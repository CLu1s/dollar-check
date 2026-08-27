// ============================================
// Dollar Check Bot - Snapshot de datos (CLI)
// ============================================
// Imprime en stdout el mismo contexto que /analyze le pasa a la AI, sin
// llamar a ningún modelo. Existe porque la imagen del contenedor no trae el
// CLI de `claude`: la skill `/analyze` del Mac corre esto por SSH y hace el
// análisis del lado de acá.
//
//   docker exec dollar-check bun run src/context.ts

import { initDatabase, applyPersistedSettings } from "./database";
import { loadConfig } from "./config";
import { buildContext } from "./analyze";

const config = loadConfig();
const db = initDatabase(process.env.DB_PATH || undefined);

try {
  console.log(buildContext(applyPersistedSettings(config)));
} finally {
  db.close();
}
