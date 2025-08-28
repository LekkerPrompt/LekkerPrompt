import { NextResponse } from "next/server";
import { z } from "zod";
import { dataLayer } from "@/server/storage/data-layer";

const DEFAULT_PROVIDER_KEY = "DEFAULT_MODEL_PROVIDER";

const Body = z.object({
  provider: z.enum(['ollama', 'openrouter-proxy']),
});

export async function GET() {
  try {
  const setting = await dataLayer.findAppSetting(DEFAULT_PROVIDER_KEY);
  return NextResponse.json({ provider: setting?.value || null });
  } catch (e: any) {
    // Handle data directory not configured error
    if (e?.message?.includes('Data directory not configured') || e?.message?.includes('Database location not configured')) {
      return NextResponse.json({ provider: null }, { status: 200 });
    }
    
    console.error('[api/model/default-provider] GET failed', e);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.parse(json);
  await dataLayer.upsertAppSetting(DEFAULT_PROVIDER_KEY, parsed.provider);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Handle data directory not configured error
    if (err?.message?.includes('Data directory not configured') || err?.message?.includes('Database location not configured')) {
      return NextResponse.json({ error: "Data directory not configured" }, { status: 400 });
    }
    
    console.error('[api/model/default-provider] POST failed', err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
  await dataLayer.deleteAppSettings([DEFAULT_PROVIDER_KEY]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/model/default-provider] DELETE failed', err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
