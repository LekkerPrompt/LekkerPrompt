import { env } from "@/env";
import { buildGemmaContext, validateInput, getFallbackSystemPrompt } from "@/server/gemma-context";
import { readSystemPromptForModeFromDb } from "@/server/settings";
import type { PromptMode, TaskType, GenerationOptions, BuildPromptInput } from "@/server/gemma-context";

export type { PromptMode, TaskType, GenerationOptions };

export interface GemmaChatInput {
  input: string;
  mode: PromptMode;
  taskType: TaskType;
  options?: GenerationOptions;
}

/**
 * GEMMA 3 MODEL INTERFACE
 * 
 * Simplified architecture:
 * 1. Validate input
 * 2. Build minimal context 
 * 3. Call model with optimized settings
 * 4. Return clean output
 */
export async function callGemma({ input, mode, taskType, options }: GemmaChatInput): Promise<string> {
  // Step 1: Input validation
  const validation = validateInput(input, taskType);
  if (!validation.valid) {
    return `Error: ${validation.error}. Please provide a clearer input.`;
  }

  // Step 2: Build minimal context
  const context = await buildGemmaContext({ input, mode, taskType, options });
  
  // Handle validation errors from context building
  if (context.startsWith('ERROR:')) {
    return context;
  }

  // Step 3: Get system prompt (fallback if empty)
  const systemPrompt = await getSystemPrompt(mode);

  // Step 4: Call model with optimized settings
  try {
    const response = await callGemmaModel(context, systemPrompt, options);
    return cleanModelOutput(response);
  } catch (error) {
    return `Model error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get system prompt with graceful fallback
 */
async function getSystemPrompt(mode: PromptMode): Promise<string> {
  try {
    const dbPrompt = await readSystemPromptForModeFromDb(mode);
    if (dbPrompt && dbPrompt.trim()) {
      return dbPrompt.trim();
    }
  } catch (error) {
    console.warn('Failed to read system prompt from DB:', error);
  }

  // Fallback to environment or built-in
  const envKey = mode === 'build' ? 'GOOGLE_SYSTEM_PROMPT_BUILD' : 'GOOGLE_SYSTEM_PROMPT_ENHANCE';
  const envPrompt = mode === 'build' ? env.GOOGLE_SYSTEM_PROMPT_BUILD : env.GOOGLE_SYSTEM_PROMPT_ENHANCE;
  
  return envPrompt || env.GOOGLE_SYSTEM_PROMPT || getFallbackSystemPrompt(mode);
}

/**
 * Optimized model call for Gemma 3B 1B
 */
async function callGemmaModel(context: string, systemPrompt: string, options?: GenerationOptions): Promise<string> {
  const base = env.GOOGLE_BASE_URL || '';
  const key = env.GOOGLE_API_KEY || '';
  
  if (!base || !key) {
    throw new Error('Missing Google API configuration');
  }

  const url = `${base}?key=${encodeURIComponent(key)}`;

  // Optimized payload for Gemma 3B 1B
  const payload: any = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n${context}` }]
      }
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: 1024, // Reasonable limit for small model
      topP: 0.9,
      topK: 40
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "User-Agent": "Gemma-Context-System/1.0"
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  
  // Extract response text with error handling
  const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!outputText) {
    throw new Error('No response text from model');
  }

  return outputText;
}

/**
 * Minimal output cleaning - only remove obvious artifacts
 */
function cleanModelOutput(rawOutput: string): string {
  let cleaned = rawOutput.trim();
  
  // Remove only obvious model artifacts that aren't legitimate content
  cleaned = cleaned.replace(/^(Here's|Here is|Output:)\s*/i, '');
  
  return cleaned;
}

/**
 * Health check for the model connection
 */
export async function checkGemmaHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const testResponse = await callGemma({
      input: "test",
      mode: "build",
      taskType: "general",
      options: { format: "plain" }
    });
    
    if (testResponse.startsWith('Error:') || testResponse.startsWith('Model error:')) {
      return { healthy: false, error: testResponse };
    }
    
    return { healthy: true };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
