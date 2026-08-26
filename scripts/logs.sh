#!/bin/bash
# scripts/logs.sh - Muestra los logs del bot en tiempo real

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📋 Logs de Dollar Check Bot (Ctrl+C para salir)"
echo "---"
tail -f "$PROJECT_DIR/logs/stdout.log" "$PROJECT_DIR/logs/stderr.log"
