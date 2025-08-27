# OpenRouter Gemma Proxy

Secure minimal proxy service that holds your OpenRouter API key (Gemma 3 27B free model) off the distributed Electron app. The app calls this proxy; the proxy injects credentials and returns model output.

---
## Features
- Hides `OPENROUTER_API_KEY` from end‑users
- Auth header (`x-proxy-auth`) required
- Rate limiting (requests / minute) via `express-rate-limit`
- Timeout / abort for upstream calls
- Health + readiness endpoints: `/healthz`, `/readyz`
- Structured TypeScript, builds to plain JS
- Caddy reverse proxy with automatic Let's Encrypt TLS

---
## Directory Structure (proxy folder in repo)
```
proxy/
  server.ts          # Source TypeScript server
  README.md          # This file
  (generated at build in deployment:) dist/server.js
  package.json
  package-lock.json (generated after npm install)
  tsconfig.json (if you copy it here for isolated build)
  .env.example       # Template for environment variables
```

Remote deployment directory snapshot (example `/opt/openrouter-api`):
```
.env                 # Secrets (NOT committed)
server.ts            
dist/server.js       
package.json
package-lock.json
node_modules/
tsconfig.json
```

---
## Environment Variables
Create a `.env` file (not committed) with:
```
# Required
OPENROUTER_API_KEY=sk-or-...            # Your OpenRouter key
PROXY_AUTH_TOKEN=64_hex_or_random       # Long random shared secret

# Optional (ranking / attribution)
OPENROUTER_REFERRER=https://promptcrafter.sammyhamwi.ai
OPENROUTER_SITE_NAME=PromptCrafter

# Runtime tuning
PORT=8080
REQUEST_TIMEOUT_MS=15000
RATE_LIMIT_PER_MIN=30
LOG_LEVEL=info          # debug | info | error
NODE_ENV=production
```
Permissions (on server):
```
chown openrouter:openrouter .env
chmod 600 .env
```

### Generating a Strong Token
```
openssl rand -hex 32   # 64 hex chars
```

---
## Build & Run Locally (dev)
```
cd proxy
npm install
npx tsc --project tsconfig.json  # or npm run build if script added
node dist/server.js
```
Test:
```
curl -s http://127.0.0.1:8080/healthz
curl -s -X POST http://127.0.0.1:8080/api/googleai/chat \
  -H "x-proxy-auth: $PROXY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"Hi","mode":"build","taskType":"general"}'
```

---
## Production Deployment (systemd + Caddy)
### 1. Create Service User
```
useradd --system --home /opt/openrouter-api --shell /usr/sbin/nologin openrouter || true
```

### 2. Sync Files to Server
Copy `package.json`, `package-lock.json`, `server.ts`, `tsconfig.json`, `.env` (create there), then:
```
cd /opt/openrouter-api
npm install
npm run build    # generates dist/server.js
chown -R openrouter:openrouter /opt/openrouter-api
chmod 750 /opt/openrouter-api
chmod 640 dist/server.js server.ts package.json tsconfig.json
chmod 600 .env
```

### 3. systemd Unit `/etc/systemd/system/openrouter-proxy.service`
```
[Unit]
Description=OpenRouter Proxy (Gemma 3 27B)
After=network.target

[Service]
Type=simple
User=openrouter
Group=openrouter
WorkingDirectory=/opt/openrouter-api
EnvironmentFile=/opt/openrouter-api/.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=3
# Safe minimal hardening (avoid MemoryDenyWriteExecute for Node JIT)
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```
Enable:
```
systemctl daemon-reload
systemctl enable --now openrouter-proxy
systemctl status openrouter-proxy
```

### 4. Caddy Reverse Proxy (TLS Auto)
Install Caddy (Debian): see https://caddyserver.com/docs/install.

`/etc/caddy/Caddyfile`:
```
promptcrafter.sammyhamwi.ai {
  reverse_proxy 127.0.0.1:8080 {
    flush_interval 250ms
    health_uri /healthz
  }
  header {
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "no-referrer"
    Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
  }
}
```
Then:
```
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy
```

### 5. Firewall to allow api calls to be done
```
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp   # if not already
ufw enable         # only if not yet active
```

