// ============================================
// Test Suite: Database Layer
// ============================================

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import {
  initDatabase,
  saveRate,
  getLatestRate,
  getDailyRates,
  saveSalaryExchange,
  getLastSalaryExchange,
  getSalaryExchangeHistory,
  getExchangeStats,
  getMonthlyState,
  markMonthAsExchanged,
  resetMonthExchange,
  setSetting,
  getSetting,
} from "../database";

const TEST_DB = "/tmp/test-dollar-check.db";

beforeEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  if (existsSync(TEST_DB + "-wal")) unlinkSync(TEST_DB + "-wal");
  if (existsSync(TEST_DB + "-shm")) unlinkSync(TEST_DB + "-shm");
  initDatabase(TEST_DB);
});

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  if (existsSync(TEST_DB + "-wal")) unlinkSync(TEST_DB + "-wal");
  if (existsSync(TEST_DB + "-shm")) unlinkSync(TEST_DB + "-shm");
});

// ---- Exchange Rates ----

describe("Exchange Rates", () => {
  test("should save and retrieve a rate", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.21, now);

    const latest = getLatestRate();
    expect(latest).not.toBeNull();
    expect(latest!.rate).toBe(17.21);
    expect(latest!.timestamp).toBe(now);
  });

  test("should return latest rate by timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.10, now - 3600);
    saveRate(17.21, now);
    saveRate(17.15, now - 7200);

    const latest = getLatestRate();
    expect(latest!.rate).toBe(17.21);
  });

  test("should return null when no rates exist", () => {
    const latest = getLatestRate();
    expect(latest).toBeNull();
  });

  test("should aggregate daily rates", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.10, now);
    saveRate(17.20, now + 60);
    saveRate(17.30, now + 120);

    const daily = getDailyRates(1);
    expect(daily.length).toBeGreaterThanOrEqual(1);
    expect(daily[0].avg_rate).toBeCloseTo(17.20, 1);
    expect(daily[0].min_rate).toBe(17.10);
    expect(daily[0].max_rate).toBe(17.30);
  });

  test("should group seeded historical rates by their real date, not insertion date", () => {
    // This simulates /seed: rates are inserted NOW but represent past dates
    const now = Math.floor(Date.now() / 1000);
    const oneDay = 86400;

    // Insert 3 rates for 3 different past days (all inserted "now")
    saveRate(17.10, now - oneDay * 3); // 3 days ago
    saveRate(17.20, now - oneDay * 2); // 2 days ago
    saveRate(17.30, now - oneDay * 1); // yesterday

    const daily = getDailyRates(7);

    // Should have 3 separate days, NOT 1 day
    expect(daily.length).toBe(3);

    // Most recent first (ORDER BY date DESC)
    expect(daily[0].avg_rate).toBe(17.30);
    expect(daily[1].avg_rate).toBe(17.20);
    expect(daily[2].avg_rate).toBe(17.10);
  });
});

// ---- Salary Exchanges (Deel USD fee model) ----

