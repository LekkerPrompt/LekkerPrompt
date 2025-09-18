import { NextResponse } from "next/server";
import { readLocalModelConfig } from "@/server/local-model";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customBaseUrl = searchParams.get('baseUrl');
    
    const cfg = await readLocalModelConfig();
    
    // Use custom baseUrl if provided, otherwise use config or default
    const baseUrl = customBaseUrl || (cfg && cfg.baseUrl) || 'http://localhost:11434';
    
    // Improve UX: if not configured and no custom base URL provided,
    // probe the default local Ollama URL instead of returning not-configured.
    if (!cfg && !customBaseUrl) {
      console.warn('[api/model/available] No saved model config. Probing default Ollama at', baseUrl);
    }

    // Get available models from Ollama
    const controller = new AbortController();
    const timeoutMs = 8000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { 
        signal: controller.signal 
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        return NextResponse.json({ 
          current: cfg?.model || null, 
          available: [],
          error: 'unreachable' 
        });
      }
      
      const data = await res.json();
      console.log('[api/model/available] Ollama response:', JSON.stringify(data));
      
      // Extract model names from Ollama API response (handle different response formats)
      const gemmaModels = data.models
        ?.map((m: any) => m?.name || m?.id || null)
        ?.filter((name: string | null) => name && name.toLowerCase().startsWith('gemma3:')) || [];
      
      return NextResponse.json({ 
        current: cfg?.model || null, 
        available: gemmaModels 
      });
    } catch (e: any) {
      clearTimeout(timeout);
      console.warn('[api/model/available] Failed to reach Ollama at', baseUrl, e?.name || e?.message || e);
      return NextResponse.json({ 
        current: cfg?.model || null, 
        available: [],
        error: e?.name === 'AbortError' ? 'timeout' : 'unreachable' 
      });
    }
  } catch (err: any) {
    return NextResponse.json({ 
      current: null, 
      available: [],
      error: err?.message || 'internal' 
    }, { status: 500 });
  }
}
