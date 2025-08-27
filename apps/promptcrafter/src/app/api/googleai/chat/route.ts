import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { callGoogleAI, type PromptMode, type TaskType } from "@/server/googleai";
import { callLocalModel, readLocalModelConfig } from "@/server/local-model";
import { buildUnifiedPrompt } from "@/server/prompt-builder";

const BodySchema = z.object({
  input: z.string().min(1, "Prompt is required"),
  mode: z.enum(["build", "enhance"]).default("build"),
  taskType: z.enum(["general", "coding", "image", "research", "writing", "marketing"]).default("general"),
  options: z
    .object({
      tone: z.enum(["neutral", "friendly", "formal", "technical", "persuasive"]).optional(),
      detail: z.enum(["brief", "normal", "detailed"]).optional(),
      format: z.enum(["plain", "markdown", "json"]).optional(),
      audience: z.string().optional(),
      language: z.string().optional(),
      styleGuidelines: z.string().optional(),
      temperature: z.number().min(0).max(1).optional(),
      stylePreset: z.enum(["photorealistic", "illustration", "3d", "anime", "watercolor"]).optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional(),
      includeTests: z.boolean().optional(),
      requireCitations: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  if (!session?.user && !isElectron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    // No server-side greeting suppression; handled by model via NEED_CONTEXT sentinel rule.

    const streamRequested = !!parsed.options?.format && (req.headers.get('x-stream') === '1' || new URL(req.url).searchParams.get('stream') === '1');
    let output: string;
    if (isElectron && !streamRequested) {
      const modelCfg = await readLocalModelConfig();
      const full = await buildUnifiedPrompt({ input: parsed.input, mode: parsed.mode as PromptMode, taskType: parsed.taskType as TaskType, options: parsed.options });
      // If builder returned a rejection / guidance sentinel, surface directly (do NOT send to model)
      if (/^User input rejected:/i.test(full)) {
        output = full;
      } else if (modelCfg && (modelCfg.provider === 'ollama' || modelCfg.provider === 'openrouter-proxy')) {
        output = await callLocalModel(full);
      } else {
        // Fallback to remote API if no local/remote provider configured
        output = await callGoogleAI({
          input: parsed.input,
          mode: parsed.mode as PromptMode,
          taskType: parsed.taskType as TaskType,
          options: parsed.options,
        });
      }
    } else {
      output = await callGoogleAI({
        input: parsed.input,
        mode: parsed.mode as PromptMode,
        taskType: parsed.taskType as TaskType,
        options: parsed.options,
      });
    }
    return NextResponse.json({ output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
