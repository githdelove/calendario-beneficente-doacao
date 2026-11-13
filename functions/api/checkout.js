import { PRODUCTS, json } from "./_lib.js";
import { createPix } from "./_gateway.js";
export async function onRequestPost({ request, env }) {
  let b; try { b = await request.json(); } catch { return json({ error: "Requisição inválida" }, 400); }
  const p = PRODUCTS[b.product], name = String(b.name || "").trim().slice(0, 80), email = String(b.email || "").trim().slice(0, 120);
  if (!p) return json({ error: "Produto inválido" }, 400);
  if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Nome ou e-mail inválido" }, 400);
  const orderId = crypto.randomUUID();
  try {
    const pix = await createPix(env, { orderId, amount: p.price, description: p.name, email, name, origin: new URL(request.url).origin });
    await env.DB.prepare("INSERT INTO orders (id,product,name,email,amount,status,gateway_id,created_at,downloads) VALUES (?,?,?,?,?,'pending',?,?,0)")
      .bind(orderId, b.product, name, email, p.price, pix.gatewayId, Date.now()).run();
    return json({ orderId, copiaECola: pix.copiaECola, qrBase64: pix.qrBase64, amount: p.price });
  } catch (e) { return json({ error: "Não foi possível gerar o Pix agora. Tente novamente." }, 502); }
}
