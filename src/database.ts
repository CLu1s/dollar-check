// ============================================
// Dollar Check Bot - Database Layer (bun:sqlite)
// ============================================

import { Database } from "bun:sqlite";
import type {
  ExchangeRate,
  SalaryExchange,
  MonthlyState,
  DailyRate,
  ExchangeStats,
} from "./types";
import { getCurrentMonth } from "./config";

let db: Database;

export function initDatabase(dbPath: string = "data/dollar-check.db"): Database {
  // Ensure data directory exists
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (dir) {
    const fs = require("fs");
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'openexchangerates',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS salary_exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      deel_rate REAL NOT NULL DEFAULT 0,
      gross_usd REAL NOT NULL DEFAULT 0,
      fee_usd REAL NOT NULL DEFAULT 0,
      amount_usd REAL NOT NULL,
      amount_mxn REAL NOT NULL,
      spread_percent REAL NOT NULL DEFAULT 0.75,
      effective_rate REAL NOT NULL,
      exchanged_at TEXT NOT NULL DEFAULT (datetime('now')),
      month TEXT NOT NULL,
      notes TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS monthly_state (
      current_month TEXT PRIMARY KEY,
      is_exchanged INTEGER NOT NULL DEFAULT 0,
      last_exchange_rate REAL,
      last_exchange_date TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migrate old schema: add new columns if missing
  try {
    db.run(`ALTER TABLE salary_exchanges ADD COLUMN deel_rate REAL NOT NULL DEFAULT 0`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(`ALTER TABLE salary_exchanges ADD COLUMN spread_percent REAL NOT NULL DEFAULT 0.75`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(`ALTER TABLE salary_exchanges ADD COLUMN gross_usd REAL NOT NULL DEFAULT 0`);
  } catch (_) { /* column already exists */ }
  try {
    db.run(`ALTER TABLE salary_exchanges ADD COLUMN fee_usd REAL NOT NULL DEFAULT 0`);
  } catch (_) { /* column already exists */ }

  // Create indexes for common queries
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_rates_timestamp
    ON exchange_rates(timestamp DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_rates_created
    ON exchange_rates(created_at DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_salary_month
    ON salary_exchanges(month DESC)
  `);

  return db;
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

// ---- Exchange Rates ----

export function saveRate(rate: number, timestamp: number, source: string = "openexchangerates"): void {
  getDb()
    .prepare("INSERT INTO exchange_rates (rate, timestamp, source) VALUES (?, ?, ?)")
    .run(rate, timestamp, source);
}

export function getLatestRate(): ExchangeRate | null {
  return getDb()
    .prepare("SELECT * FROM exchange_rates ORDER BY timestamp DESC LIMIT 1")
    .get() as ExchangeRate | null;
}

export function getRatesSince(hours: number): ExchangeRate[] {
  const since = Math.floor(Date.now() / 1000) - hours * 3600;
  return getDb()
    .prepare("SELECT * FROM exchange_rates WHERE timestamp >= ? ORDER BY timestamp ASC")
    .all(since) as ExchangeRate[];
}

export function getDailyRates(days: number): DailyRate[] {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  return getDb()
    .prepare(`
      SELECT
        date(timestamp, 'unixepoch') as date,
        AVG(rate) as avg_rate,
        MIN(rate) as min_rate,
        MAX(rate) as max_rate
      FROM exchange_rates
      WHERE timestamp >= ?
      GROUP BY date(timestamp, 'unixepoch')
      ORDER BY date DESC
    `)
    .all(since) as DailyRate[];
}

export function getRatesForMonth(month: string): ExchangeRate[] {
  return getDb()
    .prepare(`
      SELECT * FROM exchange_rates
      WHERE strftime('%Y-%m', timestamp, 'unixepoch') = ?
      ORDER BY timestamp ASC
    `)
    .all(month) as ExchangeRate[];
}

// ---- Salary Exchanges ----

export function saveSalaryExchange(exchange: Omit<SalaryExchange, "id">): void {
  getDb()
    .prepare(`
      INSERT INTO salary_exchanges
        (rate, deel_rate, gross_usd, fee_usd, amount_usd, amount_mxn, spread_percent, effective_rate, exchanged_at, month, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      exchange.rate,
      exchange.deel_rate,
      exchange.gross_usd,
      exchange.fee_usd,
      exchange.amount_usd,
      exchange.amount_mxn,
      exchange.spread_percent,
      exchange.effective_rate,
      exchange.exchanged_at,
      exchange.month,
      exchange.notes || null
    );
}

export function getLastSalaryExchange(): SalaryExchange | null {
  return getDb()
    .prepare("SELECT * FROM salary_exchanges ORDER BY exchanged_at DESC LIMIT 1")
    .get() as SalaryExchange | null;
}

export function getSalaryExchangeHistory(limit: number = 12): SalaryExchange[] {
  return getDb()
    .prepare("SELECT * FROM salary_exchanges ORDER BY exchanged_at DESC LIMIT ?")
    .all(limit) as SalaryExchange[];
}

export function getExchangeStats(): ExchangeStats | null {
  const stats = getDb()
    .prepare(`
      SELECT
        COUNT(*) as total_exchanges,
        AVG(effective_rate) as avg_rate,
        MAX(effective_rate) as best_rate,
        MIN(effective_rate) as worst_rate,
        SUM(amount_usd) as total_usd_exchanged,
        SUM(amount_mxn) as total_mxn_received
      FROM salary_exchanges
    `)
    .get() as any;

  if (!stats || stats.total_exchanges === 0) return null;

  const best = getDb()
    .prepare("SELECT month FROM salary_exchanges ORDER BY effective_rate DESC LIMIT 1")
    .get() as any;

  const worst = getDb()
    .prepare("SELECT month FROM salary_exchanges ORDER BY effective_rate ASC LIMIT 1")
    .get() as any;

  const avgMxn = stats.avg_rate * stats.total_usd_exchanged;
  const potentialDiff = stats.total_mxn_received - avgMxn;

  return {
    ...stats,
    best_month: best?.month || "N/A",
    worst_month: worst?.month || "N/A",
    potential_gain_loss_vs_avg: potentialDiff,
  };
}

// ---- Monthly State ----

export function getMonthlyState(): MonthlyState {
  const month = getCurrentMonth();

  let state = getDb()
    .prepare("SELECT * FROM monthly_state WHERE current_month = ?")
    .get(month) as any;

  if (!state) {
    const lastExchange = getLastSalaryExchange();
    const lastRate = lastExchange?.effective_rate || 0;
    const lastDate = lastExchange?.exchanged_at || "";

    getDb()
      .prepare(`
        INSERT INTO monthly_state (current_month, is_exchanged, last_exchange_rate, last_exchange_date)
        VALUES (?, 0, ?, ?)
      `)
      .run(month, lastRate, lastDate);

    state = {
      current_month: month,
      is_exchanged: 0,
      last_exchange_rate: lastRate,
      last_exchange_date: lastDate,
    };
  }

  return {
    is_exchanged: !!state.is_exchanged,
    last_exchange_rate: state.last_exchange_rate || 0,
    last_exchange_date: state.last_exchange_date || "",
    current_month: state.current_month,
  };
}

export function markMonthAsExchanged(rate: number, month?: string): void {
  const targetMonth = month || getCurrentMonth();

  getDb()
    .prepare(`
      INSERT OR IGNORE INTO monthly_state (current_month, is_exchanged, last_exchange_rate, last_exchange_date)
      VALUES (?, 0, 0, '')
    `)
    .run(targetMonth);

  getDb()
    .prepare(`
      UPDATE monthly_state
      SET is_exchanged = 1, last_exchange_rate = ?, last_exchange_date = datetime('now')
      WHERE current_month = ?
    `)
    .run(rate, targetMonth);
}

export function resetMonthExchange(): void {
  const month = getCurrentMonth();
  getDb()
    .prepare(`
      UPDATE monthly_state
      SET is_exchanged = 0
      WHERE current_month = ?
    `)
    .run(month);
}

// ---- Settings ----

export function getSetting(key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM bot_settings WHERE key = ?")
    .get(key) as any;
  return row?.value || null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(`
      INSERT INTO bot_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `)
    .run(key, value, value);
}
