<p align="center">
  <img src="https://raw.githubusercontent.com/LekkerPrompt/LekkerPrompt/refs/heads/master/logo.png" alt="LekkerPrompt Logo" width="300" height="300" />
</p>

<p align="center">
  <strong>LekkerPrompt</strong> – home of the PromptCrafter app.
</p>

<div align="center">
  <a href="https://promptcrafter.org">Website</a> · <a href="apps/promptcrafter/README.md">App Docs</a> · <a href="https://github.com/LekkerPrompt/LekkerPrompt/issues">Issues</a>
</div>

## Overview

This repository hosts **PromptCrafter**, a lightweight, local‑first Electron + Next.js application for structured prompt creation and iterative enhancement. The app keeps all user data (chats, presets, system prompts, settings, vectors) in plain JSON inside a directory you choose—no external database required.

Detailed feature, configuration, and build instructions live exclusively in `apps/promptcrafter/README.md` to keep this top‑level file concise.

## Quick Peek

PromptCrafter provides:
- Build & Enhance modes
- Task/style controls & reusable presets
- Local model (Ollama) or optional remote proxy usage (with explicit consent)
- 100% local storage by default

For the full list of capabilities, see the app docs.

## Download

Just want to use it? Grab the latest installers / portable builds from:
- GitHub Releases: https://github.com/LekkerPrompt/LekkerPrompt/releases
- Website: https://promptcrafter.org (mirrors stable release downloads)

Or run from source (see below).

## Getting Started

From the app folder:
```bash
cd apps/promptcrafter
npm install
npm run dev
```
An Electron window will open and prompt you for a data directory. That's it.

## Contributing

Issues & PRs welcome. Please read the app README first and open an Issue for major proposals.

Contributors :heart: :

<a href="https://github.com/sammyhamwi/LekkerPrompt/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=sammyhamwi/LekkerPrompt" alt="Contributors" />
</a>

## License

MIT © LekkerPrompt

---

If the project helps you, a star ⭐ is appreciated.







