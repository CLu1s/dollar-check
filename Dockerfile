# syntax=docker/dockerfile:1

# ============================================
# Dollar Check Bot - Container image
# Contexto de build: la raíz de este repo.
# Target de producción: VPS Linux (amd64 o arm64).
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
    NODE_ENV=production \
    DB_PATH=/app/data/dollar-check.db

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src

# /app/data es el mountpoint del SQLite. Debe existir y pertenecer al usuario
# no-root ANTES de declarar el volumen: Docker copia estos permisos al crear
# un named volume vacio, que es lo que hace que funcione en Linux sin tocar uids.
RUN mkdir -p /app/data && chown -R bun:bun /app

USER bun

VOLUME ["/app/data"]

# Sin HTTP que sondear: la señal de vida es que la DB siga recibiendo tasas.
HEALTHCHECK --interval=5m --timeout=20s --start-period=2m --retries=3 \
    CMD ["bun", "run", "src/healthcheck.ts"]

# Sin EXPOSE: la comunicacion con Telegram y OXR es saliente (long polling).
CMD ["bun", "run", "src/index.ts"]
