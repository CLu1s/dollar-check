// ============================================
// Dollar Check Bot - Telegram Bot Commands
// ============================================

import { Bot, type Context } from "grammy";
import type { BotConfig } from "./types";
import {
  getLatestRate,
  getMonthlyState,
  getLastSalaryExchange,
  getSalaryExchangeHistory,
  getExchangeStats,
  saveSalaryExchange,
  markMonthAsExchanged,
  setSetting,
  getSetting,
  getDailyRates,
} from "./database";
import { fetchCurrentRate } from "./exchange";
import { analyzeTrend, formatTrendMessage } from "./stats";
import { getCurrentMonth } from "./config";

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
      `Te ayudo a encontrar el mejor momento para cambiar tu sueldo de USD a MXN.\n\n` +
      `*Comandos disponibles:*\n` +
      `/status - Tasa actual, tendencia y recomendación\n` +
      `/changed <tasa> - Registrar que cambiaste tu sueldo\n` +
      `/history - Historial de cambios\n` +
      `/stats - Estadísticas acumuladas\n` +
      `/month - Resumen del mes actual\n` +
      `/config - Ver configuración actual\n` +
      `/set\\_threshold <porcentaje> - Cambiar umbral de alerta\n` +
      `/set\\_commission <monto> - Cambiar comisión por dólar\n` +
      `/set\\_salary <monto> - Cambiar monto de sueldo en USD\n` +
      `/refresh - Consultar tasa ahora mismo\n` +
      `/help - Mostrar esta ayuda`,
      { parse_mode: "Markdown" }
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.api.sendMessage(ctx.chat!.id,
      `🤑 *Dollar Check Bot - Ayuda*\n\n` +
      `*Comandos disponibles:*\n` +
      `/status - Tasa actual, tendencia y recomendación\n` +
      `/changed <tasa> - Registrar que cambiaste tu sueldo\n` +
      `/history - Historial de cambios\n` +
      `/stats - Estadísticas acumuladas\n` +
      `/month - Resumen del mes actual\n` +
      `/config - Ver configuración actual\n` +
      `/set\\_threshold <porcentaje> - Cambiar umbral de alerta\n` +
      `/set\\_commission <monto> - Cambiar comisión por dólar\n` +
      `/set\\_salary <monto> - Cambiar monto de sueldo en USD\n` +
      `/refresh - Consultar tasa ahora mismo\n` +
      `/help - Mostrar esta ayuda`,
      { parse_mode: "Markdown" }
    );
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
    let msg = formatTrendMessage(trend, latestRate.rate, lastRate, config.default_commission);

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
      const effectiveRate = rate - config.default_commission;

      const lastExchange = getLastSalaryExchange();
      const lastRate = lastExchange?.effective_rate || 0;
      let diff = "";
      if (lastRate > 0) {
        const change = effectiveRate - lastRate;
        const pct = ((change / lastRate) * 100).toFixed(2);
        const impact = (change * config.default_salary_usd).toFixed(0);
        diff = `\nVs último cambio: ${change >= 0 ? "+" : ""}${change.toFixed(4)} (${pct}%) → ${change >= 0 ? "+" : ""}$${impact} MXN`;
      }

      await ctx.reply(
        `💱 *Tasa actual*\nUSD/MXN: $${rate.toFixed(4)}\nEfectiva: $${effectiveRate.toFixed(4)}${diff}`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      await ctx.reply(`❌ Error al consultar: ${error}`);
    }
  });

  // ---- /changed <rate> [amount_usd] ----
  bot.command("changed", async (ctx) => {
    const args = ctx.message?.text?.split(" ").slice(1) || [];
    const rate = parseFloat(args[0]);
    const amountUsd = parseFloat(args[1]) || config.default_salary_usd;

    if (isNaN(rate) || rate <= 0) {
      await ctx.reply(
        "Uso: `/changed <tasa> [monto_usd]`\n" +
        "Ejemplo: `/changed 17.30` o `/changed 17.30 6000`",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const effectiveRate = rate - config.default_commission;
    const amountMxn = amountUsd * effectiveRate;

    saveSalaryExchange({
      rate,
      amount_usd: amountUsd,
      amount_mxn: amountMxn,
      commission_per_dollar: config.default_commission,
      effective_rate: effectiveRate,
      exchanged_at: new Date().toISOString(),
      month: getCurrentMonth(),
      notes: undefined,
    });

    markMonthAsExchanged(effectiveRate);

    await ctx.reply(
      `✅ *Cambio registrado*\n\n` +
      `Tasa: $${rate.toFixed(4)}\n` +
      `Comisión: -$${config.default_commission.toFixed(2)}/USD\n` +
      `Tasa efectiva: $${effectiveRate.toFixed(4)}\n` +
      `Monto: $${amountUsd.toLocaleString()} USD\n` +
      `Recibiste: $${amountMxn.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN\n\n` +
      `Alertas pausadas hasta el próximo mes. 🔕`,
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
    msg += `| Mes | Tasa Ef. | MXN Recibido |\n`;
    msg += `|-----|----------|-------------|\n`;

    for (const ex of history) {
      msg += `| ${ex.month} | $${ex.effective_rate.toFixed(2)} | $${ex.amount_mxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })} |\n`;
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
      `Tasa promedio efectiva: $${stats.avg_rate.toFixed(4)}\n` +
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

    let msg = `📅 *Resumen del mes (${monthlyState.current_month})*\n\n`;
    msg += `Días con datos: ${dailyRates.length}\n`;
    msg += `Tasa promedio: $${avg.toFixed(4)}\n`;
    msg += `Mínima: $${min.toFixed(4)}\n`;
    msg += `Máxima: $${max.toFixed(4)}\n`;
    msg += `Rango: $${(max - min).toFixed(4)}\n\n`;
    msg += monthlyState.is_exchanged
      ? `✅ Sueldo ya cambiado este mes`
      : `⏳ Sueldo pendiente de cambiar`;

    await ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // ---- /config ----
  bot.command("config", async (ctx) => {
    await ctx.reply(
      `⚙️ *Configuración actual*\n\n` +
      `Umbral de alerta: ${config.alert_threshold_percent}%\n` +
      `Días para tendencia bajista: ${config.trend_decline_days}\n` +
      `Comisión por dólar: $${config.default_commission.toFixed(2)}\n` +
      `Sueldo base: $${config.default_salary_usd.toLocaleString()} USD\n` +
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

  // ---- /set_commission <amount> ----
  bot.command("set_commission", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value < 0) {
      await ctx.reply("Uso: `/set_commission 0.10` (pesos por dólar)", { parse_mode: "Markdown" });
      return;
    }
    config.default_commission = value;
    setSetting("default_commission", value.toString());
    await ctx.reply(`✅ Comisión actualizada a $${value.toFixed(2)}/USD`);
  });

  // ---- /set_salary <amount> ----
  bot.command("set_salary", async (ctx) => {
    const value = parseFloat(ctx.message?.text?.split(" ")[1] || "");
    if (isNaN(value) || value <= 0) {
      await ctx.reply("Uso: `/set_salary 6000` (dólares)", { parse_mode: "Markdown" });
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
