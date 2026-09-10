# Deploy — Dollar Check Bot

App de [Cloud in a Bottle](https://cloudinabottle.org) (CIAB) en el VPS. CIAB
clona este repo de GitHub, construye el `Dockerfile` con Podman y lo corre según
`cloudinabottle.toml`. El repo es la única fuente de verdad.

```
dollar-check/                  raíz del repo = contexto de build
├── cloudinabottle.toml        manifest de CIAB (puerto, SQLite, recursos, grants)
├── Dockerfile                 2 etapas: build (bun run build → dist/) y runtime
├── .dockerignore
├── .env                       solo dev local — NO versionado
├── DEPLOY.md                  este archivo
├── CLAUDE.md                  documentación del bot en sí
└── src/                       bot + server + dashboard (src/web/)
```

---

## Crear la app (primera vez)

1. **Secrets.** En la app Secrets de CIAB (`https://secrets.<zona>`) crear:

   | Key | Valor |
   |---|---|
   | `DOLLAR_CHECK_TELEGRAM_BOT_TOKEN` | token de @BotFather |
   | `DOLLAR_CHECK_TELEGRAM_CHAT_ID` | tu chat ID (@userinfobot) |
   | `DOLLAR_CHECK_OXR_APP_ID` | App ID de Open Exchange Rates |

   Llevan prefijo porque las keys de la app Secrets son globales a todas las apps.

2. **Una sola instancia.** Apaga cualquier otra copia del bot antes de seguir
   (dev local, launchd viejo, el contenedor de Docker Compose): dos long-pollers
   con el mismo token dan `409 Conflict` en Telegram.

3. **Deploy.** "Deploy New App" en el dashboard de CIAB con
   `https://github.com/CLu1s/dollar-check` (URL HTTPS; CIAB no acepta SSH) y
   aprueba los grants de Secrets en la página de instalación. Por CLI:

   ```bash
   bottle app deploy https://github.com/CLu1s/dollar-check --name dollar-check --grant-permissions-v2 --wait
   ```

4. **Sembrar el histórico — el paso que se olvida.** La base arranca vacía, y sin
   histórico `/status`, `/month` y `/analyze` no sirven: las medias móviles,
   la volatilidad y el momentum necesitan días previos. En Telegram:

   ```
   /seed 30
   ```

   Descarga 30 días de tasas de OXR (una llamada por día, ~15 s). Si vienes de
   otra instalación, vuelve a registrar los cambios con
   `/changed <tasa> <bruto> <mxn> <tarifa> <YYYY-MM>` usando el mismo mes que
   mostraba `/history`, y reaplica los `/set_*` que no estén en su default.

> **Cuota de OXR.** El plan gratuito da **1000 llamadas al mes** y el polling
> horario ya consume ~720. Cada arranque de la app gasta 1. `/seed 30` cabe de
> sobra; `/seed 90` queda justo; `/seed 365` **te pasa del límite** y el bot se
> queda ciego el resto del mes.

---

## Actualizar

CIAB no se entera solo de los push. Con todo en `main`:

```bash
git push origin main
```

y luego "update" en la página de la app en CIAB, o:

```bash
bottle app reload dollar-check --update --wait
```

Eso hace `git pull`, reconstruye la imagen y reinicia el contenedor. Si el
manifest agregó una key a `grants`, hay que aprobarla (el `reload --update` del
CLI la aprueba solo).

Antes de empujar, `bun run test` y `bun run build` en el Mac: si el build falla
ahí, también fallará en CIAB (y la versión anterior seguirá corriendo).

---

## Operación

| Qué | Cómo |
|---|---|
| Dashboard | `https://dollar-check.<zona>/` (con sesión de owner) |
| Logs | página de la app en CIAB, o `bottle app logs dollar-check --follow` |
| Salud | `https://dollar-check.<zona>/health` (200 = llegan tasas; 503 = no) |
| Parar | `bottle app stop dollar-check` (los datos se quedan) |
| Arrancar | `bottle app reload dollar-check` |
| Shell en el contenedor | `bottle app ssh dollar-check` (el cwd es `/app/dist`; el CLI es `bun run /app/src/context.ts`) |
| Snapshot para `/analyze` | `bottle curl https://dollar-check.<zona>/api/context` |

Todas las rutas HTTP están detrás del login de owner de CIAB.

**`bottle app remove dollar-check` borra los datos** (el SQLite incluido) salvo
que pases `--keep-data`.

---

## Datos y respaldos

El SQLite vive en `BOTTLE_SQLITE_MAIN` (`/data/app_data/dollar-check/sqlite/main.db`
dentro del contenedor), en el almacenamiento permanente de la app. Sobrevive a
reloads, updates y reboots.

El respaldo lo hace la app Backup de CIAB (restic hacia S3, B2, SFTP…), pero
**no respalda nada hasta que la configuras**. Verifica que esté activa. restic
no hace checkpoint del WAL; con una escritura por hora el riesgo de una copia
inconsistente es mínimo.

---

## Decisiones de diseño (y por qué)

**Servidor HTTP aunque el bot no lo necesite.** CIAB define una app como un
contenedor accesible por HTTP: tras arrancar sondea `GET /` durante 60 s y, si
no contesta, la marca en error y no la vuelve a levantar tras un reboot. Por eso
`src/index.ts` arranca `startServer()` antes de pedir secrets o crear el bot. Ese
mismo servidor sirve el dashboard.

**El dashboard se empaqueta al construir, no al arrancar.** La etapa `build` del
`Dockerfile` corre `bun run build` (`bun build --target=bun --production`): server,
grammy, React y Recharts quedan en `dist/`, y el runtime no lleva `node_modules`.
Si el front no compila, falla el build y CIAB sigue con la versión anterior; con
empaquetado en caliente, el fallo sería un 500 en `GET /` durante el sondeo de
arranque. `--sourcemap=linked` hace que las trazas de los logs apunten a
`src/…:línea` en vez de al código minificado.

**Se arranca desde `dist/`.** Bun resuelve los archivos del dashboard (el
manifiesto del bundle) relativos al directorio de trabajo; por eso el
`Dockerfile` termina con `WORKDIR /app/dist`. `--no-install` evita que Bun, al no
ver `node_modules`, intente instalar paquetes al vuelo.

**Un solo proceso.** Bot, polling y HTTP en el mismo proceso: es el modelo de CIAB
(no hay tipo "worker") y deja un solo escritor del SQLite y una sola `config` en
memoria que ven el bot y la web a la vez.

**Secrets por HTTP.** CIAB solo inyecta variables `BOTTLE_*`. `src/secrets.ts`
pide las 3 keys al router con `BOTTLE_APP_TOKEN` y las copia a `process.env`, así
`loadConfig()` no cambia. Reintenta errores de red/5xx (el router puede tardar
tras un reboot); un 403 falla de inmediato porque es de configuración.

**Root dentro del contenedor.** CIAB monta los datos con `:idmap` y ahí se ven
como root: un `USER` no-root no podría escribir el SQLite. Con Podman rootless,
ese root es el usuario sin privilegios `host` del VPS.

**Sin `VOLUME` ni `HEALTHCHECK`.** `VOLUME` crearía un volumen anónimo fuera del
backup. Podman construye en formato OCI e ignora `HEALTHCHECK`; la salud se ve en
`/health`, que mira si la última tasa tiene menos de 3 intervalos de polling.

**`TZ=America/Mexico_City`.** El ciclo mensual y la "última semana del mes"
dependen de la hora de México aunque el VPS esté en UTC.

---

## Limitación conocida

**`/analyze` no funciona en el contenedor.** `src/analyze.ts` invoca el CLI de
`claude` con `Bun.spawn` y ese binario no está en la imagen. Falla con ENOENT;
los otros 14 comandos funcionan normal. El reemplazo es la skill `/analyze` de
Claude Code, que lee `GET /api/context`.

---

## Troubleshooting

| Síntoma | Causa y arreglo |
|---|---|
| `409 Conflict` de Telegram | Dos long-pollers con el mismo token. Apaga la otra instancia (dev local, launchd, Docker Compose). |
| `[Secrets] … rechazó la petición (403)` | Grants sin aprobar. Apruébalos en la página de la app y recárgala. |
| `Missing required environment variable` | Falta una key en la app Secrets: el log previo `[Secrets] Faltan…` dice cuál. |
| App en error: "not responding to HTTP" | El proceso murió antes de 60 s. Revisa los logs: casi siempre secrets o grants. |
| `unable to open database file` al arrancar | Alguien agregó `USER` al `Dockerfile`. Tiene que correr como root (ver arriba). |
| `/health` en 503 con la app viva | >3 intervalos sin tasas: `OXR_APP_ID` inválido o cuota agotada. |
| `/status` sin medias móviles | Base sin histórico: falta `/seed 30`. |
| Falla el build | Límite de 512 MB y 5 min por build (`build_memory_mb` en el manifest; `bun run build` pide ~90 MB). Si es `bun run build`, repítelo en el Mac: casi siempre es un import o TSX roto en `src/web/`. |
| `Bundled file "./index-….js" not found` al arrancar | El proceso no arrancó desde `dist/`: alguien cambió el `WORKDIR` o el `CMD` del `Dockerfile`. |
| El dashboard dice "Tu sesión de CIAB venció" | `/api/dashboard` devolvió el login en vez de JSON. Recarga y vuelve a entrar. |
| El dashboard dice "No están llegando tasas nuevas" | Lo mismo que `/health` en 503: revisa los logs (OXR, cuota). |
