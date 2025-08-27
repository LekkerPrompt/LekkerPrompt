import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { readSystemPromptForModeFromDb, writeSystemPromptForModeToDb } from '@/server/settings';
import { getDefaultSystemPrompts } from '@/server/seed-system-prompts';
import { ensureDbReady } from '@/server/db';

export async function GET() {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureDbReady();
  const build = await readSystemPromptForModeFromDb('build');
  const enhance = await readSystemPromptForModeFromDb('enhance');
  return NextResponse.json({ build, enhance });
}

export async function PUT(req: Request) {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureDbReady();
  const body = await req.json().catch(() => ({}));
  if (typeof body.build === 'string') await writeSystemPromptForModeToDb('build', body.build);
  if (typeof body.enhance === 'string') await writeSystemPromptForModeToDb('enhance', body.enhance);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  await ensureDbReady();
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'reset') {
    const defaults = getDefaultSystemPrompts();
    await writeSystemPromptForModeToDb('build', defaults.build);
    await writeSystemPromptForModeToDb('enhance', defaults.enhance);
    return NextResponse.json({ ok: true, reset: true, build: defaults.build, enhance: defaults.enhance });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
