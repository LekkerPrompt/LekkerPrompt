import { NextResponse } from 'next/server';
import { readLocalModelConfig, validateLocalModelConnection } from '@/server/local-model';
import { ensureDbReady } from '@/server/db';

export async function GET() {
  try {
    await ensureDbReady();
    const cfg = await readLocalModelConfig();
    const result = await validateLocalModelConnection(cfg);
    return NextResponse.json({ config: cfg, ...result });
  } catch (error: any) {
    // Handle database not configured error
    if (error?.message?.includes('Database location not configured')) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Database not configured',
        config: null 
      }, { status: 400 });
    }
    
    // Handle other errors
    console.error('[api/model/validate] failed', error);
    return NextResponse.json({ 
      ok: false, 
      error: error?.message || 'Validation failed',
      config: null 
    }, { status: 500 });
  }
}