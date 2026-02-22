# Dollar Check Bot

Bot de Telegram que monitorea el tipo de cambio USD/MXN y envía alertas inteligentes para optimizar el cambio de sueldo mensual.

## Stack Técnico

- **Runtime:** Bun (con `bun:sqlite` integrado)
- **Bot Framework:** grammy
- **API:** Open Exchange Rates (plan gratuito, polling cada hora)
- **Base de datos:** SQLite (persistida en `./data/`)
- **Deploy:** Docker + docker-compose en VPS

## Arquitectura

```
src/
├── index.ts      # Entry point, polling loop, graceful shutdown
├── types.ts      # Definiciones de tipos TypeScript
├── config.ts     # Carga de .env y utilidades de fecha
├── database.ts   # Capa de datos con bun:sqlite
├── exchange.ts   # Cliente de Open Exchange Rates API
├── stats.ts      # Motor estadístico (SMA, EMA, volatilidad, momentum)
├── alerts.ts     # Motor de alertas y evaluación de condiciones
└── bot.ts        # Bot de Telegram, comandos y middleware
```

## Lógica de Negocio

### Ciclo Mensual
- El sueldo llega el último día del mes
- El usuario cambia todo su sueldo de una sola vez (para evitar comisiones)
- Al registrar un cambio (`/changed`), las alertas se pausan hasta el siguiente mes
- La última semana del mes, el bot intensifica las alertas (threshold reducido al 50%)

### Thresholds
- **Manual dinámico:** Se usa la tasa efectiva del último cambio como referencia
- **Tendencia:** Si el dólar baja N días consecutivos, alerta para cambiar pronto
- **Umbral configurable:** Porcentaje mínimo de variación para disparar alerta (default: 0.15%)

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
| `/changed <tasa> [monto]` | Registrar cambio de sueldo |
| `/history` | Historial de cambios (últimos 12) |
| `/stats` | Estadísticas acumuladas |
| `/month` | Resumen del mes actual |
| `/config` | Ver configuración actual |
| `/set_threshold <pct>` | Cambiar umbral de alerta |
| `/set_commission <monto>` | Cambiar comisión por dólar |
| `/set_salary <monto>` | Cambiar sueldo en USD |

## Setup

1. Copiar `.env.example` a `.env`
2. Obtener token de bot en Telegram vía @BotFather
3. Obtener chat ID vía @userinfobot
4. Registrar app en https://openexchangerates.org/signup/free
5. Llenar las variables en `.env`

### Desarrollo local
```bash
bun install
bun run dev
```

### Deploy con Docker
```bash
docker compose up -d --build
```

### Ver logs
```bash
docker compose logs -f
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
| `DEFAULT_SALARY_USD` | No | 6000 | Sueldo mensual en USD |
| `DEFAULT_COMMISSION` | No | 0.10 | Comisión por dólar de la plataforma |
| `TZ` | No | America/Mexico_City | Zona horaria |

## Datos Importantes

- Cada centavo en el tipo de cambio equivale a $60 MXN con un sueldo de $6,000 USD
- La comisión promedio de la plataforma de cambio es $0.10 MXN por dólar
- El plan gratuito de OXR actualiza cada hora, suficiente para decisiones a nivel de días
- La base de datos SQLite se guarda en `./data/` y persiste entre reinicios del contenedor
