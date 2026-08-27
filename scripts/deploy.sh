#!/usr/bin/env bash
# ============================================
# Dollar Check Bot - Deploy al VPS via git
# ============================================
# Corre esto DESDE TU MAC. Empuja main a GitHub y le dice al VPS que jale
# y reconstruya. Los datos viven en un named volume, no se tocan.
#
#   bash scripts/deploy.sh
#   VPS_HOST=otro.host bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

VPS_USER="${VPS_USER:-luis}"
VPS_HOST="${VPS_HOST:-46.225.30.60}"
VPS_DIR="${VPS_DIR:-~/projects/dollar-check}"
BRANCH="${BRANCH:-main}"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[0;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

say "1/3  Revisando el repo local"
[ -z "$(git status --porcelain --untracked-files=no)" ] \
  || die "Tienes cambios sin commitear. Commitealos primero:
$(git status --short --untracked-files=no)"

current="$(git branch --show-current)"
[ "$current" = "$BRANCH" ] || die "Estas en '$current', no en '$BRANCH'."
echo "    limpio, en $BRANCH"

say "2/3  Empujando a GitHub"
git push origin "$BRANCH"

say "3/3  Actualizando el VPS ($VPS_USER@$VPS_HOST)"
ssh "${VPS_USER}@${VPS_HOST}" bash -se <<REMOTE
set -euo pipefail
cd ${VPS_DIR}
git fetch origin ${BRANCH}
git reset --hard origin/${BRANCH}
docker compose up -d --build
echo
docker compose ps
REMOTE

cat <<NEXT

Desplegado. Para verificar:
  ssh ${VPS_USER}@${VPS_HOST} 'cd ${VPS_DIR} && docker compose logs -f bot'

NEXT
