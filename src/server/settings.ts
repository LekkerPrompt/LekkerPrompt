import { dataLayer } from "@/server/storage/data-layer";

const SYSTEM_PROMPT_KEY = "SYSTEM_PROMPT" as const;
const SYSTEM_PROMPT_BUILD_KEY = "SYSTEM_PROMPT_BUILD" as const;
const SYSTEM_PROMPT_ENHANCE_KEY = "SYSTEM_PROMPT_ENHANCE" as const;

export type PromptMode = "build" | "enhance";

export async function readSystemPrompt(): Promise<string | null> {
  const setting = await dataLayer.findAppSetting(SYSTEM_PROMPT_KEY);
  return setting?.value ?? null;
}

export async function readSystemPromptForMode(mode: PromptMode): Promise<string | null> {
  const key = mode === "build" ? SYSTEM_PROMPT_BUILD_KEY : SYSTEM_PROMPT_ENHANCE_KEY;
  const setting = await dataLayer.findAppSetting(key);
  if (setting?.value) return setting.value;
  // Fallback to legacy single prompt if per-mode not found
  return await readSystemPrompt();
}

export async function writeSystemPrompt(prompt: string): Promise<void> {
  await dataLayer.upsertAppSetting(SYSTEM_PROMPT_KEY, prompt);
}

export async function writeSystemPromptForMode(mode: PromptMode, prompt: string): Promise<void> {
  const key = mode === "build" ? SYSTEM_PROMPT_BUILD_KEY : SYSTEM_PROMPT_ENHANCE_KEY;
  await dataLayer.upsertAppSetting(key, prompt);
}

// NOTE: Legacy DB-based helper names removed.


