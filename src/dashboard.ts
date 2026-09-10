// ============================================
// Dollar Check Bot - Datos del dashboard
// ============================================
// Arma el JSON de GET /api/dashboard. Solo lee el SQLite: no llama a OXR ni
// escribe (por eso isMonthExchanged() y no getMonthlyState(), que hace INSERT).
// Las fórmulas viven aquí y el front solo pinta, así se prueban con bun test.
//
// Días y meses se agrupan en la zona de la config, no en UTC como
// getDailyRates(): en México lo de 18:00-24:00 caería en el día siguiente, y el
// último día del mes es justo la tarde del sueldo.
//
// Los campos de la config se copian uno por uno: BotConfig trae el token de
// Telegram y el app id de OXR, y nada de eso puede terminar en el JSON.

import type { BotSettings, DailyPoint, DashboardData, DashboardHistoryRow } from "./types";
import { estimateDeelMxn } from "./types";
import {
  getUniqueRates,
  getLatestRate,
  getLastSalaryExchange,
  getExchangesByMonth,
  isMonthExchanged,
} from "./database";
import { analyzeTrend, RECOMMENDATION_EMOJI, RECOMMENDATION_LABEL } from "./stats";
import { checkRateFreshness } from "./healthcheck";

/** Días con tasas que necesita un mes para comparar un cambio contra su promedio. */
export const MIN_DAYS_FOR_MONTH_AVG = 10;

/** Lo que cubre la gráfica; el historial usa todas las tasas. */
const CHART_DAYS = 365;

/** Epoch en segundos → "YYYY-MM-DD" en la zona `tz`. */
export function localDateOf(tz: string): (epochSeconds: number) => string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (epochSeconds) => {
    const parts: Record<string, string> = {};
    for (const p of fmt.formatToParts(epochSeconds * 1000)) parts[p.type] = p.value;
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
}

/** Promedio, mínimo y máximo por día local, del día más viejo al más nuevo. */
export function groupDaily(rows: { timestamp: number; rate: number }[], tz: string): DailyPoint[] {
  const dateOf = localDateOf(tz);
  const byDate = new Map<string, { sum: number; min: number; max: number; points: number }>();

  for (const { timestamp, rate } of rows) {
    const date = dateOf(timestamp);
    const day = byDate.get(date);
    if (day) {
      day.sum += rate;
      day.min = Math.min(day.min, rate);
      day.max = Math.max(day.max, rate);
      day.points++;
    } else {
      byDate.set(date, { sum: rate, min: rate, max: rate, points: 1 });
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, d]) => ({ date, avg: d.sum / d.points, min: d.min, max: d.max, points: d.points }));
}

/**
 * Promedio de mercado por mes, como promedio de los promedios diarios: un día
 * sembrado con /seed (1 lectura) pesa lo mismo que uno vivo (~24).
 */
export function monthlyAverages(daily: DailyPoint[]): Map<string, { avg: number; days: number }> {
  const acc = new Map<string, { sum: number; days: number }>();
  for (const d of daily) {
    const month = d.date.slice(0, 7);
    const m = acc.get(month) ?? { sum: 0, days: 0 };
    m.sum += d.avg;
    m.days++;
    acc.set(month, m);
  }
  return new Map([...acc].map(([month, m]) => [month, { avg: m.sum / m.days, days: m.days }]));
}

/**
 * Tasa de mercado a la que hoy recibirías lo mismo que en tu último cambio:
 * despeja `mercado` de `neto_usd × mercado × (1 − spread) = mxn_último`.
 */
export function breakEvenRate(lastAmountMxn: number, netUsd: number, spreadPercent: number): number | null {
  const mxnPerMarketUnit = netUsd * (1 - spreadPercent / 100);
  return mxnPerMarketUnit > 0 ? lastAmountMxn / mxnPerMarketUnit : null;
}

/**
 * Lo que Deel se queda, en MXN: el bruto a tasa de mercado menos lo que
 * recibes. Se parte en tarifa (valuada a mercado) + spread sobre el neto, y las
 * dos suman exacto el total.
 */
export function deelCost(marketRate: number, grossUsd: number, feeUsd: number, spreadPercent: number) {
  const est = estimateDeelMxn(marketRate, grossUsd, spreadPercent, feeUsd);
  const fee_mxn = feeUsd * marketRate;
  const spread_mxn = est.netUsd * (marketRate - est.deelRate);
  return { total_mxn: fee_mxn + spread_mxn, fee_mxn, spread_mxn };
}

/**
 * Cuántos MXN ganaste o perdiste por el momento en que cambiaste, contra haber
 * cambiado en un día promedio del mes (con el spread actual). null si el mes
 * tiene pocos días con tasas: el primero es un /seed parcial y el actual va a
 * medias.
 */
