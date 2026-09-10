// ============================================
// Dollar Check Bot - Secrets de CIAB
// ============================================
// CIAB no inyecta variables de entorno propias: solo pone BOTTLE_*. Los secrets
// viven en la app Secrets y se piden al router por HTTP al arrancar. Aquí se
// copian a process.env para que loadConfig() funcione igual que con .env.
//
// El namespace de la app Secrets es global a todas las apps, por eso las keys
// llevan el prefijo DOLLAR_CHECK_. Cada una tiene que estar declarada en
// `grants` de cloudinabottle.toml.

const SECRET_PREFIX = "DOLLAR_CHECK_";
const SECRET_KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "OXR_APP_ID"] as const;

const MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 5000;

interface SecretsResponse {
  secrets: Record<string, string>;
  missing: string[];
}

/**
 * Fuera de CIAB (sin BOTTLE_ROUTER_URL / BOTTLE_APP_TOKEN) no hace nada y manda
 * el .env. Nunca pisa una variable que ya exista, y nunca loguea valores.
 */
export async function loadBottleSecrets(retryDelayMs = RETRY_DELAY_MS): Promise<void> {
  const routerUrl = process.env.BOTTLE_ROUTER_URL;
  const appToken = process.env.BOTTLE_APP_TOKEN;
  if (!routerUrl || !appToken) return;

  const { secrets, missing } = await fetchSecrets(routerUrl, appToken, retryDelayMs);

  let loaded = 0;
  for (const key of SECRET_KEYS) {
    const value = secrets[SECRET_PREFIX + key];
    if (value && !process.env[key]) {
      process.env[key] = value;
      loaded++;
    }
  }

  console.log(`[Secrets] ${loaded}/${SECRET_KEYS.length} cargados de la app Secrets`);
  if (missing.length > 0) {
    console.error(`[Secrets] Faltan en la app Secrets: ${missing.join(", ")}`);
  }
}

async function fetchSecrets(
  routerUrl: string,
  appToken: string,
  retryDelayMs: number
): Promise<SecretsResponse> {
  const url = `${routerUrl.replace(/\/$/, "")}/api/services/v2/call/secrets/get`;
  let lastError: unknown;

  // El router puede tardar en contestar justo después de un reboot: reintenta
  // errores de red y 5xx, pero un 403 es de configuración y no se arregla solo.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keys: SECRET_KEYS.map((k) => SECRET_PREFIX + k) }),
      });

      if (res.status === 403) {
        throw new SecretsPermissionError(
          "La app Secrets rechazó la petición (403). Aprueba los grants de " +
          "cloudinabottle.toml en la página de la app en CIAB y recárgala."
        );
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = (await res.json()) as Partial<SecretsResponse>;
      return { secrets: body.secrets ?? {}, missing: body.missing ?? [] };
    } catch (error) {
      if (error instanceof SecretsPermissionError) throw error;
      lastError = error;
      console.error(`[Secrets] Intento ${attempt}/${MAX_ATTEMPTS} falló: ${error}`);
      if (attempt < MAX_ATTEMPTS) await Bun.sleep(retryDelayMs);
    }
  }

  throw new Error(`No se pudieron leer los secrets de CIAB: ${lastError}`);
}

class SecretsPermissionError extends Error {}
