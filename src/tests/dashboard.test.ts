// ============================================
// Test Suite: Datos del dashboard (GET /api/dashboard)
// ============================================

import { describe, test, expect, beforeEach } from "bun:test";
import {
  initDatabase,
  getDb,
  saveRate,
  saveSalaryExchange,
  markMonthAsExchanged,
} from "../database";
import {
  buildDashboard,
  groupDaily,
  monthlyAverages,
  breakEvenRate,
  deelCost,
  vsMonthAverage,
} from "../dashboard";
import { estimateDeelMxn } from "../types";
import type { BotConfig, BotSettings, SalaryExchange } from "../types";

const TZ = "America/Mexico_City";

const settings: BotSettings = {
  poll_interval_minutes: 60,
  alert_threshold_percent: 0.15,
  trend_decline_days: 3,
  salary_day: 0,
  timezone: TZ,
  default_salary_usd: 6097.24,
  default_spread_percent: 0.75,
  default_fee_usd: 106.65,
};

const NET_USD = 6097.24 - 106.65; // 5990.59

/** Epoch en segundos de una hora UTC. México es UTC-6 todo el año. */
const utc = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h) / 1000;

function exchange(month: string, amountMxn: number, exchangedAt: string): Omit<SalaryExchange, "id"> {
  return {
    rate: 17.9,
    deel_rate: amountMxn / NET_USD,
    gross_usd: 6097.24,
    fee_usd: 106.65,
    amount_usd: NET_USD,
    amount_mxn: amountMxn,
    spread_percent: 0.75,
    effective_rate: amountMxn / NET_USD,
    exchanged_at: exchangedAt,
    month,
  };
}

beforeEach(() => {
  initDatabase(":memory:");
});

describe("groupDaily", () => {
  test("una tasa a las 20:00 de México cae en su día, no en el siguiente", () => {
    const eightPmMexico = utc(2026, 9, 10, 2); // 2026-09-10 02:00 UTC
    expect(groupDaily([{ timestamp: eightPmMexico, rate: 18.5 }], TZ)[0].date).toBe("2026-09-09");
    expect(groupDaily([{ timestamp: eightPmMexico, rate: 18.5 }], "UTC")[0].date).toBe("2026-09-10");
  });

  test("promedio, mínimo, máximo y lecturas por día, del más viejo al más nuevo", () => {
    const days = groupDaily(
      [
        { timestamp: utc(2026, 9, 9, 15), rate: 18.4 },
        { timestamp: utc(2026, 9, 8, 15), rate: 18.0 },
        { timestamp: utc(2026, 9, 9, 16), rate: 18.6 },
      ],
      TZ
    );
    expect(days).toEqual([
      { date: "2026-09-08", avg: 18.0, min: 18.0, max: 18.0, points: 1 },
      { date: "2026-09-09", avg: expect.closeTo(18.5, 10), min: 18.4, max: 18.6, points: 2 },
    ]);
  });
});

describe("monthlyAverages", () => {
  test("un día vivo (24 lecturas) y uno sembrado (1) pesan igual", () => {
    // 24 lecturas el 10 de agosto en hora de México (06:00 UTC = medianoche local)
    const live = Array.from({ length: 24 }, (_, h) => ({ timestamp: utc(2026, 8, 10, 6 + h), rate: 18.0 }));
    const seeded = [{ timestamp: utc(2026, 8, 11, 23), rate: 19.0 }];

    const month = monthlyAverages(groupDaily([...live, ...seeded], TZ)).get("2026-08");

    // Promediando lecturas daría 18.04; por días, 18.5
    expect(month).toEqual({ avg: 18.5, days: 2 });
  });
});

