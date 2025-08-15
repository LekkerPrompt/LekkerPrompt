import { env } from "@/env";
import { readSystemPromptForModeFromDb } from "@/server/settings";

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
}

export interface GeminiChatInput {
  input: string;
  mode: PromptMode;
  taskType: TaskType;
  options?: GenerationOptions;
}

const TYPE_GUIDELINES: Record<TaskType, string> = {
  general: "",
  coding: [
    "When generating code:",
    "- Use clear structure and idiomatic patterns",
    "- Add brief comments only where non-obvious",
    "- If 'includeTests' is true, add minimal tests",
  ].join("\n"),
  image: [
    "You are producing prompt text for an image generation model.",
    "Be explicit about subject, style, lighting, composition, color, and camera details.",
    "Avoid copyrighted names; describe styles instead.",
  ].join("\n"),
  research: [
    "When producing research output:",
    "- Provide concise, sourced facts",
    "- If 'requireCitations' is true, include citations inline with links",
    "- Summarize key findings first",
  ].join("\n"),
  writing: [
    "For writing tasks, match the requested tone and audience.",
    "Provide structured sections and clear headings when helpful.",
  ].join("\n"),
  marketing: [
    "For marketing copy, focus on benefits, clarity, and a call to action.",
    "Keep messaging brand-appropriate and persuasive without exaggeration.",
  ].join("\n"),
};

const MODE_GUIDELINES: Record<PromptMode, string> = {
  build: [
    "Mode objective: Generate a complete, production-ready prompt based on the user's goals and filters.",
    "Respond only with the prompt (or the requested format). Do not include chitchat, preambles, or disclaimers.",
    "Incorporate the selected tone, level of detail, format, and language strictly.",
    "If some details are missing, make minimal, reasonable assumptions consistent with the task type.",
  ].join("\n"),
  enhance: [
    "Mode objective: Refine and improve the user's provided prompt while preserving intent.",
    "Strengthen clarity, structure, constraints, and evaluation criteria. Avoid changing core requirements.",
    "Respond only with the revised prompt (or the requested format). Do not add commentary unless explicitly requested.",
  ].join("\n"),
};

export async function callGemini({ input, mode, taskType, options }: GeminiChatInput): Promise<string> {
  const perModePrompt = await readSystemPromptForModeFromDb(mode);
  const envFallback =
    mode === "build"
      ? env.GOOGLE_GEMINI_SYSTEM_PROMPT_BUILD
      : env.GOOGLE_GEMINI_SYSTEM_PROMPT_ENHANCE;
  const systemPrompt = perModePrompt ?? envFallback ?? env.GOOGLE_GEMINI_SYSTEM_PROMPT ?? "";

  const optionLines: string[] = [];
  if (options?.tone) optionLines.push(`Tone: ${options.tone}`);
  if (options?.detail) optionLines.push(`Level of detail: ${options.detail}`);
  if (options?.format) optionLines.push(`Output format: ${options.format}`);
  if (options?.audience) optionLines.push(`Audience: ${options.audience}`);
  if (options?.language) optionLines.push(`Language: ${options.language}`);
  if (options?.styleGuidelines) optionLines.push(`Additional style guidelines:\n${options.styleGuidelines}`);
  if (taskType === "image") {
    if (options?.stylePreset) optionLines.push(`Image style preset: ${options.stylePreset}`);
    if (options?.aspectRatio) optionLines.push(`Aspect ratio: ${options.aspectRatio}`);
  }
  if (taskType === "coding" && options?.includeTests) optionLines.push("Include tests when appropriate.");
  if (taskType === "research" && options?.requireCitations) optionLines.push("Include citations with links where possible.");

  const typeGuidelines = TYPE_GUIDELINES[taskType];

  const combinedPrompt = [
    systemPrompt ? `System instructions:\n${systemPrompt}` : null,
    MODE_GUIDELINES[mode] ? `Mode guidelines:\n${MODE_GUIDELINES[mode]}` : null,
    `Mode: ${mode.toUpperCase()}`,
    `Task type: ${taskType}`,
    typeGuidelines ? `Type guidelines:\n${typeGuidelines}` : null,
    optionLines.length ? `Constraints:\n- ${optionLines.join("\n- ")}` : null,
    `User input:\n${input}`,
    options?.format === "json"
      ? [
          "Return only a single valid JSON object without markdown code fences.",
          "Do not include comments, trailing commas, or additional text before/after the JSON.",
        ].join(" \n")
      : options?.format === "markdown"
      ? [
          "Return the response strictly as Markdown.",
          "Use fenced code blocks for any code (e.g., ```json, ```markdown, ```bash).",
          "Do not wrap the entire response in a single code fence unless the whole output is code.",
          "Avoid preambles; provide only the content requested in Markdown.",
        ].join(" \n")
      : "Do not include preambles or explanations unless explicitly requested.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const url = `${env.GOOGLE_GEMINI_BASE_URL}?key=${encodeURIComponent(env.GOOGLE_GEMINI_API_KEY)}`;

  const payload: any = {
    contents: [
      {
        role: "user",
        parts: [{ text: combinedPrompt }],
      },
    ],
  };

  // Pass generation config for better control/consistency
  if (typeof options?.temperature === "number") {
    payload.generationConfig = {
      temperature: options.temperature,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${res.statusText} - ${text}`);
  }

  const data = await res.json();
  // Try to read common Gemini response shape
  const outputText: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
    ?? data?.output_text
    ?? data?.text;

  if (!outputText) {
    throw new Error("Unexpected Gemini response shape");
  }

  return outputText as string;
}


