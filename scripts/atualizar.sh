#!/usr/bin/env bash
# Atualiza o Quadrante a partir do git (chamado pelo botão "Atualizar o sistema" em Configurações).
#
# Sem derrubar o sistema: o build novo é feito em .next-novo enquanto o app segue no ar com a .next atual.
# Este script NÃO troca as pastas nem reinicia; quem faz isso é o app, quando o script termina com sucesso
# (troca .next-novo -> .next, guarda a anterior em .next-antigo e reinicia: alguns segundos fora do ar).
# A última linha do registro é sempre "== CONCLUIDO ==" ou "== FALHOU ==" (a tela usa isso para saber o estado).
set -uo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 1
mkdir -p logs

NOVO="$DIR/.next-novo"
falhou() { rm -rf "$NOVO"; echo "ERRO: $1"; echo "O sistema continua no ar com a versão anterior."; echo "== FALHOU =="; exit 1; }
passo() { echo; echo "-- $1"; }

# o app roda com NODE_ENV=production; sem limpar, o npm ci pularia as dependências de build
unset NODE_ENV

echo "== INICIADO $(date '+%Y-%m-%d %H:%M:%S') =="

# versão que está no ar (gravada no build); sem ela, vale o commit atual
RODANDO="$(cat "$DIR/.next/QUADRANTE_VERSAO" 2>/dev/null || git rev-parse HEAD)"
# build antigo sem a marca: grava agora, antes do pull, para a tela não confundir o commit baixado com o que está no ar
if [ -d "$DIR/.next" ] && [ ! -s "$DIR/.next/QUADRANTE_VERSAO" ]; then echo "$RODANDO" > "$DIR/.next/QUADRANTE_VERSAO"; fi

passo "Cópia de segurança do banco"
BANCO="$DIR/prisma/quadrante.db"
if [ -s "$BANCO" ]; then
  cp -p "$BANCO" "$BANCO.bak-antes-deploy-$(date +%Y%m%d-%H%M)" || falhou "não foi possível copiar o banco"
  echo "ok"
else
  echo "banco não encontrado em $BANCO (seguindo sem cópia)"
fi

passo "Baixando o código novo"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch -q origin "$BRANCH" || falhou "não foi possível falar com o repositório (rede ou permissão)"
git pull -q --ff-only origin "$BRANCH" || falhou "o código local tem alterações que impedem a atualização automática"
DEPOIS="$(git rev-parse HEAD)"
echo "${RODANDO:0:7} -> ${DEPOIS:0:7}"
if [ "$RODANDO" = "$DEPOIS" ]; then
  echo "Já estava na versão mais recente."
  echo "== CONCLUIDO =="
  exit 0
fi
git log --format='  • %s' "$RODANDO..$DEPOIS" 2>/dev/null | head -n 30

# só mexe em node_modules e no cliente do Prisma quando mudou algo deles: o app no ar usa esses arquivos
mudou() { ! git diff --quiet "$RODANDO" "$DEPOIS" -- "$@" 2>/dev/null; }

if mudou package-lock.json; then
  passo "Instalando dependências (mudaram nesta versão)"
  npm ci --no-audit --no-fund || falhou "npm ci falhou"
  GERAR=1
else
  passo "Dependências: sem mudança"
  GERAR=0
fi

passo "Preparando o banco"
if [ "$GERAR" = 1 ] || mudou prisma/schema.prisma; then
  npx prisma generate || falhou "prisma generate falhou"
fi
npx prisma migrate deploy || falhou "as migrações do banco falharam"

passo "Compilando a versão nova (alguns minutos; o sistema continua no ar)"
rm -rf "$NOVO"
QUADRANTE_DIST_DIR=.next-novo npm run build || falhou "o build falhou"
# o Next pode reescrever o tsconfig ao compilar em outra pasta; volta ao do git para não travar o próximo pull
git checkout -q -- tsconfig.json 2>/dev/null || true
[ -s "$NOVO/BUILD_ID" ] || falhou "o build não gerou a pasta esperada"
echo "$DEPOIS" > "$NOVO/QUADRANTE_VERSAO"

echo
echo "Versão nova pronta. Trocando e reiniciando (alguns segundos)."
echo "== CONCLUIDO =="
