# VibeEdit Studio — flat Next.js 16 + Remotion + Claude Code bridge.
#
# Built for dokku deploys. Single-stage for simplicity; we can slim later
# once the prod surface stabilizes.

FROM node:22-slim
WORKDIR /app

# System deps: build tools for native modules, ffmpeg for Remotion's audio
# pipeline, plus the runtime libs Remotion's headless Chrome shell needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 make g++ \
      ffmpeg \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
      libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
      libgbm1 libasound2 libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
      fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Bun for install + run (lockfile is bun.lock).
RUN npm install -g bun

# Install deps first so this layer caches.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# App source.
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js defaults to PORT=3000; dokku will override via $PORT.
ENV PORT=3000

RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start"]
