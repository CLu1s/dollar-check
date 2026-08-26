# Deploy — Dollar Check Bot

Docker sobre un VPS Linux. Instalación y actualización por **git push/pull**:
el repo es la única fuente de verdad, el VPS solo jala y reconstruye.

```
dollar-check/                  raíz del repo = contexto de build
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .env                       secretos — NO versionado, se crea en cada host
├── DEPLOY.md                  este archivo
├── CLAUDE.md                  documentación del bot en sí
├── src/
└── scripts/
    ├── deploy.sh              push + pull remoto (correr desde el Mac)
    ├── install.sh             primera instalación (correr en el VPS)
    ├── backup.sh              volcar el volumen a un tar.gz
    ├── restore.sh             restaurar un tar.gz al volumen
    └── *.sh                   legado de launchd en macOS, ya no se usan
```

---

## Flujo normal: actualizar el VPS

Desde el Mac, con todo commiteado:

```bash
bash scripts/deploy.sh
```

Hace tres cosas: verifica que el repo esté limpio y en `main`, `git push origin main`,
y por SSH en el VPS `git fetch` + `git reset --hard origin/main` + `docker compose up -d --build`.

Usa `reset --hard` a propósito: el VPS es un espejo desechable de `main`, no un
lugar donde editar. Los datos no viven ahí sino en el named volume, así que
resetear el checkout no puede perder nada.

Configurable por variables de entorno:

```bash
VPS_HOST=1.2.3.4 VPS_USER=deploy BRANCH=staging bash scripts/deploy.sh
```

Si prefieres a mano:

```bash
git push origin main
ssh luis@46.225.30.60 'cd ~/dollar-check && git pull && docker compose up -d --build'
```

---

## Primera instalación en un VPS nuevo

