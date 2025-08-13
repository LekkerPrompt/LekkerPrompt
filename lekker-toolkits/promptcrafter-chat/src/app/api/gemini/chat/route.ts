import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { callGemini, type PromptMode, type TaskType } from "@/server/gemini";

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
      // Type-specific
      stylePreset: z.enum(["photorealistic", "illustration", "3d", "anime", "watercolor"]).optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional(),
      includeTests: z.boolean().optional(),
      requireCitations: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
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
    const output = await callGemini({
      input: parsed.input,
      mode: parsed.mode as PromptMode,
      taskType: parsed.taskType as TaskType,
      options: parsed.options,
    });
    return NextResponse.json({ output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}


