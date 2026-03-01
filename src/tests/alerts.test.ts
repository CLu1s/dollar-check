// ============================================
// Test Suite: Alert Engine
// ============================================

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { unlinkSync, existsSync } from "fs";
import {
  initDatabase,
  saveRate,
  saveSalaryExchange,
  markMonthAsExchanged,
  getMonthlyState,
  resetMonthExchange,
} from "../database";
import { evaluateAlerts } from "../alerts";
import type { BotConfig } from "../types";

const TEST_DB = "/tmp/test-alerts.db";

function makeConfig(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    telegram_bot_token: "test",
    telegram_chat_id: "test",
    oxr_app_id: "test",
    poll_interval_minutes: 60,
    alert_threshold_percent: 0.15,
    trend_decline_days: 3,
    salary_day: 0,
    timezone: "America/Mexico_City",
    default_salary_usd: 6097.24,
    default_spread_percent: 0.75,
    default_fee_usd: 106.65,
    ...overrides,
  };
}

function makeExchange(overrides: any = {}) {
  return {
    rate: 17.35, deel_rate: 17.25, gross_usd: 6097.24, fee_usd: 106.65,
    amount_usd: 5990.59, amount_mxn: 103333.04, spread_percent: 0.577,
    effective_rate: 103333.04 / 5990.59,
    exchanged_at: "2026-01-31T12:00:00Z", month: "2026-01",
    ...overrides,
  };
}

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

describe("Alert Engine", () => {
  test("should not alert when no rate data exists", () => {
    const result = evaluateAlerts(makeConfig());
    expect(result.shouldNotify).toBe(false);
  });

  test("should not alert when no previous exchange exists", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.35, now);

    const result = evaluateAlerts(makeConfig());
    expect(result.alerts.filter(a => a.type === "threshold_up").length).toBe(0);
  });

  test("should not alert when month is already exchanged", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.80, now);

    saveSalaryExchange(makeExchange({
      exchanged_at: new Date().toISOString(), month: getCurrentMonth(),
    }));

    getMonthlyState();
    markMonthAsExchanged(17.25);

    const result = evaluateAlerts(makeConfig());
    expect(result.shouldNotify).toBe(false);
    expect(result.fullMessage).toContain("pausadas");
  });

  test("should alert when rate is significantly above last exchange", () => {
    const now = Math.floor(Date.now() / 1000);
    // Current market rate much higher than last exchange
    saveRate(17.80, now);

    saveSalaryExchange(makeExchange());

    const result = evaluateAlerts(makeConfig());
    expect(result.shouldNotify).toBe(true);
    expect(result.alerts.some(a => a.type === "threshold_up")).toBe(true);

    const upAlert = result.alerts.find(a => a.type === "threshold_up")!;
    expect(upAlert.change_mxn).toBeGreaterThan(0);
    expect(upAlert.estimated_mxn).toBeGreaterThan(103333.04);
  });

  test("should NOT alert when rate improvement is below threshold", () => {
    const now = Math.floor(Date.now() / 1000);
    // Rate barely above last (17.36 vs 17.35 = minimal change)
    saveRate(17.36, now);

    saveSalaryExchange(makeExchange());

    const result = evaluateAlerts(makeConfig());
    expect(result.alerts.filter(a => a.type === "threshold_up").length).toBe(0);
  });

  test("should reactivate alerts after /reset", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.80, now);

    saveSalaryExchange(makeExchange({
      exchanged_at: new Date().toISOString(), month: getCurrentMonth(),
    }));

    getMonthlyState();
    markMonthAsExchanged(17.25);

    let result = evaluateAlerts(makeConfig());
    expect(result.shouldNotify).toBe(false);

    resetMonthExchange();
    result = evaluateAlerts(makeConfig());
    expect(result.shouldNotify).toBe(true);
  });

  test("should compare MXN amounts, not just rates", () => {
    const now = Math.floor(Date.now() / 1000);
    saveRate(17.80, now);

    saveSalaryExchange(makeExchange());

    const result = evaluateAlerts(makeConfig());
    if (result.shouldNotify) {
      const alert = result.alerts[0];
      expect(alert.estimated_mxn).toBeGreaterThan(0);
      expect(alert.change_mxn).toBeGreaterThan(0);
      expect(alert.message).toContain("MXN");
    }
  });

  test("should NOT trigger threshold_up when market rate unchanged from last exchange", () => {
    const now = Math.floor(Date.now() / 1000);
    // Current market rate = same as when they last exchanged (17.35)
    saveRate(17.35, now);

    saveSalaryExchange(makeExchange());

    // If market rate hasn't changed, estimated MXN should be ~same as last time
    const result = evaluateAlerts(makeConfig());
    expect(result.alerts.filter(a => a.type === "threshold_up").length).toBe(0);
  });
});

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
