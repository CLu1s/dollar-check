// ============================================
// Dollar Check Bot - Configuration
// ============================================

import type { BotConfig } from "./types";

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export function loadConfig(): BotConfig {
  return {
    telegram_bot_token: requireEnv("TELEGRAM_BOT_TOKEN"),
    telegram_chat_id: requireEnv("TELEGRAM_CHAT_ID"),
    oxr_app_id: requireEnv("OXR_APP_ID"),
    poll_interval_minutes: parseInt(optionalEnv("POLL_INTERVAL_MINUTES", "60")),
    alert_threshold_percent: parseFloat(optionalEnv("ALERT_THRESHOLD_PERCENT", "0.15")),
    trend_decline_days: parseInt(optionalEnv("TREND_DECLINE_DAYS", "3")),
    salary_day: parseInt(optionalEnv("SALARY_DAY", "0")), // 0 = last day
    timezone: optionalEnv("TZ", "America/Mexico_City"),
    default_salary_usd: parseFloat(optionalEnv("DEFAULT_SALARY_USD", "6097.24")),
    default_spread_percent: parseFloat(optionalEnv("DEFAULT_SPREAD_PERCENT", "0.75")),
    default_fee_usd: parseFloat(optionalEnv("DEFAULT_FEE_USD", "106.65")),
  };
}

/**
 * Ruta del SQLite. En CIAB la fija el manifest (`[data] sqlite = ["main"]` →
 * BOTTLE_SQLITE_MAIN, dentro del directorio que entra al backup). DB_PATH queda
 * para correr fuera de CIAB; sin ninguna, initDatabase usa data/dollar-check.db.
 */
export function resolveDbPath(): string | undefined {
  return process.env.BOTTLE_SQLITE_MAIN || process.env.DB_PATH || undefined;
}

export function isLastWeekOfMonth(): boolean {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() >= lastDay - 7;
}

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isLastDayOfMonth(): boolean {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() === lastDay;
}
