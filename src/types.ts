// ============================================
// Dollar Check Bot - Type Definitions
// ============================================

export interface ExchangeRate {
  id?: number;
  rate: number;
  timestamp: number;
  source: string;
  created_at?: string;
}

export interface SalaryExchange {
  id?: number;
  rate: number; // Market rate at time of exchange (OXR)
  deel_rate: number; // Rate Deel actually gave
  gross_usd: number; // Gross salary in USD before Deel fee
  fee_usd: number; // Deel's fee in USD ("tarifa de cambio")
  amount_usd: number; // Net USD converted (gross - fee)
  amount_mxn: number; // Actual MXN received
  spread_percent: number; // Deel's spread as percentage
  effective_rate: number; // amount_mxn / amount_usd (what you REALLY got per dollar)
  exchanged_at: string;
  month: string; // YYYY-MM format
  notes?: string;
}

export interface MonthlyState {
  is_exchanged: boolean;
  last_exchange_rate: number; // effective_rate from last exchange
  last_exchange_date: string;
  current_month: string; // YYYY-MM
}

export interface TrendAnalysis {
  direction: "up" | "down" | "sideways";
  consecutive_days: number;
  change_percent: number;
  sma_7: number; // Simple Moving Average 7 days
  sma_30: number; // Simple Moving Average 30 days
  ema_7: number; // Exponential Moving Average 7 days
  volatility: number; // Standard deviation of recent rates
  momentum: number; // Rate of change
  recommendation: AlertRecommendation;
}

export type AlertRecommendation =
  | "strong_buy" // Rate significantly above last exchange
  | "buy" // Rate moderately above last exchange
  | "hold" // Rate stable or slightly above
  | "watch" // Rate declining, monitor closely
  | "change_now"; // Rate declining fast, change immediately

export interface AlertCondition {
  type: "threshold_up" | "threshold_down" | "trend_decline" | "daily_summary";
  triggered: boolean;
  message: string;
  rate: number;
  estimated_mxn: number; // Estimated MXN with current rate
  change_mxn: number; // Difference in MXN vs last exchange
}

export interface BotConfig {
  telegram_bot_token: string;
  telegram_chat_id: string;
  oxr_app_id: string;
  poll_interval_minutes: number;
  alert_threshold_percent: number;
  trend_decline_days: number;
  salary_day: number;
  timezone: string;
  default_salary_usd: number; // Gross monthly salary in USD
  default_spread_percent: number; // Deel's spread (~0.75%)
  default_fee_usd: number; // Deel's fee in USD (~106.65)
}

export interface DailyRate {
  date: string;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
}

export interface ExchangeStats {
  total_exchanges: number;
  avg_rate: number; // Average effective rate
  best_rate: number;
  worst_rate: number;
  best_month: string;
  worst_month: string;
  total_usd_exchanged: number;
  total_mxn_received: number;
  potential_gain_loss_vs_avg: number;
}

// ---- Deel Estimation Helpers ----

/**
 * Estimate what Deel would give you for a market rate.
 *
 * Deel's real flow:
 *   1. Gross USD salary (e.g. $6,097.24)
 *   2. Deel deducts fee in USD (e.g. $106.65) → "Tarifa de cambio"
 *   3. Net USD = gross - fee (e.g. $5,990.59)
 *   4. Convert net USD at Deel's rate → MXN received
 *
 * The Deel rate ≈ market rate × (1 - spread%), but we estimate it.
 */
export function estimateDeelMxn(
  marketRate: number,
  grossUsd: number,
  spreadPercent: number,
  feeUsd: number
): { deelRate: number; netUsd: number; mxnReceived: number; effectiveRate: number } {
  const deelRate = marketRate * (1 - spreadPercent / 100);
  const netUsd = grossUsd - feeUsd;
  const mxnReceived = netUsd * deelRate;
  const effectiveRate = mxnReceived / netUsd;
  return { deelRate, netUsd, mxnReceived, effectiveRate };
}
