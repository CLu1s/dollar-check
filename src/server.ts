// ============================================
// Dollar Check Bot - Servidor HTTP
// ============================================
// CIAB necesita que la app conteste HTTP: tras arrancar sondea GET / durante
// 60s y, si no responde, la marca en error y no la vuelve a levantar después
// de un reboot. En Fase 2 este mismo servidor sirve el dashboard.
//
// Todas las rutas quedan detrás del login de owner de CIAB (no hay
// public_paths). El router le reenvía a la app el header Authorization del
// owner: no loguear headers.

import type { Server } from "bun";
import type { BotConfig } from "./types";
import { getLatestRate } from "./database";
import { checkRateFreshness } from "./healthcheck";
import { buildContext } from "./analyze";

const DEFAULT_PORT = 8080;

/**
 * Arranca antes que el bot, así que la config llega después: getConfig()
 * devuelve null mientras el bot no termina de arrancar.
 */
export function startServer(
  getConfig: () => BotConfig | null,
  port = Number(process.env.PORT) || DEFAULT_PORT
): Server<undefined> {
  return Bun.serve({
    port,
    hostname: "0.0.0.0",
    routes: {
      "/": () => {
        const latest = getLatestRate();
        const body = latest
          ? `Dollar Check — USD/MXN ${latest.rate.toFixed(4)} ` +
            `(${new Date(latest.timestamp * 1000).toISOString()})`
          : "Dollar Check — sin tasas todavía";
        return new Response(`${body}\n`);
      },

      "/health": () => {
        const config = getConfig();
        if (!config) {
          return Response.json(
            { ok: false, last_rate_age_minutes: null, message: "el bot aún no arranca" },
            { status: 503 }
          );
        }
        const health = checkRateFreshness(config.poll_interval_minutes);
        return Response.json(health, { status: health.ok ? 200 : 503 });
      },

      // Snapshot para la skill /analyze del Mac (mismo texto que buildContext()).
      "/api/context": () => {
        const config = getConfig();
        if (!config) return new Response("el bot aún no arranca\n", { status: 503 });
        return new Response(buildContext(config));
      },
    },

    fetch: () => new Response("Not found\n", { status: 404 }),

    error: (error) => {
      console.error("[HTTP] Error:", error);
      return new Response("Error\n", { status: 500 });
    },
  });
}
