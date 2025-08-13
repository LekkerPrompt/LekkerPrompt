# Production build for PromptCrafter Chat
# - Multi-stage image
# - Builds Next.js standalone output
# - Generates Prisma Client at build time
# - Applies DB migrations at container start via app.js

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-bookworm-slim AS base

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=true

WORKDIR /app
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends ca-certificates openssl libc6 && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies (with dev deps for build)
FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci

# Build the app and generate Prisma client
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (postinstall is disabled in package.json)
RUN npx prisma generate

# Build Next.js (standalone)
RUN npm run build

# Prune devDependencies after build to slim runtime node_modules, but keep generated Prisma client
RUN npm prune --omit=dev

# Runtime image
FROM base AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    AUTH_TRUST_HOST=true \
    UNDICI_NO_WASM=1

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs node

WORKDIR /app

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy runtime files
COPY --from=builder /app/app.js ./app.js
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Copy pruned production node_modules (contains generated Prisma client)
COPY --from=builder /app/node_modules ./node_modules

# Ensure ownership
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Start server via app.js (ensures static assets are copied and migrations are applied)
CMD ["node", "app.js"]


