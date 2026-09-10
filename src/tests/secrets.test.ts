// ============================================
// Test Suite: Secrets de CIAB
// ============================================

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import type { Server } from "bun";
import { loadBottleSecrets } from "../secrets";

const ENV_KEYS = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "OXR_APP_ID",
  "BOTTLE_ROUTER_URL",
  "BOTTLE_APP_TOKEN",
];

// Router falso: responde con la cola `responses` (la última se repite).
let router: Server<undefined>;
let requests: { auth: string | null; body: any }[] = [];
let responses: (() => Response)[] = [];

beforeAll(() => {
  router = Bun.serve({
    port: 0,
    routes: {
      "/api/services/v2/call/secrets/get": async (req) => {
        requests.push({ auth: req.headers.get("authorization"), body: await req.json() });
        const next = responses.length > 1 ? responses.shift()! : responses[0];
        return next();
      },
    },
    fetch: () => new Response("Not found", { status: 404 }),
  });
});

afterAll(() => {
  router.stop(true);
});

// Bun carga el .env local en `bun test`: aislar el entorno de cada prueba.
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  requests = [];
  responses = [];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

function inCiab(): void {
  process.env.BOTTLE_ROUTER_URL = router.url.origin;
  process.env.BOTTLE_APP_TOKEN = "app-token";
}

const allSecrets = () =>
  Response.json({
    secrets: {
      DOLLAR_CHECK_TELEGRAM_BOT_TOKEN: "bot-token",
      DOLLAR_CHECK_TELEGRAM_CHAT_ID: "12345",
      DOLLAR_CHECK_OXR_APP_ID: "oxr-id",
    },
    missing: [],
  });

describe("loadBottleSecrets", () => {
  test("fuera de CIAB no llama al router ni toca el entorno", async () => {
    responses = [allSecrets];
    await loadBottleSecrets(0);

    expect(requests).toHaveLength(0);
    expect(process.env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  test("pide las keys con prefijo y las copia sin prefijo a process.env", async () => {
    inCiab();
    responses = [allSecrets];
    await loadBottleSecrets(0);

    expect(requests).toHaveLength(1);
    expect(requests[0].auth).toBe("Bearer app-token");
    expect(requests[0].body.keys).toEqual([
      "DOLLAR_CHECK_TELEGRAM_BOT_TOKEN",
      "DOLLAR_CHECK_TELEGRAM_CHAT_ID",
      "DOLLAR_CHECK_OXR_APP_ID",
    ]);
    expect(process.env.TELEGRAM_BOT_TOKEN).toBe("bot-token");
    expect(process.env.TELEGRAM_CHAT_ID).toBe("12345");
    expect(process.env.OXR_APP_ID).toBe("oxr-id");
  });

  test("no pisa una variable que ya existe", async () => {
    inCiab();
    process.env.OXR_APP_ID = "desde-env";
    responses = [allSecrets];
    await loadBottleSecrets(0);

    expect(process.env.OXR_APP_ID).toBe("desde-env");
    expect(process.env.TELEGRAM_BOT_TOKEN).toBe("bot-token");
  });

  test("keys faltantes no truenan aquí: loadConfig() se queja después", async () => {
    inCiab();
    responses = [
      () =>
        Response.json({
          secrets: { DOLLAR_CHECK_OXR_APP_ID: "oxr-id" },
          missing: ["DOLLAR_CHECK_TELEGRAM_BOT_TOKEN", "DOLLAR_CHECK_TELEGRAM_CHAT_ID"],
        }),
    ];
    await loadBottleSecrets(0);

    expect(process.env.OXR_APP_ID).toBe("oxr-id");
    expect(process.env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  test("un 403 (grants sin aprobar) falla de inmediato, sin reintentar", async () => {
    inCiab();
    responses = [() => Response.json({ error: "permission_required" }, { status: 403 })];

    await expect(loadBottleSecrets(0)).rejects.toThrow(/grants/);
    expect(requests).toHaveLength(1);
  });

  test("reintenta errores 5xx hasta que el router contesta", async () => {
    inCiab();
    responses = [
      () => new Response("starting", { status: 503 }),
      () => new Response("starting", { status: 503 }),
      allSecrets,
    ];
    await loadBottleSecrets(0);

    expect(requests).toHaveLength(3);
    expect(process.env.TELEGRAM_BOT_TOKEN).toBe("bot-token");
  });

  test("se rinde tras agotar los reintentos", async () => {
    inCiab();
    responses = [() => new Response("down", { status: 500 })];

    await expect(loadBottleSecrets(0)).rejects.toThrow(/No se pudieron leer los secrets/);
    expect(requests).toHaveLength(6);
  });
});
