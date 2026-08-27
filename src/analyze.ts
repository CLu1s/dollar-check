// ============================================
// Dollar Check Bot - AI Analysis via Claude CLI
// ============================================

import { getDailyRates, getLastSalaryExchange, getSalaryExchangeHistory, getLatestRate } from "./database";
import { analyzeTrend } from "./stats";
import type { BotConfig } from "./types";
import { estimateDeelMxn } from "./types";

/**
 * Build a data snapshot for Claude to analyze.
 * Lo usan /analyze (dentro del bot) y src/context.ts (para la skill del Mac).
 */
export function buildContext(config: BotConfig): string {
  const dailyRates = getDailyRates(30);
  const latestRate = getLatestRate();
  const lastExchange = getLastSalaryExchange();
  const history = getSalaryExchangeHistory(6);
  const trend = analyzeTrend(config.alert_threshold_percent);

  let ctx = "";

  // Current rate
  if (latestRate) {
    const estimated = estimateDeelMxn(
      latestRate.rate,
      config.default_salary_usd,
      config.default_spread_percent,
      config.default_fee_usd
    );
    ctx += `TASA ACTUAL: ${latestRate.rate.toFixed(4)} MXN/USD (${new Date(latestRate.timestamp * 1000).toISOString()})\n`;
    ctx += `ESTIMADO DEEL HOY: tasa Deel ${estimated.deelRate.toFixed(4)}, recibiría ~${estimated.mxnReceived.toFixed(0)} MXN\n\n`;
  }

  // Trend analysis
  ctx += `ANÁLISIS ESTADÍSTICO:\n`;
  ctx += `- Tendencia: ${trend.direction} (${trend.consecutive_days} días consecutivos)\n`;
  ctx += `- SMA 7d: ${trend.sma_7.toFixed(4)} | SMA 30d: ${trend.sma_30.toFixed(4)}\n`;
  ctx += `- EMA 7d: ${trend.ema_7.toFixed(4)}\n`;
  ctx += `- Volatilidad (7d): ${trend.volatility.toFixed(4)}\n`;
  ctx += `- Momentum (5d): ${trend.momentum >= 0 ? "+" : ""}${trend.momentum.toFixed(3)}%\n`;
  ctx += `- Cambio vs último exchange: ${trend.change_percent >= 0 ? "+" : ""}${trend.change_percent.toFixed(3)}%\n`;
  ctx += `- Recomendación estadística: ${trend.recommendation}\n\n`;

  // Daily rates (last 30 days)
  if (dailyRates.length > 0) {
    ctx += `TASAS DIARIAS (últimos ${dailyRates.length} días, más reciente primero):\n`;
    for (const d of dailyRates) {
      ctx += `  ${d.date}: avg=${d.avg_rate.toFixed(4)} min=${d.min_rate.toFixed(4)} max=${d.max_rate.toFixed(4)}\n`;
    }
    ctx += "\n";
  }

  // Last exchange
  if (lastExchange) {
    ctx += `ÚLTIMO CAMBIO REGISTRADO:\n`;
    ctx += `- Mes: ${lastExchange.month}\n`;
    ctx += `- Tasa mercado: ${lastExchange.rate.toFixed(4)}\n`;
    ctx += `- Tasa Deel: ${lastExchange.deel_rate.toFixed(4)}\n`;
    ctx += `- Bruto: $${lastExchange.gross_usd} USD | Tarifa: $${lastExchange.fee_usd} USD\n`;
    ctx += `- Neto convertido: $${lastExchange.amount_usd} USD\n`;
    ctx += `- Recibió: $${lastExchange.amount_mxn.toLocaleString()} MXN\n`;
    ctx += `- Tasa efectiva: ${lastExchange.effective_rate.toFixed(4)}\n\n`;
  }

  // Exchange history
  if (history.length > 1) {
    ctx += `HISTORIAL DE CAMBIOS (últimos ${history.length}):\n`;
    for (const ex of history) {
      ctx += `  ${ex.month}: tasa Deel ${ex.deel_rate.toFixed(4)}, ${ex.amount_mxn.toLocaleString()} MXN ($${ex.amount_usd} USD)\n`;
    }
    ctx += "\n";
  }

  // User config
  ctx += `CONFIGURACIÓN:\n`;
  ctx += `- Sueldo bruto: $${config.default_salary_usd} USD/mes\n`;
  ctx += `- Tarifa Deel: $${config.default_fee_usd} USD\n`;
  ctx += `- Spread Deel estimado: ${config.default_spread_percent}%\n`;
  ctx += `- Umbral de alerta: ${config.alert_threshold_percent}%\n`;

  return ctx;
}

/**
 * Prompt de sistema del analista. Lo comparten el /analyze del bot y la skill
 * `/analyze` del Mac, para que ambos den el mismo tipo de respuesta.
 */
export const ANALYSIS_SYSTEM_PROMPT = [
  "Eres un analista financiero especializado en el par USD/MXN.",
  "El usuario cobra su sueldo en USD y lo cambia a MXN una vez al mes vía Deel.",
  "Tu trabajo: analizar los datos proporcionados y dar una recomendación clara sobre si debería cambiar ahora, esperar, o estar atento.",
  "",
  "Reglas:",
  "- Responde en español, máximo 300 palabras",
  "- Sé directo y concreto: ¿cambiar hoy o esperar?",
  "- Cuantifica en MXN cuando sea posible (\"ganarías ~$X MXN más si...\")",
  "- Menciona los factores clave que observas en los datos",
  "- Si no hay suficiente información para una recomendación fuerte, dilo",
  "- NO uses markdown, solo texto plano con emojis para estructura",
  "- NO inventes datos que no estén en el contexto",
].join("\n");

/**
 * Run Claude CLI with the data and return its analysis
 */
export async function runAnalysis(config: BotConfig): Promise<string> {
  const context = buildContext(config);
  const systemPrompt = ANALYSIS_SYSTEM_PROMPT;

  const userPrompt = `Analiza estos datos del tipo de cambio USD/MXN y dame tu recomendación:\n\n${context}`;

  // Write prompt to a temp file to avoid command-line length limits
  const tmpFile = `/tmp/dollar-check-prompt-${Date.now()}.txt`;
  await Bun.write(tmpFile, userPrompt);

  try {
    const proc = Bun.spawn(
      [
        "claude",
        "-p",
        "--system-prompt", systemPrompt,
        "--no-session-persistence",
        "--model", "sonnet",
      ],
      {
        stdin: Bun.file(tmpFile),
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error("[Analyze] Claude CLI stderr:", stderr);
      console.error("[Analyze] Claude CLI stdout:", stdout);
      throw new Error(`Claude CLI falló (exit ${exitCode}): ${(stderr || stdout).slice(0, 200)}`);
    }

    return stdout.trim();
  } finally {
    // Clean up temp file
    try { await Bun.write(tmpFile, ""); require("fs").unlinkSync(tmpFile); } catch (_) {}
  }
}
