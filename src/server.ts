// ============================================
// Dollar Check Bot - Servidor HTTP
// ============================================
// CIAB necesita que la app conteste HTTP: tras arrancar sondea GET / durante
// 60s y, si no responde, la marca en error y no la vuelve a levantar después
// de un reboot. El mismo servidor sirve el dashboard (src/web/).
//
// Todas las rutas quedan detrás del login de owner de CIAB (no hay
// public_paths). El router le reenvía a la app el header Authorization del
// owner: no loguear headers.

import type { HTMLBundle, Server } from "bun";
import type { BotSettings } from "./types";
import { getLatestRate } from "./database";
import { checkRateFreshness } from "./healthcheck";
import { buildContext } from "./analyze";
import { buildDashboard } from "./dashboard";

const DEFAULT_PORT = 8080;

// Cambia cada hora y trae el sueldo: que no lo guarde ni el navegador ni un proxy.
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Arranca antes que el bot, así que la config llega después: getConfig()
 * devuelve null mientras el bot no termina de arrancar.
 *
 * `dashboard` es el HTML import de src/web/ y lo pasan index.ts y preview.ts.
 * Llega inyectado para que las pruebas no arranquen el bundler de React; sin
 * él, `/` contesta una línea de texto, que también le basta al sondeo de CIAB.
 */
export function startServer(
  getConfig: () => BotSettings | null,
  port = Number(process.env.PORT) || DEFAULT_PORT,
  dashboard?: HTMLBundle
): Server<undefined> {
  return Bun.serve({
    port,
    hostname: "0.0.0.0",
    // HMR en `bun run web`; el contenedor corre con NODE_ENV=production.
    development: process.env.NODE_ENV !== "production",
    routes: {
      "/": dashboard ?? textStatus,

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

      "/api/dashboard": () => {
        const config = getConfig();
        if (!config) {
          return Response.json({ error: "el bot aún no arranca" }, { status: 503, headers: NO_STORE });
        }
        return Response.json(buildDashboard(config), { headers: NO_STORE });
      },
    },

    fetch: () => new Response("Not found\n", { status: 404 }),

    error: (error) => {
      console.error("[HTTP] Error:", error);
      return new Response("Error\n", { status: 500 });
    },
  });
}

function textStatus(): Response {
  const latest = getLatestRate();
  const body = latest
    ? `Dollar Check — USD/MXN ${latest.rate.toFixed(4)} ` +
      `(${new Date(latest.timestamp * 1000).toISOString()})`
    : "Dollar Check — sin tasas todavía";
  return new Response(`${body}\n`);
}
