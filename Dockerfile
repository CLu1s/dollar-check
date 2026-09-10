# ============================================
# Dollar Check Bot - Container image
# Contexto de build: la raíz de este repo.
# Target: app de Cloud in a Bottle (Podman rootless). Ver cloudinabottle.toml.
# ============================================

# ---- build: empaqueta server + dashboard en dist/ (bun run build) ----
# Aquí sí entran las devDependencies (React, Recharts): quedan dentro del bundle
# y el runtime no las necesita. Si el front no compila, falla el build y CIAB
# sigue corriendo la versión anterior, en vez de dar 500 en GET / al arrancar.
# Sin NODE_ENV=production antes del install, o se saltaría las devDependencies.
FROM oven/bun:1.3.10-alpine AS build

WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile
COPY src ./src
RUN bun run build


# ---- runtime ----
FROM oven/bun:1.3.10-alpine AS runtime

# tzdata: el bot razona en fechas locales (ciclo mensual, ultima semana del mes).
# El VPS casi siempre corre en UTC; TZ mantiene la logica en horario de Mexico.
RUN apk add --no-cache tzdata

ENV TZ=America/Mexico_City \
    NODE_ENV=production

WORKDIR /app

# El bundle trae todo (grammy incluido): no hay node_modules en runtime.
COPY --from=build /app/dist ./dist
# src/ solo para el CLI: bottle app ssh dollar-check bun run /app/src/context.ts
COPY package.json ./
COPY src ./src

# Corre como root del contenedor a proposito: CIAB monta /data/app_data con
# :idmap y ahi se ve como root, asi que un USER no-root no podria escribir el
# SQLite. Con Podman rootless ese root es el usuario sin privilegios `host`.
#
# Sin VOLUME: crearia un volumen anonimo fuera del backup de CIAB (el SQLite
# va en BOTTLE_SQLITE_MAIN). Sin HEALTHCHECK: Podman construye en formato OCI
# y lo ignora; la salud se ve en GET /health.

# HTTP: CIAB lo necesita para dar la app por viva, y sirve el dashboard.
EXPOSE 8080

# Bun busca los archivos del dashboard (el manifiesto del bundle) relativos al
# directorio de trabajo, así que se arranca desde dist/. --no-install: sin
# node_modules, Bun intentaría instalar paquetes al vuelo.
WORKDIR /app/dist
CMD ["bun", "--no-install", "index.js"]
