# Dollar Check Bot

Bot de Telegram que monitorea el tipo de cambio USD/MXN y envía alertas inteligentes para optimizar el cambio de sueldo mensual vía Deel.

## Stack Técnico

- **Runtime:** Bun (con `bun:sqlite` integrado)
- **Bot Framework:** grammy
- **API:** Open Exchange Rates (plan gratuito, polling cada hora)
- **Base de datos:** SQLite (en CIAB: `BOTTLE_SQLITE_MAIN`; en local: `./data/`)
- **Dashboard:** React 19 + Recharts, servido por el mismo `Bun.serve` (HTML import de Bun)
- **Deploy:** app de [Cloud in a Bottle](https://cloudinabottle.org) (CIAB) en el VPS, construida desde el `Dockerfile`

## Arquitectura

```
src/
├── index.ts      # Entry point, polling loop, graceful shutdown
├── server.ts     # HTTP (Bun.serve :8080): /, /health, /api/context, /api/dashboard
├── dashboard.ts  # buildDashboard(): el JSON del dashboard y sus fórmulas (solo lectura)
├── preview.ts    # Dashboard sin bot, con datos de ejemplo: `bun run web` (solo dev)
├── web/          # Front del dashboard (index.html, App.tsx, components/, styles.css)
├── secrets.ts    # Lee los secrets de la app Secrets de CIAB → process.env
├── healthcheck.ts # checkRateFreshness(): ¿la DB sigue recibiendo tasas?
├── context.ts    # CLI: imprime buildContext() (dev local / bottle app ssh)
├── types.ts      # Tipos (incluye DashboardData) + helper estimateDeelMxn()
├── config.ts     # Carga de env (loadConfig/loadTunables), resolveDbPath() y fechas
├── database.ts   # Capa de datos con bun:sqlite
├── exchange.ts   # Cliente de Open Exchange Rates API
├── stats.ts      # Motor estadístico (SMA, EMA, volatilidad, momentum)
├── alerts.ts     # Motor de alertas y evaluación de condiciones
├── analyze.ts    # Análisis AI vía Claude CLI (Bun.spawn)
└── bot.ts        # Bot de Telegram, comandos y middleware
```

## Lógica de Negocio

### Modelo de Comisiones (Deel)
Deel cobra al cambiar USD→MXN:
- **Tarifa de cambio:** ~$106.65 USD (fee fija deducida del bruto en USD)
- **Spread:** ~0.75% sobre la tasa de mercado (ej: mercado 17.35 → Deel te da 17.25)
- **Flujo real:** `neto_usd = bruto_usd - tarifa_usd` → `MXN = neto_usd × tasa_deel`
- **Tasa efectiva real:** `MXN_recibido / neto_usd` (lo que realmente obtienes por dólar)
- Los datos exactos se registran con `/changed` tal como aparecen en Deel

### Ciclo Mensual
- El sueldo llega el último día del mes (~$6,097.24 USD brutos, ~$5,990.59 netos)
- El usuario cambia todo su sueldo de una sola vez (para evitar comisiones)
- Al registrar un cambio (`/changed`), las alertas se pausan hasta el siguiente mes
- La última semana del mes, el bot intensifica las alertas (threshold reducido al 50%)

### Thresholds
- **Manual dinámico:** Se usa la tasa efectiva del último cambio como referencia
- **Tendencia:** Si el dólar baja N días consecutivos, alerta para cambiar pronto
- **Umbral configurable:** Porcentaje mínimo de variación para disparar alerta (default: 0.15%)
- Las alertas comparan MXN estimados vs MXN reales del último cambio (no solo tasas)

### Análisis Estadístico (sin AI)
- SMA (Simple Moving Average) de 7 y 30 días
- EMA (Exponential Moving Average) de 7 días
- Volatilidad (desviación estándar de últimos 7 días)
- Momentum (tasa de cambio en 5 días)
- Detección de días consecutivos en misma dirección

### Recomendaciones
- `strong_buy`: Tasa significativamente arriba del último cambio con momentum positivo
- `buy`: Tasa moderadamente arriba o bajando desde un buen nivel
- `hold`: Sin cambios significativos
- `watch`: Tendencia bajista, vigilar
- `change_now`: Caída sostenida, cambiar de inmediato

## Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/status` | Tasa actual, tendencia, recomendación |
| `/refresh` | Consultar tasa en tiempo real |
| `/changed <tasa> <bruto_usd> <mxn> <tarifa> [YYYY-MM]` | Registrar cambio de sueldo |
| `/reset` | Reactivar alertas del mes actual |
| `/seed [días]` | Cargar datos históricos de OXR |
| `/history` | Historial de cambios (últimos 12) |
| `/stats` | Estadísticas acumuladas |
| `/month` | Resumen del mes actual |
| `/analyze` | Análisis AI del tipo de cambio (roto en el contenedor → usar la skill del Mac) |
| `/config` | Ver configuración actual |
| `/set_threshold <pct>` | Cambiar umbral de alerta |
| `/set_spread <pct>` | Cambiar spread de Deel |
| `/set_fee <monto>` | Cambiar fee fija de Deel |
| `/set_salary <monto>` | Cambiar sueldo en USD |

## Dashboard

`https://dollar-check.<zona>/`, detrás del login de owner de CIAB. Una página de
solo lectura: recomendación y MXN de hoy vs. el último cambio, tarjetas (tasa,
tasa Deel, costo de Deel, tendencia), la gráfica de la tasa con la línea de
**empate con el último cambio**, y el historial con "vs. día promedio del mes".
Las acciones (`/changed`, `/set_*`) siguen en Telegram.

- **Las fórmulas viven en `src/dashboard.ts`**, con pruebas en
  `src/tests/dashboard.test.ts`; el front solo pinta el JSON de `/api/dashboard`.
- **Días y meses se agrupan en la zona de la config** (`America/Mexico_City`),
  no en UTC como `getDailyRates()`: lo de 18:00–24:00 caería en el día siguiente.
- **Rangos de la gráfica:** 24 h y 7 días (default) pintan cada lectura de OXR
  (`intraday`, una por hora) porque sirven para decidir el día del cambio;
  30/90 días y 1 año pintan el promedio diario (`daily`) y sirven para comparar
  meses. `?rango=24h|7d|30d|90d|365d` en la URL fija el rango (para marcadores).
- **El historial es una fila por mes** (la de `id` más alto) y se ordena por
  `month`. La columna `rate` de un `/changed` diferido es la tasa de OXR del
  momento del comando, así que el dashboard no la usa.
- **Nunca `...config` en el payload**: `BotConfig` trae el token de Telegram y
  el app id de OXR. `buildDashboard()` recibe `BotSettings` y copia campo por campo.
- **`GET /` y el HTML llegan inyectados en `startServer()`**: solo `index.ts` y
  `preview.ts` importan `./web/index.html`. Sin él, `/` contesta una línea de
  texto (lo que usan las pruebas; también le basta al sondeo de CIAB).
- Colores y marcas siguen la paleta de referencia de la skill de dataviz;
  los estados siempre llevan ícono + texto, nunca solo color.

## Setup

1. Obtener token de bot en Telegram vía @BotFather
2. Obtener chat ID vía @userinfobot
3. Registrar app en https://openexchangerates.org/signup/free
4. En CIAB: guardar los 3 valores en la app Secrets (ver DEPLOY.md)
5. En local: copiar `.env.example` a `.env` y llenarlo

### CIAB (deploy actual)

El bot es una app de Cloud in a Bottle: CIAB clona el repo de GitHub, construye
el `Dockerfile` con Podman y lo corre según `cloudinabottle.toml`. No hay
auto-deploy: tras un push, "update" en la página de la app (o
`bottle app reload dollar-check --update --wait`).
**El runbook completo está en [DEPLOY.md](DEPLOY.md)** — crear la app, secrets,
respaldos, decisiones de diseño y troubleshooting.

Puntos que hay que tener presentes al tocar el código:

- **La app tiene que contestar HTTP.** CIAB sondea `GET /` los primeros 60s;
  si no responde la marca en error y no la levanta tras un reboot. Por eso
  `src/index.ts` arranca `startServer()` antes de pedir secrets o crear el bot.
- **El contenedor corre un bundle, no `src/`.** El `Dockerfile` hace
  `bun run build` (server + dashboard empaquetados AOT en `dist/`, grammy
  incluido) y arranca `bun --no-install index.js` **desde `dist/`**: Bun busca
  los archivos del dashboard relativos al directorio de trabajo, y desde otro
  cwd el proceso muere con `Bundled file "./index-….js" not found`. Así un error
  del front falla el build y no el `GET /` en runtime.
- **Nunca correr `dist/index.js` en local**: arranca el bot (409 con CIAB). Para
  probar el bundle, empaqueta `src/preview.ts` y córrelo desde su carpeta.
- **CIAB no inyecta variables propias**, solo `BOTTLE_*`. Los 3 requeridos llegan
  de la app Secrets como `DOLLAR_CHECK_<NOMBRE>` vía `loadBottleSecrets()`; lo
  demás usa los defaults de `config.ts` y los `/set_*` persistidos. Una key
  nueva va en `grants` del manifest y en `SECRET_KEYS` de `src/secrets.ts`.
- El SQLite vive en `BOTTLE_SQLITE_MAIN` (`resolveDbPath()`), dentro del
  directorio que respalda CIAB. El contenedor corre como root a propósito
  (mounts `:idmap`); no agregar `USER` ni `VOLUME` al `Dockerfile`.
- `.env` no está en git y solo sirve fuera de CIAB.
- Solo puede haber **una** instancia viva: dos long-pollers con el mismo token
  dan 409 en Telegram. Ojo al correr `bun run dev` con el token de producción.
- Todas las rutas HTTP quedan detrás del login de owner de CIAB. El router le
  reenvía a la app el `Authorization` del owner: no loguear headers.
- **`/analyze` no funciona dentro del contenedor**: la imagen no trae el CLI de
  `claude` que invoca `src/analyze.ts` vía `Bun.spawn`. El reemplazo es la skill
  `/analyze` de Claude Code (ver abajo).

### Legado: macOS launchd

`scripts/{setup,start,stop,restart,status,logs}.sh` y
`com.dollarcheck.bot.plist` son del deploy anterior con launchd en el Mac
Studio. Se conservan como referencia; no correrlos en paralelo con la app de
CIAB. El deploy intermedio con Docker Compose se retiró (queda en el historial
de git).

### Skill `/analyze` (reemplazo del comando del bot)

Vive en `.claude/skills/analyze/SKILL.md` y está versionada con el repo. Desde
Claude Code en el Mac, `/analyze` trae el snapshot de datos de la app en CIAB y
hace el análisis del lado del cliente:

```bash
bottle curl https://dollar-check.<zona>/api/context
```

`GET /api/context` devuelve el mismo contexto que `buildContext()` le pasaba a
la AI dentro del bot (solo lectura del SQLite; no consulta OXR). El prompt del
analista es el mismo `ANALYSIS_SYSTEM_PROMPT` de `src/analyze.ts`, así que la
respuesta es equivalente a la del viejo `/analyze` de Telegram.

### Desarrollo
```bash
bun run web     # dashboard sin bot en :3000, con HMR y datos de ejemplo (data/preview.db)
bun run test    # = bun test src (hay pruebas viejas en .claude/worktrees/)
bun run build   # el bundle de producción en dist/ (lo que corre el contenedor)
bun run dev     # el bot completo: ¡usa el token de producción → 409 con CIAB!
```

`bun run web` no pide secrets, no llama a OXR ni arranca el bot. Variables:
`PREVIEW_DB` (otra base; no usa `DB_PATH` porque Bun carga `.env` y ahí puede
apuntar a tu base real), `PREVIEW_SEED=0` (sin datos de ejemplo, para ver los
estados vacíos) y `PREVIEW_PORT`.

## Variables de Entorno

En CIAB los 3 requeridos llegan de la app Secrets (`DOLLAR_CHECK_TELEGRAM_BOT_TOKEN`,
etc.) y el resto usa su default; en local todo sale de `.env`.

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Sí | - | Token del bot de Telegram |
| `TELEGRAM_CHAT_ID` | Sí | - | ID del chat autorizado |
| `OXR_APP_ID` | Sí | - | App ID de Open Exchange Rates |
| `POLL_INTERVAL_MINUTES` | No | 60 | Intervalo de polling en minutos |
| `ALERT_THRESHOLD_PERCENT` | No | 0.15 | % mínimo de cambio para alertar |
| `TREND_DECLINE_DAYS` | No | 3 | Días consecutivos de baja para alertar |
| `SALARY_DAY` | No | 0 | Día de pago (0 = último del mes) |
| `DEFAULT_SALARY_USD` | No | 6097.24 | Sueldo mensual bruto en USD |
| `DEFAULT_SPREAD_PERCENT` | No | 0.75 | Spread de Deel en % |
| `DEFAULT_FEE_USD` | No | 106.65 | Tarifa de cambio de Deel en USD |
| `TZ` | No | America/Mexico_City | Zona horaria |
| `DB_PATH` | No | data/dollar-check.db | Ruta del SQLite fuera de CIAB |
| `PORT` | No | 8080 | Puerto HTTP (debe coincidir con `port` del manifest) |
| `PREVIEW_DB` / `PREVIEW_SEED` / `PREVIEW_PORT` | No | `data/preview.db` / on / 3000 | Solo `bun run web` |
| `BOTTLE_*` | — | — | Los inyecta CIAB: `BOTTLE_SQLITE_MAIN` (gana a `DB_PATH`), `BOTTLE_ROUTER_URL` y `BOTTLE_APP_TOKEN` (secrets) |

## Datos Importantes

- Cada centavo en el tipo de cambio equivale a ~$60 MXN con un sueldo de ~$6,000 USD
- Deel cobra ~$106.65 USD de tarifa + ~0.75% de spread sobre la tasa de mercado
- El plan gratuito de OXR actualiza cada hora, suficiente para decisiones a nivel de días
- La base de datos SQLite persiste entre reinicios (en CIAB, en el directorio de datos de la app)
- CIAB corre el contenedor con `restart=unless-stopped` y lo levanta tras un reboot
- Usar `/seed 30` al iniciar por primera vez para tener contexto histórico
