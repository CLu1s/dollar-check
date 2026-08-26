#!/bin/bash
# scripts/setup.sh - Configura Dollar Check Bot como servicio local en macOS
# Ejecutar una sola vez después de clonar el proyecto

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_SRC="$PROJECT_DIR/com.dollarcheck.bot.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.dollarcheck.bot.plist"

echo "📦 Instalando dependencias..."
cd "$PROJECT_DIR"
bun install

echo "📁 Creando directorio de logs..."
mkdir -p "$PROJECT_DIR/logs"
mkdir -p "$PROJECT_DIR/data"

echo "🔗 Instalando launch agent..."
cp "$PLIST_SRC" "$PLIST_DST"

echo ""
echo "✅ Setup completo!"
echo ""
echo "⚠️  Antes de iniciar, verifica que las rutas en el plist sean correctas:"
echo "   $PLIST_DST"
echo ""
echo "   - Ruta de bun: $(which bun)"
echo "   - Directorio del proyecto: $PROJECT_DIR"
echo ""
echo "Para iniciar: bash scripts/start.sh"
