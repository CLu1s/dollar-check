// ============================================
// Test Suite: Cliente de Open Exchange Rates
// ============================================

import { describe, test, expect, spyOn, afterEach } from "bun:test";
import { fetchHistoricalRate } from "../exchange";

afterEach(() => {
  (globalThis.fetch as any).mockRestore?.();
});

describe("fetchHistoricalRate", () => {
  test("devuelve el timestamp de OXR, que es el que /seed debe guardar", async () => {
    // Cierre del 2026-09-08 según OXR: 23:00 UTC = 17:00 en México, mismo día
    const oxrTimestamp = Date.UTC(2026, 8, 8, 23) / 1000;
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ timestamp: oxrTimestamp, base: "USD", rates: { MXN: 18.6123 } })
    );

    const result = await fetchHistoricalRate("app-id", "2026-09-08");

    expect(result).toEqual({ rate: 18.6123, timestamp: oxrTimestamp });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/historical/2026-09-08.json");
  });

  test("falla con el status de OXR", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 429 }));
    await expect(fetchHistoricalRate("app-id", "2026-09-08")).rejects.toThrow("429");
  });
});