---
## Health & Readiness
```
GET /healthz  -> { ok: true }
GET /readyz   -> { ok: true, uptimeMs: <number> }
```

---
## Request Contract
POST `/api/googleai/chat`
Body:
```
{
  "input": "string",
  "mode": "build" | "enhance",
  "taskType": "general" | "coding" | "image" | "research" | "writing" | "marketing",
  "options": { "temperature"?: number, ... }
}
```
Headers:
```
x-proxy-auth: <PROXY_AUTH_TOKEN>
Content-Type: application/json
```
Response:
```
{ "output": "model text", "latencyMs": 1234 }
```
Errors:
- 401 Unauthorized (bad / missing token)
- 429 Rate limit exceeded
- 504 Upstream timeout
- 502/500 Other upstream or internal failures

---
## Rotation & Upgrades
Rotate auth token:
1. Generate new token
2. Update `.env` `PROXY_AUTH_TOKEN`
3. `systemctl restart openrouter-proxy`
4. Update Electron app env `GOOGLE_PROXY_AUTH_TOKEN`

Upgrade code:
```
cd /opt/openrouter-api
sudo -u openrouter git pull (if using git)
npm install
npm run build
systemctl restart openrouter-proxy
```

---
## Logging & Debugging
View logs:
```
journalctl -u openrouter-proxy -f
```
Enable verbose logs set `LOG_LEVEL=debug` then restart.

Common issues:
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 401 Unauthorized | Token mismatch / whitespace | Verify `.env` token & curl header (no braces/quotes) |
| Hang then 504 | Upstream (OpenRouter) slow | Increase `REQUEST_TIMEOUT_MS` or retry logic |
| ECONNREFUSED to 443 | Caddy not running | `systemctl status caddy` |
| Immediate crash on start | Missing env var | Check `.env` keys |

---
## Security Notes
- Keep `.env` mode 600; owned by service user.
- Proxy only on localhost (Caddy handles public TLS). If you *accidentally* run proxy on 0.0.0.0 without TLS, token can be sniffed.
- Consider fail2ban on repeated 401s (Caddy logs can be parsed).
- Avoid very large bodies (JSON limit currently 32kb). Adjust in `express.json({ limit: '32kb' })` if needed.

---
## Backup & Restore
Backup (excluding node_modules):
```
tar czf proxy-backup.tgz \
  /opt/openrouter-api/dist \
  /opt/openrouter-api/package.json \
  /opt/openrouter-api/package-lock.json \
  /opt/openrouter-api/.env \
  /etc/caddy/Caddyfile \
  /etc/systemd/system/openrouter-proxy.service
```
Restore:
1. Extract files
2. `npm ci --omit=dev` (if package-lock.json present)
3. `systemctl daemon-reload && systemctl enable --now openrouter-proxy && systemctl reload caddy`

---
## .env Example
`proxy/.env.example` (create if not present):
```
OPENROUTER_API_KEY=sk-or-REPLACE
PROXY_AUTH_TOKEN=replace_with_random_64_hex
OPENROUTER_REFERRER=https://promptcrafter.sammyhamwi.ai
OPENROUTER_SITE_NAME=PromptCrafter
PORT=8080
REQUEST_TIMEOUT_MS=15000
RATE_LIMIT_PER_MIN=30
LOG_LEVEL=info
NODE_ENV=production
```

---
## Future Enhancements (Optional)
- Streaming endpoint using Server-Sent Events
- Multi-model selection via query param
- Persistent usage logging (SQLite / Postgres) + per-user quotas
- JWT-based auth instead of static shared token
- Structured log output (JSON) for ingestion into ELK / Loki

---
## Quick Test Commands
```
# Health
curl -s https://promptcrafter.sammyhamwi.ai/healthz

# Auth test
curl -s -X POST https://promptcrafter.sammyhamwi.ai/api/googleai/chat \
  -H "x-proxy-auth: $PROXY_AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"input":"One word summary","mode":"build","taskType":"general"}'
```

---
## License / Ownership
Internal deployment helper for PromptCrafter; adjust license as needed.

---
## Support
If something breaks: check logs, verify env vars, use `/readyz`, then escalate.
