#!/bin/bash
# scripts/status.sh - Verifica si el bot está corriendo

if launchctl list | grep -q "com.dollarcheck.bot"; then
  PID=$(launchctl list | grep "com.dollarcheck.bot" | awk '{print $1}')
  echo "✅ Dollar Check Bot corriendo (PID: $PID)"
else
  echo "⏹️  Dollar Check Bot no está corriendo"
fi
