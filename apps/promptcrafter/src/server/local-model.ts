import { ensureDbReady } from "@/server/db";

interface LocalModelConfig {
  provider: string; // e.g. 'ollama'
  baseUrl: string;  // e.g. 'http://localhost:11434'
  model: string;    // e.g. 'gemma:4b'
}

const PROVIDER_KEY = "MODEL_PROVIDER";
const BASE_URL_KEY = "MODEL_BASE_URL";
const MODEL_NAME_KEY = "MODEL_NAME";
const PRIVACY_CONSENT_KEY = "REMOTE_PRIVACY_CONSENT_ACCEPTED";

export async function readLocalModelConfig(): Promise<LocalModelConfig | null> {
  try {
    const db = await ensureDbReady();
    const rows = await db.appSetting.findMany({ where: { key: { in: [PROVIDER_KEY, BASE_URL_KEY, MODEL_NAME_KEY] } } }) as Array<{ key: string; value: string | null }>;
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
    if (!map[PROVIDER_KEY] || !map[BASE_URL_KEY] || !map[MODEL_NAME_KEY]) return null;
    return { provider: map[PROVIDER_KEY], baseUrl: map[BASE_URL_KEY], model: map[MODEL_NAME_KEY] };
  } catch (e) {
    console.error('[local-model] readLocalModelConfig failed', e);
    return null;
  }
}

export async function writeLocalModelConfig(cfg: LocalModelConfig) {
  const db = await ensureDbReady();
  try {
    await Promise.all([
      db.appSetting.upsert({ where: { key: PROVIDER_KEY }, create: { key: PROVIDER_KEY, value: cfg.provider }, update: { value: cfg.provider } }),
      db.appSetting.upsert({ where: { key: BASE_URL_KEY }, create: { key: BASE_URL_KEY, value: cfg.baseUrl }, update: { value: cfg.baseUrl } }),
      db.appSetting.upsert({ where: { key: MODEL_NAME_KEY }, create: { key: MODEL_NAME_KEY, value: cfg.model }, update: { value: cfg.model } }),
    ]);
  } catch (e:any) {
    console.error('[local-model] writeLocalModelConfig failed', e);
    throw e;
  }
}

export async function validateLocalModelConnection(cfg?: LocalModelConfig | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = cfg || await readLocalModelConfig();
    if (!config) return { ok: false, error: 'not-configured' };
    
    if (config.provider === 'openrouter-proxy') {
      // Validate OpenRouter proxy connection
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 5000);
      try {
        const healthUrl = config.baseUrl.replace(/\/$/, '') + '/healthz';
        const res = await fetch(healthUrl, { 
          signal: controller.signal,
          headers: { 'x-proxy-auth': config.model } // auth token is stored in model field
        });
        clearTimeout(to);
        if (!res.ok) {
          return { ok: false, error: `proxy-error-${res.status}` };
        }
        return { ok: true };
      } catch (e:any) {
        if (e?.name === 'AbortError') {
          return { ok: false, error: 'proxy-timeout' };
        }
        // More specific error for connection issues
        if (e?.cause?.code === 'ENOTFOUND' || e?.message?.includes('fetch failed')) {
          return { ok: false, error: 'proxy-dns-error' };
        }
        return { ok: false, error: 'proxy-unreachable' };
      }
    }
    
    if (config.provider === 'ollama') {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(config.baseUrl.replace(/\/$/, '') + '/api/tags', { signal: controller.signal });
        clearTimeout(to);
        if (!res.ok) return { ok: false, error: 'unreachable' };
        let json: any = null;
        try { json = await res.json(); } catch { /* ignore */ }
        if (json && Array.isArray(json.models)) {
          const found = json.models.some((m: any) => m?.name === config.model);
          if (!found) return { ok: false, error: 'model-not-found' };
        }
        return { ok: true };
      } catch (e:any) {
        return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : 'unreachable' };
      }
    }
    
    return { ok: false, error: 'unsupported-provider' };
  } catch (e:any) {
    return { ok: false, error: 'internal' };
  }
}

export async function callLocalModel(prompt: string): Promise<string> {
  const cfg = await readLocalModelConfig();
  if (!cfg) throw new Error("Model not configured");
  
  if (cfg.provider === 'openrouter-proxy') {
    // Check privacy consent for remote provider (Gemma 3 27B via OpenRouter)
    const db = await ensureDbReady();
    const consent = await db.appSetting.findUnique({ where: { key: PRIVACY_CONSENT_KEY } });
    if (!consent?.value || consent.value !== 'true') {
      throw new Error("Privacy consent required for remote Gemma 3 27B API. Your prompts will be sent to external servers. Consider using local Ollama for complete privacy.");
    }
    
    // Forward to remote proxy that wraps OpenRouter's Gemma 3 27B model
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(cfg.baseUrl.replace(/\/$/, '') + '/api/googleai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Auth token is stored in model field for this provider (encrypted at rest would be better)
          ...(cfg.model ? { 'x-proxy-auth': cfg.model } : {}),
        },
        body: JSON.stringify({ input: prompt, mode: 'build', taskType: 'general' }),
        signal: controller.signal,
      });
      clearTimeout(to);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemma 3 27B proxy error ${res.status}: ${text.slice(0,200)}`);
      }
      const data: any = await res.json();
      if (typeof data?.output === 'string') return data.output;
      throw new Error('Invalid Gemma 3 27B response');
    } catch (e:any) {
      if (e?.name === 'AbortError') throw new Error('Gemma 3 27B proxy timeout');
      throw e;
    }
  }
  
  if (cfg.provider === "ollama") {
    // Ollama simple generate API
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, prompt, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const data: any = await res.json();
    if (typeof data?.response === "string") return data.response;
    return JSON.stringify(data);
  }
  throw new Error(`Unsupported provider: ${cfg.provider}`);
}

export async function setPrivacyConsentForRemoteAPI(accepted: boolean): Promise<void> {
  const db = await ensureDbReady();
  await db.appSetting.upsert({
    where: { key: PRIVACY_CONSENT_KEY },
    create: { key: PRIVACY_CONSENT_KEY, value: accepted.toString() },
    update: { value: accepted.toString() },
  });
}

export async function hasPrivacyConsentForRemoteAPI(): Promise<boolean> {
  try {
    const db = await ensureDbReady();
    const consent = await db.appSetting.findUnique({ where: { key: PRIVACY_CONSENT_KEY } });
    return consent?.value === 'true';
  } catch {
    return false;
  }
}
