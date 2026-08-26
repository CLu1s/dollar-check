# Dollar Check Bot

Bot de Telegram que monitorea el tipo de cambio USD/MXN y envía alertas inteligentes para optimizar el cambio de sueldo mensual vía Deel.

## Stack Técnico

- **Runtime:** Bun (con `bun:sqlite` integrado)
- **Bot Framework:** grammy
- **API:** Open Exchange Rates (plan gratuito, polling cada hora)
- **Base de datos:** SQLite (persistida en `./data/`)
- **Deploy:** Docker Compose (imagen `dollar-check:latest`)

## Arquitectura

```
src/
├── index.ts      # Entry point, polling loop, graceful shutdown
├── types.ts      # Definiciones de tipos TypeScript + helper estimateDeelMxn()
├── config.ts     # Carga de .env y utilidades de fecha
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
| `/analyze` | Análisis AI del tipo de cambio (Claude CLI) |
| `/config` | Ver configuración actual |
| `/set_threshold <pct>` | Cambiar umbral de alerta |
| `/set_spread <pct>` | Cambiar spread de Deel |
| `/set_fee <monto>` | Cambiar fee fija de Deel |
| `/set_salary <monto>` | Cambiar sueldo en USD |

## Setup

1. Copiar `.env.example` a `.env`
2. Obtener token de bot en Telegram vía @BotFather
3. Obtener chat ID vía @userinfobot
4. Registrar app en https://openexchangerates.org/signup/free
5. Llenar las variables en `.env`

### Docker (deploy actual)

El deploy es por git: se empuja a GitHub y el VPS jala y reconstruye.
**El runbook completo está en [DEPLOY.md](DEPLOY.md)** — instalación desde cero,
respaldos, decisiones de diseño y troubleshooting.

```bash
bash scripts/deploy.sh          # desde el Mac: push + pull remoto + rebuild
bash scripts/install.sh         # en el VPS: primera instalación
docker compose logs -f bot      # logs
docker compose ps               # estado + healthy/unhealthy
bash scripts/backup.sh          # respaldar el volumen SQLite
```

Puntos que hay que tener presentes al tocar el código:

- El SQLite vive en el named volume `dollar-check-data`, no en `./data/`.
  La ruta la fija `DB_PATH` desde el compose.
- `.env` no está en git; se crea una vez por host.
- Solo puede haber **una** instancia viva: dos long-pollers con el mismo token
  dan 409 en Telegram.
- **`/analyze` no funciona dentro del contenedor**: la imagen no trae el CLI de
  `claude` que invoca `src/analyze.ts` vía `Bun.spawn`.

### Legado: macOS launchd

`scripts/{setup,start,stop,restart,status,logs}.sh` y
`com.dollarcheck.bot.plist` son del deploy anterior con launchd en el Mac
Studio. Se conservan como referencia; no correrlos en paralelo con el
contenedor.

### Desarrollo
```bash
bun run dev
```

## Variables de Entorno

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
| `DB_PATH` | No | data/dollar-check.db | Ruta del SQLite (Docker: `/app/data/dollar-check.db`) |

## Datos Importantes

- Cada centavo en el tipo de cambio equivale a ~$60 MXN con un sueldo de ~$6,000 USD
- Deel cobra ~$106.65 USD de tarifa + ~0.75% de spread sobre la tasa de mercado
- El plan gratuito de OXR actualiza cada hora, suficiente para decisiones a nivel de días
- La base de datos SQLite se guarda en `./data/` y persiste entre reinicios
- El bot corre en Docker con `restart: unless-stopped` (se reinicia automáticamente)
- Usar `/seed 30` al iniciar por primera vez para tener contexto histórico
