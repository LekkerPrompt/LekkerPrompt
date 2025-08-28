import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { dataLayer } from "@/server/storage/data-layer";

const OptionsSchema = z.object({
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
}).partial();

const BodySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  mode: z.enum(["build", "enhance"]),
  taskType: z.enum(["general", "coding", "image", "research", "writing", "marketing"]),
  options: OptionsSchema.optional(),
});

export async function GET() {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  
  const allPresets = await dataLayer.findPresetsByUserId(userId);
  const presets = allPresets
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map(preset => ({
      id: preset.id,
      name: preset.name,
      mode: preset.mode,
      taskType: preset.taskType,
      options: preset.options,
      updatedAt: preset.updatedAt,
    }));
  
  return NextResponse.json(presets);
}

export async function POST(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  
  try {
    const body = await req.json();
    const parsed = BodySchema.parse(body);
    
    // Check for duplicate name
    const existing = await dataLayer.findPresetsByUserId(userId);
    const duplicateName = existing.find(preset => preset.name === parsed.name && preset.id !== parsed.id);
    
    if (duplicateName) {
      return NextResponse.json({ error: "Name already exists" }, { status: 409 });
    }
    
    const preset = await dataLayer.createPreset({
      userId,
      name: parsed.name,
      mode: parsed.mode,
      taskType: parsed.taskType,
      options: parsed.options || {},
    });
    
    return NextResponse.json(preset, { status: 201 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  
  try {
    const body = await req.json();
    const parsed = BodySchema.parse(body);
    
    if (!parsed.id) {
      return NextResponse.json({ error: "ID is required for updates" }, { status: 400 });
    }
    
    // Verify ownership
    const existingPreset = await dataLayer.findPresetById(parsed.id);
    if (!existingPreset || existingPreset.userId !== userId) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    
    // Check for duplicate name
    const allPresets = await dataLayer.findPresetsByUserId(userId);
    const duplicateName = allPresets.find(preset => preset.name === parsed.name && preset.id !== parsed.id);
    
    if (duplicateName) {
      return NextResponse.json({ error: "Name already exists" }, { status: 409 });
    }
    
    const updatedPreset = await dataLayer.updatePreset(parsed.id, {
      name: parsed.name,
      mode: parsed.mode,
      taskType: parsed.taskType,
      options: parsed.options || {},
    });
    
    return NextResponse.json(updatedPreset);
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }
    
    // Verify ownership
    const preset = await dataLayer.findPresetById(id);
    if (!preset || preset.userId !== userId) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    
    await dataLayer.deletePreset(id);
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
