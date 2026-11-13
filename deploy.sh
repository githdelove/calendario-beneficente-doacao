#!/usr/bin/env bash
# Deploy de primeira configuração + publicação do site no Cloudflare Pages.
# Execute na pasta do projeto: bash deploy.sh
# O script solicitará login Cloudflare no navegador e, opcionalmente, credenciais do gateway.
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

export MSYS_NO_PATHCONV=1
PROJECT="calendario-beneficente-doacao"
DB_NAME="calendarios"
BUCKET="calendarios-arquivos"
WRANGLER=(npx --yes wrangler@4)

fail() { echo "ERRO: $*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail "Node.js não encontrado. Instale Node.js 20+ e tente novamente."
[ -f wrangler.toml ] || fail "Execute este comando na pasta raiz do projeto (wrangler.toml não encontrado)."
[ -f schema.sql ] || fail "schema.sql não encontrado."
for f in calendario-modelo1.pdf calendario-modelo2.pdf molde-a2.pdf; do
  [ -s "arquivos/$f" ] || fail "Arquivo ausente ou vazio: arquivos/$f"
done

echo "==> Validando instalação do Wrangler"
"${WRANGLER[@]}" --version >/dev/null
echo "==> Faça login/autorize o Cloudflare quando solicitado"
"${WRANGLER[@]}" login

# Cria o D1 apenas quando ainda não existir e grava seu database_id no wrangler.toml.
echo "==> Configurando banco D1: $DB_NAME"
D1_LIST=$("${WRANGLER[@]}" d1 list --json)
DB_ID=$(printf '%s' "$D1_LIST" | DB_NAME="$DB_NAME" node -e '
 let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  try { const a=JSON.parse(s); const x=(Array.isArray(a)?a:[]).find(v=>v.name===process.env.DB_NAME); process.stdout.write(x?.uuid||x?.database_id||x?.id||""); }
  catch(e) { process.stderr.write("Não foi possível interpretar a lista D1 do Wrangler.\n"); process.exit(2); }
 });')
if [ -z "$DB_ID" ]; then
  "${WRANGLER[@]}" d1 create "$DB_NAME"
  D1_LIST=$("${WRANGLER[@]}" d1 list --json)
  DB_ID=$(printf '%s' "$D1_LIST" | DB_NAME="$DB_NAME" node -e '
   let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
    const a=JSON.parse(s); const x=(Array.isArray(a)?a:[]).find(v=>v.name===process.env.DB_NAME);
    process.stdout.write(x?.uuid||x?.database_id||x?.id||"");
   });')
fi
[ -n "$DB_ID" ] || fail "Não consegui obter o ID do D1 '$DB_NAME'. Verifique a conta Cloudflare e tente novamente."
DB_ID="$DB_ID" node -e '
 const fs=require("fs"), p="wrangler.toml"; let s=fs.readFileSync(p,"utf8");
 if (!/database_id\s*=\s*"[^"]+"/.test(s)) throw Error("Linha database_id não encontrada no wrangler.toml");
 s=s.replace(/database_id\s*=\s*"[^"]+"/, `database_id = "${process.env.DB_ID}"`); fs.writeFileSync(p,s);
'
"${WRANGLER[@]}" d1 execute "$DB_NAME" --remote --yes --file=schema.sql

echo "==> Configurando bucket R2 e PDFs privados"
if ! "${WRANGLER[@]}" r2 bucket create "$BUCKET"; then
  echo "Bucket já existente ou indisponível; vou tentar enviar os arquivos e reportar erro se necessário."
fi
for f in arquivos/*.pdf; do
  [ -s "$f" ] || fail "PDF vazio: $f"
  "${WRANGLER[@]}" r2 object put "$BUCKET/$(basename "$f")" --remote --file="$f"
done

echo "==> Configurando projeto Cloudflare Pages"
if ! "${WRANGLER[@]}" pages project create "$PROJECT" --production-branch main; then
  echo "Projeto Pages já existente ou já configurado; continuando para a publicação."
fi

echo "==> Configurando segredo interno para links de download"
# Mantém a mesma chave entre publicações; não a envie para o Git nem a compartilhe.
if [ ! -s .download_secret ]; then
  node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))' > .download_secret
  chmod 600 .download_secret
fi
"${WRANGLER[@]}" pages secret put DOWNLOAD_SECRET --project-name "$PROJECT" < .download_secret

# PONTO DE CONFIGURAÇÃO DO GATEWAY:
# Cole aqui, quando solicitado, o Access Token de produção da sua API de pagamento.
# Este projeto vem com adaptador Mercado Pago em functions/api/_gateway.js.
# Para outro gateway, substitua createPix/getPayment/parseWebhook nesse arquivo;
# mantenha os segredos fora do código-fonte.
read -r -s -p "Token de produção da API do gateway (Enter para deixar em modo DEMO): " MP_TOKEN; echo
if [ -n "$MP_TOKEN" ]; then
  printf '%s' "$MP_TOKEN" | "${WRANGLER[@]}" pages secret put MP_ACCESS_TOKEN --project-name "$PROJECT"
  read -r -s -p "Segredo de assinatura do webhook (Enter para pular): " WEBHOOK_SECRET; echo
  if [ -n "$WEBHOOK_SECRET" ]; then
    printf '%s' "$WEBHOOK_SECRET" | "${WRANGLER[@]}" pages secret put MP_WEBHOOK_SECRET --project-name "$PROJECT"
  fi
else
  echo "ATENÇÃO: sem token, o checkout fica em MODO DEMO e não recebe pagamentos reais."
fi

echo "==> Publicando https://${PROJECT}.pages.dev"
"${WRANGLER[@]}" pages deploy public --project-name "$PROJECT" --branch main

echo
echo "Deploy concluído: https://${PROJECT}.pages.dev"
echo "Webhook Mercado Pago (configure no painel do gateway): https://${PROJECT}.pages.dev/api/webhook"
echo "Para publicar novamente, execute: bash deploy.sh"
