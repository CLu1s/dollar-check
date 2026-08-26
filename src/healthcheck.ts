// ============================================
// Dollar Check Bot - Container healthcheck
// ============================================
// El bot no expone HTTP, así que la señal de vida es la propia base de datos:
// si sigue registrando tasas, está haciendo su trabajo. Exit 0 = healthy.

import { Database } from "bun:sqlite";

const dbPath = process.env.DB_PATH || "data/dollar-check.db";
const pollMinutes = parseInt(process.env.POLL_INTERVAL_MINUTES || "60");

// Tolera un par de polls perdidos (caídas de OXR) antes de marcar unhealthy.
const maxAgeSeconds = pollMinutes * 60 * 3;

try {
  const db = new Database(dbPath, { readonly: true });
  const row = db
    .query("SELECT MAX(created_at) AS last FROM exchange_rates")
    .get() as { last: string | null } | null;
  db.close();

  if (!row?.last) {
    console.error("healthcheck: aún no hay tasas registradas");
    process.exit(1);
  }

  // created_at lo escribe SQLite con datetime('now'), siempre en UTC.
  const ageSeconds = (Date.now() - Date.parse(`${row.last.replace(" ", "T")}Z`)) / 1000;

  if (ageSeconds > maxAgeSeconds) {
    console.error(
      `healthcheck: última tasa hace ${Math.round(ageSeconds / 60)}min ` +
      `(máximo ${maxAgeSeconds / 60}min)`
    );
    process.exit(1);
  }

  console.log(`healthcheck: ok (última tasa hace ${Math.round(ageSeconds / 60)}min)`);
} catch (error) {
  console.error("healthcheck: error:", error);
  process.exit(1);
}
