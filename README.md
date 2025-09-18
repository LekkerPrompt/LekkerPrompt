<p align="center">
  <img src="https://promptcrafter.org/images/prompt-crafter-logo.png" alt="PromptCrafter Logo" width="300" height="300" />
</p>

<p align="center">
  <strong>PromptCrafter</strong> — local-only AI prompt crafting with Ollama Gemma 3 models (Electron + Next.js).
</p>

<div align="center">
  <a href="https://github.com/LekkerPrompt/LekkerPrompt">Repo Home</a> · <a href="https://github.com/LekkerPrompt/LekkerPrompt/issues">Issues</a> · <a href="https://promptcrafter.org">Website</a>
</div>

## What Is PromptCrafter?

PromptCrafter is a local-only AI prompt crafting tool that requires Ollama with Gemma 3 models for complete privacy. Build new prompts from scratch or enhance existing ones using structured controls for task type, tone, detail level, and output format. 

**Complete Privacy**: All processing happens locally on your machine using Ollama. No data ever leaves your computer.

**Local Storage**: Chats, presets, system prompts, and RAG learning data are stored as JSON files in a directory you choose.

The app runs as an Electron desktop application with a modern Material Design interface and three beautiful themes.

## Features

### Core Functionality
- **Build Mode**: Create prompts from scratch with structured guidance
- **Enhance Mode**: Improve and refine existing prompts
- **Task Types**: General, coding, image, research, writing, marketing
- **Customization**: Tone, detail level, output format, language, temperature control
- **Smart Presets**: Save, edit, delete, and manage prompt configurations

### Local AI Integration
- **Ollama Required**: Works exclusively with local Ollama Gemma 3 models (1B, 4B, 12B, 27B)
- **Auto-Discovery**: Automatically detects available local models
- **Model Switching**: Easy dropdown selection between installed models
- **Complete Privacy**: All processing stays on your machine

### Interface & Experience
- **Material Design**: Modern, clean interface with 8pt grid system
- **Three Themes**: Default (purple), WarmEarth, and Light themes
- **Responsive Design**: Adapts to different screen sizes with mobile sidebar
- **Chat History**: Persistent conversations with easy navigation
- **Code Blocks**: Syntax highlighting and copy functionality for markdown/json
- **RAG Learning**: Like/dislike system that personalizes future suggestions

### Technical Features
- **Local Storage**: JSON-based data storage in your chosen directory
- **Vector Search**: Semantic search for personalized recommendations
- **Message Feedback**: Rate responses to improve future suggestions
- **System Prompts**: Customize AI behavior for build and enhance modes
- **Electron Integration**: Native desktop app with custom titlebar and window controls

## Download

If you just want to use the app (no local build), grab the latest signed installers / portable builds from:

- GitHub Releases: https://github.com/LekkerPrompt/LekkerPrompt/releases
- Website mirror: https://promptcrafter.org

Then launch and pick a data directory on first run. Building from source is only needed if you want to hack on the code.

## Stack

- Next.js (App Router)
- Electron
- TypeScript
- tRPC + React Query
- Tailwind CSS
- Local JSON storage (+ lightweight vector store)
- Biome (lint / format)

No SQL / Prisma layer—intentionally simplified.

## Prerequisites

**Required:**
1. **Node.js 18.18+** (recommend 20+)
2. **Ollama** installed and running
3. **Gemma 3 model** pulled (e.g., `ollama pull gemma3:4b`)

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Electron launches and spawns the Next.js dev server. On first run:
1. Choose a data directory for local storage
2. Configure your local Ollama connection
3. Select a Gemma 3 model from the dropdown

**Note**: `SKIP_ENV_VALIDATION=1` is set by default for development.

## Environment Variables (Optional)

