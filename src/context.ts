// ============================================
// Dollar Check Bot - Snapshot de datos (CLI)
// ============================================
// Imprime en stdout el mismo contexto que /analyze le pasa a la AI, sin
// llamar a ningún modelo. En producción la skill `/analyze` del Mac lo lee de
// GET /api/context (src/server.ts); esto queda para dev local o para correrlo
// dentro del contenedor de CIAB:
//
//   bun run src/context.ts
//   bottle app ssh dollar-check bun run src/context.ts

import { initDatabase, applyPersistedSettings } from "./database";
import { loadConfig, resolveDbPath } from "./config";
import { loadBottleSecrets } from "./secrets";
import { buildContext } from "./analyze";

await loadBottleSecrets();
const config = loadConfig();
const db = initDatabase(resolveDbPath());

try {
  console.log(buildContext(applyPersistedSettings(config)));
} finally {
  db.close();
}
