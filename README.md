<p align="center">
  <img src="https://raw.githubusercontent.com/LekkerPrompt/LekkerPrompt/refs/heads/master/logo.png" alt="LekkerPrompt Logo" width="320" height="320" />
</p>

<p align="center">
  LekkerPrompt – open source tooling for structured prompt & context engineering.
</p>

<div align="center">
  <a href="https://github.com/LekkerPrompt/LekkerPrompt">Home</a> · <a href="https://github.com/LekkerPrompt/LekkerPrompt/issues">Issues</a>
</div>

---

# Overview

This repository currently ships the **PromptCrafter** application (web + Electron desktop) for crafting, refining, and organizing AI prompt workflows. Earlier, the repo planned a larger multi-package library; it has since been simplified to focus on a polished end‑user app with local (SQLite) persistence and optional remote model access.

Key directions:

- Local‑first desktop experience (Electron + Next.js App Router)
- Private on‑disk data (SQLite DB created in a user‑selected directory)
- Structured prompt building ("build" + "enhance" modes, task types, option presets)
- Extensible model routing (local Ollama models, remote proxy / Google AI endpoints)
- Admin & system prompt configuration stored in DB (overrides env fallbacks)

---

# Application: PromptCrafter

PromptCrafter is a Next.js application packaged for the desktop with Electron. It can also run as a normal web app during development. The app stores user data (presets, chats, system prompts, settings) in a SQLite database (`electron.db`) located in a directory you choose on first launch (or later via the UI / menu flow).

## Core Features

- Two prompt modes: **build** and **enhance**
- Task types: general, coding, image, research, writing, marketing
- Tunable generation options: tone, detail, format, language, temperature, etc.
- Saved **presets** (create, update, delete, set default)
- **Chat history** with ability to reopen / continue prior work
- System prompt management per mode (DB > mode-specific > global > fallback)
- Local model configuration (e.g. Ollama) OR remote proxy (OpenRouter / Google AI)
- Electron desktop packaging (Win / macOS / Linux) with spellcheck & custom menus

## Tech Stack

- Next.js
- TypeScript
- Prisma
- tRPC
- Tailwind
- Electron
- Biome

---

## Quick Start (Dev – Web + Electron)

1. Clone repo & install deps:
   ```bash
   npm install
   ```
2. Launch in Electron dev (spawns Next.js then desktop window):
   ```bash
   npm run dev
   ```
3. On first run you'll be prompted to choose a data directory. A SQLite file `electron.db` will be created there.
4. Configure model access (see below) inside the app (settings/admin routes) or via environment.

---

## Environment Variables (Server Side)

All are optional for initial local use (the desktop flow sets `DATABASE_URL` dynamically after you pick a directory). Provide when you want remote API access or default system prompts.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Overridden at runtime by Electron when you pick data dir (SQLite). |
| `GOOGLE_API_KEY` | API key for Google AI (Gemma / Gemini style endpoints). |
| `GOOGLE_BASE_URL` | Full model endpoint URL (e.g. https://generativelanguage.googleapis.com/v1beta/models/gemma-2-...:generateContent). |
| `GOOGLE_PROXY_URL` | Optional: remote proxy that holds the key (privacy). |
| `GOOGLE_PROXY_AUTH_TOKEN` | Shared secret header for proxy auth. |
| `GOOGLE_SYSTEM_PROMPT` | Global fallback system prompt. |
| `GOOGLE_SYSTEM_PROMPT_BUILD` | Mode-specific build prompt (higher priority). |
| `GOOGLE_SYSTEM_PROMPT_ENHANCE` | Mode-specific enhance prompt. |
| `NEXT_PUBLIC_BASE_PATH` | Optional base path if serving under subdirectory (web mode). |

Client only: `NEXT_PUBLIC_BASE_PATH`.

Run with `SKIP_ENV_VALIDATION=1` to bypass strict checks (used automatically in Electron scripts).

---

## Local / Remote Model Options

Model config is persisted in the `AppSetting` table:

- Provider `ollama`: requires an Ollama daemon; specify base URL (e.g. http://localhost:11434) and model name (e.g. `gemma:4b`).
- Provider `openrouter-proxy`: points to an intermediate proxy which calls a remote model (e.g. Gemma 3 27B). Stores auth token and enforces explicit privacy consent.

Privacy consent (for remote) is stored under a dedicated key and must be accepted before prompts are sent externally.

---

## Building Desktop Packages

Build scripts generate a production Next.js output and wrap it with Electron. Common commands:

```bash
npm run dist:win      # Windows installers / portable
npm run dist:electron # All platforms (requires mac/linux signing context as applicable)
```

Artifacts are produced via `electron-builder` (AppImage / NSIS / etc.).

---

## Data & Schema

The local Electron schema lives in `prisma/schema.sqlite.prisma` and generates a client in `src/server/generated/electron`. Core models: `User`, `PromptPreset`, `Chat`, `ChatMessage`, `AppSetting`, plus a lightweight `Post` example and NextAuth-compatible tables retained for structural similarity (may be unused locally depending on auth choices).

Database initialization happens automatically (`db.ts` ensures the Prisma client points to the runtime `DATABASE_URL`).

---

## Contributing

Issues & PRs welcome—focus areas that help most right now:

- Electron stability / packaging edge cases (Windows junctions, asar optimizations)
- Additional local model providers or adapters
- UI/UX refinements for prompt editing & preset management
- Accessibility & i18n contributions

Please open an Issue first for sizeable feature proposals.

---

## License & Attribution

MIT License. Created for the LekkerPrompt project.

---

## Contributors

<a href="https://github.com/sammyhamwi/LekkerPrompt/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=sammyhamwi/LekkerPrompt" alt="Contributors" />
</a>

---

If this project helps you, a star ⭐ is appreciated.




