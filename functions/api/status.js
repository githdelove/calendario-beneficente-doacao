import { json, markPaid, filesFor } from "./_lib.js";
import { getPayment } from "./_gateway.js";
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (!o) return json({ status: "not_found" }, 404);
  let status = o.status;
  if (status === "pending") {
    if (Date.now() - o.created_at > 35 * 60 * 1000) return json({ status: "expired" });
    const pay = await getPayment(env, o.gateway_id, o); // plano B caso o webhook atrase
    if (pay.approved && pay.orderId === o.id && Number(pay.amount) === Number(o.amount)) { await markPaid(env, o.id); status = "paid"; }
  }
  return status === "paid" ? json({ status, files: await filesFor(env, o) }) : json({ status });
}
