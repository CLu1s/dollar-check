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
  rate: number;
  amount_usd: number;
  amount_mxn: number;
  commission_per_dollar: number;
  effective_rate: number; // rate - commission
  exchanged_at: string;
  month: string; // YYYY-MM format
  notes?: string;
}

export interface MonthlyState {
  is_exchanged: boolean;
  last_exchange_rate: number;
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
  change_percent: number;
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
  default_salary_usd: number;
  default_commission: number;
}

export interface DailyRate {
  date: string;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
}

export interface ExchangeStats {
  total_exchanges: number;
  avg_rate: number;
  best_rate: number;
  worst_rate: number;
  best_month: string;
  worst_month: string;
  total_usd_exchanged: number;
  total_mxn_received: number;
  potential_gain_loss_vs_avg: number;
}
