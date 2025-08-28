import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { readSystemPromptForMode, writeSystemPromptForMode } from '@/server/settings';
import { BUILD_VALUE, ENHANCE_VALUE } from '@/server/system-prompts';

export async function GET() {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const build = await readSystemPromptForMode('build') || BUILD_VALUE;
  const enhance = await readSystemPromptForMode('enhance') || ENHANCE_VALUE;
  return NextResponse.json({ build, enhance });
}

export async function PUT(req: Request) {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json().catch(() => ({}));
  if (typeof body.build === 'string') await writeSystemPromptForMode('build', body.build);
  if (typeof body.enhance === 'string') await writeSystemPromptForMode('enhance', body.enhance);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await req.json().catch(() => ({}));
  if (body?.action === 'reset') {
  await writeSystemPromptForMode('build', BUILD_VALUE);
  await writeSystemPromptForMode('enhance', ENHANCE_VALUE);
    return NextResponse.json({ ok: true, reset: true, build: BUILD_VALUE, enhance: ENHANCE_VALUE });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
