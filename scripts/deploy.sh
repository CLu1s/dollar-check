#!/bin/bash
# scripts/deploy.sh - Despliega Dollar Check Bot al VPS

set -e

VPS_USER="luis"
VPS_HOST="5.78.119.203"
VPS_DIR="~/dollar-check"

echo "🚀 Desplegando Dollar Check Bot al VPS..."

ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
    cd ~/dollar-check
    git pull origin main
    docker compose up -d --build
EOF

echo "✅ Desplegado! Verifica con: ssh luis@5.78.119.203 'docker logs -f dollar-check-bot'"
