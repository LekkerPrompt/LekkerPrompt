import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { ensureDbReady } from "@/server/db";

const keyForUser = (userId: string) => `default_preset:${userId}`;

export async function GET() {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const key = keyForUser(userId);
  const db = await ensureDbReady();
  const setting = await db.appSetting.findUnique({ where: { key } });
  const defaultPresetId = (setting?.value as string | null) ?? null;
  return NextResponse.json({ defaultPresetId });
}

export async function POST(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const body = (await req.json().catch(() => ({}))) as { presetId?: string };
  const presetId = typeof body?.presetId === "string" ? body.presetId : null;
  if (!presetId) return NextResponse.json({ error: "presetId is required" }, { status: 400 });
  const key = keyForUser(userId);
  const db = await ensureDbReady();
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: presetId },
    update: { value: presetId },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const key = keyForUser(userId);
  const db = await ensureDbReady();
  await db.appSetting.deleteMany({ where: { key } });
  return NextResponse.json({ ok: true });
}


