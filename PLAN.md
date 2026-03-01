# Plan: Adaptar modelo de comisiones a Deel

## Problema
El bot usa `commission_per_dollar = 0.10` (lineal por dólar). Deel cobra diferente:
- **Spread:** ~0.75% sobre la tasa de mercado (17.21 → 17.08)
- **Fee fija:** $106.50 MXN por transacción
- **Salario real:** $5,981.52 USD (varía por deducciones, no siempre $6,000)

## Cambios propuestos

### 1. types.ts - Nuevos tipos
- Reemplazar `commission_per_dollar` en `SalaryExchange` por `spread_percent` + `fixed_fee_mxn`
- Reemplazar `default_commission` en `BotConfig` por `default_spread_percent` + `default_fixed_fee_mxn`
- `effective_rate` pasa a significar: `MXN realmente recibido / USD cambiados` (tasa real que obtuviste)

### 2. config.ts - Nuevas variables de entorno
- `DEFAULT_SPREAD_PERCENT=0.75` (reemplaza DEFAULT_COMMISSION)
- `DEFAULT_FIXED_FEE_MXN=106.50` (nuevo)

### 3. database.ts - Migración de schema
- Alterar tabla `salary_exchanges`: agregar columnas `spread_percent` y `fixed_fee_mxn`, eliminar `commission_per_dollar`
- Función helper: `calculateEstimatedMxn(marketRate, salaryUsd, spreadPercent, fixedFee)`
- Función helper: `calculateEffectiveRate(mxnReceived, salaryUsd)`

### 4. bot.ts - Comandos actualizados
- `/changed` acepta datos reales de Deel: `/changed <tasa_deel> <usd> [mxn_recibido] [YYYY-MM]`
  - Si pasas MXN recibido, lo usa directo
  - Si no, lo estima con spread + fee
- `/refresh` y `/status` muestran estimación real: "Con tu sueldo de $5,981 USD recibirías ~$X MXN"
- Reemplazar `/set_commission` por `/set_spread` y `/set_fee`
- `/config` muestra spread % y fee fija

### 5. alerts.ts - Alertas basadas en MXN real
- En lugar de comparar tasas, comparar **MXN estimados**: "Hoy recibirías $102,500 vs $101,800 del mes pasado (+$700 MXN)"
- El threshold se aplica sobre la diferencia en MXN, no en porcentaje de tasa
- Más intuitivo: "ganarías $700 más" vs "la tasa subió 0.4%"

### 6. stats.ts - Formato de mensajes
- `formatTrendMessage` muestra impacto en MXN reales (con spread + fee incluidos)
- Estadísticas comparan MXN recibidos reales

### 7. index.ts - Restaurar settings actualizados
- Cargar `spread_percent` y `fixed_fee_mxn` de bot_settings

## Flujo del usuario después del cambio

```
/changed 17.08 5981.52 102059.80         → Registro con datos exactos de Deel
/changed 17.08 5981.52                    → Registro estimando MXN con spread+fee
/status                                    → "Hoy recibirías ~$102,400 MXN (+$340 vs enero)"
Alerta push                               → "Con tu sueldo recibirías $700 más que el mes pasado"
```

## Notas
- Los datos del mercado (OXR) siguen siendo la tasa de mercado pura
- La conversión a "lo que realmente recibes" se hace al momento de mostrar/alertar
- El análisis estadístico (SMA, tendencia) sigue usando tasa de mercado (es lo que varía)
- Solo las comparaciones personales usan el modelo Deel
