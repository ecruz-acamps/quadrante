#!/usr/bin/env bash
# Atualiza o Quadrante a partir do git (chamado pelo botão "Atualizar o sistema" em Configurações).
# Não reinicia o app: o reinício é um passo à parte, pedido na tela depois que este script termina com sucesso.
# A última linha do registro é sempre "== CONCLUIDO ==" ou "== FALHOU ==" (a tela usa isso para saber o estado).
set -uo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR" || exit 1
mkdir -p logs

falhou() { echo "ERRO: $1"; echo "== FALHOU =="; exit 1; }
passo() { echo; echo "-- $1"; }

# o app roda com NODE_ENV=production; sem limpar, o npm ci pularia as dependências de build
unset NODE_ENV

echo "== INICIADO $(date '+%Y-%m-%d %H:%M:%S') =="

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
ANTES="$(git rev-parse --short HEAD)"
git fetch -q origin "$BRANCH" || falhou "não foi possível falar com o repositório (rede ou permissão)"
git pull -q --ff-only origin "$BRANCH" || falhou "o código local tem alterações que impedem a atualização automática"
DEPOIS="$(git rev-parse --short HEAD)"
echo "$ANTES -> $DEPOIS"
if [ "$ANTES" = "$DEPOIS" ]; then
  echo "Já estava na versão mais recente."
  echo "== CONCLUIDO =="
  exit 0
fi

passo "Instalando dependências"
npm ci --no-audit --no-fund || falhou "npm ci falhou"

passo "Preparando o banco"
npx prisma generate || falhou "prisma generate falhou"
npx prisma migrate deploy || falhou "as migrações do banco falharam"

passo "Compilando o sistema (alguns minutos)"
npm run build || falhou "o build falhou"

echo
echo "== CONCLUIDO =="
