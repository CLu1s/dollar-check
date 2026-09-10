// ============================================
// Test Suite: Servidor HTTP
// ============================================

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import type { Server } from "bun";
import { initDatabase, saveRate } from "../database";
import { startServer } from "../server";
import type { BotConfig } from "../types";

const config: BotConfig = {
  telegram_bot_token: "test",
  telegram_chat_id: "1",
  oxr_app_id: "test",
  poll_interval_minutes: 60,
  alert_threshold_percent: 0.15,
  trend_decline_days: 3,
  salary_day: 0,
  timezone: "America/Mexico_City",
  default_salary_usd: 6097.24,
  default_spread_percent: 0.75,
  default_fee_usd: 106.65,
};

let server: Server<undefined>;
let currentConfig: BotConfig | null;

beforeEach(() => {
  initDatabase(":memory:");
  currentConfig = null;
  server = startServer(() => currentConfig, 0);
});

afterEach(() => {
  server.stop(true);
});

const get = (path: string) => fetch(new URL(path, server.url));

describe("GET /", () => {
  test("contesta 200 aunque todavía no haya tasas (sondeo de arranque de CIAB)", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("sin tasas todavía");
  });

  test("muestra la última tasa", async () => {
    saveRate(17.3456, Math.floor(Date.now() / 1000));
    const res = await get("/");
    expect(await res.text()).toContain("USD/MXN 17.3456");
  });
});

describe("GET /health", () => {
  test("503 mientras el bot no arranca", async () => {
    const res = await get("/health");
    expect(res.status).toBe(503);
    expect((await res.json()).message).toBe("el bot aún no arranca");
  });

  test("503 sin tasas registradas", async () => {
    currentConfig = config;
    const res = await get("/health");
    expect(res.status).toBe(503);
    expect((await res.json()).last_rate_age_minutes).toBeNull();
  });

  test("200 con una tasa reciente", async () => {
    currentConfig = config;
    saveRate(17.35, Math.floor(Date.now() / 1000));
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, last_rate_age_minutes: 0 });
  });
});

describe("GET /api/context", () => {
  test("503 mientras el bot no arranca", async () => {
    expect((await get("/api/context")).status).toBe(503);
  });

  test("devuelve el snapshot de buildContext()", async () => {
    currentConfig = config;
    saveRate(17.35, Math.floor(Date.now() / 1000));
    const res = await get("/api/context");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("17.35");
  });
});

test("rutas desconocidas dan 404", async () => {
  expect((await get("/nope")).status).toBe(404);
});
