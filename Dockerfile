FROM node:22-slim AS builder
WORKDIR /app

# Build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install bun for workspace:* protocol support
RUN npm install -g bun

COPY . .

# Install with bun, then fix the layout for Node.js + Turbopack:
#   1. Backup .bin symlinks (cp -rL would turn them into broken files)
#   2. Flatten all symlinks (resolves workspace + .bun/ symlinks)
#   3. Hoist deduped packages from .bun/node_modules/ into root node_modules/
#   4. Remove .bun/ dir (Turbopack can't resolve its internal structure)
RUN bun install --frozen-lockfile && \
    mv node_modules/.bin /tmp/bin_backup && \
    cp -rL node_modules node_modules_flat && \
    rm -rf node_modules && mv node_modules_flat node_modules && \
    rm -rf node_modules/.bin && mv /tmp/bin_backup node_modules/.bin && \
    cp -rn node_modules/.bun/node_modules/. node_modules/ 2>/dev/null || true && \
    rm -rf node_modules/.bun

# Rebuild better-sqlite3 native addon (try prebuilt binary first)
RUN cd node_modules/better-sqlite3 && npx --yes prebuild-install || npm rebuild better-sqlite3

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=3072"

ARG NEXT_PUBLIC_SITE_URL=https://vibevideoedit.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN cd apps/web && npx next build

# --- Production ---
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Expose at runtime so better-auth server reads the correct baseURL for cookies/CSRF
ARG NEXT_PUBLIC_SITE_URL=https://vibevideoedit.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Claude Code CLI — needs git and a writable home dir
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code
RUN mkdir -p /root/.claude /data

# Verify claude works in this container
RUN claude --version

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_PATH="/data/vibeedit.db"

CMD ["node", "apps/web/server.js"]
