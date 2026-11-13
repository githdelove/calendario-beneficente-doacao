# Loja de Calendário 2027 (Cloudflare Pages)

## 1. Criar banco e bucket (uma vez)
    wrangler d1 create calendarios        (copie o database_id para o wrangler.toml)
    wrangler d1 execute calendarios --remote --file=schema.sql
    wrangler r2 bucket create calendarios-arquivos

## 2. Subir os arquivos privados (nomes exatos)
    wrangler r2 object put calendarios-arquivos/calendario-modelo1.pdf --file=SEU_ARQUIVO1.pdf --remote
    wrangler r2 object put calendarios-arquivos/calendario-modelo2.pdf --file=SEU_ARQUIVO2.pdf --remote
    wrangler r2 object put calendarios-arquivos/molde-a2.pdf --file=molde-a2.pdf --remote
Use os calendários em alta resolução (as imagens do site são só vitrine).

## 3. Segredos
    wrangler pages secret put DOWNLOAD_SECRET      (texto longo e aleatório)
    wrangler pages secret put MP_ACCESS_TOKEN      (token de produção do Mercado Pago)
    wrangler pages secret put MP_WEBHOOK_SECRET    (assinatura secreta do webhook, recomendado)
Sem MP_ACCESS_TOKEN o site roda em MODO DEMO: o Pix é de mentira e aprova sozinho em 8s (só para testar).

## 4. Publicar
    wrangler pages deploy public --project-name calendario-beneficente-doacao
No painel do Mercado Pago, cadastre o webhook: https://SEU-DOMINIO/api/webhook (evento "Pagamentos").

## Como funciona
- /api/checkout cria o pedido e o Pix (preço vem do servidor, não do navegador).
- /api/webhook e /api/status confirmam o pagamento direto no gateway antes de liberar.
- Só pedido pago recebe links de download assinados (1h) via /api/download, com limite de 30 baixadas.
- Trocar de gateway: edite só functions/api/_gateway.js. Preços: functions/api/_lib.js (e app.js, só visual).
