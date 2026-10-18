#!/usr/bin/env bash
# Lembrete único (agendado em 2026-10-17 para 2026-10-18): ler o plano da v1.2 (Evangelização).
# Lê o webhook do .env e remove a própria entrada do crontab.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="$(grep -E '^PUSHBIRD_WEBHOOK_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$URL" ] && curl -sS -m 20 -X POST "$URL" -H 'Content-Type: application/json' \
  -d '{"title":"Quadrante v1.2","subtitle":"Ler o plano","message":"Hoje: ler o plano da Evangelização (equipes e distribuição das casas) em app/docs/superpowers/plans/2026-10-17-evangelizacao-distribuicao-v1-2.md e escolher a execução (subagentes ou nativa)."}' >/dev/null

# one-shot: cron não tem ano e repetiria em 2027
crontab -l 2>/dev/null | grep -v 'lembrete-ler-plano-v1-2.sh' | crontab -