describe("fórmulas", () => {
  test("empate: a esa tasa de mercado recibirías exactamente lo del último cambio", () => {
    const lastMxn = 103333.04;
    const rate = breakEvenRate(lastMxn, NET_USD, 0.75)!;
    expect(estimateDeelMxn(rate, 6097.24, 0.75, 106.65).mxnReceived).toBeCloseTo(lastMxn, 6);
  });

  test("empate sin sentido (neto ≤ 0 o spread ≥ 100) da null, no Infinity", () => {
    expect(breakEvenRate(103333.04, 0, 0.75)).toBeNull();
    expect(breakEvenRate(103333.04, NET_USD, 100)).toBeNull();
  });

  test("costo de Deel: tarifa + spread suman lo que se pierde contra el mercado", () => {
    const cost = deelCost(18.0, 6097.24, 106.65, 0.75);
    expect(cost.fee_mxn).toBeCloseTo(1919.7, 6); // 106.65 × 18
    expect(cost.spread_mxn).toBeCloseTo(808.72965, 4); // 5990.59 × (18 − 17.865)
    expect(cost.total_mxn).toBeCloseTo(2728.42965, 4);
    const received = estimateDeelMxn(18.0, 6097.24, 0.75, 106.65).mxnReceived;
    expect(cost.total_mxn).toBeCloseTo(6097.24 * 18.0 - received, 6);
  });

  test("vs. día promedio del mes: signo y null con pocos días", () => {
    expect(vsMonthAverage(NET_USD, 105000, { avg: 17.8, days: 10 }, 0.75)).toBeCloseTo(-832.758235, 4);
    expect(vsMonthAverage(NET_USD, 105000, { avg: 17.8, days: 9 }, 0.75)).toBeNull();
    expect(vsMonthAverage(NET_USD, 105000, undefined, 0.75)).toBeNull();
  });
});