export function vsMonthAverage(
  amountUsd: number,
  amountMxn: number,
  month: { avg: number; days: number } | undefined,
  spreadPercent: number
): number | null {
  if (!month || month.days < MIN_DAYS_FOR_MONTH_AVG) return null;
  return amountMxn - amountUsd * month.avg * (1 - spreadPercent / 100);
}

function summarize(rows: DashboardHistoryRow[]): DashboardData["totals"] {
  if (rows.length === 0) return null;
  const byRate = [...rows].sort((a, b) => b.effective_rate - a.effective_rate);
  return {
    count: rows.length,
    avg_effective_rate: rows.reduce((sum, r) => sum + r.effective_rate, 0) / rows.length,
    total_mxn: rows.reduce((sum, r) => sum + r.amount_mxn, 0),
    best_month: byRate[0].month,
    worst_month: byRate[byRate.length - 1].month,
  };
}

/** Mes actual, días al día de pago (el último del mes) y si es la última semana, en la zona `tz`. */
function monthInfo(now: number, tz: string) {
  const today = localDateOf(tz)(Math.floor(now / 1000));
  const [year, month, day] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    current: today.slice(0, 7),
    days_to_payday: lastDay - day,
    last_week: day >= lastDay - 7, // misma regla que isLastWeekOfMonth()
  };
}

export function buildDashboard(settings: BotSettings, now: number = Date.now()): DashboardData {
  const tz = settings.timezone;
  const salary = settings.default_salary_usd;
  const fee = settings.default_fee_usd;
  const spread = settings.default_spread_percent;

  const latest = getLatestRate();
  const last = getLastSalaryExchange();
  const daily = groupDaily(getUniqueRates(), tz);
  const byMonth = monthlyAverages(daily);

  let today: DashboardData["today"] = null;
  if (latest) {
    const est = estimateDeelMxn(latest.rate, salary, spread, fee);
    today = {
      deel_rate: est.deelRate,
      net_usd: est.netUsd,
      mxn: est.mxnReceived,
      deel_cost: deelCost(latest.rate, salary, fee, spread),
    };
  }

  // Por montos, como las alertas (src/alerts.ts), no por tasas como /status.
  let vs_last: DashboardData["vs_last"] = null;
  if (today && last) {
    const mxn = today.mxn - last.amount_mxn;
    vs_last = { mxn, percent: last.amount_mxn > 0 ? (mxn / last.amount_mxn) * 100 : null };
  }

  let trend: DashboardData["trend"] = null;
  const t = latest ? analyzeTrend(settings.alert_threshold_percent) : null;
  // analyzeTrend() devuelve ceros si no hay tasas de los últimos 30 días.
  if (t && t.sma_7 > 0) {
    trend = {
      direction: t.direction,
      consecutive_days: t.consecutive_days,
      momentum: t.momentum,
      sma_7: t.sma_7,
      sma_30: t.sma_30,
      recommendation: t.recommendation,
      emoji: RECOMMENDATION_EMOJI[t.recommendation],
      label: RECOMMENDATION_LABEL[t.recommendation],
    };
  }

  const history: DashboardHistoryRow[] = getExchangesByMonth().map((ex) => {
    const month = byMonth.get(ex.month);
    return {
      month: ex.month,
      effective_rate: ex.effective_rate,
      amount_usd: ex.amount_usd,
      amount_mxn: ex.amount_mxn,
      market_avg: month?.avg ?? null,
      days_with_data: month?.days ?? 0,
      vs_avg_mxn: vsMonthAverage(ex.amount_usd, ex.amount_mxn, month, spread),
    };
  });

  const month = monthInfo(now, tz);
  const chartFrom = localDateOf(tz)(Math.floor(now / 1000) - CHART_DAYS * 86400);

  return {
    generated_at: new Date(now).toISOString(),
    settings: {
      salary_usd: salary,
      fee_usd: fee,
      spread_percent: spread,
      threshold_percent: settings.alert_threshold_percent,
      poll_interval_minutes: settings.poll_interval_minutes,
      timezone: tz,
    },
    health: checkRateFreshness(settings.poll_interval_minutes),
    latest: latest ? { rate: latest.rate, timestamp: latest.timestamp } : null,
    today,
    last_exchange: last
      ? {
          month: last.month,
          effective_rate: last.effective_rate,
          amount_usd: last.amount_usd,
          amount_mxn: last.amount_mxn,
        }
      : null,
    vs_last,
    break_even_rate: today && last ? breakEvenRate(last.amount_mxn, today.net_usd, spread) : null,
    trend,
    month: { ...month, exchanged: isMonthExchanged(month.current) },
    daily: daily.filter((d) => d.date > chartFrom),
    history,
    totals: summarize(history),
  };
}
