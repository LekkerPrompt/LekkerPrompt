import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { callGemma, checkGemmaHealth, type PromptMode, type TaskType } from "@/server/gemma";

/**
 * SIMPLIFIED GEMMA 3B 1B API ENDPOINT
 * 
 * Clean, minimal implementation focused on small model efficiency
 */

const BodySchema = z.object({
  input: z.string().min(1, "Input is required"),
  mode: z.enum(["build", "enhance"]).default("build"),
  taskType: z.enum(["general", "coding", "image", "research", "writing", "marketing"]).default("general"),
  options: z.object({
    tone: z.enum(["neutral", "friendly", "formal", "technical", "persuasive"]).optional(),
    detail: z.enum(["brief", "normal", "detailed"]).optional(),
    format: z.enum(["plain", "markdown", "json"]).optional(),
    audience: z.string().optional(),
    language: z.string().optional(),
    temperature: z.number().min(0).max(1).optional(),
    // Task-specific options
    stylePreset: z.enum(["photorealistic", "illustration", "3d", "anime", "watercolor"]).optional(),
    aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3"]).optional(),
    includeTests: z.boolean().optional(),
    requireCitations: z.boolean().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  // Auth check (skip for Electron mode)
  const session = await auth();
  const isElectron = process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
  
  if (!session?.user && !isElectron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate request
  let parsed: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json({ 
      error: "Invalid request", 
      details: err instanceof Error ? err.message : "Validation failed" 
    }, { status: 400 });
  }

  // Process with Gemma 3B 1B optimized system
  try {
    const output = await callGemma({
      input: parsed.input,
      mode: parsed.mode as PromptMode,
      taskType: parsed.taskType as TaskType,
      ...(parsed.options && { options: parsed.options }),
    });

    return NextResponse.json({ 
      output,
      model: "gemma-3b",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('Gemma API error:', err);
    
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ 
      error: "Processing failed", 
      details: message 
    }, { status: 500 });
  }
}

/**
 * Health check endpoint
 */
export async function GET() {
  try {
    const health = await checkGemmaHealth();
    
    if (health.healthy) {
      return NextResponse.json({ 
        status: "healthy", 
        model: "gemma-3b",
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({ 
        status: "unhealthy", 
        error: health.error 
      }, { status: 503 });
    }
  } catch (err) {
    return NextResponse.json({ 
      status: "error", 
      error: err instanceof Error ? err.message : "Health check failed" 
    }, { status: 503 });
  }
}
