import { NextResponse } from "next/server";
import { readLocalModelConfig } from "@/server/local-model";
import { ensureDbReady } from "@/server/db";

export async function GET(request: Request) {
  try {
    await ensureDbReady();
    const { searchParams } = new URL(request.url);
    const customBaseUrl = searchParams.get('baseUrl');
    
    const cfg = await readLocalModelConfig();
    
    // Use custom baseUrl if provided, otherwise use config or default
    const baseUrl = customBaseUrl || cfg?.baseUrl || 'http://localhost:11434';
    
    if (!cfg && !customBaseUrl) {
      return NextResponse.json({ 
        current: null, 
        available: [],
        error: 'not-configured' 
      });
    }

    // Get available models from Ollama
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
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
      const gemmaModels = data.models
        ?.filter((m: any) => m?.name?.startsWith('gemma3:'))
        ?.map((m: any) => m.name) || [];
      
      return NextResponse.json({ 
        current: cfg?.model || null, 
        available: gemmaModels 
      });
    } catch (e: any) {
      clearTimeout(timeout);
      return NextResponse.json({ 
        current: cfg?.model || null, 
        available: [],
        error: e?.name === 'AbortError' ? 'timeout' : 'unreachable' 
      });
    }
  } catch (err) {
    return NextResponse.json({ 
      current: null, 
      available: [],
      error: 'internal' 
    }, { status: 500 });
  }
}
