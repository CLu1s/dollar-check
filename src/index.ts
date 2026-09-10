// ============================================
// Dollar Check Bot - Entry Point
// ============================================

import { initDatabase, applyPersistedSettings } from "./database";
import { loadConfig, resolveDbPath } from "./config";
import { loadBottleSecrets } from "./secrets";
import { startServer } from "./server";
import { fetchCurrentRate } from "./exchange";
import { evaluateAlerts } from "./alerts";
import { createBot, sendAlert } from "./bot";
import type { BotConfig } from "./types";
import dashboard from "./web/index.html";

console.log("🤑 Dollar Check Bot starting...");

// Initialize database (en CIAB la ruta viene de BOTTLE_SQLITE_MAIN)
const db = initDatabase(resolveDbPath());
console.log("✅ Database initialized");

// HTTP antes que nada: CIAB sondea GET / durante los primeros 60s
let readyConfig: BotConfig | null = null;
const server = startServer(() => readyConfig, undefined, dashboard);
console.log(`✅ HTTP listening on :${server.port}`);

// Secrets de CIAB → process.env (fuera de CIAB no hace nada y manda .env)
await loadBottleSecrets();

// Load config from environment
const config = loadConfig();

// Restore persisted settings (/set_threshold, /set_spread, /set_fee, /set_salary)
applyPersistedSettings(config);

// Create and start bot
const bot = createBot(config);
readyConfig = config;

// ---- Polling Loop ----
async function pollAndAlert(): Promise<void> {
  try {
    console.log(`[Poll] Fetching rate at ${new Date().toISOString()}`);
    await fetchCurrentRate(config.oxr_app_id);

    const result = evaluateAlerts(config);

    if (result.shouldNotify) {
      console.log(`[Poll] Sending ${result.alerts.length} alert(s)`);
      await sendAlert(bot, config.telegram_chat_id, result.fullMessage);
    } else {
      console.log("[Poll] No alerts triggered");
    }
  } catch (error) {
    console.error("[Poll] Error:", error);
  }
}

// Start polling
const intervalMs = config.poll_interval_minutes * 60 * 1000;

// Initial poll after 5 seconds (let bot connect first)
setTimeout(pollAndAlert, 5000);

// Recurring poll
setInterval(pollAndAlert, intervalMs);
console.log(`✅ Polling every ${config.poll_interval_minutes} minutes`);

// Start bot (long polling for Telegram updates)
bot.start({
  onStart: () => {
    console.log("✅ Telegram bot is running");
    console.log(`📡 Polling OXR every ${config.poll_interval_minutes}min`);
    console.log(`⚡ Alert threshold: ${config.alert_threshold_percent}%`);
    console.log(`💰 Salary: $${config.default_salary_usd} USD`);
    console.log(`💸 Deel spread: ${config.default_spread_percent}% | Tarifa: $${config.default_fee_usd} USD`);
  },
});

// Graceful shutdown (CIAB da 10s entre SIGTERM y kill)
function shutdown(): void {
  console.log("\n🛑 Shutting down...");
  server.stop();
  bot.stop();
  db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
