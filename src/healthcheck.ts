// ============================================
// Dollar Check Bot - Health check
// ============================================
// La señal de vida es la propia base de datos: si sigue registrando tasas, el
// bot está haciendo su trabajo. Lo expone GET /health (src/server.ts).

import { getDb } from "./database";

export interface HealthStatus {
  ok: boolean;
  /** Minutos desde la última tasa registrada; null si aún no hay ninguna. */
  last_rate_age_minutes: number | null;
  message: string;
}

export function checkRateFreshness(pollMinutes: number): HealthStatus {
  // Tolera un par de polls perdidos (caídas de OXR) antes de marcar unhealthy.
  const maxAgeMinutes = pollMinutes * 3;

  const row = getDb()
    .query("SELECT MAX(created_at) AS last FROM exchange_rates")
    .get() as { last: string | null } | null;

  if (!row?.last) {
    return { ok: false, last_rate_age_minutes: null, message: "aún no hay tasas registradas" };
  }

  // created_at lo escribe SQLite con datetime('now'), siempre en UTC.
  const ageMinutes = Math.round(
    (Date.now() - Date.parse(`${row.last.replace(" ", "T")}Z`)) / 60_000
  );

  if (ageMinutes > maxAgeMinutes) {
    return {
      ok: false,
      last_rate_age_minutes: ageMinutes,
      message: `última tasa hace ${ageMinutes}min (máximo ${maxAgeMinutes}min)`,
    };
  }

  return { ok: true, last_rate_age_minutes: ageMinutes, message: `última tasa hace ${ageMinutes}min` };
}
