# ============================================
# Dollar Check Bot - Container image
# Contexto de build: la raíz de este repo.
# Target: app de Cloud in a Bottle (Podman rootless). Ver cloudinabottle.toml.
# ============================================

# ---- deps: resuelve dependencias de produccion, en capa cacheada aparte ----
FROM oven/bun:1-alpine AS deps

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production


# ---- runtime ----
FROM oven/bun:1-alpine AS runtime

# tzdata: el bot razona en fechas locales (ciclo mensual, ultima semana del mes).
# El VPS casi siempre corre en UTC; TZ mantiene la logica en horario de Mexico.
RUN apk add --no-cache tzdata

ENV TZ=America/Mexico_City \
    NODE_ENV=production

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# Corre como root del contenedor a proposito: CIAB monta /data/app_data con
# :idmap y ahi se ve como root, asi que un USER no-root no podria escribir el
# SQLite. Con Podman rootless ese root es el usuario sin privilegios `host`.
#
# Sin VOLUME: crearia un volumen anonimo fuera del backup de CIAB (el SQLite
# va en BOTTLE_SQLITE_MAIN). Sin HEALTHCHECK: Podman construye en formato OCI
# y lo ignora; la salud se ve en GET /health.

# HTTP: CIAB lo necesita para dar la app por viva (y en Fase 2, el dashboard).
EXPOSE 8080
CMD ["bun", "run", "src/index.ts"]
