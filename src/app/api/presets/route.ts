import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { dataLayer } from "@/server/storage/data-layer";

const OptionsSchema = z.object({
  model: z.string().optional(),
  tone: z.enum(["neutral", "friendly", "formal", "technical", "persuasive"]).optional(),
  detail: z.enum(["brief", "normal", "detailed"]).optional(),
  format: z.enum(["plain", "markdown", "json"]).optional(),
  audience: z.string().optional(),
  language: z.string().optional(),
  styleGuidelines: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  // Type-specific
  stylePreset: z.enum(["photorealistic", "illustration", "3d", "anime", "watercolor"]).optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional(),
  includeTests: z.boolean().optional(),
  requireCitations: z.boolean().optional(),
  rag: z.object({ enabled: z.boolean(), files: z.array(z.string()) }).optional(),
}).partial();

const BodySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  taskType: z.enum(["general", "coding", "image", "research", "writing", "marketing"]),
  options: OptionsSchema.optional(),
});

export async function GET() {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const presets = await dataLayer.findPresetsByUserId(userId);
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let preset;
  if (parsed.id) {
    preset = await dataLayer.updatePreset(parsed.id!, { name: parsed.name, taskType: parsed.taskType, options: parsed.options ?? {}, userId });
  } else {
    const existingPresets = await dataLayer.findPresetsByUserId(userId);
    const existing = existingPresets.find(p => p.name === parsed.name);
    if (existing) {
      preset = await dataLayer.updatePreset(existing.id, { name: parsed.name, taskType: parsed.taskType, options: parsed.options ?? {}, userId });
    } else {
      preset = await dataLayer.createPreset({ name: parsed.name, taskType: parsed.taskType, options: parsed.options ?? {}, userId });
    }
  }

  return NextResponse.json({ preset });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await dataLayer.deletePreset(id);
  return NextResponse.json({ ok: true });
}


