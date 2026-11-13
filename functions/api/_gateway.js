// Adaptador do gateway. Padrão: Mercado Pago (Pix). Para outro gateway, troque só createPix/getPayment/parseWebhook.
// Sem MP_ACCESS_TOKEN o sistema roda em MODO DEMO (aprova sozinho após 8s) para você testar o fluxo.
const MP = "https://api.mercadopago.com";
export const isDemo = (env) => !env.MP_ACCESS_TOKEN;

export async function createPix(env, { orderId, amount, description, email, name, origin }) {
  if (isDemo(env)) return { gatewayId: "demo-" + orderId, copiaECola: "00020126DEMO-PIX-" + orderId, qrBase64: "" };
  const [first, ...rest] = name.split(" ");
  const r = await fetch(`${MP}/v1/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", "X-Idempotency-Key": orderId },
    body: JSON.stringify({
      transaction_amount: amount, description, payment_method_id: "pix", external_reference: orderId,
      notification_url: `${origin}/api/webhook`,
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString().replace("Z", "-00:00"),
      payer: { email, first_name: first, last_name: rest.join(" ") || "-" },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Gateway: " + (j.message || r.status));
  const t = j.point_of_interaction.transaction_data;
  return { gatewayId: String(j.id), copiaECola: t.qr_code, qrBase64: t.qr_code_base64 };
}

// Consulta o pagamento direto no gateway (fonte da verdade). Retorna { approved, orderId, amount }.
export async function getPayment(env, gatewayId, order) {
  if (isDemo(env)) return { approved: Date.now() - order.created_at > 8000, orderId: order.id, amount: order.amount };
  const r = await fetch(`${MP}/v1/payments/${gatewayId}`, { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } });
  if (!r.ok) return { approved: false };
  const j = await r.json();
  return { approved: j.status === "approved", orderId: j.external_reference, amount: j.transaction_amount };
}

// Valida a assinatura do webhook (se MP_WEBHOOK_SECRET estiver configurado) e devolve o id do pagamento.
export async function parseWebhook(env, request) {
  const url = new URL(request.url);
  let body = {}; try { body = await request.json(); } catch {}
  const id = url.searchParams.get("data.id") || body?.data?.id;
  if (!id) return null;
  if (env.MP_WEBHOOK_SECRET) {
    const sig = request.headers.get("x-signature") || "", reqId = request.headers.get("x-request-id") || "";
    const ts = /ts=([^,]+)/.exec(sig)?.[1], v1 = /v1=([^,]+)/.exec(sig)?.[1];
    if (!ts || !v1) return null;
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.MP_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`id:${String(id).toLowerCase()};request-id:${reqId};ts:${ts};`));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== v1) return null;
  }
  return String(id);
}
