import { json, markPaid } from "./_lib.js";
import { parseWebhook, getPayment } from "./_gateway.js";
export async function onRequestPost({ request, env }) {
  const gid = await parseWebhook(env, request);
  if (!gid) return json({ ok: false }, 401);
  const order = await env.DB.prepare("SELECT * FROM orders WHERE gateway_id=?").bind(gid).first();
  if (!order) return json({ ok: true }); // evento de outro pagamento: ignora
  const pay = await getPayment(env, gid, order); // confirma direto no gateway
  if (pay.approved && pay.orderId === order.id && Number(pay.amount) === Number(order.amount)) await markPaid(env, order.id);
  return json({ ok: true });
}
