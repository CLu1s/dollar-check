FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

# Copy source
COPY src/ ./src/
COPY tsconfig.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data

# Volume for persistent data
VOLUME ["/app/data"]

# Run
CMD ["bun", "run", "src/index.ts"]