describe("Salary Exchanges", () => {
  test("should save and retrieve a salary exchange with Deel USD fee model", () => {
    saveSalaryExchange({
      rate: 17.35,
      deel_rate: 17.25,
      gross_usd: 6097.24,
      fee_usd: 106.65,
      amount_usd: 5990.59,
      amount_mxn: 103333.04,
      spread_percent: 0.577,
      effective_rate: 103333.04 / 5990.59,
      exchanged_at: "2026-03-01T12:00:00Z",
      month: "2026-03",
    });

    const last = getLastSalaryExchange();
    expect(last).not.toBeNull();
    expect(last!.rate).toBe(17.35);
    expect(last!.deel_rate).toBe(17.25);
    expect(last!.gross_usd).toBe(6097.24);
    expect(last!.fee_usd).toBe(106.65);
    expect(last!.amount_usd).toBe(5990.59);
    expect(last!.amount_mxn).toBe(103333.04);
    expect(last!.effective_rate).toBeCloseTo(17.2494, 3);
    expect(last!.month).toBe("2026-03");
  });

  test("should return exchanges in reverse chronological order", () => {
    saveSalaryExchange({
      rate: 17.10, deel_rate: 16.97, gross_usd: 6000, fee_usd: 100,
      amount_usd: 5900, amount_mxn: 101400, spread_percent: 0.75,
      effective_rate: 17.19, exchanged_at: "2025-12-31T12:00:00Z", month: "2025-12",
    });
    saveSalaryExchange({
      rate: 17.35, deel_rate: 17.25, gross_usd: 6097.24, fee_usd: 106.65,
      amount_usd: 5990.59, amount_mxn: 103333.04, spread_percent: 0.577,
      effective_rate: 17.2494, exchanged_at: "2026-03-01T12:00:00Z", month: "2026-03",
    });

    const history = getSalaryExchangeHistory(12);
    expect(history.length).toBe(2);
    expect(history[0].month).toBe("2026-03");
    expect(history[1].month).toBe("2025-12");
  });

  test("a past month registered later does not become the last exchange", () => {
    saveSalaryExchange({
      rate: 17.35, deel_rate: 17.25, gross_usd: 6097.24, fee_usd: 106.65,
      amount_usd: 5990.59, amount_mxn: 103333.04, spread_percent: 0.577,
      effective_rate: 17.2494, exchanged_at: "2026-09-01T12:00:00Z", month: "2026-08",
    });
    // Backfill de junio con /changed ... 2026-06, tecleado días después
    saveSalaryExchange({
      rate: 17.60, deel_rate: 17.10, gross_usd: 6097.24, fee_usd: 106.65,
      amount_usd: 5990.59, amount_mxn: 102439.09, spread_percent: 2.84,
      effective_rate: 17.10, exchanged_at: "2026-09-05T12:00:00Z", month: "2026-06",
    });

    expect(getLastSalaryExchange()!.month).toBe("2026-08");
    expect(getSalaryExchangeHistory(12).map((e) => e.month)).toEqual(["2026-08", "2026-06"]);
  });

  test("a corrected /changed for the same month wins over the first one", () => {
    const base = {
      rate: 17.35, gross_usd: 6097.24, fee_usd: 106.65, amount_usd: 5990.59,
      spread_percent: 0.577, exchanged_at: "2026-09-01T12:00:00Z", month: "2026-08",
    };
    saveSalaryExchange({ ...base, deel_rate: 17.52, amount_mxn: 104955.14, effective_rate: 17.52 });
    saveSalaryExchange({ ...base, deel_rate: 17.25, amount_mxn: 103333.04, effective_rate: 17.2494 });

    expect(getLastSalaryExchange()!.deel_rate).toBe(17.25);
  });

  test("should calculate exchange stats correctly", () => {
    saveSalaryExchange({
      rate: 17.10, deel_rate: 16.97, gross_usd: 6000, fee_usd: 100,
      amount_usd: 5900, amount_mxn: 101400, spread_percent: 0.75,
      effective_rate: 17.19, exchanged_at: "2025-12-31T12:00:00Z", month: "2025-12",
    });
    saveSalaryExchange({
      rate: 17.50, deel_rate: 17.37, gross_usd: 6097.24, fee_usd: 106.65,
      amount_usd: 5990.59, amount_mxn: 103800, spread_percent: 0.75,
      effective_rate: 17.33, exchanged_at: "2026-01-31T12:00:00Z", month: "2026-01",
    });

    const stats = getExchangeStats();
    expect(stats).not.toBeNull();
    expect(stats!.total_exchanges).toBe(2);
    expect(stats!.best_rate).toBe(17.33);
    expect(stats!.worst_rate).toBe(17.19);
    expect(stats!.best_month).toBe("2026-01");
    expect(stats!.worst_month).toBe("2025-12");
    expect(stats!.total_mxn_received).toBeCloseTo(101400 + 103800, 0);
  });

  test("should return null stats when no exchanges", () => {
    const stats = getExchangeStats();
    expect(stats).toBeNull();
  });
});

// ---- Monthly State ----

describe("Monthly State", () => {
  test("should initialize as not exchanged", () => {
    const state = getMonthlyState();
    expect(state.is_exchanged).toBe(false);
  });

  test("should mark month as exchanged", () => {
    getMonthlyState();
    markMonthAsExchanged(17.25);

    const state = getMonthlyState();
    expect(state.is_exchanged).toBe(true);
    expect(state.last_exchange_rate).toBe(17.25);
  });

  test("should reset month exchange", () => {
    getMonthlyState();
    markMonthAsExchanged(17.25);
    resetMonthExchange();

    const state = getMonthlyState();
    expect(state.is_exchanged).toBe(false);
  });

  test("should mark specific past month without affecting current", () => {
    getMonthlyState();
    markMonthAsExchanged(17.25, "2026-01");

    const currentState = getMonthlyState();
    expect(currentState.is_exchanged).toBe(false);
  });

  test("should use last exchange rate as reference for new month", () => {
    saveSalaryExchange({
      rate: 17.35, deel_rate: 17.25, gross_usd: 6097.24, fee_usd: 106.65,
      amount_usd: 5990.59, amount_mxn: 103333.04, spread_percent: 0.577,
      effective_rate: 17.2494, exchanged_at: "2026-01-31T12:00:00Z", month: "2026-01",
    });

    const state = getMonthlyState();
    expect(state.last_exchange_rate).toBeCloseTo(17.25, 1);
  });
});

// ---- Settings ----

describe("Bot Settings", () => {
  test("should save and retrieve settings", () => {
    setSetting("alert_threshold_percent", "0.20");
    expect(getSetting("alert_threshold_percent")).toBe("0.20");
  });

  test("should update existing setting", () => {
    setSetting("default_spread_percent", "0.75");
    setSetting("default_spread_percent", "0.80");
    expect(getSetting("default_spread_percent")).toBe("0.80");
  });

  test("should return null for missing setting", () => {
    expect(getSetting("nonexistent")).toBeNull();
  });
});
