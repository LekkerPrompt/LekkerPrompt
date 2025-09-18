import { readSystemPromptForMode } from '@/server/settings';
import { env } from '@/env';
import type { PromptMode, TaskType, GenerationOptions } from '@/server/googleai';
import { buildStylePresetPhrase } from '@/server/image-style-presets';
import { dataLayer } from '@/server/storage/data-layer';

const TYPE_GUIDELINES: Record<TaskType, string> = {
  general: '',
  coding: [
    'Code prompt goals: clarity, correctness, minimal necessary context.',
    '- Specify language, libraries, target environment, and I/O shape when implied or missing.',
    '- Avoid over-specifying internal implementation unless required.',
    "- If tests requested, outline test cases after instructions as a separate section.",
  ].join('\n'),
  image: [
    'Image prompt goals: produce a well-structured, high-signal text prompt for an image generation model.',
    '- Explicitly cover: primary subject(s), secondary elements, style modifiers, lighting, mood, composition, camera / lens (if photographic), color palette, detail level.',
    '- No meta commentary about what you are doing. Do not output instructions like "Instruction:"— output only the usable prompt unless a structured format was explicitly requested.',
  '- Never ask the user clarifying questions; infer reasonable defaults and output a finished prompt.',
  ].join('\n'),
  research: [
    'Research prompt goals: factual precision, sourcing, synthesis.',
    '- Encourage model to verify claims and note uncertainty.',
    "- If citations requested, specify inline bracket style with source name + URL. APA style is default for citations.",
  ].join('\n'),
  writing: [
    'Writing prompt goals: audience alignment, tone fidelity, structure.',
    '- Provide explicit sections or formatting expectations.',
  ].join('\n'),
  marketing: [
    'Marketing prompt goals: benefit-led, audience-relevant, compliant.',
    '- Include target persona, product differentiators, CTA style, required channels.',
  ].join('\n'),
};

