#!/usr/bin/env bash
# ============================================================================
#  Instalador do Quadrante — um único comando, num Debian 12 (ou Ubuntu) limpo:
#
#    curl -fsSL https://raw.githubusercontent.com/ecruz-acamps/quadrante/main/install.sh | sudo bash
#
#  Rodar de novo ATUALIZA o sistema: não troca segredos nem apaga o banco.
#  Variáveis opcionais: QUADRANTE_DIR (/opt/quadrante), QUADRANTE_REPO, QUADRANTE_BRANCH (main)
# ============================================================================
set -euo pipefail

DIR="${QUADRANTE_DIR:-/opt/quadrante}"
REPO="${QUADRANTE_REPO:-https://github.com/ecruz-acamps/quadrante.git}"
BRANCH="${QUADRANTE_BRANCH:-main}"
USUARIO=quadrante
PORTA=3008
LOG=/var/log/quadrante/instalacao.log

verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
etapa() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
aviso() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
erro() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || erro "Rode como administrador: curl -fsSL …/install.sh | sudo bash"
command -v apt-get >/dev/null || erro "Este instalador é para Debian/Ubuntu (usa apt-get)."

# roda um comando como o usuário do sistema, com a casa dele (npm e pm2 guardam dados lá)
como_app() { runuser -u "$USUARIO" -- env HOME="/home/$USUARIO" "$@"; }

cat <<'BANNER'

  ┌──────────────────────────────────────────────────┐
  │   Quadrante · Movimento Campista                  │
  │   Instalação                                      │
  └──────────────────────────────────────────────────┘
BANNER

etapa "1/8 · Programas do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates gnupg openssl tar cron sudo >/dev/null
verde "✓ git, curl, gpg, cron e sudo prontos"

etapa "2/8 · Node 22 e pm2"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" != 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
fi
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null 2>&1
verde "✓ Node $(node -v) e pm2 $(pm2 -v 2>/dev/null | tail -n 1)"

etapa "3/8 · Usuário do sistema"
id "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$USUARIO" --shell /usr/sbin/nologin "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" /var/log/quadrante
: >> "$LOG"
verde "✓ usuário '$USUARIO' e /var/log/quadrante"

etapa "4/8 · Código em $DIR"
ATUALIZANDO=""
if [ -d "$DIR/.git" ]; then
  ATUALIZANDO=1
  BANCO="$DIR/prisma/quadrante.db"
  if [ -s "$BANCO" ]; then
    cp -p "$BANCO" "$BANCO.bak-antes-deploy-$(date +%Y%m%d)"
    echo "Cópia de segurança do banco: $BANCO.bak-antes-deploy-$(date +%Y%m%d)"
  fi
  como_app git -C "$DIR" fetch -q origin "$BRANCH"
  como_app git -C "$DIR" checkout -q "$BRANCH"
  como_app git -C "$DIR" pull -q --ff-only origin "$BRANCH"
else
  mkdir -p "$DIR"
  chown "$USUARIO:$USUARIO" "$DIR"
  como_app git clone -q --branch "$BRANCH" "$REPO" "$DIR"
fi
verde "✓ código atualizado ($(como_app git -C "$DIR" rev-parse --short HEAD))"

etapa "5/8 · Configuração (.env)"
if [ ! -f "$DIR/.env" ]; then
  H=$(openssl rand -hex 6 | tr 'a-f' 'A-F')
  (
    umask 077
    {
      echo 'DATABASE_URL="file:./quadrante.db"'
      echo "AUTH_SECRET=\"$(openssl rand -hex 32)\""
      echo "RESTAURACAO_CODIGO=\"${H:0:4}-${H:4:4}-${H:8:4}\""
      # acesso por HTTP na rede local: sem isto o navegador descarta o cookie de login. Ligar o túnel remove esta linha.
      echo 'COOKIE_SECURE="false"'
    } > "$DIR/.env"
  )
  chown "$USUARIO:$USUARIO" "$DIR/.env"
  chmod 600 "$DIR/.env"
  verde "✓ .env criado"
else
  verde "✓ .env já existe (mantido como está)"
fi

etapa "6/8 · Dependências, banco e build (alguns minutos; detalhes em $LOG)"
if ! como_app bash -c "cd '$DIR' && npm ci --no-audit --no-fund && npx prisma generate && npx prisma migrate deploy && npm run build" >> "$LOG" 2>&1; then
  tail -n 40 "$LOG"
  erro "Falha ao preparar o sistema. O registro completo está em $LOG"
fi
verde "✓ dependências, banco e build prontos"

etapa "7/8 · Iniciando o sistema (pm2, porta $PORTA)"
como_app pm2 startOrReload "$DIR/ecosystem.config.cjs" --update-env >> "$LOG" 2>&1
como_app pm2 save >> "$LOG" 2>&1
if env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USUARIO" --hp "/home/$USUARIO" >> "$LOG" 2>&1; then
  verde "✓ o sistema volta sozinho após reiniciar a máquina"
else
  aviso "Não foi possível ativar o início automático (pm2 startup). Sem systemd isto é esperado; no servidor real rode: sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u $USUARIO --hp /home/$USUARIO"
fi

etapa "8/8 · Agendamento dos backups (cron)"
BLOCO=$(cat <<CRON
# >>> quadrante >>>
PATH=/usr/bin:/bin
0 3 * * * grep -q '^BACKUP_PASSPHRASE=' $DIR/.env && cd $DIR && ./node_modules/.bin/tsx scripts/backup-to-drive.ts >> /var/log/quadrante/backup.log 2>&1
0 9 * * * grep -q '^BACKUP_PASSPHRASE=' $DIR/.env && cd $DIR && ./node_modules/.bin/tsx scripts/verificar-backup.ts >> /var/log/quadrante/backup.log 2>&1
# <<< quadrante <<<
CRON
)
ATUAL=$(crontab -u "$USUARIO" -l 2>/dev/null | sed '/# >>> quadrante >>>/,/# <<< quadrante <<</d' || true)
printf '%s\n%s\n' "$ATUAL" "$BLOCO" | crontab -u "$USUARIO" -
verde "✓ backup às 03:00 e alarme de silêncio às 09:00 (só agem depois que o .env tiver BACKUP_PASSPHRASE)"

FUSO=$(cat /etc/timezone 2>/dev/null || timedatectl show -p Timezone --value 2>/dev/null || true)
[ "$FUSO" = "America/Sao_Paulo" ] || aviso "O fuso do servidor é '${FUSO:-desconhecido}'. Os horários do cron seguem o relógio do servidor; para o horário de Brasília: sudo timedatectl set-timezone America/Sao_Paulo"

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
CODIGO=$(grep '^RESTAURACAO_CODIGO=' "$DIR/.env" 2>/dev/null | cut -d'"' -f2 || true)
echo
echo "════════════════════════════════════════════════════════════"
if [ -n "$CODIGO" ]; then
  echo "  ✓ Quadrante instalado. Abra no navegador (rede local):"
  echo "      http://${IP:-IP-DO-SERVIDOR}:$PORTA/restaurar"
  echo "    Código de restauração (uso único): $CODIGO"
  echo "    Envie o backup do Google Drive e a senha dele (BACKUP_PASSPHRASE)."
  echo "    Depois de restaurar, ligue o acesso pela internet em Configurações."
else
  echo "  ✓ Quadrante atualizado: http://${IP:-IP-DO-SERVIDOR}:$PORTA"
fi
echo "════════════════════════════════════════════════════════════"
