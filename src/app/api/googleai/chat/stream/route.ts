import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/server/auth';
import { buildUnifiedPrompt } from '@/server/prompt-builder';
import { callLocalModel } from '@/server/local-model';
import type { PromptMode, TaskType } from '@/server/googleai';
import { sanitizeAndDetectDrift } from '@/server/output-sanitize';

const BodySchema = z.object({
  input: z.string().min(1),
  mode: z.enum(['build','enhance']).default('build'),
  taskType: z.enum(['general','coding','image','research','writing','marketing']).default('general'),
  options: z.any().optional(),
});

export async function POST(req: Request) {
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let parsed: z.infer<typeof BodySchema>;
  try { parsed = BodySchema.parse(await req.json()); } catch (e:any) { return NextResponse.json({ error: 'invalid-body', detail: e?.message || 'parse-failed' }, { status: 400 }); }
  if (!isElectron) return NextResponse.json({ error: 'not-electron', detail: 'Streaming only enabled inside Electron runtime' }, { status: 400 });

  const encoder = new TextEncoder();
  // No greeting guard; model handles NEED_CONTEXT sentinel.

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const built = await buildUnifiedPrompt({ input: parsed.input, mode: parsed.mode as PromptMode, taskType: parsed.taskType as TaskType, options: parsed.options });
        // Intercept rejection / guidance sentinel and stream directly instead of invoking model
        if (/^User input rejected:/i.test(built)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: built })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
          controller.close();
          return;
        }
        const raw = await callLocalModel(built, { mode: parsed.mode as PromptMode, taskType: parsed.taskType as TaskType, options: parsed.options });
        const sanitized = sanitizeAndDetectDrift(parsed.taskType as TaskType, parsed.options, raw).cleaned || raw;
        const fmt = parsed.options?.format ?? 'plain';
        const chunks = sanitized.match(/.{1,400}/gs) || [sanitized];
        // For markdown/json, stream opening fence, body chunks, then closing fence
        if (fmt === 'markdown') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: '```markdown\n' })}\n\n`));
        } else if (fmt === 'json') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: '```json\n' })}\n\n`));
        }
        for (const c of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: c })}\n\n`));
          await new Promise(r => setTimeout(r, 20));
        }
        if (fmt === 'markdown' || fmt === 'json') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: '\n```' })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (e:any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message || 'error' })}\n\n`));
        controller.close();
      }
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
}
