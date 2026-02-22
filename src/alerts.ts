// ============================================
// Dollar Check Bot - Alert Engine
// ============================================

import { getLatestRate, getMonthlyState, getLastSalaryExchange } from "./database";
import { analyzeTrend, formatTrendMessage } from "./stats";
import { isLastWeekOfMonth } from "./config";
import type { AlertCondition, BotConfig } from "./types";

export interface AlertResult {
  shouldNotify: boolean;
  alerts: AlertCondition[];
  fullMessage: string;
}

/**
 * Evaluate all alert conditions and return actionable alerts
 */
export function evaluateAlerts(config: BotConfig): AlertResult {
  const latestRate = getLatestRate();
  const monthlyState = getMonthlyState();
  const lastExchange = getLastSalaryExchange();
  const trend = analyzeTrend(config.alert_threshold_percent);

  const alerts: AlertCondition[] = [];

  // If no rate data, nothing to evaluate
  if (!latestRate) {
    return { shouldNotify: false, alerts: [], fullMessage: "" };
  }

  const currentRate = latestRate.rate;
  const effectiveRate = currentRate - config.default_commission;
  const lastExchangeRate = lastExchange?.effective_rate || 0;

  // ---- Skip if already exchanged this month ----
  if (monthlyState.is_exchanged) {
    return {
      shouldNotify: false,
      alerts: [],
      fullMessage: "Ya cambiaste tu sueldo este mes. Alertas pausadas.",
    };
  }

  // ---- Threshold UP: Rate is better than last exchange ----
  if (lastExchangeRate > 0) {
    const changePercent = ((effectiveRate - lastExchangeRate) / lastExchangeRate) * 100;

    if (changePercent >= config.alert_threshold_percent) {
      const impactMxn = (effectiveRate - lastExchangeRate) * config.default_salary_usd;
      alerts.push({
        type: "threshold_up",
        triggered: true,
        message:
          `📈 *¡Dólar arriba!*\n` +
          `Tasa efectiva: $${effectiveRate.toFixed(4)} vs último cambio $${lastExchangeRate.toFixed(4)}\n` +
          `Mejora: +${changePercent.toFixed(2)}% → +$${impactMxn.toFixed(0)} MXN en tu sueldo`,
        rate: currentRate,
        change_percent: changePercent,
      });
    }

    // ---- Threshold DOWN: Sustained decline ----
    if (
      trend.direction === "down" &&
      trend.consecutive_days >= config.trend_decline_days
    ) {
      alerts.push({
        type: "trend_decline",
        triggered: true,
        message:
          `📉 *Tendencia bajista sostenida*\n` +
          `${trend.consecutive_days} días consecutivos a la baja\n` +
          `Momentum: ${trend.momentum.toFixed(2)}%\n` +
          `${effectiveRate > lastExchangeRate
            ? "Aún estás por encima de tu último cambio, pero la tendencia no es favorable."
            : "⚠️ Ya estás por debajo de tu último cambio. Considera cambiar pronto."
          }`,
        rate: currentRate,
        change_percent: ((effectiveRate - lastExchangeRate) / lastExchangeRate) * 100,
      });
    }
  }

  // ---- Last week of month intensified alerting ----
  if (isLastWeekOfMonth() && lastExchangeRate > 0) {
    const changePercent = ((effectiveRate - lastExchangeRate) / lastExchangeRate) * 100;

    // During last week, lower the threshold
    if (
      Math.abs(changePercent) >= config.alert_threshold_percent * 0.5 &&
      !alerts.some((a) => a.type === "threshold_up")
    ) {
      alerts.push({
        type: "daily_summary",
        triggered: true,
        message:
          `📅 *Última semana del mes*\n` +
          `Tu sueldo llega pronto. Tasa efectiva: $${effectiveRate.toFixed(4)}\n` +
          `vs último cambio: $${lastExchangeRate.toFixed(4)} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%)`,
        rate: currentRate,
        change_percent: changePercent,
      });
    }
  }

  // ---- Build full message ----
  if (alerts.length === 0) {
    return { shouldNotify: false, alerts, fullMessage: "" };
  }

  let fullMessage = alerts.map((a) => a.message).join("\n\n---\n\n");
  fullMessage += `\n\n${formatTrendMessage(trend, currentRate, lastExchangeRate, config.default_commission)}`;

  return {
    shouldNotify: true,
    alerts,
    fullMessage,
  };
}
