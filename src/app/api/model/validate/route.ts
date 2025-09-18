import { NextResponse } from 'next/server';
import { readLocalModelConfig, validateLocalModelConnection } from '@/server/local-model';

export async function GET() {
  try {
    console.log('[api/model/validate] Validating model connection');
    const cfg = await readLocalModelConfig();
    
    if (!cfg) {
      console.log('[api/model/validate] No model configuration found');
      return NextResponse.json({ 
        ok: false, 
        error: 'not-configured', 
        config: null,
        message: 'Model is not configured. Please configure a model first.' 
      });
    }
    
    console.log(`[api/model/validate] Validating connection for ${cfg.provider} model: ${cfg.model}`);
    const result = await validateLocalModelConnection(cfg);
    console.log('[api/model/validate] Validation result:', result);
    
    return NextResponse.json({ 
      config: cfg, 
      ...result,
      message: result.ok ? 'Connection successful' : `Connection failed: ${result.error}`
    });
  } catch (error: any) {
    const message = error?.message || 'internal';
    
    console.error('[api/model/validate] Validation failed', error);
    return NextResponse.json({ 
      ok: false, 
      error: message, 
      config: null,
      message: `Validation error: ${message}`
    }, { status: 500 });
  }
}