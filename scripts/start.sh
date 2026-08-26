#!/bin/bash
# scripts/start.sh - Inicia el bot como servicio de macOS

PLIST="$HOME/Library/LaunchAgents/com.dollarcheck.bot.plist"

if [ ! -f "$PLIST" ]; then
  echo "❌ Launch agent no instalado. Ejecuta primero: bash scripts/setup.sh"
  exit 1
fi

launchctl load "$PLIST" 2>/dev/null
echo "✅ Dollar Check Bot iniciado"
echo "📋 Logs: bash scripts/logs.sh"
