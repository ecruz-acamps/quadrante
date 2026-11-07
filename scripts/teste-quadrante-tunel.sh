#!/usr/bin/env bash
# Testa o auxiliar root do túnel (scripts/quadrante-tunel) e a regra do sudo num contêiner debian:12.
# Usa um `systemctl` FALSO (o contêiner não tem systemd) que registra os argumentos. Roda no HOST; exige Docker.
#   bash scripts/teste-quadrante-tunel.sh
set -euo pipefail

if [ "${1:-}" != "--dentro" ]; then
  RAIZ=$(cd "$(dirname "$0")/.." && pwd)
  exec docker run --rm -v "$RAIZ":/codigo:ro debian:12 bash /codigo/scripts/teste-quadrante-tunel.sh --dentro
fi

# ---------------------------------------------------------------- dentro do contêiner (root)
set +e
set -uo pipefail
FALHAS=0
ok() { printf '  OK      %s\n' "$1"; }
falhou() { printf '  FALHOU  %s\n' "$1"; FALHAS=$((FALHAS + 1)); }
conferir() { local d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else falhou "$d"; fi; }
ARQ=/etc/quadrante/cloudflared.env
TOKEN_OK=$(printf 'A%.0s' $(seq 1 60))

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null && apt-get install -y -qq sudo >/dev/null
useradd --system --create-home --shell /usr/sbin/nologin quadrante
install -m 755 -o root -g root /codigo/scripts/quadrante-tunel /usr/local/sbin/quadrante-tunel
install -m 440 -o root -g root /codigo/scripts/quadrante-sudoers /etc/sudoers.d/quadrante

# systemctl falso: registra os argumentos; is-active depende do arquivo /tmp/ativo
cat > /usr/bin/systemctl <<'FAKE'
#!/bin/bash
echo "$*" >> /tmp/systemctl.log
if [ "$1" = "is-active" ]; then [ -e /tmp/ativo ]; exit $?; fi
if [ "$1" = "enable" ]; then touch /tmp/ativo; fi
if [ "$1" = "disable" ]; then rm -f /tmp/ativo; fi
exit 0
FAKE
chmod +x /usr/bin/systemctl
T=/usr/local/sbin/quadrante-tunel

echo "== Auxiliar do túnel"
echo "$TOKEN_OK" | $T ligar; rc=$?
conferir "ligar com token válido termina com 0" test "$rc" -eq 0
conferir "cloudflared.env criado com modo 600" test "$(stat -c %a $ARQ)" = 600
conferir "cloudflared.env contém TUNNEL_TOKEN=<token>" grep -qx "TUNNEL_TOKEN=$TOKEN_OK" $ARQ
conferir "ligar habilita o serviço no boot ('enable quadrante-cloudflared')" grep -qx 'enable quadrante-cloudflared' /tmp/systemctl.log
conferir "ligar REINICIA o serviço (token novo vale mesmo com o serviço já ativo)" grep -qx 'restart quadrante-cloudflared' /tmp/systemctl.log
conferir "status → ativo" test "$($T status)" = ativo

# duas linhas: só a primeira vale; a segunda nunca é executada
rm -f $ARQ /tmp/ativo
printf '%s\n%s\n' "$TOKEN_OK" 'touch /tmp/invadido' | $T ligar
conferir "segunda linha do stdin é ignorada (não executa nada)" test ! -e /tmp/invadido
conferir "ligar com 2 linhas usa só a primeira" grep -qx "TUNNEL_TOKEN=$TOKEN_OK" $ARQ
conferir "cada ligar reinicia o serviço (2 reinícios até aqui)" test "$(grep -c '^restart quadrante-cloudflared$' /tmp/systemctl.log)" -ge 2

for ruim in "tem espaco $TOKEN_OK" ";rm -rf /" "curto123" "" "$TOKEN_OK;touch /tmp/invadido" "\$(touch /tmp/invadido)$TOKEN_OK"; do
  rm -f $ARQ
  printf '%s\n' "$ruim" | $T ligar 2>/dev/null; rc=$?
  conferir "token inválido '${ruim:0:20}' → código 2 e nada gravado" bash -c "[ $rc -eq 2 ] && [ ! -e $ARQ ] && [ ! -e /tmp/invadido ]"
done

$T desligar
conferir "desligar chamou 'disable --now quadrante-cloudflared'" grep -qx 'disable --now quadrante-cloudflared' /tmp/systemctl.log
conferir "status → inativo" test "$($T status)" = inativo
$T abrir 2>/dev/null; conferir "argumento desconhecido → código 2" test $? -eq 2
$T ligar extra 2>/dev/null </dev/null; conferir "argumento extra → código 2" test $? -eq 2

echo "== Regra do sudo"
conferir "sudoers passa no visudo -cf" visudo -cf /etc/sudoers.d/quadrante
conferir "quadrante roda 'sudo -n quadrante-tunel status'" runuser -u quadrante -- sudo -n /usr/local/sbin/quadrante-tunel status
conferir "quadrante NÃO roda outro comando via sudo" bash -c "! runuser -u quadrante -- sudo -n /bin/ls"
conferir "quadrante NÃO roda quadrante-tunel com outro argumento" bash -c "! runuser -u quadrante -- sudo -n /usr/local/sbin/quadrante-tunel abrir"
conferir "quadrante NÃO edita o auxiliar" bash -c "! runuser -u quadrante -- sh -c 'echo x >> /usr/local/sbin/quadrante-tunel'"

echo
if [ "$FALHAS" -eq 0 ]; then echo "TUDO OK"; else echo "$FALHAS verificação(ões) FALHARAM"; fi
exit "$FALHAS"
