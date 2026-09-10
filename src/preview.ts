// ============================================
// Dollar Check Bot - Preview del dashboard (solo dev local)
// ============================================
// Levanta el dashboard SIN el bot, para trabajar la UI con HMR:
//
//   bun run web                      → http://localhost:3000 con data/preview.db
//   PREVIEW_DB=otra.db bun run web   → otra base (si está vacía, también la llena)
//   PREVIEW_SEED=0 bun run web       → sin datos de ejemplo (estados vacíos)
//
// No pide secrets, no llama a OXR y no arranca el bot: no hay riesgo de 409 con
// la instancia de CIAB. Usa PREVIEW_DB y no DB_PATH porque Bun carga .env solo,
// y ahí DB_PATH puede apuntar a tu base local de verdad.

import dashboard from "./web/index.html";
import {
  initDatabase,
  getDb,
  applyPersistedSettings,
  getLatestRate,
  saveRate,
  saveSalaryExchange,
} from "./database";
import { loadTunables } from "./config";
import { startServer } from "./server";
import { localDateOf } from "./dashboard";
import type { BotSettings } from "./types";

const dbPath = process.env.PREVIEW_DB || "data/preview.db";
const port = Number(process.env.PREVIEW_PORT) || 3000;

initDatabase(dbPath);
const settings = applyPersistedSettings(loadTunables());

// --hot vuelve a ejecutar este módulo en cada cambio: llenar solo si está vacía.
if (process.env.PREVIEW_SEED !== "0" && !getLatestRate()) {
  getDb().transaction(() => seedExampleData(settings))();
  console.log(`[Preview] ${dbPath} llenada con datos de ejemplo`);
}

const server = startServer(() => settings, port, dashboard);
console.log(`[Preview] Dashboard en ${server.url} (base: ${dbPath})`);

/**
 * ~200 días de tasas con la forma de la base real (una lectura diaria como las
 * de /seed y cada hora las últimas 2 semanas) y un cambio en cada uno de los 5
 * meses anteriores. Deterministas: mismo resultado en cada corrida.
 */
function seedExampleData(s: BotSettings): void {
  let seed = 42;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const noise = () => random() + random() + random() - 1.5;
  const round = (x: number, digits: number) => Math.round(x * 10 ** digits) / 10 ** digits;

  const HOUR = 3600;
  const now = Math.floor(Date.now() / 1000);
  const liveFrom = now - 14 * 86400;
  const dateOf = localDateOf(s.timezone);
  const monthOf = (t: number) => dateOf(t).slice(0, 7);

  // Caminata aleatoria que regresa hacia 18.30, hora por hora
  let rate = 18.6;
  const closeOfMonth = new Map<string, number>();
  for (let t = now - 200 * 86400; t <= now; t += HOUR) {
    rate += 0.004 * (18.3 - rate) + 0.02 * noise();
    const isDailyClose = new Date(t * 1000).getUTCHours() === 23; // OXR cierra a medianoche UTC
    if (t >= liveFrom) saveRate(round(rate, 4), t);
    else if (isDailyClose) saveRate(round(rate, 4), t, "openexchangerates-historical");
    closeOfMonth.set(monthOf(t), rate);
  }

  const netUsd = s.default_salary_usd - s.default_fee_usd;
  const months = [...closeOfMonth.keys()].sort().slice(0, -1).slice(-5);
  for (const month of months) {
    const market = closeOfMonth.get(month)!;
    const deelRate = round(market * (1 - s.default_spread_percent / 100) + 0.03 * noise(), 4);
    const amountMxn = round(netUsd * deelRate, 2);
    saveSalaryExchange({
      rate: round(market, 4),
      deel_rate: deelRate,
      gross_usd: s.default_salary_usd,
      fee_usd: s.default_fee_usd,
      amount_usd: netUsd,
      amount_mxn: amountMxn,
      spread_percent: s.default_spread_percent,
      effective_rate: amountMxn / netUsd,
      exchanged_at: `${month}-28T20:00:00.000Z`,
      month,
    });
  }
}
