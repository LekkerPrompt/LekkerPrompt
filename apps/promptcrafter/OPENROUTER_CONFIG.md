# OpenRouter Proxy Configuration

This app supports two model providers:

## 1. Ollama (Local, Private)
- Requires Ollama installation
- Complete privacy - no data leaves the device
- User configures base URL and model

## 2. OpenRouter Proxy (Remote, Hosted)
- No installation required
- Uses hosted Gemma 3 27B model via promptcrafter.sammyhamwi.ai
- Requires authentication token (stored as environment variable)

## Environment Variables

### Development (.env.local)
```bash
GOOGLE_PROXY_URL="https://promptcrafter.sammyhamwi.ai"
GOOGLE_PROXY_AUTH_TOKEN="8481aa1ccc2b1993540ce3854f77fb89b4f3b2a183d38fcaca90e311a62da4a4"
```

### Production (.env.production)  
Same variables for Electron builds.

## Security Notes

- ✅ Auth token is NOT hardcoded in source code
- ✅ Auth token is loaded from environment variables
- ✅ .env files are gitignored (except .env.example)
- ⚠️ Token will be bundled in Electron app (extractable but obscured)
- ⚠️ Rate limiting on proxy server prevents abuse

## User Experience

Users see two clear options:
- "🏠 Ollama (Local, Private)" - requires setup
- "🌐 Gemma 3 27B API (Remote)" - zero setup, with privacy warnings

For the remote option:
- No token input required from user
- Clear privacy warnings displayed
- Requires explicit consent before first use
- "Ready to use" messaging
