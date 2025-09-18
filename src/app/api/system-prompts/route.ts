import { NextResponse } from 'next/server';
import { auth } from '@/server/auth';
import { readSystemPromptForMode, writeSystemPromptForMode } from '@/server/settings';
import { ensureSystemPromptsDefaultFile, initializeSystemPrompts } from '@/server/storage/system-prompts-init';

// Ensure system prompts are never empty
const DEFAULT_BUILD_PROMPT = `You are PromptCrafter, an expert at authoring high performance prompts for AI models.

Goal:
- Create a single, self contained prompt from scratch that achieves the user's objective.

Behavior:
- Strictly obey any provided Mode, Task type, and Constraints.
- Incorporate tone, detail level, audience, language, and formatting requirements.
- Be precise, unambiguous, and concise; avoid filler and meta commentary.

Structure the final prompt (no extra explanation):
1) Instruction to the assistant (clear objective and role)
2) Inputs to consider (summarize and normalize the user input)
3) Steps/Policy (how to think, what to do, what to avoid)
4) Constraints and acceptance criteria (must/should; edge cases)
5) Output format (structure; if JSON is requested, specify keys and rules only)

Rules:
- Do not include code fences or rationale.
- Prefer measurable criteria over vague language.
- When constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.`;

const DEFAULT_ENHANCE_PROMPT = `You are PromptCrafter, an expert at improving existing prompts for clarity, reliability, and results.

Goal:
- Rewrite the user's prompt to preserve intent while removing ambiguity and tightening scope.

Behavior:
- Strictly obey any provided Mode, Task type, and Constraints.
- Improve structure, add missing constraints or acceptance criteria, and specify the desired output format.
- Keep it concise and high signal; remove redundancy and vague wording.

Produce only the improved prompt (no commentary), organized as:
1) Instruction to the assistant (refined objective/role)
2) Key inputs/assumptions (crisp, minimal)
3) Steps/Policy (how to reason, what to check)
4) Constraints and acceptance criteria (must/should; edge cases)
5) Output format (exact structure; if JSON requested, specify keys and rules only)

Rules:
- No code fences or meta explanation.
- Prefer explicit, testable requirements over generalities.
- If constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.`;

export async function GET() {
  console.log('[api/system-prompts] GET request received');
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    // Try to initialize system prompts first to ensure they exist
    await initializeSystemPrompts();
    
    // Read prompts from settings
    let build = await readSystemPromptForMode('build');
    let enhance = await readSystemPromptForMode('enhance');
    
    // Ensure prompts are never empty
    if (!build || build.trim() === '') {
      console.log('[api/system-prompts] BUILD prompt is empty, using default');
      build = DEFAULT_BUILD_PROMPT;
      // Try to save the default
      try {
        await writeSystemPromptForMode('build', DEFAULT_BUILD_PROMPT);
      } catch (e) {
        console.error('[api/system-prompts] Failed to write default BUILD prompt:', e);
      }
    }
    
    if (!enhance || enhance.trim() === '') {
      console.log('[api/system-prompts] ENHANCE prompt is empty, using default');
      enhance = DEFAULT_ENHANCE_PROMPT;
      // Try to save the default
      try {
        await writeSystemPromptForMode('enhance', DEFAULT_ENHANCE_PROMPT);
      } catch (e) {
        console.error('[api/system-prompts] Failed to write default ENHANCE prompt:', e);
      }
    }
    
    console.log('[api/system-prompts] Returning prompts, build length:', build?.length || 0, 'enhance length:', enhance?.length || 0);
    return NextResponse.json({ build, enhance });
  } catch (error) {
    console.error('[api/system-prompts] Error in GET:', error);
    // If all else fails, return hardcoded defaults
    return NextResponse.json({ 
      build: DEFAULT_BUILD_PROMPT, 
      enhance: DEFAULT_ENHANCE_PROMPT,
      error: 'Using fallback prompts due to error'
    });
  }
}

export async function PUT(req: Request) {
  console.log('[api/system-prompts] PUT request received');
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await req.json().catch(() => ({}));
    
    console.log('[api/system-prompts] Updating prompts, build length:', body.build?.length || 0, 'enhance length:', body.enhance?.length || 0);
    
    if (typeof body.build === 'string') {
      if (body.build.trim() === '') {
        console.warn('[api/system-prompts] Attempted to save empty BUILD prompt, using default instead');
        await writeSystemPromptForMode('build', DEFAULT_BUILD_PROMPT);
      } else {
        await writeSystemPromptForMode('build', body.build);
      }
    }
    
    if (typeof body.enhance === 'string') {
      if (body.enhance.trim() === '') {
        console.warn('[api/system-prompts] Attempted to save empty ENHANCE prompt, using default instead');
        await writeSystemPromptForMode('enhance', DEFAULT_ENHANCE_PROMPT);
      } else {
        await writeSystemPromptForMode('enhance', body.enhance);
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/system-prompts] Error in PUT:', error);
    return NextResponse.json({ error: 'Failed to update system prompts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  console.log('[api/system-prompts] POST request received');
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  const session = await auth();
  if (!isElectron && !session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const body = await req.json().catch(() => ({}));
    
    if (body?.action === 'reset') {
      console.log('[api/system-prompts] Resetting to defaults');
      // First try to get defaults from file
      try {
        // Load defaults from the system-prompts-default.json file
        const defaults = await ensureSystemPromptsDefaultFile();
        await writeSystemPromptForMode('build', defaults.build);
        await writeSystemPromptForMode('enhance', defaults.enhance);
        return NextResponse.json({ 
          ok: true, 
          reset: true, 
          build: defaults.build, 
          enhance: defaults.enhance 
        });
      } catch (error) {
        console.error('[api/system-prompts] Error resetting to defaults from file:', error);
        // If that fails, use hardcoded defaults
        await writeSystemPromptForMode('build', DEFAULT_BUILD_PROMPT);
        await writeSystemPromptForMode('enhance', DEFAULT_ENHANCE_PROMPT);
        return NextResponse.json({ 
          ok: true, 
          reset: true, 
          build: DEFAULT_BUILD_PROMPT, 
          enhance: DEFAULT_ENHANCE_PROMPT,
          note: 'Using hardcoded defaults due to error'
        });
      }
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[api/system-prompts] Error in POST:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
