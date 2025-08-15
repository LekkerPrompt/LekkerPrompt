<p align="center">
  <img src="https://sammyhamwi.ai/images/LekkerPrompt-logo-lrg.png" alt="LekkerPrompt Logo" width="400" height="400">
</p>

<p align="center">
  Master LLM interaction with LekkerPrompt <br> An open source library of toolkits and resources for advanced prompt and context engineering.
</p>

<div align="center">
  <a href="https://github.com/sammyhamwi/LekkerPrompt">Home</a> | <a href="https://github.com/sammyhamwi/LekkerPrompt/issues">Report an Issue</a>
</div>

---

# LekkerPrompt: PromptCrafter AI Chat App

PromptCrafter AI Chat is a focused web app for crafting, refining, and validating AI prompts. It provides two modes — Build and Enhance — plus task-specific options (coding, image, research, writing, marketing). Users can save reusable presets, manage chat history, and configure system prompts per mode.

Built using the t3 app stack; with Next.js App Router, NextAuth (email/Discord), Prisma (MySQL), tRPC, Tailwind CSS, and a Gemini-compatible backend.

## Features

- **Modes**: Build a full prompt or Enhance an existing one
- **Task types**: general, coding, image, research, writing, marketing
- **Options**: tone, detail, output format, language, temperature, and type-specific options
- **Presets**: create, update, delete, set default; quickly apply to new chats
- **Chats**: saved per user; reopen, delete, or export from UI
- **Auth**: NextAuth (Discord and/or email magic link)
- **Admin**: per-mode system prompts via an admin API

## Stack

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Getting Started

### 1) Prerequisites

- Node 24
- MySQL DB
- Google Gemini API key and base endpoint

### 2) Environment variables

Create a `.env` with the following (required unless marked optional):

```env
# NextAuth
AUTH_SECRET=your-random-string            # required in production
AUTH_DISCORD_ID=                           # required if using Discord
AUTH_DISCORD_SECRET=                       # required if using Discord
NEXTAUTH_URL=http://localhost:3000         # optional (set in production)
AUTH_TRUST_HOST=true                       # optional (useful in Docker)

# Database
DATABASE_URL=mysql://user:pass@host:3306/dbname

# Gemini
GOOGLE_GEMINI_API_KEY=your-key
# Example model endpoint for gemini-2.5-pro:
GOOGLE_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent

# Optional per-mode system prompts (fallback chain: DB → per-mode → global → empty)
GOOGLE_GEMINI_SYSTEM_PROMPT=
GOOGLE_GEMINI_SYSTEM_PROMPT_BUILD=
GOOGLE_GEMINI_SYSTEM_PROMPT_ENHANCE=

# Admins (comma-separated email list). Grants access to system prompt admin API.
ADMIN_EMAILS="user1@example.com,user2@example.com,user3@example.com"

# Client / base path
NEXT_PUBLIC_BASE_PATH=                     # optional, used by client fetch URLs
# If deploying under a subpath, also set Next.js basePath at build/runtime:
NEXT_BASE_PATH=                            # optional, used by next.config.js

# Email (optional, for magic-link sign-in)
EMAIL_FROM=
EMAIL_SERVER=
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_SERVER_SECURE=
```

Notes:

- If you don’t configure Discord or Email, only the methods you configure will appear on the sign-in page.
- `AUTH_SECRET` must be set in production.
- `NEXT_BASE_PATH` (server) and `NEXT_PUBLIC_BASE_PATH` (client) are both optional, but should match if you serve the app under a subpath.

### 3) Run with Docker (development)

This repository includes a `Dockerfile` and `docker-compose.yml` for local development.

```bash
# Start MySQL + web (Next.js dev) using the dev stage in Dockerfile
docker compose up --build

# Tail logs (optional)
docker compose logs -f web
```

- App: `http://localhost:3000`
- DB: MySQL 8 on `localhost:${MYSQL_PORT:-3306}` (inside Compose, the app uses `db:3306`)

Notes:

- The `web` service builds with target `dev` and runs `npm run dev` inside the container.
- Prisma migrations are applied automatically on startup (`migrate deploy` or fallback to `db push`).
- You can customize MySQL via env (see `docker-compose.yml`: `MYSQL_*` variables). The app’s `DATABASE_URL` is wired to the Compose DB by default.

## How it works

- UI: `src/app/chat/_components/ChatClient.tsx` and `FiltersSidebar.tsx`
- Auth: `src/server/auth/*`, route at `src/app/api/auth/[...nextauth]/route.ts`
- Presets: stored in `PromptPreset` (Prisma). REST endpoints under `/api/presets`.
- Chats: stored in `Chat` and `ChatMessage` (Prisma). Managed via tRPC.
- Gemini: server call is in `src/server/gemini.ts`; HTTP endpoint at `/api/gemini/chat`.
- System prompts: DB-backed via `src/server/settings.ts` with admin API.

## API Overview

### Auth

- `GET /api/auth/signout`: immediately signs the user out and redirects (no confirmation). Optional `?callbackUrl=/path`.
- `GET|POST /api/auth/[...nextauth]`: handled by NextAuth.

### Prompt generation

- `POST /api/gemini/chat`
  - Body:

    ```json
    {
      "input": "string",
      "mode": "build" | "enhance",
      "taskType": "general" | "coding" | "image" | "research" | "writing" | "marketing",
      "options": {
        "tone": "neutral" | "friendly" | "formal" | "technical" | "persuasive",
        "detail": "brief" | "normal" | "detailed",
        "format": "plain" | "markdown" | "json",
        "language": "string",
        "temperature": 0.0
      }
    }
    ```

  - Response: `{ "output": string }` or `{ "error": string }`

### Presets

- `GET /api/presets`: list presets for the authenticated user
- `POST /api/presets`: create or update (upsert)
  - Accepts `{ id?, name, mode, taskType, options }`
- `DELETE /api/presets?id=...` or `DELETE /api/presets?name=...`: delete by id or name
- `GET /api/presets/default`: get default preset id
- `POST /api/presets/default`: set default `{ presetId }`
- `DELETE /api/presets/default`: clear default

### Admin (system prompts)

Restricted to emails in `ADMIN_EMAILS`.

- `GET /api/admin/system-prompt`: `{ build, enhance }`
- `PUT /api/admin/system-prompt`: update either or both
  - Body: `{ "build"?: string, "enhance"?: string }`

## Database

Prisma models live in `prisma/schema.prisma`. Primary entities:

- `User`, `Account`, `Session` (NextAuth)
- `PromptPreset` (per-user settings)
- `Chat`, `ChatMessage` (conversation history)
- `AppSetting` (key-value config, including per-mode system prompts)

Common commands:

```bash
# Dev schema sync
npm run db:push

# Production migrations
npm run db:generate   # create new migration from schema changes (dev)
npm run db:migrate    # apply migrations (deploy)
```

## Credits

Created by [Sammy](https://sammyhamwi.ai) for open source use in LekkerPrompt toolkit library.
