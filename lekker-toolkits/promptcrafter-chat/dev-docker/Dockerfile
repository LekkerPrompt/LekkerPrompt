# Multi-stage Dockerfile for T3 App (Next.js 15 + Prisma + Postgres)

# Use Debian-based image to avoid Prisma/openssl issues on Alpine
FROM node:20-bookworm-slim AS base

ENV NODE_ENV=production \
    # Ensure Next binds to all interfaces in containers
    HOSTNAME=0.0.0.0 \
    PORT=3000

WORKDIR /app

# --- Install dependencies (cached if package files unchanged) ---
FROM base AS deps

# Install system deps used by some libs during install (optional but safe)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Align npm with project packageManager
RUN npm i -g npm@11.4.2

COPY package.json package-lock.json ./
# Copy prisma before install because postinstall runs `prisma generate`
COPY prisma ./prisma

# Use npm CI for reproducible installs
RUN npm ci

# --- Development image ---
FROM node:20-bookworm-slim AS dev

ENV NODE_ENV=development \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    # Skip strict env validation during container builds/dev
    SKIP_ENV_VALIDATION=true

WORKDIR /app

# System deps
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Align npm with project packageManager
RUN npm i -g npm@11.4.2

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Copy source code (mounted as volume in docker-compose for live reload)
COPY . .

EXPOSE 3000

CMD ["sh", "-c", "npm run dev"]

# --- Build production app ---
FROM deps AS builder

ENV SKIP_ENV_VALIDATION=true
# Allow compiling basePath at build-time (must be provided via --build-arg)
ARG NEXT_BASE_PATH=
ENV NEXT_BASE_PATH=$NEXT_BASE_PATH \
    NEXT_PUBLIC_BASE_PATH=$NEXT_BASE_PATH

# Copy full source for build
COPY . .

# Build Next.js app
RUN npx prisma generate && npm run build

# --- Production runtime image ---
FROM base AS prod

# Copy node_modules and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/postcss.config.js ./postcss.config.js
COPY --from=builder /app/prisma ./prisma

# Set conservative defaults to avoid WASM OOM and ensure basePath is available at runtime too
ENV UNDICI_NO_WASM=1 \
    NODE_OPTIONS=--max-old-space-size=2048 \
    NEXT_BASE_PATH=$NEXT_BASE_PATH \
    NEXT_PUBLIC_BASE_PATH=$NEXT_BASE_PATH

EXPOSE 3000

CMD ["npm", "run", "start"]


