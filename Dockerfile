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
#  - python3 also backs the yt-dlp zipapp installed below (URL video import)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 make g++ \
      ffmpeg \
      chromium \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
      fonts-liberation fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp — resolves external video URLs (YouTube etc.) to a downloadable stream
# for the "Import from URL" + browser-extension capture flows. Standalone binary
# (python3 zipapp) pinned so builds are reproducible; bump deliberately.
ARG YT_DLP_VERSION=2026.07.04
RUN curl -fSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
      -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && /usr/local/bin/yt-dlp --version

# Bun is the package manager + runtime (bun.lock is the source of truth).
RUN npm install -g bun@1.2.5

# Claude Code CLI — required by claude-agent-sdk which spawns it as a subprocess.
RUN npm install -g @anthropic-ai/claude-code

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

# Build only the workspace artifacts apps/web actually needs:
#  - @hyperframes/core's hyperframe.runtime artifact (the iife the player loads)
#  - @hyperframes/cli — but only the runtime bits, not the studio-assets copy
#    step (build:copy waits for @hyperframes/studio/dist, which we don't build
#    because our deploy doesn't ship the standalone studio UI).
RUN bun run --filter @hyperframes/core build:hyperframes-runtime
RUN cd packages/cli \
 && bun run build:fonts \
 && bunx tsup \
 && bun run build:runtime \
 && chmod +x /app/packages/cli/dist/cli.js \
 && ln -sf /app/packages/cli/dist/cli.js /app/node_modules/.bin/hyperframes

# Public observability keys must be present at build time so Next.js inlines
# them into the browser bundle (NEXT_PUBLIC_* are build-time, not runtime).
# Values are injected by dokku via `docker-options:add ... build --build-arg`;
# they're public-safe (PostHog write-only key + Sentry DSN are client-exposable).
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ARG NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# Build the Next.js app.
RUN cd apps/web && bun run build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Chromium binary for the snapshot/capture engine (agent visual self-critique).
# The libs above are the runtime deps; this is the actual browser executable.
ENV HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Dokku will override PORT via $PORT. Next.js obeys it via `next start -p $PORT`.
ENV PORT=3000

# Storage path for SQLite + uploads. Mount a persistent volume here at deploy
# (dokku storage:mount vibeedit /var/lib/dokku/storage/vibeedit:/data).
ENV DATABASE_PATH=/data/app.db
ENV STORAGE_ROOT=/data/storage
RUN mkdir -p /data/storage

# Run as non-root so claude --dangerously-skip-permissions works.
# (Claude Code refuses bypassPermissions mode when running as root.)
RUN useradd -m -u 1001 appuser \
 && chown -R appuser:appuser /app /data
USER appuser

EXPOSE 3000

# Run migrations on boot so a fresh container always has the latest schema.
# `bun run start` in apps/web maps to `next start`.
CMD ["sh", "-c", "cd apps/web && bun run db:migrate && bun run start -- -p ${PORT:-3000} -H 0.0.0.0"]
