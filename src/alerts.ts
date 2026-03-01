// ============================================
// Dollar Check Bot - Alert Engine
// ============================================

import { getLatestRate, getMonthlyState, getLastSalaryExchange } from "./database";
import { analyzeTrend, formatTrendMessage } from "./stats";
import { isLastWeekOfMonth } from "./config";
import type { AlertCondition, BotConfig } from "./types";
import { estimateDeelMxn } from "./types";

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

  if (!latestRate) {
    return { shouldNotify: false, alerts: [], fullMessage: "" };
  }

  const currentRate = latestRate.rate;

  // ---- Skip if already exchanged this month ----
  if (monthlyState.is_exchanged) {
    return {
      shouldNotify: false,
      alerts: [],
      fullMessage: "Ya cambiaste tu sueldo este mes. Alertas pausadas.",
    };
  }

  // Estimate what you'd get today with Deel
  const estimated = estimateDeelMxn(
    currentRate,
    config.default_salary_usd,
    config.default_spread_percent,
    config.default_fee_usd
  );

  // What you got last time
  const lastMxn = lastExchange ? lastExchange.amount_mxn : 0;
  const lastEffectiveRate = lastExchange?.effective_rate || 0;
  const mxnDiff = lastMxn > 0 ? estimated.mxnReceived - lastMxn : 0;
  const mxnDiffPercent = lastMxn > 0 ? (mxnDiff / lastMxn) * 100 : 0;

  // ---- Threshold UP: You'd get more MXN than last time ----
  if (lastMxn > 0 && mxnDiff > 0) {
    // Convert threshold % to minimum MXN gain
    const minGainMxn = lastMxn * (config.alert_threshold_percent / 100);

    if (mxnDiff >= minGainMxn) {
      alerts.push({
        type: "threshold_up",
        triggered: true,
        message:
          `📈 *¡Recibirías más que el mes pasado!*\n` +
          `Estimado hoy: $${estimated.mxnReceived.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN\n` +
          `Último cambio: $${lastMxn.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN\n` +
          `Diferencia: +$${mxnDiff.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN (+${mxnDiffPercent.toFixed(2)}%)`,
        rate: currentRate,
        estimated_mxn: estimated.mxnReceived,
        change_mxn: mxnDiff,
      });
    }
  }

  // ---- Trend decline: sustained drop ----
  if (
    lastMxn > 0 &&
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
        `${mxnDiff >= 0
          ? "Aún recibirías más que el mes pasado, pero la tendencia no es favorable."
          : `⚠️ Recibirías $${Math.abs(mxnDiff).toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN menos que el mes pasado. Considera cambiar pronto.`
        }`,
      rate: currentRate,
      estimated_mxn: estimated.mxnReceived,
      change_mxn: mxnDiff,
    });
  }

  // ---- Last week of month: intensified alerting ----
  if (isLastWeekOfMonth() && lastMxn > 0) {
    const minGainMxn = lastMxn * (config.alert_threshold_percent * 0.5 / 100);

    if (
      Math.abs(mxnDiff) >= minGainMxn &&
      !alerts.some((a) => a.type === "threshold_up")
    ) {
      alerts.push({
        type: "daily_summary",
        triggered: true,
        message:
          `📅 *Última semana del mes*\n` +
          `Tu sueldo llega pronto.\n` +
          `Estimado hoy: $${estimated.mxnReceived.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN\n` +
          `Vs último cambio: ${mxnDiff >= 0 ? "+" : ""}$${mxnDiff.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN`,
        rate: currentRate,
        estimated_mxn: estimated.mxnReceived,
        change_mxn: mxnDiff,
      });
    }
  }

  // ---- Build full message ----
  if (alerts.length === 0) {
    return { shouldNotify: false, alerts, fullMessage: "" };
  }

  let fullMessage = alerts.map((a) => a.message).join("\n\n---\n\n");
  fullMessage += `\n\n${formatTrendMessage(trend, currentRate, lastEffectiveRate, config)}`;

  return {
    shouldNotify: true,
    alerts,
    fullMessage,
  };
}
