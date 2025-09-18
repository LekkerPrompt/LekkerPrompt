import { NextResponse } from "next/server";
import { z } from "zod";
import { readLocalModelConfig, writeLocalModelConfig } from "@/server/local-model";
import { env } from "@/env";
import { dataLayer } from "@/server/storage/data-layer";

const AllowedModels = ["gemma3:1b", "gemma3:4b", "gemma3:12b", "gemma3:27b"] as const;
const OllamaBody = z.object({
  provider: z.literal("ollama"),
  baseUrl: z.string().refine(v => /^https?:\/\/(localhost|127\.0\.0\.1)(:11434)?$/.test(v.replace(/\/$/, "")), "Base URL must be local (http://localhost:11434)"),
  model: z.enum(AllowedModels),
  setDefault: z.boolean().optional(),
});
const Body = OllamaBody;

export async function GET() {
  try {
    console.log('[api/model/config] Reading model config');
    const cfg = await readLocalModelConfig();
    
    if (!cfg) {
      console.log('[api/model/config] No model configuration found');
      return NextResponse.json({ 
        config: null, 
        error: 'not-configured',
        message: 'Model configuration not found. Please configure a model.'
      }, { status: 200 });
    }
    
    console.log('[api/model/config] Got config:', cfg);
    return NextResponse.json({ 
      config: cfg,
      message: `Model configured: ${cfg.model} via ${cfg.provider}` 
    });
  } catch (e) {
    console.error('[api/model/config] Error reading config:', e);
    // Uninitialized; do not write or imply defaults.
    return NextResponse.json({ 
      config: null, 
      error: 'uninitialized',
      message: 'Failed to read model configuration' 
    }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    console.log('[api/model/config] Saving model config');
    
    // Parse the JSON request body
    let json: any;
    try {
      json = await req.json();
      console.log('[api/model/config] Received payload:', json);
    } catch (parseError) {
      console.error('[api/model/config] Failed to parse request body:', parseError);
      return NextResponse.json({ 
        ok: false, 
        error: 'invalid-request', 
        message: 'Invalid JSON in request body' 
      }, { status: 400 });
    }
    
    // Validate the payload against our schema
    let parsed;
    try {
      parsed = Body.parse(json);
      console.log('[api/model/config] Parsed payload:', parsed);
    } catch (validationError: any) {
      console.error('[api/model/config] Validation error:', validationError);
      return NextResponse.json({ 
        ok: false, 
        error: 'validation-failed', 
        message: validationError?.message || 'Validation failed',
        details: validationError?.errors || [] 
      }, { status: 400 });
    }
    
    const { provider, baseUrl, model, setDefault } = parsed;
    
    // Ensure data directory exists and is writable
    try {
      console.log('[api/model/config] Ensuring data directory exists');
      const fs = require('fs');
      const { resolveDataDir } = require('@/server/storage/data-path');
      const dataDir = resolveDataDir();
      console.log('[api/model/config] Resolved data directory:', dataDir);
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('[api/model/config] Data directory created/verified');
    } catch (dirError) {
      console.error('[api/model/config] Failed to ensure data directory:', dirError);
      return NextResponse.json({ 
        ok: false, 
        error: 'data-dir-error', 
        message: 'Failed to access data directory' 
      }, { status: 500 });
    }
    
    // Persist model configuration
    try {
      await writeLocalModelConfig({ provider, baseUrl, model });
      console.log('[api/model/config] Model config saved successfully');
    } catch (writeError: any) {
      console.error('[api/model/config] Failed to write model config:', writeError);
      return NextResponse.json({ 
        ok: false, 
        error: 'write-failed', 
        message: writeError?.message || 'Failed to save model configuration' 
      }, { status: 500 });
    }
    
    // Set default provider if requested
    if (setDefault) {
      try {
        console.log('[api/model/config] Setting default provider:', provider);
        await dataLayer.upsertAppSetting("DEFAULT_MODEL_PROVIDER", provider);
        console.log('[api/model/config] Default provider set successfully');
      } catch (defaultError) {
        console.error('[api/model/config] Failed to set default provider', defaultError);
        // Don't fail the whole request for default flag issues
      }
    }
    
    return NextResponse.json({ 
      ok: true,
      message: `Model configuration saved successfully: ${model} via ${provider}`
    });
  } catch (err) {
    console.error('[api/model/config] Unexpected error during save:', err);
    if (err instanceof Error) {
      return NextResponse.json({ 
        ok: false, 
        error: 'save-failed', 
        message: err.message || 'Save failed' 
      }, { status: 500 });
    }
    return NextResponse.json({ 
      ok: false, 
      error: 'unknown-error', 
      message: 'Unknown error occurred during save' 
    }, { status: 500 });
  }
}
