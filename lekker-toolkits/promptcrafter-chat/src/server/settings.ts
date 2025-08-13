import { db } from "@/server/db";

const SYSTEM_PROMPT_KEY = "SYSTEM_PROMPT" as const;
const SYSTEM_PROMPT_BUILD_KEY = "SYSTEM_PROMPT_BUILD" as const;
const SYSTEM_PROMPT_ENHANCE_KEY = "SYSTEM_PROMPT_ENHANCE" as const;

export type PromptMode = "build" | "enhance";

export async function readSystemPromptFromDb(): Promise<string | null> {
  const setting = await db.appSetting.findUnique({ where: { key: SYSTEM_PROMPT_KEY } });
  return setting?.value ?? null;
}

export async function readSystemPromptForModeFromDb(mode: PromptMode): Promise<string | null> {
  const key = mode === "build" ? SYSTEM_PROMPT_BUILD_KEY : SYSTEM_PROMPT_ENHANCE_KEY;
  const setting = await db.appSetting.findUnique({ where: { key } });
  if (setting?.value) return setting.value;
  // Fallback to legacy single prompt if per-mode not found
  return await readSystemPromptFromDb();
}

export async function writeSystemPromptToDb(prompt: string): Promise<void> {
  await db.appSetting.upsert({
    where: { key: SYSTEM_PROMPT_KEY },
    create: { key: SYSTEM_PROMPT_KEY, value: prompt },
    update: { value: prompt },
  });
}

export async function writeSystemPromptForModeToDb(mode: PromptMode, prompt: string): Promise<void> {
  const key = mode === "build" ? SYSTEM_PROMPT_BUILD_KEY : SYSTEM_PROMPT_ENHANCE_KEY;
  await db.appSetting.upsert({
    where: { key },
    create: { key, value: prompt },
    update: { value: prompt },
  });
}


