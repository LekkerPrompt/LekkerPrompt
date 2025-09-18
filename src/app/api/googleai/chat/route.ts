import { NextResponse } from "next/server";
import { z } from "zod";


import { auth } from "@/server/auth";
import { type PromptMode, type TaskType } from "@/server/googleai";
import { callLocalModel, readLocalModelConfig } from "@/server/local-model";
import { buildUnifiedPrompt } from "@/server/prompt-builder";
import { sanitizeAndDetectDrift } from "@/server/output-sanitize";
import { withErrorHandler, createSuccessResponse, createErrorResponse, APIErrorHandler } from "@/server/api/error-handler";
import { PromptGenerationSchema, ValidationUtils } from "@/server/validation";
import { aiGenerationRateLimit, withRateLimit } from "@/server/middleware/rate-limit";

const BodySchema = PromptGenerationSchema;

const handleChatRequest = async (req: Request): Promise<NextResponse> => {
  const session = await auth(req);
  const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';

  if (!session?.user && !isElectron) {
    return createErrorResponse('UNAUTHORIZED');
  }

  const json = await req.json();

  // Additional security validation
  if (ValidationUtils.containsMaliciousContent(JSON.stringify(json))) {
    return createErrorResponse('INVALID_REQUEST', 'Request contains potentially malicious content');
  }

  const parsed = BodySchema.parse(json);

  // Validate temperature if provided
  if (parsed.options?.temperature !== undefined &&
      !ValidationUtils.validateTemperature(parsed.options.temperature)) {
    return createErrorResponse('VALIDATION_ERROR', 'Invalid temperature value');
  }

  try {
    // No server-side greeting suppression; handled by model via NEED_CONTEXT sentinel rule.

    const streamRequested = (req.headers.get('x-stream') === '1' || new URL(req.url).searchParams.get('stream') === '1');
    let output: string;
    // Local Ollama only
    const modelCfg = await readLocalModelConfig();
    if (!modelCfg || modelCfg.provider !== 'ollama') {
      throw new Error('No local Ollama model configured. Please install Ollama and configure a gemma3 model.');
    }
    
    const full = await buildUnifiedPrompt({ input: parsed.input, mode: parsed.mode as PromptMode, taskType: parsed.taskType as TaskType, ...(parsed.options && { options: parsed.options }) });
    
    // If builder returned a rejection / guidance sentinel, surface directly (do NOT send to model)
    if (/^User input rejected:/i.test(full)) {
      output = full;
    } else {
      const raw = await callLocalModel(full, { mode: parsed.mode as PromptMode, taskType: parsed.taskType as TaskType, ...(parsed.options && { options: parsed.options }) });
      output = sanitizeAndDetectDrift(parsed.taskType as TaskType, parsed.options, raw).cleaned || raw;
    }

    // Wrap output according to selected format (markdown/json) unless it's a sentinel guidance
    const fmt = parsed.options?.format ?? 'plain';
    const isSentinel = /^(User input rejected:|NEED_CONTEXT\s+–|INPUT_INSUFFICIENT)$/i.test(output.trim());
    if (!isSentinel) {
      if (fmt === 'markdown') {
        output = `\u0060\u0060\u0060markdown\n${output}\n\u0060\u0060\u0060`;
      } else if (fmt === 'json') {
        output = `\u0060\u0060\u0060json\n${output}\n\u0060\u0060\u0060`;
      }
    }
    return createSuccessResponse({ output });
  } catch (err) {
    if (err instanceof Error) {
      // Handle specific error types
      if (err.message.includes('timeout')) {
        throw APIErrorHandler.createError('EXTERNAL_TIMEOUT', 'AI service timeout', undefined, err);
      }
      if (err.message.includes('rate limit') || err.message.includes('quota')) {
        throw APIErrorHandler.createError('RATE_LIMITED', 'AI service rate limited', undefined, err);
      }
      if (err.message.includes('authentication') || err.message.includes('unauthorized')) {
        throw APIErrorHandler.createError('EXTERNAL_SERVICE_ERROR', 'AI service authentication failed', undefined, err);
      }
    }
    throw err; // Re-throw for the error handler to catch
  }
};

const POST = withRateLimit(aiGenerationRateLimit, withErrorHandler(handleChatRequest));

export { POST };
