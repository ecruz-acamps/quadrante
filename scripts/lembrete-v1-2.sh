#!/usr/bin/env bash
# Lembrete único (agendado em 2026-10-17 para 2026-10-24): avisa pelo Pushbird sobre a atualização v1.2
# (Evangelização: equipes e distribuição das casas). Lê o webhook do .env e remove a própria entrada do crontab.
set -euo pipefail
cd "$(dirname "$0")/.."

URL="$(grep -E '^PUSHBIRD_WEBHOOK_URL=' .env | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$URL" ] && curl -sS -m 20 -X POST "$URL" -H 'Content-Type: application/json' \
  -d '{"title":"Quadrante v1.2","subtitle":"Evangelização","message":"Lembrete: atualização v1.2 (equipes e distribuição das casas da Evangelização). Plano em app/docs/superpowers/plans/2026-10-17-evangelizacao-distribuicao-v1-2.md"}' >/dev/null

# one-shot: tira este lembrete do crontab (cron não tem ano e repetiria em 2027)
crontab -l 2>/dev/null | grep -v 'lembrete-v1-2.sh' | crontab -
