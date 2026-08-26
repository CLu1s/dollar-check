#!/bin/bash
# scripts/stop.sh - Detiene el bot

PLIST="$HOME/Library/LaunchAgents/com.dollarcheck.bot.plist"

launchctl unload "$PLIST" 2>/dev/null
echo "🛑 Dollar Check Bot detenido"
