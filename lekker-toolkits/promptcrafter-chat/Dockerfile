# Production build for PromptCrafter Chat (monorepo-friendly)
# - Works when the app lives in a subdirectory of the repository
# - Detects the app directory automatically (or override via APP_DIR build-arg)
# - Builds Next.js standalone and runs via app.js (handles Prisma migrations)

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=true

WORKDIR /app
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends ca-certificates openssl libc6 bash && \
    rm -rf /var/lib/apt/lists/*

# Bring the whole repository in; we'll copy only the app subtree later
FROM base AS repo
WORKDIR /repo
COPY . /repo

# Build the app
FROM base AS builder
WORKDIR /app

# Copy repo to this stage
COPY --from=repo /repo /repo

# Optionally set APP_DIR at build time; default autodetects common paths
ARG APP_DIR
RUN set -eux; \
    DETECTED_DIR=""; \
    if [ -n "${APP_DIR:-}" ] && [ -f "/repo/${APP_DIR}/package.json" ]; then \
      DETECTED_DIR="/repo/${APP_DIR}"; \
    elif [ -f "/repo/package.json" ]; then \
      DETECTED_DIR="/repo"; \
    elif [ -f "/repo/lekker-toolkits/promptcrafter-chat/package.json" ]; then \
      DETECTED_DIR="/repo/lekker-toolkits/promptcrafter-chat"; \
    elif [ -f "/repo/promptcrafter-chat/package.json" ]; then \
      DETECTED_DIR="/repo/promptcrafter-chat"; \
    else \
      echo "Could not locate package.json. Searched /repo and common subpaths."; \
      echo "Found candidates:"; \
      find /repo -maxdepth 3 -name package.json -printf '%h\n' || true; \
      exit 1; \
    fi; \
    echo "Using app directory: ${DETECTED_DIR}"; \
    cp -R "${DETECTED_DIR}/." /app

# Install dependencies (with dev deps for build)
RUN npm ci

# Generate Prisma client (postinstall is disabled in package.json)
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# Prune dev deps but keep generated Prisma client
RUN npm prune --omit=dev

# Runtime image
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    AUTH_TRUST_HOST=true \
    UNDICI_NO_WASM=1

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs node

WORKDIR /app

# Copy build outputs
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy runtime files
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Production node_modules (contains generated Prisma client)
COPY --from=builder /app/node_modules ./node_modules

RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["node", "app.js"]


