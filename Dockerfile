FROM node:22-slim AS builder
WORKDIR /app

# Build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install bun for workspace:* protocol support
RUN npm install -g bun

COPY . .

# Install deps, then resolve only workspace symlinks (Turbopack can't follow them)
# We must NOT flatten all of node_modules — cp -rL breaks .bin links and @swc/helpers
RUN bun install --frozen-lockfile && \
    for link in $(find node_modules -maxdepth 2 -type l -not -path "*/\.bin/*"); do \
      real=$(readlink -f "$link"); \
      if [ -d "$real" ]; then rm "$link" && cp -r "$real" "$link"; fi; \
    done

# Rebuild better-sqlite3 native addon (try prebuilt binary first)
RUN cd node_modules/better-sqlite3 && npx --yes prebuild-install || npm rebuild better-sqlite3

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=3072"
# Bun dedupes packages into .bun/node_modules/ which Node.js can't find
ENV NODE_PATH="/app/node_modules/.bun/node_modules"
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
