// ============================================
// Dollar Check Bot - Telegram Bot Commands
// ============================================

import { Bot } from "grammy";
import type { BotConfig } from "./types";
import { estimateDeelMxn } from "./types";
import {
  getLatestRate,
  getMonthlyState,
  getLastSalaryExchange,
  getSalaryExchangeHistory,
  getExchangeStats,
  saveSalaryExchange,
  markMonthAsExchanged,
  resetMonthExchange,
  saveRate,
  setSetting,
  getDailyRates,
} from "./database";
import { fetchCurrentRate, fetchHistoricalRate } from "./exchange";
import { analyzeTrend, formatTrendMessage } from "./stats";
import { runAnalysis } from "./analyze";
import { getCurrentMonth } from "./config";

const HELP_TEXT =
  `*Comandos disponibles:*\n` +
  `/status - Tasa actual, tendencia y recomendación\n` +
  `/refresh - Consultar tasa ahora mismo\n` +
  `/changed <tasa> <bruto\\_usd> <mxn> <tarifa> [YYYY-MM] - Registrar cambio\n` +
  `/reset - Reactivar alertas del mes actual\n` +
  `/seed [días] - Cargar datos históricos\n` +
  `/history - Historial de cambios\n` +
  `/stats - Estadísticas acumuladas\n` +
  `/month - Resumen del mes actual\n` +
  `/analyze - Análisis AI del tipo de cambio\n` +
  `/config - Ver configuración actual\n` +
  `/set\\_spread <pct> - Cambiar spread de Deel\n` +
  `/set\\_fee <monto> - Cambiar tarifa Deel en USD\n` +
  `/set\\_salary <monto> - Cambiar sueldo bruto en USD\n` +
  `/set\\_threshold <pct> - Cambiar umbral de alerta\n` +
  `/help - Mostrar esta ayuda`;