| Name | Description |
|------|-------------|
| DATA_DIR | Data directory path (auto-set by Electron, overrides default `./data`) |
| GOOGLE_SYSTEM_PROMPT | Global default system prompt |
| GOOGLE_SYSTEM_PROMPT_BUILD | Build mode prompt override |
| GOOGLE_SYSTEM_PROMPT_ENHANCE | Enhance mode prompt override |
| NEXT_PUBLIC_BASE_PATH | Base path if served under a subpath |
| SKIP_ENV_VALIDATION | Skip environment validation (set to `1` for development) |

All environment variables are optional. System prompts can be customized through the UI.


## Ollama Setup

**Install Ollama:**
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows: Download from https://ollama.ai/download
```

**Pull Gemma 3 Models:**
```bash
# Choose one or more models based on your system:
ollama pull gemma3:1b   # Fastest, basic quality
ollama pull gemma3:4b   # Good balance of speed/quality  
ollama pull gemma3:12b  # Higher quality, slower
ollama pull gemma3:27b  # Best quality, requires powerful hardware
```

**Start Ollama:**
```bash
ollama serve
```

PromptCrafter will auto-detect available models and let you switch between them in the interface.


## Building Production Desktop Bundles

```bash
npm run dist:win       # Windows installer + portable
npm run dist:electron  # All supported targets (needs platform tooling)
```

Process: `build:electron` (Next.js production build) → `electron-builder` (asar packaging; selected `.next` assets unpacked). The main process starts an internal HTTP server for dynamic Next.js routes in production.


## Scripts (select)

| Script | Purpose |
|--------|---------|
| dev | Electron + Next.js dev |
| build:electron | Production Next.js build for Electron |
| dist:win / dist:electron | Package installers / bundles |
| check / check:write | Biome lint & auto‑fix |
| typecheck | TypeScript checking |


## Data Model

**Local JSON Storage:**
- **Chats & Messages**: Conversation history with like/dislike feedback
- **Presets**: Saved prompt configurations with task settings
- **System Prompts**: Custom AI behavior instructions
- **App Settings**: Model configuration and preferences
- **Vector Store**: Semantic embeddings for RAG personalization

**Privacy**: All data stays local. Delete the data directory to completely reset the app.


## Code Map

**Electron:**
- Main process: `electron/main.cjs`
- Preload script: `electron/preload.cjs`
- Startup: `electron/start-electron.cjs`

**Frontend:**
- Chat interface: `src/app/chat/_components/ChatClient.tsx`
- UI components: `src/components/*`
- Styling: `src/styles/globals.css` (Material Design + themes)

**Backend:**
- Local model integration: `src/server/local-model.ts`
- Prompt building: `src/server/prompt-builder.ts`
- Data storage: `src/server/storage/*` (JSON + vector store)
- API routes: `src/app/api/*`


## Contributing

Welcome contributions! High-impact areas:
- **Additional Local Providers**: LM Studio, vLLM, etc.
- **Enhanced UI**: Prompt diff/comparison, better mobile experience
- **Accessibility**: Keyboard shortcuts, ARIA labels, screen reader support
- **Themes**: Additional color schemes and customization options
- **Localization**: Multi-language interface support

**Guidelines:**
- Discuss large features via Issues first
- Keep PRs focused and small
- Follow existing code style (Biome enforced)
- Maintain local-only privacy principles

## Design Philosophy

**Material Design Principles:**
- **8pt Grid System**: Consistent spacing and alignment throughout
- **Theme System**: Three beautiful themes (Default purple, WarmEarth, Light)
- **Typography**: Clear hierarchy with proper line heights and spacing
- **Interactive Elements**: Smooth animations and clear hover states
- **Accessibility**: Proper contrast ratios and keyboard navigation

**Privacy-First Approach:**
- **Local Processing**: All AI operations happen on your machine
- **No Telemetry**: No data collection or external connections
- **User Control**: Complete ownership of your data and conversations

## License

MIT © [LekkerPrompt](https://github.com/LekkerPrompt/LekkerPrompt)

---

If this project helps you, a star ⭐ is appreciated.
