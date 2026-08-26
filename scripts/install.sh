#!/usr/bin/env bash
# ============================================
# Dollar Check Bot - Primera instalacion en un VPS Linux
# ============================================
# Idempotente: se puede volver a correr sin romper nada.
#   bash scripts/install.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[0;32mok\033[0m %s\n' "$*"; }
die()  { printf '\n\033[0;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

say "1/5  Verificando Docker"
command -v docker >/dev/null || die "Docker no esta instalado. Instalalo con: curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || die "Falta el plugin 'docker compose' (v2)."
docker info >/dev/null 2>&1 || die "El daemon de Docker no responde. Prueba: sudo systemctl start docker
Si tienes que usar sudo para todo, agregate al grupo docker:
  sudo usermod -aG docker \$USER   # y vuelve a entrar por SSH"
ok "docker $(docker version -f '{{.Server.Version}}') + compose $(docker compose version --short)"

say "2/5  Verificando configuracion"
if [ ! -f .env ]; then
  cp .env.example .env
  chmod 600 .env
  die "Se creo .env a partir del ejemplo.
Llenalo con tus credenciales reales y vuelve a correr este script:
  nano $ROOT/.env

Necesitas: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, OXR_APP_ID"
fi
chmod 600 .env
missing=""
for key in TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID OXR_APP_ID; do
  value="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- || true)"
  case "$value" in
    ""|*your_*_here) missing="$missing $key" ;;
  esac
done
[ -z "$missing" ] || die "Faltan valores reales en .env:$missing"
ok ".env completo (permisos 600)"

say "3/5  Construyendo la imagen"
docker compose build
ok "imagen dollar-check:latest lista"

say "4/5  Arrancando el contenedor"
docker compose up -d
ok "contenedor arriba"

say "5/5  Esperando el primer poll de OXR"
for _ in $(seq 1 60); do
  if docker compose logs bot 2>/dev/null | grep -qE '\[Exchange\] USD/MXN'; then
    ok "$(docker compose logs bot 2>/dev/null | grep '\[Exchange\] USD/MXN' | tail -1 | sed 's/^[^|]*| //')"
    break
  fi
  if docker compose logs bot 2>/dev/null | grep -qiE 'Missing required environment|error 40[19]'; then
    docker compose logs bot | tail -20
    die "El bot arranco con error. Revisa .env"
  fi
  sleep 2
done

# ¿La base viene vacia? Entonces hay que sembrar historico.
rows="$(docker compose exec -T bot bun -e \
  'const{Database}=require("bun:sqlite");const d=new Database(process.env.DB_PATH,{readonly:true});console.log(d.query("SELECT COUNT(*) c FROM exchange_rates").get().c)' \
  2>/dev/null | tr -dc '0-9')"

cat <<BANNER

────────────────────────────────────────────────────────
 Instalacion lista.  Tasas en la base: ${rows:-0}
────────────────────────────────────────────────────────
BANNER

if [ "${rows:-0}" -lt 20 ]; then
  cat <<'NEXT'
 SIGUIENTE PASO - sembrar el historico:

   Abre Telegram y mandale al bot:
       /seed 30

   Descarga 30 dias de tasas historicas de OXR (~15 seg).
   Sin esto, /status y /analyze no tienen contexto: las medias
   moviles de 7 y 30 dias necesitan historia para significar algo.

   Cuidado con la cuota: el plan gratuito de OXR da 1000 llamadas
   al mes y el polling horario ya consume ~720. /seed 30 cabe de
   sobra; /seed 365 te pasa del limite.

   Luego confirma con:  /status
NEXT
else
  echo " La base ya trae historico. Confirma con /status en Telegram."
fi

cat <<'CMDS'

 Comandos utiles:
   docker compose logs -f bot     ver logs
   docker compose ps              estado y health
   bash scripts/backup.sh         respaldar la base
   docker compose restart bot     reiniciar

CMDS
