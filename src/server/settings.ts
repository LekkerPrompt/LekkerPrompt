import { dataLayer } from "@/server/storage/data-layer";
import { ensureSystemPromptsDefaultFile } from "@/server/storage/system-prompts-init";

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
  const legacyPrompt = await readSystemPrompt();
  if (legacyPrompt) return legacyPrompt;
  
  // If no stored value, get from defaults file
  try {
    const defaults = await ensureSystemPromptsDefaultFile();
    return mode === "build" ? defaults.build : defaults.enhance;
  } catch (error) {
    console.error(`Failed to load default system prompt for ${mode} mode:`, error);
    return null;
  }
}

export async function writeSystemPrompt(prompt: string): Promise<void> {
  await dataLayer.upsertAppSetting(SYSTEM_PROMPT_KEY, prompt);
}

export async function writeSystemPromptForMode(mode: PromptMode, prompt: string): Promise<void> {
  const key = mode === "build" ? SYSTEM_PROMPT_BUILD_KEY : SYSTEM_PROMPT_ENHANCE_KEY;
  await dataLayer.upsertAppSetting(key, prompt);
}

// NOTE: Legacy DB-based helper names removed.


