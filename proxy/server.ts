/**
 * OpenRouter Proxy (Gemma 3 27B free)
 * Purpose: keep OPENROUTER_API_KEY off end‑user machines.
 *
 * Env (required):
 *  - OPENROUTER_API_KEY
 *  - PROXY_AUTH_TOKEN
 *
 * Env (optional):
 *  - OPENROUTER_REFERRER, OPENROUTER_SITE_NAME
 *  - PORT (default 8080)
 *  - REQUEST_TIMEOUT_MS (default 15000)
 *  - RATE_LIMIT_PER_MIN (default 30)
 *  - LOG_LEVEL=debug|info|error (default info)
 *
 * POST /api/googleai/chat
 *   body: { input, mode, taskType, options? }
 *   returns: { output }
 * GET /healthz -> { ok: true }
 * GET /readyz  -> { ok: true, uptimeMs }
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';

// ---- Env / Config ----
const cfg = {
  port: Number(process.env.PORT || 8080),
  apiKey: process.env.OPENROUTER_API_KEY || '',
  referrer: process.env.OPENROUTER_REFERRER || '',
  siteName: process.env.OPENROUTER_SITE_NAME || '',
  proxyAuth: process.env.PROXY_AUTH_TOKEN || '',
  // Request timeout (ms). Increased default from 15s to 90s to accommodate slower upstream responses.
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 90000),
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN || 30),
  logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
};

if (!cfg.apiKey) throw new Error('OPENROUTER_API_KEY missing');
if (!cfg.proxyAuth) throw new Error('PROXY_AUTH_TOKEN missing');

const log = {
  debug: (...a: any[]) => cfg.logLevel === 'debug' && console.log('[debug]', ...a),
  info: (...a: any[]) => cfg.logLevel !== 'error' && console.log('[info]', ...a),
  error: (...a: any[]) => console.error('[error]', ...a),
};

// ---- App Setup ----
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cors({ origin: '*', methods: ['POST', 'OPTIONS'] }));
app.use(helmet({ contentSecurityPolicy: false }));

// Simple request logging (trim output for prod)
app.use((req, _res, next) => {
  if (cfg.logLevel === 'debug') {
    log.debug(`${req.method} ${req.path}`);
  }
  next();
});

// Rate limit
const limiter = rateLimit({
  windowMs: 60_000,
  max: cfg.rateLimitPerMin,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth middleware
app.use('/api/', (req: Request, res: Response, next: NextFunction) => {
  const token = (req.headers['x-proxy-auth'] || '').toString().trim();
  if (token !== cfg.proxyAuth) {
    if (cfg.logLevel === 'debug') {
      log.debug('Auth fail: incomingLen=%d expectedLen=%d', token.length, cfg.proxyAuth.length);
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ---- Validation Schema ----
const BodySchema = z.object({
  input: z.string().min(1),
  mode: z.enum(['build', 'enhance']),
  taskType: z.enum(['general', 'coding', 'image', 'research', 'writing', 'marketing']),
  options: z.object({
    tone: z.enum(['neutral', 'friendly', 'formal', 'technical', 'persuasive']).optional(),
    detail: z.enum(['brief', 'normal', 'detailed']).optional(),
    format: z.enum(['plain', 'markdown', 'json']).optional(),
    audience: z.string().optional(),
    language: z.string().optional(),
    styleGuidelines: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    stylePreset: z.enum(['photorealistic', 'illustration', '3d', 'anime', 'watercolor']).optional(),
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3']).optional(),
    includeTests: z.boolean().optional(),
    requireCitations: z.boolean().optional(),
  }).optional(),
});

// ---- Route ----
app.post('/api/googleai/chat', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const parsed = BodySchema.parse(req.body);

    const temperature = typeof parsed.options?.temperature === 'number'
      ? parsed.options.temperature
      : undefined;

    const openRouterBody: any = {
      model: 'google/gemma-3-27b-it:free',
      messages: [
        { role: 'user', content: parsed.input },
      ],
      ...(temperature !== undefined ? { temperature } : {}),
    };

    // Timeout / abort
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    let r: Response | any;
    try {
      r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
          ...(cfg.referrer ? { 'HTTP-Referer': cfg.referrer } : {}),
          ...(cfg.siteName ? { 'X-Title': cfg.siteName } : {}),
        },
        body: JSON.stringify(openRouterBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return res.status(504).json({ error: 'Upstream timeout' });
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(r.status).json({ error: text.slice(0, 500) || 'Upstream error' });
    }

    const data: any = await r.json().catch((e: unknown) => {
      const msg = (e && typeof e === 'object' && 'message' in e) ? (e as { message?: string }).message : undefined;
      return { error: msg || 'Bad JSON' };
    });
    if (data.error) {
      return res.status(502).json({ error: data.error });
    }

    const choice = data?.choices?.[0];
    let outputText: string | undefined;
    if (typeof choice?.message?.content === 'string') {
      outputText = choice.message.content;
    } else if (Array.isArray(choice?.message?.content)) {
      outputText = choice.message.content.map((c: any) => c?.text ?? (typeof c === 'string' ? c : '')).join('');
    }
    if (!outputText) outputText = 'No content returned.';

    res.json({ output: outputText, latencyMs: Date.now() - start });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid body', issues: e.issues });
    }
    log.error('Handler error:', e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Health / readiness
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/readyz', (_req, res) => res.json({ ok: true, uptimeMs: Math.round(process.uptime() * 1000) }));

// Fallback 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
// (Should rarely be called because we try/catch route)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  log.error('Unhandled error middleware:', err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(cfg.port, () => {
  log.info(`Proxy listening on :${cfg.port}`);
  log.info(`Rate limit ${cfg.rateLimitPerMin}/min, timeout ${cfg.timeoutMs}ms`);
  log.debug(`Auth token first8=${cfg.proxyAuth.slice(0, 8)}`);
});