describe("buildDashboard", () => {
  test("base vacía: todo en null, sin inventar ceros", () => {
    const data = buildDashboard(settings);
    expect(data.latest).toBeNull();
    expect(data.today).toBeNull();
    expect(data.last_exchange).toBeNull();
    expect(data.vs_last).toBeNull();
    expect(data.break_even_rate).toBeNull();
    expect(data.trend).toBeNull();
    expect(data.daily).toEqual([]);
    expect(data.history).toEqual([]);
    expect(data.totals).toBeNull();
    expect(data.health.ok).toBe(false);
  });

  test("es de solo lectura: no crea la fila del mes como getMonthlyState()", () => {
    buildDashboard(settings);
    const row = getDb().query("SELECT COUNT(*) AS n FROM monthly_state").get() as { n: number };
    expect(row.n).toBe(0);
  });

  test("con tasa pero sin /changed: estimado sí, comparación y empate no", () => {
    saveRate(18.0, Math.floor(Date.now() / 1000));
    const data = buildDashboard(settings);

    expect(data.today!.mxn).toBeCloseTo(NET_USD * 18.0 * (1 - 0.0075), 6);
    expect(data.today!.deel_cost.total_mxn).toBeCloseTo(2728.42965, 4);
    expect(data.trend).not.toBeNull();
    expect(data.vs_last).toBeNull();
    expect(data.break_even_rate).toBeNull();
  });

  test("vs. último cambio por montos y empate contra ese cambio", () => {
    saveRate(18.0, Math.floor(Date.now() / 1000));
    saveSalaryExchange(exchange("2026-08", 106000, "2026-08-31T20:00:00Z"));
    const data = buildDashboard(settings);

    const today = NET_USD * 18.0 * (1 - 0.0075);
    expect(data.vs_last!.mxn).toBeCloseTo(today - 106000, 6);
    expect(data.vs_last!.percent).toBeCloseTo(((today - 106000) / 106000) * 100, 6);
    expect(estimateDeelMxn(data.break_even_rate!, 6097.24, 0.75, 106.65).mxnReceived).toBeCloseTo(106000, 6);
  });

  test("historial: una fila por mes, ordenado por mes aunque exchanged_at diga otra cosa", () => {
    saveSalaryExchange(exchange("2026-08", 106000, "2026-08-31T20:00:00Z"));
    saveSalaryExchange(exchange("2026-06", 104000, "2026-09-05T12:00:00Z")); // backfill tardío
    saveSalaryExchange(exchange("2026-08", 105500, "2026-09-01T12:00:00Z")); // /changed corregido

    const data = buildDashboard(settings);

    expect(data.history.map((h) => [h.month, h.amount_mxn])).toEqual([
      ["2026-08", 105500],
      ["2026-06", 104000],
    ]);
    expect(data.last_exchange!.amount_mxn).toBe(105500);
    expect(data.totals).toMatchObject({ count: 2, total_mxn: 209500, best_month: "2026-08", worst_month: "2026-06" });
  });

  test("historial: compara contra el promedio del mes solo con ≥ 10 días de tasas", () => {
    for (let day = 1; day <= 12; day++) saveRate(17.8, utc(2026, 8, day, 18));
    for (let day = 1; day <= 5; day++) saveRate(17.5, utc(2026, 7, day, 18));
    saveSalaryExchange(exchange("2026-08", 105000, "2026-08-31T20:00:00Z"));
    saveSalaryExchange(exchange("2026-07", 104000, "2026-07-31T20:00:00Z"));

    const [aug, jul] = buildDashboard(settings, Date.UTC(2026, 8, 10, 18)).history;

    expect(aug.days_with_data).toBe(12);
    expect(aug.market_avg).toBeCloseTo(17.8, 10);
    expect(aug.vs_avg_mxn).toBeCloseTo(-832.758235, 4);
    expect(jul.days_with_data).toBe(5);
    expect(jul.vs_avg_mxn).toBeNull();
  });

  test("la gráfica cubre 365 días; las tasas más viejas siguen contando para el historial", () => {
    const now = Date.UTC(2026, 8, 10, 18);
    saveRate(17.0, now / 1000 - 400 * 86400);
    saveRate(18.0, now / 1000 - 3600);

    const data = buildDashboard(settings, now);
    expect(data.daily.map((d) => d.avg)).toEqual([18.0]);
  });

  test("lecturas sueltas de los últimos 7 días para los rangos de 24 h y 7 días", () => {
    const now = Date.UTC(2026, 8, 10, 18);
    const t = now / 1000;
    saveRate(17.9, t - 8 * 86400); // fuera
    saveRate(18.1, t - 2 * 86400);
    saveRate(18.2, t - 3600);
    saveRate(18.2, t - 3600); // la misma lectura guardada dos veces (reinicio o /refresh)

    expect(buildDashboard(settings, now).intraday).toEqual([
      { timestamp: t - 2 * 86400, rate: 18.1 },
      { timestamp: t - 3600, rate: 18.2 },
    ]);
  });

  test("mes, días al pago y última semana, en hora de México", () => {
    const sep10 = buildDashboard(settings, Date.UTC(2026, 8, 10, 18)).month;
    expect(sep10).toEqual({ current: "2026-09", days_to_payday: 20, last_week: false, exchanged: false });

    expect(buildDashboard(settings, Date.UTC(2026, 8, 23, 18)).month).toMatchObject({
      days_to_payday: 7,
      last_week: true,
    });

    // 1 de octubre 03:00 UTC = 30 de septiembre 21:00 en México: sigue siendo el día de pago
    expect(buildDashboard(settings, Date.UTC(2026, 9, 1, 3)).month).toMatchObject({
      current: "2026-09",
      days_to_payday: 0,
    });
  });

  test("ya cambiado este mes", () => {
    markMonthAsExchanged(17.5, "2026-09");
    expect(buildDashboard(settings, Date.UTC(2026, 8, 10, 18)).month.exchanged).toBe(true);
  });

  test("nunca incluye los secrets aunque le pasen la BotConfig completa", () => {
    const config: BotConfig = {
      ...settings,
      telegram_bot_token: "123456:SECRET-TELEGRAM-TOKEN",
      telegram_chat_id: "987654321",
      oxr_app_id: "SECRET-OXR-APP-ID",
    };
    saveRate(18.0, Math.floor(Date.now() / 1000));
    const json = JSON.stringify(buildDashboard(config));

    expect(json).not.toContain("SECRET-TELEGRAM-TOKEN");
    expect(json).not.toContain("SECRET-OXR-APP-ID");
    expect(json).not.toContain("987654321");
  });
});
