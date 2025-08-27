import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { ensureDbReady } from "@/server/db";

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
  const db = await ensureDbReady();
  const presets = await db.promptPreset.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, mode: true, taskType: true, options: true, updatedAt: true },
  });
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

  // If id is provided, rename/update the record by id (ensures true rename semantics)
  let preset;
  if (parsed.id) {
    // Ensure ownership and update
  const db = await ensureDbReady();
  preset = await db.promptPreset.update({
      where: { id: parsed.id, userId } as any,
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
  const db = await ensureDbReady();
  preset = await db.promptPreset.upsert({
      where: { userId_name: { userId, name: parsed.name } },
      create: {
        userId,
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
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const name = url.searchParams.get("name");
  if (!id && !name) return NextResponse.json({ error: "id or name is required" }, { status: 400 });
  const db = await ensureDbReady();
  await db.promptPreset.deleteMany({ where: { userId, OR: [{ id: id ?? undefined }, { name: name ?? undefined }] } });
  return NextResponse.json({ ok: true });
}


