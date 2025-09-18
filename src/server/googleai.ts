// Types only - local Ollama only
import { buildStylePresetPhrase } from '@/server/image-style-presets';

export type PromptMode = "build" | "enhance";
export type TaskType = "general" | "coding" | "image" | "research" | "writing" | "marketing";

export interface GenerationOptions {
  tone?: "neutral" | "friendly" | "formal" | "technical" | "persuasive" | undefined;
  detail?: "brief" | "normal" | "detailed" | undefined;
  format?: "plain" | "markdown" | "json" | undefined;
  audience?: string | undefined;
  language?: string | undefined;
  styleGuidelines?: string | undefined;
  temperature?: number | undefined;
  // Type-specific
  stylePreset?: "photorealistic" | "illustration" | "3d" | "anime" | "watercolor" | undefined;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | undefined;
  includeTests?: boolean | undefined;
  requireCitations?: boolean | undefined;
}

export interface GoogleAIChatInput {
  input: string;
  mode: PromptMode;
  taskType: TaskType;
  options?: GenerationOptions;
}

// All functions removed - local Ollama only