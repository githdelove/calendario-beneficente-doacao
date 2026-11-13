export const PRODUCTS = {
  modelo1: { name: "Modelo 1 - Esperança", price: 13, files: [["Calendário Modelo 1 (PDF)", "calendario-modelo1.pdf"]] },
  modelo2: { name: "Modelo 2 - Brasil mais justo", price: 13, files: [["Calendário Modelo 2 (PDF)", "calendario-modelo2.pdf"], ["Molde A2 (PDF)", "molde-a2.pdf"]] },
  combo:   { name: "Combo: Modelo 1 + Modelo 2", price: 20, files: [["Calendário Modelo 1 (PDF)", "calendario-modelo1.pdf"], ["Calendário Modelo 2 (PDF)", "calendario-modelo2.pdf"], ["Molde A2 (PDF)", "molde-a2.pdf"]] },
};
export const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function hmac(secret, data) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(data)));
}
export async function signToken(env, orderId, idx, ttlSec = 3600) {
  const p = `${orderId}.${idx}.${Math.floor(Date.now() / 1000) + ttlSec}`;
  return `${p}.${await hmac(env.DOWNLOAD_SECRET, p)}`;
}
export async function verifyToken(env, t) {
  const parts = (t || "").split(".");
  if (parts.length !== 4) return null;
  const [id, idx, exp, sig] = parts;
  const good = await hmac(env.DOWNLOAD_SECRET, `${id}.${idx}.${exp}`);
  if (good.length !== sig.length || good !== sig || Number(exp) < Date.now() / 1000) return null;
  return { id, idx: Number(idx) };
}
// Marca o pedido como pago (idempotente). Só chame depois de confirmar com o gateway.
export async function markPaid(env, orderId) {
  await env.DB.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=? AND status!='paid'").bind(Date.now(), orderId).run();
}
export async function filesFor(env, order) {
  const p = PRODUCTS[order.product];
  return Promise.all(p.files.map(async ([label], i) => ({ label, url: `/api/download?t=${await signToken(env, order.id, i)}` })));
}