export function createBot(config: BotConfig): Bot {
  const bot = new Bot(config.telegram_bot_token);

  // Middleware: restrict to authorized chat
  bot.use(async (ctx, next) => {
    if (ctx.chat?.id.toString() !== config.telegram_chat_id) {
      await ctx.reply("⛔ No autorizado.");
      return;
    }
    await next();
  });

  // ---- /start ----
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `🤑 *Dollar Check Bot*\n\n` +
      `Te ayudo a encontrar el mejor momento para cambiar tu sueldo de USD a MXN vía Deel.\n\n` +
      HELP_TEXT,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(`🤑 *Dollar Check Bot - Ayuda*\n\n` + HELP_TEXT, { parse_mode: "Markdown" });
  });

  // ---- /status ----
  bot.command("status", async (ctx) => {
    const latestRate = getLatestRate();
    const monthlyState = getMonthlyState();
    const lastExchange = getLastSalaryExchange();
    const trend = analyzeTrend(config.alert_threshold_percent);

    if (!latestRate) {
      await ctx.reply("⏳ Aún no tengo datos. Espera al primer polling o usa /refresh");
      return;
    }

    const lastRate = lastExchange?.effective_rate || 0;
    let msg = formatTrendMessage(trend, latestRate.rate, lastRate, config);

    if (monthlyState.is_exchanged) {
      msg += `\n\n✅ Ya cambiaste tu sueldo este mes. Alertas pausadas.`;
    } else {
      msg += `\n\n⏳ Pendiente de cambiar este mes.`;
    }

    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // ---- /refresh ----
  bot.command("refresh", async (ctx) => {
    try {
      await ctx.reply("🔄 Consultando tasa actual...");
      const rate = await fetchCurrentRate(config.oxr_app_id);

      const estimated = estimateDeelMxn(
        rate,
        config.default_salary_usd,
        config.default_spread_percent,
        config.default_fee_usd
      );

      const lastExchange = getLastSalaryExchange();
      let diff = "";
      if (lastExchange) {
        const lastMxn = lastExchange.amount_mxn;
        const mxnDiff = estimated.mxnReceived - lastMxn;
        diff = `\nVs último cambio: ${mxnDiff >= 0 ? "+" : ""}$${mxnDiff.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN`;
      }

      await ctx.reply(
        `💱 *Tasa actual*\n` +
        `Mercado: $${rate.toFixed(4)}\n` +
        `Deel estimada: $${estimated.deelRate.toFixed(4)}\n` +
        `Recibirías: ~$${estimated.mxnReceived.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN${diff}`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      await ctx.reply(`❌ Error al consultar: ${error}`);
    }
  });

  // ---- /changed <tasa_deel> <bruto_usd> <mxn_recibido> <tarifa_usd> [YYYY-MM] ----
  bot.command("changed", async (ctx) => {
    const args = ctx.message?.text?.split(" ").slice(1) || [];

    if (args.length < 4) {
      await ctx.reply(
        "Uso: `/changed <tasa> <bruto_usd> <mxn> <tarifa> [YYYY-MM]`\n\n" +
        "Ingresa los datos tal como aparecen en Deel:\n" +
        "  `tasa` → Tasa de cambio ($1.00 = X MXN)\n" +
        "  `bruto_usd` → Tu sueldo bruto en USD\n" +
        "  `mxn` → Monto a recibir en MXN\n" +
        "  `tarifa` → Tarifa de cambio en USD\n\n" +
        "Ejemplo:\n" +
        "  `/changed 17.25 6097.24 103333.04 106.65`\n" +
        "  `/changed 17.25 6097.24 103333.04 106.65 2026-02` → mes pasado",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const deelRate = parseFloat(args[0]);
    const grossUsd = parseFloat(args[1]);
    const amountMxn = parseFloat(args[2]);
    const feeUsd = parseFloat(args[3]);

    if ([deelRate, grossUsd, amountMxn, feeUsd].some((v) => isNaN(v) || v <= 0)) {
      await ctx.reply("❌ Todos los valores deben ser números positivos.");
      return;
    }

    // 5th arg: optional YYYY-MM
    const monthArg = (args[4] && /^\d{4}-\d{2}$/.test(args[4])) ? args[4] : null;

    const targetMonth = monthArg || getCurrentMonth();
    const isCurrentMonth = targetMonth === getCurrentMonth();
    const netUsd = grossUsd - feeUsd;
    const effectiveRate = amountMxn / netUsd;

    // Get market rate from bot's data for spread calculation
    const latestRate = getLatestRate();
    const marketRate = latestRate?.rate || deelRate;
    const actualSpread = marketRate > 0 ? ((marketRate - deelRate) / marketRate) * 100 : config.default_spread_percent;

    saveSalaryExchange({
      rate: marketRate,
      deel_rate: deelRate,
      gross_usd: grossUsd,
      fee_usd: feeUsd,
      amount_usd: netUsd,
      amount_mxn: amountMxn,
      spread_percent: actualSpread,
      effective_rate: effectiveRate,
      exchanged_at: new Date().toISOString(),
      month: targetMonth,
      notes: undefined,
    });

    markMonthAsExchanged(effectiveRate, targetMonth);

    let statusMsg = isCurrentMonth
      ? `Alertas pausadas hasta el próximo mes. 🔕`
      : `📝 Registrado para ${targetMonth}. Alertas de este mes siguen activas. ✅`;

    await ctx.reply(
      `✅ *Cambio registrado (${targetMonth})*\n\n` +
      `Tasa mercado: $${marketRate.toFixed(4)}\n` +
      `Tasa Deel: $${deelRate.toFixed(4)} (spread: ${actualSpread.toFixed(2)}%)\n` +
      `Bruto: $${grossUsd.toLocaleString()} USD\n` +
      `Tarifa Deel: $${feeUsd.toFixed(2)} USD\n` +
      `Neto convertido: $${netUsd.toLocaleString()} USD\n` +
      `Recibiste: $${amountMxn.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN\n` +
      `Tasa efectiva: $${effectiveRate.toFixed(4)}/USD\n\n` +
      statusMsg,
      { parse_mode: "Markdown" }
    );
  });

  // ---- /reset ----
  bot.command("reset", async (ctx) => {
    resetMonthExchange();
    await ctx.reply(
      `🔔 *Alertas reactivadas*\n\n` +
      `El mes actual (${getCurrentMonth()}) está marcado como pendiente de cambio.\n` +
      `El bot volverá a enviarte alertas.`,
      { parse_mode: "Markdown" }
    );
  });

  // ---- /seed [days] ----
  bot.command("seed", async (ctx) => {
    const days = parseInt(ctx.message?.text?.split(" ")[1] || "30");

    if (isNaN(days) || days <= 0 || days > 365) {
      await ctx.reply("Uso: `/seed [días]`\nEjemplo: `/seed 30` (default: 30, max: 365)", { parse_mode: "Markdown" });
      return;
    }

    await ctx.reply(`🌱 Descargando datos históricos de ${days} días...`);

    let loaded = 0;
    let errors = 0;

    for (let i = days; i >= 1; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const timestamp = Math.floor(date.getTime() / 1000);

      try {
        const rate = await fetchHistoricalRate(config.oxr_app_id, dateStr);
        saveRate(rate, timestamp, "openexchangerates-historical");
        loaded++;
      } catch (error) {
        errors++;
        console.error(`[Seed] Failed to fetch ${dateStr}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await ctx.reply(
      `✅ *Seed completado*\n\n` +
      `Días cargados: ${loaded}\n` +
      `Errores: ${errors}\n\n` +
      `Ahora /status y /month tienen contexto histórico.`,
      { parse_mode: "Markdown" }
    );
  });

  // ---- /history ----
  bot.command("history", async (ctx) => {
    const history = getSalaryExchangeHistory(12);

    if (history.length === 0) {
      await ctx.reply("📭 No hay historial de cambios aún. Usa /changed cuando hagas tu primer cambio.");
      return;
    }

    let msg = `📊 *Historial de cambios*\n\n`;
    for (const ex of history) {
      msg += `*${ex.month}*: $${ex.deel_rate.toFixed(2)} → $${ex.amount_mxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN ($${ex.amount_usd.toLocaleString()} USD)\n`;
    }

    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // ---- /stats ----
  bot.command("stats", async (ctx) => {
    const stats = getExchangeStats();

    if (!stats) {
      await ctx.reply("📭 No hay suficientes datos para estadísticas.");
      return;
    }

    const avgMxnPerMonth = stats.total_mxn_received / stats.total_exchanges;

    await ctx.reply(
      `📈 *Estadísticas acumuladas*\n\n` +
      `Total de cambios: ${stats.total_exchanges}\n` +
      `Tasa efectiva promedio: $${stats.avg_rate.toFixed(4)}/USD\n` +
      `Mejor tasa: $${stats.best_rate.toFixed(4)} (${stats.best_month})\n` +
      `Peor tasa: $${stats.worst_rate.toFixed(4)} (${stats.worst_month})\n\n` +
      `Total USD cambiados: $${stats.total_usd_exchanged.toLocaleString()}\n` +
      `Total MXN recibidos: $${stats.total_mxn_received.toLocaleString("es-MX", { minimumFractionDigits: 0 })}\n` +
      `Promedio MXN/mes: $${avgMxnPerMonth.toLocaleString("es-MX", { minimumFractionDigits: 0 })}\n\n` +
      `${stats.potential_gain_loss_vs_avg >= 0 ? "📈" : "📉"} Vs promedio plano: ${stats.potential_gain_loss_vs_avg >= 0 ? "+" : ""}$${stats.potential_gain_loss_vs_avg.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN`,
      { parse_mode: "Markdown" }
    );
  });

  // ---- /month ----
  bot.command("month", async (ctx) => {
    const dailyRates = getDailyRates(30);
    const monthlyState = getMonthlyState();

    if (dailyRates.length === 0) {
      await ctx.reply("📭 No hay datos del mes actual.");
      return;
    }

    const rates = dailyRates.map((d) => d.avg_rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    const avg = rates.reduce((s, r) => s + r, 0) / rates.length;

    const estMin = estimateDeelMxn(min, config.default_salary_usd, config.default_spread_percent, config.default_fee_usd);
    const estMax = estimateDeelMxn(max, config.default_salary_usd, config.default_spread_percent, config.default_fee_usd);

    let msg = `📅 *Resumen del mes (${monthlyState.current_month})*\n\n`;
    msg += `Días con datos: ${dailyRates.length}\n`;
    msg += `Tasa promedio: $${avg.toFixed(4)}\n`;
    msg += `Mínima: $${min.toFixed(4)} (~$${estMin.mxnReceived.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN)\n`;
    msg += `Máxima: $${max.toFixed(4)} (~$${estMax.mxnReceived.toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN)\n`;
    msg += `Rango: $${(max - min).toFixed(4)} (~$${(estMax.mxnReceived - estMin.mxnReceived).toLocaleString("es-MX", { minimumFractionDigits: 0 })} MXN)\n\n`;
    msg += monthlyState.is_exchanged
      ? `✅ Sueldo ya cambiado este mes`
      : `⏳ Sueldo pendiente de cambiar`;

    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // ---- /config ----
  // ---- /analyze ----
  bot.command("analyze", async (ctx) => {
    await ctx.reply("🤖 Analizando con Claude, dame un momento...");

    try {
      const analysis = await runAnalysis(config);

      // Telegram has 4096 char limit per message
      if (analysis.length > 4000) {
        await ctx.reply(analysis.slice(0, 4000) + "\n\n⚠️ (respuesta truncada)");
      } else {
        await ctx.reply(analysis);
      }
    } catch (error) {
      console.error("[Analyze] Error:", error);
      await ctx.reply(`❌ Error al analizar: ${error}`);
    }
  });

  // ---- /config ----
  bot.command("config", async (ctx) => {
    await ctx.reply(
      `⚙️ *Configuración actual*\n\n` +
      `Sueldo bruto: $${config.default_salary_usd.toLocaleString()} USD\n` +
      `Spread Deel: ${config.default_spread_percent}%\n` +
      `Tarifa Deel: $${config.default_fee_usd} USD\n` +
      `Umbral de alerta: ${config.alert_threshold_percent}%\n` +
      `Días para tendencia bajista: ${config.trend_decline_days}\n` +
      `Intervalo de polling: ${config.poll_interval_minutes} min\n` +
      `Día de pago: Último día del mes`,
      { parse_mode: "Markdown" }
    );
  });

  // ---- /set_threshold <percent> ----
  bot.command("set_threshold", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value <= 0) {
      await ctx.reply("Uso: `/set_threshold 0.15` (porcentaje)", { parse_mode: "Markdown" });
      return;
    }
    config.alert_threshold_percent = value;
    setSetting("alert_threshold_percent", value.toString());
    await ctx.reply(`✅ Umbral actualizado a ${value}%`);
  });

  // ---- /set_spread <percent> ----
  bot.command("set_spread", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value < 0 || value > 10) {
      await ctx.reply("Uso: `/set_spread 0.75` (porcentaje que cobra Deel)", { parse_mode: "Markdown" });
      return;
    }
    config.default_spread_percent = value;
    setSetting("default_spread_percent", value.toString());
    await ctx.reply(`✅ Spread de Deel actualizado a ${value}%`);
  });

  // ---- /set_fee <amount> ----
  bot.command("set_fee", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value < 0) {
      await ctx.reply("Uso: `/set_fee 106.65` (tarifa de cambio en USD)", { parse_mode: "Markdown" });
      return;
    }
    config.default_fee_usd = value;
    setSetting("default_fee_usd", value.toString());
    await ctx.reply(`✅ Tarifa Deel actualizada a $${value.toFixed(2)} USD`);
  });

  // ---- /set_salary <amount> ----
  bot.command("set_salary", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value <= 0) {
      await ctx.reply("Uso: `/set_salary 6097.24` (dólares brutos)", { parse_mode: "Markdown" });
      return;
    }
    config.default_salary_usd = value;
    setSetting("default_salary_usd", value.toString());
    await ctx.reply(`✅ Sueldo actualizado a $${value.toLocaleString()} USD`);
  });

  // Error handler
  bot.catch((err) => {
    console.error("[Bot] Error:", err);
  });

  return bot;
}

/**
 * Send a push alert to the configured chat
 */
export async function sendAlert(bot: Bot, chatId: string, message: string): Promise<void> {
  try {
    await bot.api.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("[Bot] Failed to send alert:", error);
  }
}