### 1. Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER    # sal y vuelve a entrar por SSH
```

### 2. Clave SSH para GitHub

El VPS necesita poder clonar el repo. Si es privado:

```bash
ssh-keygen -t ed25519 -C "vps-dollar-check"
cat ~/.ssh/id_ed25519.pub    # pégala en GitHub > Settings > Deploy keys (read-only)
```

### 3. Clonar

```bash
git clone git@github.com:CLu1s/dollar-check.git ~/dollar-check
cd ~/dollar-check
```

### 4. Configurar `.env`

`.env` NO está en git (a propósito: son secretos). Se crea una vez por host y
sobrevive a todos los `git pull`.

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Obligatorias: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `OXR_APP_ID`.
Deja `TZ=America/Mexico_City` aunque el VPS esté en UTC: el ciclo mensual y la
lógica de "última semana del mes" dependen de la hora de México.

### 5. Instalar

```bash
bash scripts/install.sh
```

Verifica Docker, valida que `.env` no traiga placeholders, construye la imagen,
levanta el contenedor y espera el primer poll de OXR. Es idempotente.

### 6. Sembrar el histórico — **el paso que se olvida**

En una instalación nueva la base arranca **vacía**. Sin histórico, `/status`,
`/month` y `/analyze` no sirven: las medias móviles de 7 y 30 días, la
volatilidad y el momentum necesitan días previos para significar algo.

En Telegram, mándale al bot:

```
/seed 30
```

Descarga 30 días de tasas históricas de OXR (una llamada por día, 500 ms de
separación, ~15 s). Confirma con `/status`.

> **Cuota de OXR.** El plan gratuito da **1000 llamadas al mes** y el polling
> horario ya consume ~720. `/seed 30` cabe de sobra (~750 total). `/seed 90`
> queda justo. `/seed 365` **te pasa del límite** y el bot se queda ciego el
> resto del mes.

Si estás migrando una instalación que ya tenía datos, **no siembres**: restaura
el respaldo, que trae la historia completa.

---

## Operación

```bash
docker compose logs -f bot      # logs en vivo
docker compose ps               # estado + healthy/unhealthy
docker compose restart bot
docker compose down             # detener (los datos siguen en el volumen)
docker compose up -d --build    # reconstruir
```

**Solo puede haber UNA instancia viva.** El bot usa long polling; dos procesos
con el mismo token dan `409 Conflict` en Telegram. Antes de levantar el VPS,
apaga cualquier instancia local y el launchd viejo.

---

## Respaldos

Los datos viven en el named volume `dollar-check-data`, fuera del contenedor y
fuera del checkout de git. `docker compose down` y `git reset --hard` no los
tocan; `docker volume rm dollar-check-data` sí los borra.

```bash
bash scripts/backup.sh                    # -> ./backups/dollar-check-<fecha>.tar.gz
bash scripts/restore.sh backups/dollar-check-20260826-071815.tar.gz
```

`backup.sh` hace `PRAGMA wal_checkpoint(TRUNCATE)` antes de copiar, para que el
`.db` esté completo sin depender de los `-wal`/`-shm`. Conserva los últimos 14.
`restore.sh` detiene el bot antes de escribir (restaurar con un escritor activo
corrompe el SQLite) y hace `chown` a 1000:1000.

Traer un respaldo del VPS al Mac:

```bash
ssh luis@46.225.30.60 'cd ~/dollar-check && bash scripts/backup.sh'
scp luis@46.225.30.60:'~/dollar-check/backups/*.tar.gz' ./backups/
```

Cron diario en el VPS:

```cron
0 4 * * * cd /home/luis/dollar-check && bash scripts/backup.sh >> /var/log/dollar-check-backup.log 2>&1
```

---

## Decisiones de diseño (y por qué)

**Named volume, no bind mount.** El contenedor corre como usuario no-root `bun`
(uid 1000). Con un bind mount en Linux el directorio del host tendría que
pertenecer a uid 1000 o el bot no puede escribir — falla que en macOS no se ve
porque Docker Desktop virtualiza los permisos. El named volume hereda el owner
que el `Dockerfile` deja con `mkdir -p /app/data && chown -R bun:bun /app`. Ese
`chown` **antes** del `VOLUME` es lo que lo hace funcionar: no lo quites.

**El volumen sobrevive al `git reset --hard`.** Es lo que permite que el deploy
sea destructivo con el código y conservador con los datos.

**`DB_PATH`.** `src/index.ts` hace `initDatabase(process.env.DB_PATH || undefined)`.
El compose lo fija a `/app/data/dollar-check.db`. Sin la variable el default
sigue siendo `data/dollar-check.db` relativo al cwd, que es lo que usa
`bun run dev` en local.

**`.env` fuera de git.** Se crea una vez por host y sobrevive a los pulls. Por
eso `install.sh` falla ruidosamente si detecta placeholders en lugar de arrancar
un bot roto.

**Sin puertos expuestos.** Telegram (long polling) y OXR son conexiones
salientes. No hay que abrir el firewall ni poner un reverse proxy.

**`init: true`.** `src/analyze.ts` hace `Bun.spawn`; sin un reaper en PID 1 los
hijos quedan zombie. También asegura que SIGTERM llegue limpio al
`process.on("SIGTERM")` de `index.ts`, que cierra la DB y hace checkpoint del WAL.

**Rootfs de solo lectura.** `read_only: true` con `tmpfs` en `/tmp` (que sí
necesita `/analyze`) y el volumen como única zona escribible persistente. Más
`cap_drop: ALL` y `no-new-privileges`.

**Healthcheck sin HTTP.** `src/healthcheck.ts` mira `MAX(created_at)` de
`exchange_rates`: si el bot dejó de registrar tasas por más de 3 intervalos de
polling, marca unhealthy. Detecta el caso feo — proceso vivo pero atorado — que
`restart: unless-stopped` por sí solo no ve.

**Rotación de logs.** `max-size: 10m`, `max-file: 3`. Sin esto los logs JSON se
comen el disco de un VPS chico en semanas.

---

## Limitación conocida

**`/analyze` no funciona en el contenedor.** `src/analyze.ts` invoca el CLI de
`claude` con `Bun.spawn` y ese binario no está en la imagen. Falla con ENOENT;
los otros 14 comandos funcionan normal. Dos caminos posibles, ninguno
implementado:

1. Migrar a la API de Anthropic con el SDK — lo correcto para un contenedor,
   pero necesita `ANTHROPIC_API_KEY` y es costo por token.
2. Instalar el CLI en la imagen y montar credenciales — sin costo extra, pero
   acopla el contenedor a una sesión de Claude y engorda la imagen.

---

## Troubleshooting

| Síntoma | Causa y arreglo |
|---|---|
| `409 Conflict` de Telegram | Dos long-pollers con el mismo token. Apaga la instancia local o el launchd viejo. |
| `Missing required environment variable` | Falta una clave en `.env` del host. `.env` no viaja por git: hay que crearlo en cada máquina. |
| Contenedor `unhealthy` | >3 intervalos sin registrar tasas. Revisa los logs: casi siempre `OXR_APP_ID` inválido o cuota agotada. |
| `exec format error` | Construiste en el Mac (arm64) para un VPS amd64. Construye **en el VPS** (que es lo que hace `deploy.sh`) o usa `--platform linux/amd64`. |
| `deploy.sh` dice "cambios sin commitear" | Es a propósito: si el VPS jala de GitHub, lo que no esté empujado no llega. Commitea primero. |
| `Permission denied (publickey)` en el VPS | Falta la deploy key de GitHub en el VPS (paso 2). |
| El bot no puede escribir la DB | Estás con bind mount en vez del named volume. Vuelve al named volume o `chown -R 1000:1000`. |
| `/status` sin medias móviles | Base sin histórico: falta `/seed 30`. |
