import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDbReady } from "@/server/db";

const DEFAULT_PROVIDER_KEY = "DEFAULT_MODEL_PROVIDER";

const Body = z.object({
  provider: z.enum(['ollama', 'openrouter-proxy']),
});

export async function GET() {
  try {
    const db = await ensureDbReady();
    const setting = await db.appSetting.findUnique({ 
      where: { key: DEFAULT_PROVIDER_KEY } 
    });
    return NextResponse.json({ provider: setting?.value || null });
  } catch (e: any) {
    // Handle database not configured error
    if (e?.message?.includes('Database location not configured')) {
      return NextResponse.json({ provider: null }, { status: 200 });
    }
    
    console.error('[api/model/default-provider] GET failed', e);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = await ensureDbReady();
    const json = await req.json();
    const parsed = Body.parse(json);
    
    await db.appSetting.upsert({
      where: { key: DEFAULT_PROVIDER_KEY },
      create: { key: DEFAULT_PROVIDER_KEY, value: parsed.provider },
      update: { value: parsed.provider },
    });
    
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Handle database not configured error
    if (err?.message?.includes('Database location not configured')) {
      return NextResponse.json({ error: "Database not configured" }, { status: 400 });
    }
    
    console.error('[api/model/default-provider] POST failed', err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = await ensureDbReady();
    await db.appSetting.deleteMany({ 
      where: { key: DEFAULT_PROVIDER_KEY } 
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/model/default-provider] DELETE failed', err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
