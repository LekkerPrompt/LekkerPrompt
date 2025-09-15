import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { dataLayer } from "@/server/storage/data-layer";

const keyForUser = (userId: string) => `default_preset:${userId}`;

export async function GET() {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const key = keyForUser(userId);
  const setting = await dataLayer.findAppSetting(key);
  const defaultPresetId = setting?.value ?? null;
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
  await dataLayer.upsertAppSetting(key, presetId);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id ?? 'local-user';
  const key = keyForUser(userId);
  await dataLayer.deleteAppSettings([key]);
  return NextResponse.json({ ok: true });
}


