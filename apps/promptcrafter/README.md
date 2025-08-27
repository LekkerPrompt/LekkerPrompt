<p align="center">
  <img src="https://promptcrafter.org/images/prompt-crafter-logo.png" alt="LekkerPrompt Logo" width="300" height="300" />
</p>

<p align="center">
  <strong>PromptCrafter</strong> – local privacy‑first Electron app for structured prompt building and enhancing.
</p>

<div align="center">
  <a href="https://github.com/LekkerPrompt/LekkerPrompt">Repo Home</a> · <a href="https://github.com/LekkerPrompt/LekkerPrompt/issues">Issues</a>
</div>

---

# PromptCrafter (Electron + Next.js)

PromptCrafter lets you <em>build</em> new prompts or <em>enhance</em> existing text using task‑specific and style controls. It stores your chats, presets, and system prompts locally (SQLite) inside a directory you choose on first run of the packaged Electron app.

The same codebase runs in two modes:

1. Dev Web (Next.js dev server)
2. Packaged Desktop (Electron + embedded Next.js server)

---

## Feature Summary

- Modes: build / enhance
- Task types: general, coding, image, research, writing, marketing
- Options: tone, detail level, output format, language, temperature
- Presets: create, edit, delete, set default
- Chat history: persisted; reopen & continue
- System prompts: per-mode overrides, stored in DB (fallback chain: DB > per-mode env > global env > internal fallback)
- Local model config (Ollama) or remote proxy (OpenRouter / Google AI endpoint)
- Privacy consent gate for remote model usage
- Electron niceties: spellcheck (en-US), custom context menu w/ suggestions, controlled window sizing

---

## Stack

- Next.js
- Electron
- TypeScript
- Prisma (Local SQLite db)
- tRPC + React Query
- Tailwind CSS
- Biome

---

## Development Quick Start

Prerequisites: Node >= 18.18 (recommended 20+). No database service required (SQLite file is generated automatically).

```bash
npm install
npm run dev
```

This runs a script that prepares the SQLite schema then launches Electron, which spawns the Next.js dev server. Choose a data directory when prompted; your `electron.db` will live there.

---

## Environment Variables

All server env vars are optional for local experimentation. Provide them to enable remote model calls or baked-in system prompts.

| Name | Description |
|------|-------------|
| DATABASE_URL | Normally set automatically by Electron after directory selection. |
| GOOGLE_API_KEY | API key for calling Google AI endpoints directly. |
| GOOGLE_BASE_URL | Full model endpoint URL (e.g. https://.../models/gemma-2-...:generateContent). |
| GOOGLE_PROXY_URL | Optional proxy endpoint if you don't want to bundle your key. |
| GOOGLE_PROXY_AUTH_TOKEN | Shared secret header for proxy authentication. |
| GOOGLE_SYSTEM_PROMPT | Global default system prompt. |
| GOOGLE_SYSTEM_PROMPT_BUILD | Build-mode specific system prompt. |
| GOOGLE_SYSTEM_PROMPT_ENHANCE | Enhance-mode specific system prompt. |
| NEXT_PUBLIC_BASE_PATH | Optional client base path when hosting under a subpath (web build). |

Set `SKIP_ENV_VALIDATION=1` when experimenting; the dev/Electron scripts already do this.

---

## Local & Remote Model Configuration

Stored in `AppSetting` rows (`MODEL_PROVIDER`, `MODEL_BASE_URL`, `MODEL_NAME`). Two supported providers:

1. `ollama`
   - `MODEL_BASE_URL`: e.g. `http://localhost:11434`
   - `MODEL_NAME`: e.g. `gemma:4b`
2. `openrouter-proxy`
   - `MODEL_BASE_URL`: proxy endpoint you control
   - `MODEL_NAME`: auth token (passed as header `x-proxy-auth`)

Remote provider usage (openrouter-proxy) requires explicit privacy consent, stored under `REMOTE_PRIVACY_CONSENT_ACCEPTED`.

`local-model.ts` contains helpers for reading/writing config and validating connectivity.

---

## Build & Distribution

Production desktop bundles:

```bash
npm run dist:win       # Windows installer + portable
npm run dist:electron  # All targets (requires platform tooling)
```

Internally these run `build:electron` then `electron-builder` (with asar packaging; `.next` assets are unpacked where necessary). The main process starts an embedded Next.js server in production to support dynamic routes.

---

## Project Scripts (selected)

| Script | Purpose |
|--------|---------|
| dev | Prepare SQLite + launch Electron (Next.js dev) |
| build:electron | Build Next.js for production (no trace) |
| dist:win / dist:electron | Package desktop app(s) |
| db:push:electron | Push SQLite schema for Electron client |
| check / check:write | Biome lint/format |
| typecheck | TypeScript type checking |

---

## Data & Schema

SQLite schema file: `prisma/schema.sqlite.prisma`.
Generated client output: `src/server/generated/electron`.

Models: `User`, `Account`, `Session`, `VerificationToken`, `Post`, `PromptPreset`, `Chat`, `ChatMessage`, `AppSetting`.

The `Account/Session` tables are present for structural similarity (auth flows may be trimmed in pure local mode).

---

## Code Pointers

- Electron main: `electron/main.cjs`
- Preload: `electron/preload.cjs`
- Startup script: `electron/start-electron.cjs`
- Env schema: `src/env.js`
- Model logic (Gemma / Google): `src/server/gemma.ts` & context helpers
- Local/remote model bridge: `src/server/local-model.ts`
- System prompts & settings: `src/server/settings.ts`
- DB bootstrap: `src/server/db.ts`

---

## Contributing

PRs & issues welcome. Useful areas:

- Additional providers (LM Studio, vLLM, etc.)
- Advanced prompt diffing / comparison UI
- Accessibility (keyboard navigation, screen reader labels)
- Localization (multi-language UI)

Open an Issue for large proposals before implementation.

---

## License

MIT © [LekkerPrompt](https://github.com/LekkerPrompt/LekkerPrompt)

---

If this project helps you, a star ⭐ is appreciated.
