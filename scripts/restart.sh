#!/bin/bash
# scripts/restart.sh - Reinicia el bot

PLIST="$HOME/Library/LaunchAgents/com.dollarcheck.bot.plist"

launchctl unload "$PLIST" 2>/dev/null
sleep 1
launchctl load "$PLIST" 2>/dev/null
echo "🔄 Dollar Check Bot reiniciado"
echo "📋 Logs: bash scripts/logs.sh"
