FROM node:22-slim AS builder
WORKDIR /app

# Build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install bun for workspace:* protocol support
RUN npm install -g bun

COPY . .

# Install with hoisted node_modules (flat layout, no .bun/ symlinks)
# This is critical: Turbopack can't resolve bun's default symlinked layout
# Preserve .bin/ symlinks — cp -rL turns them into broken regular files
RUN bun install --frozen-lockfile && \
    mv node_modules/.bin /tmp/bin_backup && \
    cp -rL node_modules node_modules_flat && \
    rm -rf node_modules && \
    mv node_modules_flat node_modules && \
    rm -rf node_modules/.bin && \
    mv /tmp/bin_backup node_modules/.bin

# Try prebuilt binary first, fall back to compiling from source
RUN cd node_modules/better-sqlite3 && npx --yes prebuild-install || npm rebuild better-sqlite3

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN cd apps/web && npx next build

# --- Production ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p /data

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH="/data/vibeedit.db"

CMD ["node", "apps/web/server.js"]
