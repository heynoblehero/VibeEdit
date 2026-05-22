# VibeEdit Video — monorepo Dockerfile.
#
# Builds the Hyperframes workspace packages first, then the Next.js app at
# apps/web. The app stays at apps/web in the final image so workspace imports
# (@hyperframes/core etc.) resolve via the existing node_modules links.

FROM node:22-slim

WORKDIR /app

# System deps:
#  - build tools for native modules (better-sqlite3, sharp)
#  - ffmpeg for the render pipeline + audio mux
#  - chromium runtime libs for hyperframes/engine's headless captures
#  - fonts so server-rendered text doesn't fall back to boxes
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 make g++ \
      ffmpeg \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
      fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Bun is the package manager + runtime (bun.lock is the source of truth).
RUN npm install -g bun@1.2.5

# Copy manifests first so dep install is cached across source-only changes.
# Both apps + all packages need manifests present at install time so the
# workspace topology matches bun.lock; missing any one rejects the lockfile.
COPY package.json bun.lock turbo.json* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop-worker/package.json apps/desktop-worker/package.json
COPY packages packages

# `bun install` resolves workspaces from the root. Drop --frozen-lockfile
# because the lockfile drifts as the upstream Hyperframes monorepo evolves;
# we re-resolve on each build and accept the minor variance.
RUN bun install

# Full source after deps so editing a file doesn't bust the deps layer.
COPY . .

# Build workspace packages first (apps/web imports them).
RUN bun run build || (echo "workspace build failed" && exit 1)

# Build the Next.js app.
RUN cd apps/web && bun run build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Dokku will override PORT via $PORT. Next.js obeys it via `next start -p $PORT`.
ENV PORT=3000

# Storage path for SQLite + uploads. Mount a persistent volume here at deploy
# (dokku storage:mount vibeedit /var/lib/dokku/storage/vibeedit:/data).
ENV DATABASE_PATH=/data/app.db
ENV STORAGE_ROOT=/data/storage
RUN mkdir -p /data/storage

EXPOSE 3000

# Run migrations on boot so a fresh container always has the latest schema.
# `bun run start` in apps/web maps to `next start`.
CMD ["sh", "-c", "cd apps/web && bun run db:migrate && bun run start -- -p ${PORT:-3000} -H 0.0.0.0"]
