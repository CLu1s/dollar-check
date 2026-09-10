---
name: analyze
description: Análisis del tipo de cambio USD/MXN usando los datos vivos del bot (app dollar-check en CIAB, en el VPS). Úsala cuando Luis pida /analyze, pregunte si le conviene cambiar el sueldo hoy, si espera, o quiera leer la tendencia del dólar.
---

# Análisis del dólar (datos del bot en CIAB)

Reemplaza al comando `/analyze` del bot de Telegram, que no funciona dentro del
contenedor: la imagen no trae el CLI de `claude` que `src/analyze.ts` invoca con
`Bun.spawn`. Aquí la app solo aporta los datos y **el análisis lo haces tú**, en
esta sesión.

## 1. Traer el snapshot

Un solo comando. `GET /api/context` devuelve exactamente el mismo contexto que
`buildContext()` le pasaba a la AI dentro del bot. `bottle curl` (CLI de Cloud
in a Bottle) le pone el token de owner, porque la ruta está detrás del login:

```bash
bottle curl https://dollar-check.<zona>/api/context
```

`<zona>` es el dominio de la instancia de CIAB de Luis. Si todavía aparece como
`<zona>` en este archivo, pregúntaselo una vez y reemplázalo aquí.

Sin el CLI, lo mismo con curl y un token de `bottle tokens create`:
`curl -fsS --max-redirs 0 -H "Authorization: Bearer $BOTTLE_TOKEN" https://dollar-check.<zona>/api/context`.

Es de solo lectura: lee el SQLite de la app, no toca OXR ni gasta cuota de la API.

### Si falla

| Salida | Qué pasó | Qué hacer |
|---|---|---|
| `command not found: bottle` | falta el CLI de CIAB en el Mac | avisar a Luis (https://cloudinabottle.org/docs/operation/cli.html) o usar la variante con curl |
| redirect / HTML de `/login` | sin sesión de owner o token vencido | avisar a Luis que renueve la sesión del CLI o el token |
| `503 el bot aún no arranca` | la app está arrancando o se trabó leyendo secrets | esperar un minuto; si sigue, que Luis revise los logs de la app en CIAB |
| 404 / timeout / `Connection refused` | la app no existe, está parada o el VPS no responde | reportarlo, no reintentar en bucle |
| contexto sin `TASAS DIARIAS` | base vacía | pedirle a Luis que mande `/seed 30` al bot en Telegram |
| contexto sin `ÚLTIMO CAMBIO REGISTRADO` | la app no tiene historial de `/changed` | analiza igual, pero di explícitamente que no hay referencia real contra la cual comparar los MXN |

No inventes el snapshot ni lo sustituyas por la base local de `./data/` sin
decirlo: esa copia es vieja y llevaría a una recomendación equivocada.

## 2. Analizar

Actúa como analista financiero del par USD/MXN. Luis cobra su sueldo en USD y lo
cambia completo a MXN una vez al mes vía Deel (tarifa fija + spread), así que la
única decisión que importa es **cambiar hoy o esperar**.

Reglas:

- Español, máximo 300 palabras, directo.
- Cuantifica en MXN: cada centavo de la tasa son ~$60 MXN sobre un sueldo de ~$6,000 USD.
  Compara siempre contra los MXN reales del último cambio registrado, no solo contra tasas.
- Apóyate en los números del snapshot (SMA 7/30, EMA, volatilidad, momentum, días
  consecutivos) y di cuáles pesan en tu conclusión.
- Si los datos no alcanzan para una recomendación fuerte, dilo en vez de adornarla.
- No inventes datos que no estén en el contexto. No consultes noticias ni otras
  fuentes salvo que Luis lo pida explícitamente.

Si Luis acompañó la invocación con una pregunta (`/analyze ¿aguanto a fin de mes?`),
respóndela con estos mismos datos.

## 3. Responder

En la terminal, sin preámbulo:

```
🎯 <cambiar hoy | esperar | vigilar> — <una línea con el porqué>

📊 <2-4 bullets con los factores que sí mueven la decisión>

💰 <el número: cuántos MXN recibirías hoy vs. el último cambio>
```

Cierra con el umbral concreto que dispararía la acción contraria
("si toca 17.10 vale la pena; abajo de 16.85 mejor espera").
