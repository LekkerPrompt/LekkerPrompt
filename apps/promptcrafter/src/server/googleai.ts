import { env } from "@/env";
import { buildUnifiedPrompt } from "@/server/prompt-builder";
import { callGoogleProxy } from '@/server/google-proxy-client';
import { sanitizeAndDetectDrift } from '@/server/output-sanitize';
import { buildStylePresetPhrase } from '@/server/image-style-presets';

export type PromptMode = "build" | "enhance";
export type TaskType = "general" | "coding" | "image" | "research" | "writing" | "marketing";

export interface GenerationOptions {
  tone?: "neutral" | "friendly" | "formal" | "technical" | "persuasive";
  detail?: "brief" | "normal" | "detailed";
  format?: "plain" | "markdown" | "json";
  audience?: string;
  language?: string;
  styleGuidelines?: string;
  temperature?: number;
  // Type-specific
  stylePreset?: "photorealistic" | "illustration" | "3d" | "anime" | "watercolor";
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3";
  includeTests?: boolean;
  requireCitations?: boolean;
  /** When true, bypass deterministic builders and always call the model (still subject to guardrails) */
  forceModel?: boolean;
}

export interface GoogleAIChatInput {
  input: string;
  mode: PromptMode;
  taskType: TaskType;
  options?: GenerationOptions;
}

export async function callGoogleAI({ input, mode, taskType, options }: GoogleAIChatInput): Promise<string> {
  const basePrompt = await buildUnifiedPrompt({ input, mode, taskType, options });
  
  // If buildUnifiedPrompt returned a rejection/guidance sentinel, surface directly without model call
  if (/^User input (rejected|too vague)/i.test(basePrompt)) {
    return basePrompt;
  }
  
  // If running without a bundled API key but proxy configured, delegate to proxy.
  if (!env.GOOGLE_API_KEY && env.GOOGLE_PROXY_URL) {
    return await callGoogleProxy({ input, mode, taskType, options });
  }

  const output = await attemptModelCall(basePrompt, options);
  
  if (output === 'INPUT_INSUFFICIENT') {
    return buildFallbackGuidance(input, taskType, options);
  }
  
  if (!output.trim()) {
    return buildFallbackGuidance(input, taskType, options, 'Empty output received');
  }
  
  return output;
}

async function attemptModelCall(combinedPrompt: string, options?: GenerationOptions): Promise<string> {
  // Attempt to split out a leading System Instructions: block into a system message
  let systemPart: string | null = null;
  let userPart = combinedPrompt;
  const sysMatch = /^System Instructions:\n([\s\S]*?)(?=\n\n[A-Z][^:]+:\n|$)/.exec(combinedPrompt);
  if (sysMatch && typeof sysMatch[1] === 'string') {
    systemPart = sysMatch[1].trim();
    userPart = combinedPrompt.replace(/^System Instructions:\n[\s\S]*?(?=\n\n[A-Z][^:]+:\n|$)/, '').trim();
  }

  const base = env.GOOGLE_BASE_URL || '';
  const key = env.GOOGLE_API_KEY || '';
  if (!base) {
    // Avoid making a relative fetch like '?key=' which would return HTML and cause parse errors.
    return 'Google AI endpoint not configured. Set GOOGLE_BASE_URL (and optionally GOOGLE_API_KEY) or configure a local / proxy model.';
  }
  const url = `${base}?key=${encodeURIComponent(key)}`;

  const payload: any = {
    contents: [
      ...(systemPart ? [{ role: 'user', parts: [{ text: `SYSTEM:\n${systemPart}` }] }] : []),
      { role: "user", parts: [{ text: userPart }] },
    ],
  };

  if (typeof options?.temperature === "number") {
    payload.generationConfig = { temperature: options.temperature };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GoogleAI API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  const outputText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    ?? data?.output_text
    ?? data?.text;

  if (!outputText) {
    throw new Error("Unexpected GoogleAI response shape");
  }

  // Light sanitization - only essential cleanup
  const { cleaned } = sanitizeAndDetectDrift('general', options, outputText);

  // Return model's response with minimal processing
  return cleaned || outputText;
}

function buildFallbackGuidance(original: string, taskType: TaskType, options?: GenerationOptions, reason?: string): string {
  return `Input not actionable. Please provide more specific details about what you want to create or enhance.${reason ? ` (${reason})` : ''}`;
}

