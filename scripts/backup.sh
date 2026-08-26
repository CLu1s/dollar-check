#!/usr/bin/env bash
# ============================================
# Dollar Check Bot - Respaldo del volumen SQLite
# ============================================
#   bash scripts/backup.sh [directorio_destino]   (default: ./backups)
set -euo pipefail

cd "$(dirname "$0")/.."
DEST="${1:-./backups}"
VOLUME="dollar-check-data"
STAMP="$(date +%Y%m%d-%H%M%S)"

docker volume inspect "$VOLUME" >/dev/null 2>&1 || {
  echo "ERROR: no existe el volumen $VOLUME" >&2; exit 1; }

mkdir -p "$DEST"

# Checkpoint del WAL antes de copiar, si el bot esta corriendo: garantiza que
# el .db incluya todo lo escrito y no dependa de los archivos -wal/-shm.
if [ "$(docker inspect -f '{{.State.Running}}' dollar-check 2>/dev/null)" = "true" ]; then
  docker compose exec -T bot bun -e \
    'const{Database}=require("bun:sqlite");const d=new Database(process.env.DB_PATH);d.run("PRAGMA wal_checkpoint(TRUNCATE)");d.close()' \
    >/dev/null 2>&1 && echo "WAL checkpointeado"
fi

OUT="$DEST/dollar-check-$STAMP.tar.gz"
docker run --rm -v "$VOLUME":/data:ro -v "$(cd "$DEST" && pwd)":/backup alpine \
  tar czf "/backup/$(basename "$OUT")" -C /data .

echo "Respaldo: $OUT ($(du -h "$OUT" | cut -f1))"

# Retencion: conserva los ultimos 14.
ls -1t "$DEST"/dollar-check-*.tar.gz 2>/dev/null | tail -n +15 | while read -r old; do
  rm -f "$old" && echo "purgado: $old"
done
