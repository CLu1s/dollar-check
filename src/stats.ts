// ============================================
// Dollar Check Bot - Statistical Analysis Engine
// ============================================

import { getDailyRates, getLatestRate, getLastSalaryExchange } from "./database";
import type { TrendAnalysis, AlertRecommendation, DailyRate } from "./types";

/**
 * Simple Moving Average
 */
function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / slice.length;
}

/**
 * Exponential Moving Average
 */
function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1); // smoothing factor
  let emaValue = values[0];
  for (let i = 1; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}

/**
 * Standard deviation (volatility measure)
 */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

/**
 * Momentum: rate of change over N periods
 * Positive = price going up, Negative = price going down
 */
function momentum(values: number[], period: number): number {
  if (values.length < period + 1) return 0;
  const current = values[values.length - 1];
  const past = values[values.length - 1 - period];
  return ((current - past) / past) * 100;
}

/**
 * Count consecutive days in same direction
 */
function consecutiveDirection(dailyRates: DailyRate[]): { direction: "up" | "down" | "sideways"; count: number } {
  if (dailyRates.length < 2) return { direction: "sideways", count: 0 };

  // dailyRates comes DESC, we need to check from most recent
  let count = 0;
  let direction: "up" | "down" | "sideways" = "sideways";

  for (let i = 0; i < dailyRates.length - 1; i++) {
    const current = dailyRates[i].avg_rate;
    const previous = dailyRates[i + 1].avg_rate;
    const diff = current - previous;

    // Threshold: ignore changes less than 0.01 (1 centavo)
    if (Math.abs(diff) < 0.01) {
      if (count === 0) {
        direction = "sideways";
        count++;
        continue;
      }
      break;
    }

    const currentDir = diff > 0 ? "up" : "down";

    if (count === 0) {
      direction = currentDir;
      count = 1;
    } else if (currentDir === direction) {
      count++;
    } else {
      break;
    }
  }

  return { direction, count };
}

/**
 * Generate recommendation based on analysis
 */
function generateRecommendation(
  currentRate: number,
  lastExchangeRate: number,
  changePercent: number,
  trend: "up" | "down" | "sideways",
  consecutiveDays: number,
  momentumValue: number,
  volatility: number,
  thresholdPercent: number
): AlertRecommendation {
  // No reference point yet
  if (lastExchangeRate === 0) return "hold";

  const isAboveLastExchange = currentRate > lastExchangeRate;

  // Strong upward trend with rate above last exchange
  if (isAboveLastExchange && changePercent >= thresholdPercent * 3 && momentumValue > 0) {
    return "strong_buy";
  }

  // Moderate improvement
  if (isAboveLastExchange && changePercent >= thresholdPercent) {
    // But if momentum is slowing, might peak soon
    if (momentumValue < 0 && trend === "down") {
      return "buy"; // Good rate but declining, act soon
    }
    return "buy";
  }

  // Rate declining significantly from recent highs
  if (trend === "down" && consecutiveDays >= 3 && !isAboveLastExchange) {
    return "change_now"; // Sustained decline, change before it gets worse
  }

  // Rate declining but still above last exchange
  if (trend === "down" && isAboveLastExchange) {
    return "buy"; // Still better than last time but dropping
  }

  // Trending down below last exchange
  if (trend === "down" && consecutiveDays >= 2) {
    return "watch";
  }

  return "hold";
}

/**
 * Full trend analysis
 */
export function analyzeTrend(thresholdPercent: number): TrendAnalysis {
  const dailyRates = getDailyRates(30);
  const latestRate = getLatestRate();
  const lastExchange = getLastSalaryExchange();

  if (!latestRate || dailyRates.length === 0) {
    return {
      direction: "sideways",
      consecutive_days: 0,
      change_percent: 0,
      sma_7: 0,
      sma_30: 0,
      ema_7: 0,
      volatility: 0,
      momentum: 0,
      recommendation: "hold",
    };
  }

  const avgRates = dailyRates.map((d) => d.avg_rate).reverse(); // chronological order
  const currentRate = latestRate.rate;
  const lastExchangeRate = lastExchange?.effective_rate || 0;

  const changePercent = lastExchangeRate > 0
    ? ((currentRate - lastExchangeRate) / lastExchangeRate) * 100
    : 0;

  const { direction, count } = consecutiveDirection(dailyRates);

  const sma7 = sma(avgRates, 7);
  const sma30 = sma(avgRates, 30);
  const ema7 = ema(avgRates, 7);
  const vol = standardDeviation(avgRates.slice(-7)); // 7-day volatility
  const mom = momentum(avgRates, 5); // 5-day momentum

  const recommendation = generateRecommendation(
    currentRate,
    lastExchangeRate,
    Math.abs(changePercent),
    direction,
    count,
    mom,
    vol,
    thresholdPercent
  );

  return {
    direction,
    consecutive_days: count,
    change_percent: changePercent,
    sma_7: sma7,
    sma_30: sma30,
    ema_7: ema7,
    volatility: vol,
    momentum: mom,
    recommendation,
  };
}

/**
 * Format trend analysis as readable message
 */
export function formatTrendMessage(trend: TrendAnalysis, currentRate: number, lastExchangeRate: number, commission: number): string {
  const effectiveRate = currentRate - commission;
  const diffFromLast = lastExchangeRate > 0 ? effectiveRate - lastExchangeRate : 0;
  const diffMxn = diffFromLast * 6000; // Impact on $6000 USD salary

  const dirEmoji = trend.direction === "up" ? "📈" : trend.direction === "down" ? "📉" : "➡️";
  const recEmoji: Record<string, string> = {
    strong_buy: "🟢🟢",
    buy: "🟢",
    hold: "🟡",
    watch: "🟠",
    change_now: "🔴",
  };
  const recLabel: Record<string, string> = {
    strong_buy: "¡EXCELENTE momento para cambiar!",
    buy: "Buen momento para cambiar",
    hold: "Mantener, sin urgencia",
    watch: "Vigilar de cerca, tendencia bajista",
    change_now: "⚠️ Cambiar YA, caída sostenida",
  };

  let msg = `💱 *USD/MXN Status*\n\n`;
  msg += `Tasa actual: *$${currentRate.toFixed(4)}*\n`;
  msg += `Tasa efectiva (-comisión): *$${effectiveRate.toFixed(4)}*\n\n`;

  if (lastExchangeRate > 0) {
    msg += `Último cambio: $${lastExchangeRate.toFixed(4)}\n`;
    msg += `Diferencia: ${diffFromLast >= 0 ? "+" : ""}${diffFromLast.toFixed(4)} (${trend.change_percent >= 0 ? "+" : ""}${trend.change_percent.toFixed(2)}%)\n`;
    msg += `Impacto en $6,000 USD: ${diffMxn >= 0 ? "+" : ""}$${diffMxn.toFixed(0)} MXN\n\n`;
  }

  msg += `${dirEmoji} Tendencia: ${trend.direction} (${trend.consecutive_days} días)\n`;
  msg += `SMA 7d: $${trend.sma_7.toFixed(4)} | SMA 30d: $${trend.sma_30.toFixed(4)}\n`;
  msg += `Volatilidad: ${trend.volatility.toFixed(4)} | Momentum: ${trend.momentum >= 0 ? "+" : ""}${trend.momentum.toFixed(2)}%\n\n`;
  msg += `${recEmoji[trend.recommendation] || "⚪"} *${recLabel[trend.recommendation] || "Sin datos suficientes"}*`;

  return msg;
}
