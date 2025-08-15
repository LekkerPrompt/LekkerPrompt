import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { db } from "@/server/db";

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
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const presets = await (db as any).promptPreset.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, mode: true, taskType: true, options: true, updatedAt: true },
  });
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // If id is provided, rename/update the record by id (ensures true rename semantics)
  let preset;
  if (parsed.id) {
    // Ensure ownership and update
    preset = await (db as any).promptPreset.update({
      where: { id: parsed.id, userId: session.user.id } as any,
      data: {
        name: parsed.name,
        mode: parsed.mode,
        taskType: parsed.taskType,
        options: parsed.options ?? {},
      },
      select: { id: true, name: true, mode: true, taskType: true, options: true, updatedAt: true },
    });
  } else {
    // Create or update by unique (userId, name)
    preset = await (db as any).promptPreset.upsert({
      where: { userId_name: { userId: session.user.id, name: parsed.name } },
      create: {
        userId: session.user.id,
        name: parsed.name,
        mode: parsed.mode,
        taskType: parsed.taskType,
        options: parsed.options ?? {},
      },
      update: {
        mode: parsed.mode,
        taskType: parsed.taskType,
        options: parsed.options ?? {},
      },
      select: { id: true, name: true, mode: true, taskType: true, options: true, updatedAt: true },
    });
  }

  return NextResponse.json({ preset });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name");
  if (!id && !name) return NextResponse.json({ error: "id or name is required" }, { status: 400 });
  await (db as any).promptPreset.deleteMany({ where: { userId: session.user.id, OR: [{ id: id ?? undefined }, { name: name ?? undefined }] } });
  return NextResponse.json({ ok: true });
}


