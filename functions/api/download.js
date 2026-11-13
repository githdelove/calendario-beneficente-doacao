import { PRODUCTS, json, verifyToken } from "./_lib.js";
const MAX_DOWNLOADS = 30;
export async function onRequestGet({ request, env }) {
  const t = await verifyToken(env, new URL(request.url).searchParams.get("t"));
  if (!t) return json({ error: "Link inválido ou expirado. Volte ao site e abra 'Ver meu pedido'." }, 403);
  const o = await env.DB.prepare("SELECT * FROM orders WHERE id=? AND status='paid'").bind(t.id).first();
  const f = o && PRODUCTS[o.product].files[t.idx];
  if (!f) return json({ error: "Pedido não pago ou arquivo inexistente" }, 403);
  if (o.downloads >= MAX_DOWNLOADS) return json({ error: "Limite de downloads atingido. Fale com o suporte." }, 429);
  const obj = await env.FILES.get(f[1]);
  if (!obj) return json({ error: "Arquivo indisponível. Fale com o suporte." }, 404);
  await env.DB.prepare("UPDATE orders SET downloads=downloads+1 WHERE id=?").bind(o.id).run();
  return new Response(obj.body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${f[1]}"`, "Cache-Control": "private, no-store" } });
}
