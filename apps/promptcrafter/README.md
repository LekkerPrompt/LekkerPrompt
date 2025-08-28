<p align="center">
  <img src="https://promptcrafter.org/images/prompt-crafter-logo.png" alt="PromptCrafter Logo" width="300" height="300" />
</p>

<p align="center">
  <strong>PromptCrafter</strong> — local‑first, privacy‑friendly prompt building & enhancement (Electron + Next.js).
</p>

<div align="center">
  <a href="https://github.com/LekkerPrompt/LekkerPrompt">Repo Home</a> · <a href="https://github.com/LekkerPrompt/LekkerPrompt/issues">Issues</a> · <a href="https://promptcrafter.org">Website</a>
</div>

---

## What Is PromptCrafter?

PromptCrafter lets you compose new prompts (Build mode) or iteratively refine existing text (Enhance mode) using structured task & style controls. Everything—chats, presets, system prompts, app settings, personalization vectors—is stored as plain JSON files in a directory you pick on first launch. No external database or cloud service is required.

The codebase runs in two contexts:
1. Dev Web (Next.js dev server started by Electron)
2. Packaged Desktop (Electron with embedded production Next.js server)

---

## Features

- Modes: build / enhance
- Task types: general, coding, image, research, writing, marketing
- Customization: tone, detail level, output format, language, temperature
- Presets: create / edit / delete / set default
- Persistent chat history (reopen & continue)
- System prompts: per‑mode overrides (priority chain: per‑mode stored > global stored > env > internal fallback)
- Local model config (Ollama) or remote proxy / Google AI endpoints
- Explicit privacy consent gate for remote model usage
- Electron niceties: spellcheck (en‑US), custom context menu with suggestions, controlled window sizing

---

## Download

If you just want to use the app (no local build), grab the latest signed installers / portable builds from:

- GitHub Releases: https://github.com/LekkerPrompt/LekkerPrompt/releases
- Website mirror: https://promptcrafter.org

Then launch and pick a data directory on first run. Building from source is only needed if you want to hack on the code.

---

## Stack

- Next.js (App Router)
- Electron
- TypeScript
- tRPC + React Query
- Tailwind CSS
- Local JSON storage (+ lightweight vector store)
- Biome (lint / format)

No SQL / Prisma layer—intentionally simplified.

---

## Quick Start (Development)

Prerequisites: Node 18.18+ (recommend 20+). From this folder:

```bash
npm install
npm run dev
```

Electron launches and spawns the Next.js dev server. Choose a data directory when prompted; JSON state files & the vector index are created there.

To experiment without providing all env vars, `SKIP_ENV_VALIDATION=1` is already set by the dev script.

---

## Environment Variables (Optional)

| Name | Description |
|------|-------------|
| DATA_DIR | Normally auto‑set by Electron (overrides default `./data`). |
| GOOGLE_API_KEY | Direct Google AI key (if calling endpoints directly). |
| GOOGLE_BASE_URL | Full model endpoint URL override. |
| GOOGLE_PROXY_URL | Privacy proxy endpoint (instead of bundling key). |
| GOOGLE_PROXY_AUTH_TOKEN | Shared secret sent to proxy. |
| GOOGLE_SYSTEM_PROMPT | Global default system prompt. |
| GOOGLE_SYSTEM_PROMPT_BUILD | Build‑mode prompt override. |
| GOOGLE_SYSTEM_PROMPT_ENHANCE | Enhance‑mode prompt override. |
| NEXT_PUBLIC_BASE_PATH | Base path if served under a subpath (web build). |

All are optional; remote model features simply won't function until the relevant values & consents exist.

---

## Model Configuration

Stored locally as JSON settings: `MODEL_PROVIDER`, `MODEL_BASE_URL`, `MODEL_NAME`, plus a consent key for remote usage.

Supported providers:
1. `ollama` — local daemon (e.g. `http://localhost:11434`, model `gemma:4b`).
2. `openrouter-proxy` — a user‑controlled proxy; token passed as header `x-proxy-auth`.

Remote usage only activates after explicit privacy consent inside the app.

See `src/server/local-model.ts` for connectivity helpers.

---

## Building Production Desktop Bundles

```bash
npm run dist:win       # Windows installer + portable
npm run dist:electron  # All supported targets (needs platform tooling)
```

Process: `build:electron` (Next.js production build) → `electron-builder` (asar packaging; selected `.next` assets unpacked). The main process starts an internal HTTP server for dynamic Next.js routes in production.

---

## Scripts (select)

| Script | Purpose |
|--------|---------|
| dev | Electron + Next.js dev |
| build:electron | Production Next.js build for Electron |
| dist:win / dist:electron | Package installers / bundles |
| check / check:write | Biome lint & auto‑fix |
| typecheck | TypeScript checking |

---

## Data Model

Logical entities (`User`, `PromptPreset`, `Chat`, `ChatMessage`, `AppSetting`) are stored as individual JSON documents with a companion vector store for semantic personalization / retrieval. Remove the chosen data directory to fully clear state.

---

## Code Map

- Electron main: `electron/main.cjs`
- Preload: `electron/preload.cjs`
- Startup orchestrator: `electron/start-electron.cjs`
- Env schema: `src/env.js`
- Model logic (Gemma / Google): `src/server/gemma.ts` (+ context helpers)
- Local/remote bridge: `src/server/local-model.ts`
- System prompts & settings: `src/server/settings.ts`
- Storage layer: `src/server/storage/*` (JSON + vector store)

---

## Contributing

You're welcome to open Issues & PRs. High‑impact areas:
- Additional providers (LM Studio, vLLM, etc.)
- Enhanced prompt diff / comparison UI
- Accessibility (keyboard shortcuts, ARIA labels)
- Localization / multi‑language support

Guidelines:
- Discuss large features first via an Issue.
- Keep PRs focused & small where possible.
- Match existing code style (Biome will enforce formatting).

---

## License

MIT © [LekkerPrompt](https://github.com/LekkerPrompt/LekkerPrompt)

If this project helps you, a star ⭐ is appreciated.
