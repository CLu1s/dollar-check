// ============================================
// Dollar Check Bot - Entry Point
// ============================================

import { initDatabase, getSetting } from "./database";
import { loadConfig } from "./config";
import { fetchCurrentRate } from "./exchange";
import { evaluateAlerts } from "./alerts";
import { createBot, sendAlert } from "./bot";

console.log("🤑 Dollar Check Bot starting...");

// Load config from environment
const config = loadConfig();

// Initialize database (DB_PATH lets the container point it at a mounted volume)
const db = initDatabase(process.env.DB_PATH || undefined);
console.log("✅ Database initialized");

// Restore persisted settings
const savedThreshold = getSetting("alert_threshold_percent");
if (savedThreshold) config.alert_threshold_percent = parseFloat(savedThreshold);

const savedSpread = getSetting("default_spread_percent");
if (savedSpread) config.default_spread_percent = parseFloat(savedSpread);

const savedFee = getSetting("default_fee_usd");
if (savedFee) config.default_fee_usd = parseFloat(savedFee);

const savedSalary = getSetting("default_salary_usd");
if (savedSalary) config.default_salary_usd = parseFloat(savedSalary);

// Create and start bot
const bot = createBot(config);

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

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  bot.stop();
  db.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down...");
  bot.stop();
  db.close();
  process.exit(0);
});
