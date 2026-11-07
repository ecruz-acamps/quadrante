#!/usr/bin/env bash
# Testa o install.sh (e a restauração) num contêiner debian:12 limpo. Roda no HOST; exige Docker.
# Usa o que está COMMITADO na branch atual (o instalador clona o repositório): faça commit antes.
#
#   bash scripts/teste-instalador.sh                 # instalação + restauração
#   FASES="instalacao" bash scripts/teste-instalador.sh
set -euo pipefail

if [ "${1:-}" != "--dentro" ]; then
  RAIZ=$(cd "$(dirname "$0")/.." && pwd)
  BRANCH=$(git -C "$RAIZ" branch --show-current)
  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT
  if [ -n "$(git -C "$RAIZ" status --porcelain -- . ':!docs')" ]; then
    echo "⚠ há alterações não commitadas: o teste usa só o que está commitado em '$BRANCH'."
  fi
  git clone -q --bare "$RAIZ" "$TMP/fonte.git"
  exec docker run --rm \
    -v "$RAIZ":/codigo:ro -v "$TMP/fonte.git":/fonte.git:ro \
    -e QUADRANTE_REPO=/fonte.git -e QUADRANTE_BRANCH="$BRANCH" \
    -e FASES="${FASES:-instalacao restauracao}" \
    debian:12 bash /codigo/scripts/teste-instalador.sh --dentro
fi

# ---------------------------------------------------------------- dentro do contêiner (root, sem systemd)
set +e
set -uo pipefail
FALHAS=0
DIR=/opt/quadrante
ok() { printf '  OK      %s\n' "$1"; }
falhou() { printf '  FALHOU  %s\n' "$1"; FALHAS=$((FALHAS + 1)); }
conferir() { local d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else falhou "$d"; fi; }
aguardar_app() { for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3008/login && return 0; sleep 2; done; return 1; }
aguardar_codigo() { for _ in $(seq 1 45); do [ "$(http "$1")" = "$2" ] && return 0; sleep 2; done; return 1; }
http() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

printf '[safe]\n\tdirectory = *\n' > /etc/gitconfig   # o repositório de teste é de outro dono

fase_instalacao() {
  echo "== Instalação"
  bash /codigo/install.sh > /tmp/inst1.log 2>&1; local rc=$?
  tail -n 15 /tmp/inst1.log
  conferir "1ª execução termina com código 0" test "$rc" -eq 0
  conferir "saída mostra /restaurar" grep -q '/restaurar' /tmp/inst1.log
  conferir "app respondeu na porta 3008" aguardar_app
  conferir "/restaurar responde 200" test "$(http http://localhost:3008/restaurar)" = 200
  conferir ".env tem AUTH_SECRET" grep -q '^AUTH_SECRET=' "$DIR/.env"
  conferir ".env tem RESTAURACAO_CODIGO" grep -q '^RESTAURACAO_CODIGO=' "$DIR/.env"
  conferir ".env tem COOKIE_SECURE=false (login por HTTP na rede local)" grep -q '^COOKIE_SECURE="false"' "$DIR/.env"
  conferir ".env com modo 600" test "$(stat -c %a "$DIR/.env")" = 600
  conferir "pm2 roda como usuário quadrante" bash -c "runuser -u quadrante -- pm2 pid quadrante | grep -Eq '^[1-9]'"

  local segredo; segredo=$(grep '^AUTH_SECRET=' "$DIR/.env")
  bash /codigo/install.sh > /tmp/inst2.log 2>&1; local rc2=$?
  conferir "2ª execução termina com código 0" test "$rc2" -eq 0
  conferir "AUTH_SECRET não mudou na 2ª execução" test -n "$segredo" -a "$segredo" = "$(grep '^AUTH_SECRET=' "$DIR/.env")"
  conferir "cron de backup aparece 1 vez" test "$(crontab -u quadrante -l | grep -c 'backup-to-drive')" = 1
  conferir "bloco do cron marcado 1 vez" test "$(crontab -u quadrante -l | grep -c '>>> quadrante')" = 1
  conferir "app continua respondendo após a 2ª execução" aguardar_app
}

fase_restauracao() {
  echo "== Restauração"
  local senha="senha-do-backup-de-teste-123" codigo url arq resp
  url=http://localhost:3008/api/restaurar
  codigo=$(grep '^RESTAURACAO_CODIGO=' "$DIR/.env" | cut -d'"' -f2)
  install -d -o quadrante -g quadrante /tmp/qd-backup
  arq=$(runuser -u quadrante -- env HOME=/home/quadrante bash -c "cd $DIR && ./node_modules/.bin/tsx scripts/gerar-backup-teste.ts /tmp/qd-backup '$senha'" | tail -n 1)
  conferir "backup sintético gerado" test -s "$arq"
  echo "isto não é um backup" > /tmp/lixo.gpg

  conferir "código errado → 403" test "$(http -F codigo=ERRADO -F senha="$senha" -F arquivo=@"$arq" $url)" = 403
  conferir "senha errada → 400" test "$(http -F codigo="$codigo" -F senha=errada-errada-123 -F arquivo=@"$arq" $url)" = 400
  conferir "arquivo que não é backup → 400" test "$(http -F codigo="$codigo" -F senha="$senha" -F arquivo=@/tmp/lixo.gpg $url)" = 400
  resp=$(curl -s -F codigo="$codigo" -F senha="$senha" -F arquivo=@"$arq" $url)
  conferir "restauração válida → ok:true" bash -c "echo '$resp' | grep -q '\"ok\":true'"

  conferir "/restaurar passa a responder 404 depois do reinício" aguardar_codigo http://localhost:3008/restaurar 404
  conferir "/login responde 200 (sem redirecionar para /restaurar)" test "$(http http://localhost:3008/login)" = 200
  conferir ".env restaurado traz o AUTH_SECRET do backup" grep -q '^AUTH_SECRET="segredo-do-backup"' "$DIR/.env"
  conferir ".env restaurado mantém COOKIE_SECURE=false" grep -q '^COOKIE_SECURE="false"' "$DIR/.env"
  cat > /tmp/conta-usuarios.js <<'JS'
const { PrismaClient } = require("/opt/quadrante/node_modules/@prisma/client");
const p = new PrismaClient();
p.usuario.count().then((n) => { console.log(n); return p.$disconnect(); });
JS
  conferir "banco restaurado tem o usuário do backup" bash -c "cd $DIR && runuser -u quadrante -- env HOME=/home/quadrante node /tmp/conta-usuarios.js | grep -qx 1"
  conferir "nova restauração → 404" test "$(http -F codigo="$codigo" -F senha="$senha" -F arquivo=@"$arq" $url)" = 404
}

for f in $FASES; do "fase_$f"; done
echo
if [ "$FALHAS" -eq 0 ]; then echo "TUDO OK"; else echo "$FALHAS verificação(ões) FALHARAM"; fi
exit "$FALHAS"
