import { dataLayer } from "./storage/data-layer";

interface LocalModelConfig {
  provider: string; // e.g. 'ollama'
  baseUrl: string;  // e.g. 'http://localhost:11434'
  model: string;    // e.g. 'gemma:4b'
}

const PROVIDER_KEY = "MODEL_PROVIDER";
const BASE_URL_KEY = "MODEL_BASE_URL";
const MODEL_NAME_KEY = "MODEL_NAME";
// Removed privacy consent - local only now
const VALIDATION_TIMEOUT_MS = 15000; // aligned validation timeout
const GENERATION_TIMEOUT_MS = 90000; // long operations

export async function readLocalModelConfig(): Promise<LocalModelConfig | null> {
  try {
    console.log('[local-model] Reading model config from data store...');
    const settings = await dataLayer.findManyAppSettings([PROVIDER_KEY, BASE_URL_KEY, MODEL_NAME_KEY]);
    
    if (!settings || settings.length === 0) {
      console.log('[local-model] No model settings found in data store');
      return null;
    }
    
    console.log('[local-model] Found settings:', settings);
    const map: Record<string, string> = Object.fromEntries(settings.map((s) => [s.key, (s.value ?? "") as string]));
    const providerVal = (map[PROVIDER_KEY] ?? '').toString();
    const baseUrlVal = (map[BASE_URL_KEY] ?? '').toString();
    const modelVal = (map[MODEL_NAME_KEY] ?? '').toString();
    console.log('[local-model] Extracted values:', { 
      provider: providerVal, 
      baseUrl: baseUrlVal, 
      model: modelVal 
    });
    
    // Validate all required values are present
    const hasAll = !!(providerVal && baseUrlVal && modelVal);
    const looksBroken = [providerVal, baseUrlVal, modelVal].some(v => typeof v !== 'string' || v.trim() === '');
    
    if (!hasAll || looksBroken) {
      console.log('[local-model] Config incomplete or broken:', { 
        hasProvider: !!providerVal, 
        hasBaseUrl: !!baseUrlVal, 
        hasModel: !!modelVal,
        looksBroken
      });
      // Do not auto-create defaults; treat as unconfigured until user selects provider.
      return null;
    }
    
    console.log('[local-model] Returning valid config:', { 
      provider: providerVal, 
      baseUrl: baseUrlVal, 
      model: modelVal 
    });
    
    return { provider: providerVal, baseUrl: baseUrlVal, model: modelVal };
  } catch (e) {
    console.error('[local-model] readLocalModelConfig failed', e);
    // Treat as unconfigured on failure
    return null;
  }
}

export async function writeLocalModelConfig(cfg: LocalModelConfig) {
  try {
    // Validate the config before writing
    if (!cfg.provider || !cfg.baseUrl || !cfg.model) {
      console.error('[local-model] Invalid model config - missing required values:', cfg);
      throw new Error('Invalid model configuration. Missing required values.');
    }
    
    console.log('[local-model] Writing model config:', {
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      model: cfg.model
    });
    
    // Write settings one by one with better error reporting
    try {
      console.log('[local-model] Writing provider setting:', cfg.provider);
      await dataLayer.upsertAppSetting(PROVIDER_KEY, cfg.provider);
      
      console.log('[local-model] Writing baseUrl setting:', cfg.baseUrl);
      await dataLayer.upsertAppSetting(BASE_URL_KEY, cfg.baseUrl);
      
      console.log('[local-model] Writing model setting:', cfg.model);
      await dataLayer.upsertAppSetting(MODEL_NAME_KEY, cfg.model);
      
      console.log('[local-model] Successfully wrote all model config settings');
    } catch (writeError) {
      console.error('[local-model] Failed to write one or more settings:', writeError);
      throw new Error('Failed to save model configuration: ' + (writeError instanceof Error ? writeError.message : 'Unknown error'));
    }
    
    // Verify the config was written correctly by reading it back
    try {
      const verifyConfig = await readLocalModelConfig();
      if (!verifyConfig) {
        console.error('[local-model] Config verification failed - unable to read back config');
        throw new Error('Failed to verify model configuration was saved correctly');
      }
      console.log('[local-model] Config verification successful:', verifyConfig);
    } catch (verifyError) {
      console.warn('[local-model] Config verification warning:', verifyError);
      // Don't throw here, since we did write the config
    }
  } catch (e:any) {
    console.error('[local-model] writeLocalModelConfig failed:', e);
    throw e;
  }
}

export async function validateLocalModelConnection(cfg?: LocalModelConfig | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const config = cfg ?? await readLocalModelConfig();
    if (!config) {
      return { ok: false, error: 'not-configured' };
    }
    
    if (config.provider === 'ollama') {
      const controller = new AbortController();
      const to = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS);
      try {
        const res = await fetch(config.baseUrl.replace(/\/$/, '') + '/api/tags', { signal: controller.signal });
        clearTimeout(to);
        if (!res.ok) return { ok: false, error: 'unreachable' };
        let json: any = null;
        try { json = await res.json(); } catch { /* ignore */ }
        
        console.log('[local-model] Ollama API response:', JSON.stringify(json));
        
        if (json && Array.isArray(json.models) && json.models.length > 0) {
          // Get a list of all model names for better debugging
          const modelNames = json.models.map((m: any) => m?.name || m?.id || JSON.stringify(m)).filter(Boolean);
          console.log('[local-model] Available models:', modelNames);
          
          // Check if the model exists (case insensitive)
          const found = json.models.some((m: any) => {
            const modelName = m?.name || m?.id || '';
            return modelName.toLowerCase() === config.model.toLowerCase();
          });
          
          if (!found) {
            console.log(`[local-model] Model '${config.model}' not found in available models:`, modelNames);
            return { ok: false, error: 'model-not-found' };
          }
        } else {
          console.log('[local-model] No models found in Ollama response');
          return { ok: false, error: 'no-models-found' };
        }
        return { ok: true };
      } catch (e:any) {
        return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : 'unreachable' };
      }
    }
    
    return { ok: false, error: 'unsupported-provider' };
  } catch (e:any) {
    return { ok: false, error: e?.message || 'internal' };
  }
}

export async function callLocalModel(prompt: string, opts?: { mode?: 'build' | 'enhance'; taskType?: string; options?: any }): Promise<string> {
  const cfg = await readLocalModelConfig();
  if (!cfg) throw new Error("Model not configured");
  
  if (cfg.provider === "ollama") {
    // Ollama simple generate API
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const data: any = await res.json();
    if (typeof data?.response === "string") return data.response;
    return JSON.stringify(data);
  }
  throw new Error(`Unsupported provider: ${cfg.provider}`);
}
