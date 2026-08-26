#!/usr/bin/env bash
# ============================================
# Dollar Check Bot - Restaurar el volumen desde un respaldo
# ============================================
#   bash scripts/restore.sh backups/dollar-check-20260826-131600.tar.gz
set -euo pipefail

# Resolver la ruta ANTES del cd, para aceptar rutas relativas al cwd actual.
ARCHIVE="${1:-}"
[ -n "$ARCHIVE" ] || { echo "Uso: bash scripts/restore.sh <archivo.tar.gz>" >&2; exit 1; }
[ -f "$ARCHIVE" ]  || { echo "ERROR: no existe $ARCHIVE" >&2; exit 1; }
ARCHIVE="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"

cd "$(dirname "$0")/.."
VOLUME="dollar-check-data"

echo "Esto SOBREESCRIBE el contenido de $VOLUME con $ARCHIVE"
printf "Escribe 'si' para continuar: "
read -r answer
[ "$answer" = "si" ] || { echo "cancelado"; exit 1; }

# El bot tiene que estar detenido: restaurar bajo un escritor activo corrompe
# el SQLite.
docker compose stop bot 2>/dev/null || true

docker run --rm -v "$VOLUME":/data \
  -v "$(cd "$(dirname "$ARCHIVE")" && pwd)":/backup:ro alpine sh -c "
    rm -rf /data/* &&
    tar xzf /backup/$(basename "$ARCHIVE") -C /data &&
    chown -R 1000:1000 /data"

echo "Restaurado. Arrancando el bot..."
docker compose up -d bot