// Smart context detection function
function detectUserIntent(input: string, mode: PromptMode, taskType: TaskType, options?: GenerationOptions): {
  isDirectTechnicalQuestion: boolean;
  isPromptCreation: boolean;
  isPromptEnhancement: boolean;
  responseStrategy: 'direct_help' | 'structured_prompt' | 'enhanced_prompt';
} {
  const trimmed = input.trim();

  // Check for direct technical/implementation questions
  const technicalKeywords = /\b(make|change|fix|update|improve|modify|add|implement|create|build)\b.*\b(chat|ui|interface|width|sidebar|bubble|responsive|css|style|layout|component|code|javascript|react|tailwind|html|function|class)\b/i;
  const howToPatterns = /\b(how\s+to|can\s+you|help\s+me)\b.*\b(code|implement|add|create|fix|make|change)\b/i;
  const technicalTerms = /\b(css|javascript|react|tailwind|html|typescript|component|function|class|api|database|query)\b/i;

  const hasTechnicalIntent = technicalKeywords.test(trimmed) ||
                            howToPatterns.test(trimmed) ||
                            technicalTerms.test(trimmed);

  // Check if user is providing actual prompt text to enhance
  const looksLikeExistingPrompt = /1?\)\s*(Instruction|Key inputs|Steps|Policy|Constraints|Output)/i.test(trimmed) ||
                                  /^["""]/.test(trimmed) ||
                                  /\b(prompt|instruction|assistant|ai|model|system)\b.*:/i.test(trimmed) ||
                                  trimmed.split('\n').length > 3 && /\b(you are|your role|you should|you must)\b/i.test(trimmed);

  // Determine response strategy
  if (hasTechnicalIntent && (taskType === 'coding' || taskType === 'general')) {
    return {
      isDirectTechnicalQuestion: true,
      isPromptCreation: false,
      isPromptEnhancement: false,
      responseStrategy: 'direct_help'
    };
  } else if (mode === 'enhance' && looksLikeExistingPrompt) {
    return {
      isDirectTechnicalQuestion: false,
      isPromptCreation: false,
      isPromptEnhancement: true,
      responseStrategy: 'enhanced_prompt'
    };
  } else if (mode === 'build') {
    return {
      isDirectTechnicalQuestion: false,
      isPromptCreation: true,
      isPromptEnhancement: false,
      responseStrategy: 'structured_prompt'
    };
  } else {
    // Default fallback
    return {
      isDirectTechnicalQuestion: false,
      isPromptCreation: true,
      isPromptEnhancement: false,
      responseStrategy: 'structured_prompt'
    };
  }
}

const MODE_GUIDELINES: Record<PromptMode, string> = {
  build: [
    'You are PromptCrafter, an expert at authoring high performance prompts for AI models.',
    'Goal:',
    '- Create a single, standalone prompt delivering the user objective.',
    'Behavior:',
    '- Strictly obey any provided Mode, Task type, and Constraints.',
    '- Incorporate tone, detail level, audience, language, and response formatting requirements.',
    '- Be precise, unambiguous, and concise; avoid filler and meta commentary.',
    'IMPORTANT: Adapt your response based on user intent:',
    '- For DIRECT TECHNICAL QUESTIONS (like "how to make chat wider" or "fix this CSS"), provide immediate, actionable code solutions and explanations.',
    '- For PROMPT CREATION requests, use the structured format below.',
    '- Never force structured format when user wants direct technical help.',
    'Rule: If the user input is ONLY a casual greeting / acknowledgement (e.g. hi, hey, hello, thanks, thank you, ok, cool, great) and contains no actionable objective or domain noun, reply EXACTLY: NEED_CONTEXT – Please describe what you want me to create or enhance.',
    'When creating prompts, structure as (no extra explanation):',
    '1) Instruction to the assistant (clear objective and role)',
    '2) Inputs to consider (summarize and normalize the user input)',
    '3) Steps/Policy (how to think, what to do, what to avoid)',
    '4) Constraints and acceptance criteria (must/should; edge cases)',
    'Rules:',
    '- Do not include code fences or rationale.',
    '- Prefer measurable criteria over vague language.',
    '- When constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.',
    '- FORMAT RULE: If JSON format is requested, specify keys and rules WITHIN the constraints section above, NOT as a separate section.',
    '- FORMAT RULE: Do NOT add any "Response structure" or "Output format" sections to the prompt you create.',
  ].join('\n'),
  enhance: [
    'You are PromptCrafter, an expert at improving existing prompts for clarity, reliability, and results.',
    'Goal:',
    '- Rewrite the user\'s prompt to preserve intent while removing ambiguity and tightening scope.',
    'Behavior:',
    '- Strictly obey any provided Mode, Task type, and Constraints.',
    '- Improve structure, add missing constraints or acceptance criteria, and integrate response formatting requirements directly.',
    '- Keep it concise and high‑signal; remove redundancy and vague wording.',
    'IMPORTANT: Adapt your response based on user intent:',
    '- If user provides EXISTING PROMPT TEXT, enhance it using structured format below.',
    '- For DIRECT TECHNICAL QUESTIONS (like "make chat wider" or "fix CSS"), provide immediate code solutions, not prompt structure.',
    '- Only use structured format when enhancing actual prompts.',
    'Rule: If the user input is ONLY a casual greeting / acknowledgement (e.g. hi, hey, hello, thanks, thank you, ok, cool, great) and contains no actionable objective or domain noun, reply EXACTLY: NEED_CONTEXT – Please describe what you want me to create or enhance.',
    'When enhancing existing prompts, produce only the improved prompt (no commentary), organized as:',
    '1) Instruction to the assistant (refined objective/role)',
    '2) Key inputs/assumptions (crisp, minimal)',
    '3) Steps/Policy (how to reason, what to check)',
    '4) Constraints and acceptance criteria (must/should; edge cases)',
    'Rules:',
    '- No code fences or meta explanation.',
    '- Prefer explicit, testable requirements over generalities.',
    '- If constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.',
    '- FORMAT RULE: If JSON format is requested, specify keys and rules WITHIN the constraints section above, NOT as a separate section.',
    '- FORMAT RULE: Do NOT add any "Response structure" or "Output format" sections to the prompt you create.',
  ].join('\n'),
};

export interface BuildPromptInput {
  input: string;
  mode: PromptMode;
  taskType: TaskType;
  options?: GenerationOptions;
}

export async function buildUnifiedPrompt({ input, mode, taskType, options }: BuildPromptInput): Promise<string> {
  const rawUserInput = input.trim();
  const validationError = validateBuilderInput(rawUserInput, taskType);
  if (validationError) return validationError;

  // Smart context detection to determine response strategy
  const userIntent = detectUserIntent(rawUserInput, mode, taskType, options);

  // Get the system prompt, which will now come from either the app settings or system-prompts-default.json
  const systemPrompt = await readSystemPromptForMode(mode) ?? '';

  const optionLines: string[] = [];
  if (options?.tone) optionLines.push(`Tone: ${options.tone}`);
  if (options?.detail) optionLines.push(`Level of detail: ${options.detail}`);
  if (options?.audience) optionLines.push(`Audience: ${options.audience}`);
  if (options?.language) optionLines.push(`Language: ${options.language}`);
  if (options?.styleGuidelines) optionLines.push(`Additional style guidelines:\n${options.styleGuidelines}`);
  if (taskType === 'image') {
    if (options?.stylePreset) {
      optionLines.push(`Image style preset: ${options.stylePreset}`);
      optionLines.push(`Style descriptor: ${buildStylePresetPhrase(options.stylePreset)}`);
    }
    if (options?.aspectRatio) optionLines.push(`Aspect ratio: ${options.aspectRatio}`);
  }
  if (taskType === 'coding' && options?.includeTests) optionLines.push('Include tests when appropriate.');
  if (taskType === 'research' && options?.requireCitations) optionLines.push('Include citations with links where possible.');

  const typeGuidelines = TYPE_GUIDELINES[taskType];
  // Semantic expansions to help model internalize each selected option beyond a simple label
  const semanticExpansions: string[] = [];

  // Add context-aware guidance based on detected user intent
  if (userIntent.responseStrategy === 'direct_help') {
    semanticExpansions.push(`CRITICAL: User wants DIRECT TECHNICAL HELP, not prompt creation. Provide immediate, actionable solutions for their specific question about ${taskType === 'coding' ? 'code/UI implementation' : 'their query'}.`);

    if (options?.detail === 'brief') {
      semanticExpansions.push('Response style: Keep it concise and actionable - focus on the specific solution they need.');
    } else if (options?.detail === 'detailed') {
      semanticExpansions.push('Response style: Provide comprehensive explanation with step-by-step implementation details.');
    }

    if (options?.tone === 'technical') {
      semanticExpansions.push('Communication style: Use precise technical terminology appropriate for developers.');
    } else if (options?.tone === 'friendly') {
      semanticExpansions.push('Communication style: Be approachable and encouraging while remaining technically accurate.');
    }

  } else if (userIntent.responseStrategy === 'structured_prompt') {
    // Standard prompt creation guidance
    if (options?.tone) {
      const toneMap: Record<string, string> = {
        neutral: 'Tone semantics: objective, evenly weighted language; avoid emotive intensifiers.',
        friendly: 'Tone semantics: warm, approachable, positive—avoid slang; keep clarity first.',
        formal: 'Tone semantics: precise, professional register; avoid contractions; maintain impartial phrasing.',
        technical: 'Tone semantics: domain-specific vocabulary, unambiguous definitions, prioritize precision over flair.',
        persuasive: 'Tone semantics: benefit-led phrasing, confident active voice, avoid unsupported superlatives.'
      };
      const t = options.tone as keyof typeof toneMap;
      if (toneMap[t]) semanticExpansions.push(toneMap[t] as string);
    }

    if (options?.detail) {
      const detailMap: Record<string, string> = {
        brief: 'Detail level: minimal—only essential attributes; omit auxiliary qualifiers.',
        normal: 'Detail level: balanced—cover core facets without exhaustive micro-attributes.',
        detailed: taskType === 'image'
          ? 'Detail level: rich—include 18–32 distinct, non-redundant descriptive fragments capturing subject focus, environment, perspective, composition, lighting qualities (key + fill or ambient), mood, color palette strategy, texture/material adjectives, style modifiers, rendering / post-processing hints, plus aspect ratio token once.'
          : 'Detail level: rich—enumerate scope, roles, step logic, edge cases, acceptance criteria, and quality bars explicitly.'
      };
      const d = options.detail as keyof typeof detailMap;
      if (detailMap[d]) semanticExpansions.push(detailMap[d] as string);
    }
  }

  // Format guidance - adapt based on intent
  if (options?.format) {
    if (userIntent.responseStrategy === 'direct_help') {
      // For direct help, format should match user expectation
      if (options.format === 'markdown') {
        semanticExpansions.push('Format: Use markdown for code examples and clear structure, but keep explanations natural and readable.');
      } else if (options.format === 'json') {
        semanticExpansions.push('Format: If providing structured data, use JSON format. Otherwise, provide natural text explanations.');
      } else {
        semanticExpansions.push('Format: Provide natural, readable text explanations with inline code examples.');
      }
    } else {
      // Standard format guidance for prompt creation
      if (options.format === 'json') {
        semanticExpansions.push('Response formatting: Output ONLY a single JSON object. No prose before/after, no markdown fences, no alternatives.');
      } else if (options.format === 'markdown') {
        semanticExpansions.push('Response formatting: Output ONLY Markdown. Use proper headings and lists. Do NOT include extra sections labeled as other formats; provide exactly one representation.');
      } else if (options.format === 'plain') {
        semanticExpansions.push('Response formatting: Output ONLY plain text (no markdown fences, no JSON, no image/link markdown). Provide exactly one representation.');
      }
    }
  }

  // Task-specific guidance
  if (taskType === 'coding' && userIntent.responseStrategy === 'direct_help') {
    semanticExpansions.push('Coding guidance: Provide specific, working code examples. Include imports, error handling, and best practices.');
    if (options?.includeTests) semanticExpansions.push('Testing: Include relevant test examples and testing patterns.');
  } else if (taskType === 'image') {
    semanticExpansions.push('Image semantics: Structure content using clear headings and lists. Organize information logically without using code blocks or text wrappers.');
    if (options?.aspectRatio) semanticExpansions.push('Include aspect ratio specification (e.g., 16:9, 1:1, 9:16)');
    if (options?.detail === 'detailed') semanticExpansions.push('Provide comprehensive details with clear organization and hierarchy.');
  } else if (taskType === 'research' && options?.requireCitations) {
    semanticExpansions.push('Citation semantics: each factual claim requiring support followed immediately by [SourceName](URL).');
  }

  if (options?.language && options.language.toLowerCase() !== 'english') {
    semanticExpansions.push(`Language semantics: write entirely in ${options.language} (keep technical terms accurate).`);
  }
  const semanticsBlock = semanticExpansions.length ? `Option Semantics:\n- ${semanticExpansions.join('\n- ')}` : null;

  // ALWAYS apply RAG context (universal across local + API models)
  let ragContextBlock: string | null = null;
  try {
    const rag = await dataLayer.getRagContext(rawUserInput, { similarLimit: 5, personalizationLimit: 5 });
    const personalized = rag.personalized;
    const similar = rag.similar;

    if (personalized.length || similar.length) {
      const lines: string[] = [];
      if (personalized.length) {
        lines.push('Personalization Signals (derived ONLY from explicitly liked/disliked past responses; neutral messages excluded):');
        personalized.slice(0, 5).forEach(p => {
          const tag = p.feedback === 'like' ? 'LIKE' : 'DISLIKE';
          // trim content for brevity
          const truncated = p.content.length > 180 ? p.content.slice(0, 177) + '...' : p.content;
          lines.push(`- (${tag}) [Relevance ${(p.score * 100).toFixed(1)}%] ${truncated}`);
        });
      }
      if (similar.length) {
        lines.push('Contextually Similar Messages (may include neutral messages; DO NOT learn preferences from neutral, use only for factual/contextual grounding):');
        similar.slice(0, 5).forEach(s => {
          const fb = s.feedback ? (s.feedback === 'like' ? 'LIKE' : 'DISLIKE') : 'NEUTRAL';
          const truncated = s.content.length > 160 ? s.content.slice(0, 157) + '...' : s.content;
          lines.push(`- (${fb}) ${truncated}`);
        });
      }
      lines.push('Usage Rules: Incorporate stylistic / preference cues ONLY from items tagged LIKE or DISLIKE (treat DISLIKE as negative preference to avoid). Never assume preference from NEUTRAL.');
      ragContextBlock = `RAG Context (Universal):\n${lines.join('\n')}`;
    }
  } catch (e) {
    ragContextBlock = null; // Fail silent – do not block prompt creation
  }


  return [
    systemPrompt ? `System Instructions:\n${systemPrompt}` : null,
    MODE_GUIDELINES[mode] ? `Mode Guidelines:\n${MODE_GUIDELINES[mode]}` : null,
    typeGuidelines ? `Task Type Guidelines:\n${typeGuidelines}` : null,
    optionLines.length ? `Constraints:\n- ${optionLines.join('\n- ')}` : null,
    ragContextBlock,
  semanticsBlock,
  `User Input Raw:\n${rawUserInput}`,
  'Hard Rule: Produce exactly ONE output in the selected format. Do NOT include multiple versions or format-labeled sections. Never ask clarifying questions; infer reasonable defaults.',
  'Failure Handling:\nIf you cannot comply due to insufficient detail, reply with exactly INPUT_INSUFFICIENT (no punctuation).',
  ].filter(Boolean).join('\n\n');
}

// Centralized builder input validation. Returns an error string if invalid, otherwise null.
export function validateBuilderInput(rawUserInput: string, taskType: TaskType): string | null {
  // Basic input validation
  if (rawUserInput.length === 0) {
    return 'User input rejected: Empty input. Please provide a prompt description or content to work with.';
  }

  // NOTE: Small talk / greeting inputs are now permitted; previous trivial greeting filtering removed per user request.

  // Improved injection detection - focus on high-confidence patterns
  const highConfidenceInjection = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all)\s+(above|before|previous)/i,
    /disregard\s+(all\s+)?(above|previous)\s+(instructions?|prompts?)/i,
    /you\s+are\s+(no\s+longer|now)\s+(a|an)\s+/i,
    /from\s+now\s+on\s+you\s+(will|are|should)/i,
    /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+(different|new)\s+/i,
    /override\s+(system|default|previous)\s+(settings?|instructions?)/i,
    /reset\s+(your\s+)?(instructions?|parameters?|settings?)/i,
    /\b(jailbreak|DAN\s*v?\d*)\b(?!\s+(method|technique|prevention|detection))/i,
    /developer\s+mode(?!\s+(discussion|prevention|security))/i,
  ].some(pattern => pattern.test(rawUserInput));

  if (highConfidenceInjection) {
    return 'User input rejected: Potential prompt injection detected. Please focus on describing the prompt content you want created or enhanced.';
  }

  // Smarter misuse detection - use multiple signals
  const signals = {
    isSimpleQuestion: /^(what|who|when|where|why|how)\s+/i.test(rawUserInput),
    hasPromptIntent: /(prompt|write|create|generate|build|make|design|craft|develop|compose|draft)\b/i.test(rawUserInput),
    hasCreativeIntent: /(story|image|picture|poem|article|essay|letter|email|code|script|marketing|ad|description)\b/i.test(rawUserInput),
    isConversational: /^(can\s+you|could\s+you|would\s+you|please|thanks?|thank\s+you)/i.test(rawUserInput),
    wordCount: rawUserInput.split(/\s+/).filter(Boolean).length,
    hasRichContent: rawUserInput.split(/[,;.]/).length > 2 || /\b(about|for|with|featuring|including|containing)\b/i.test(rawUserInput)
  };

  // Only reject if multiple negative signals align
  const likelyMisuse = signals.wordCount < 3 || (
    signals.isSimpleQuestion && 
    !signals.hasPromptIntent && 
    !signals.hasCreativeIntent && 
    signals.wordCount < 8 &&
    !signals.hasRichContent
  );

  if (likelyMisuse) {
    return 'User input rejected: Input appears too brief or conversational. Please describe what kind of prompt you want created or provide content to enhance.';
  }

  return null;
}
