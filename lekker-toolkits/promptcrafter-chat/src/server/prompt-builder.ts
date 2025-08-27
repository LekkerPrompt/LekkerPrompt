import { readSystemPromptForModeFromDb } from '@/server/settings';
import { env } from '@/env';
import type { PromptMode, TaskType, GenerationOptions } from '@/server/googleai';
import { buildStylePresetPhrase } from '@/server/image-style-presets';

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

const MODE_GUIDELINES: Record<PromptMode, string> = {
  build: [
    'You are PromptCrafter, an expert at authoring high performance prompts for AI models.',
    'Goal:',
    '- Create a single, standalone prompt delivering the user objective.',
    'Behavior:',
    '- Strictly obey any provided Mode, Task type, and Constraints.',
    '- Incorporate tone, detail level, audience, language, and formatting requirements.',
    '- Be precise, unambiguous, and concise; avoid filler and meta commentary.',
    'Structure the final prompt (no extra explanation):',
    '1) Instruction to the assistant (clear objective and role)',
    '2) Inputs to consider (summarize and normalize the user input)',
    '3) Steps/Policy (how to think, what to do, what to avoid)',
    '4) Constraints and acceptance criteria (must/should; edge cases)',
    '5) Output format (structure; if JSON is requested, specify keys and rules only)',
    'Rules:',
    '- Do not include code fences or rationale.',
    '- Prefer measurable criteria over vague language.',
    '- When constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.',
  ].join('\n'),
  enhance: [
    'You are PromptCrafter, an expert at improving existing prompts for clarity, reliability, and results.',
    'Goal:',
    '- Rewrite the user’s prompt to preserve intent while removing ambiguity and tightening scope.',
    'Behavior:',
    '- Strictly obey any provided Mode, Task type, and Constraints.',
    '- Improve structure, add missing constraints or acceptance criteria, and specify the desired output format.',
    '- Keep it concise and high‑signal; remove redundancy and vague wording.',
    'Produce only the improved prompt (no commentary), organized as:',
    '1) Instruction to the assistant (refined objective/role)',
    '2) Key inputs/assumptions (crisp, minimal)',
    '3) Steps/Policy (how to reason, what to check)',
    '4) Constraints and acceptance criteria (must/should; edge cases)',
    '5) Output format (exact structure; if JSON requested, specify keys and rules only)',
    'Rules:',
    '- No code fences or meta explanation.',
    '- Prefer explicit, testable requirements over generalities.',
    '- If constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.',
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
  // Basic input validation
  if (rawUserInput.length === 0) {
    return 'User input rejected: Empty input. Please provide a prompt description or content to work with.';
  }

  // Only reject obvious trivial greetings with no additional content
  const trivialGreeting = /^(hi|hey|hello|hola|yo|sup|howdy|test)\.?$|^(hi|hey|hello)\s+(there|everyone)\.?$/i.test(rawUserInput);
  if (trivialGreeting) {
    return 'User input rejected: Greeting detected. Please provide a substantive prompt objective or content to work with.';
  }

  // Improved injection detection - focus on high-confidence patterns
  const highConfidenceInjection = [
    // Direct instruction overrides
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all)\s+(above|before|previous)/i,
    /disregard\s+(all\s+)?(above|previous)\s+(instructions?|prompts?)/i,
    
    // Role manipulation attempts
    /you\s+are\s+(no\s+longer|now)\s+(a|an)\s+/i,
    /from\s+now\s+on\s+you\s+(will|are|should)/i,
    /act\s+as\s+(if\s+you\s+are\s+)?(a|an)\s+(different|new)\s+/i,
    
    // System override attempts
    /override\s+(system|default|previous)\s+(settings?|instructions?)/i,
    /reset\s+(your\s+)?(instructions?|parameters?|settings?)/i,
    
    // Known jailbreak terms (but allow legitimate use in context)
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

  const perModePrompt = await readSystemPromptForModeFromDb(mode);
  const envFallback = mode === 'build' ? env.GOOGLE_SYSTEM_PROMPT_BUILD : env.GOOGLE_SYSTEM_PROMPT_ENHANCE;
  const systemPrompt = perModePrompt ?? envFallback ?? env.GOOGLE_SYSTEM_PROMPT ?? '';

  const optionLines: string[] = [];
  if (options?.tone) optionLines.push(`Tone: ${options.tone}`);
  if (options?.detail) optionLines.push(`Level of detail: ${options.detail}`);
  if (options?.format) optionLines.push(`Output format: ${options.format}`);
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
  if (options?.tone) {
    const toneMap: Record<string, string> = {
      neutral: 'Tone semantics: objective, evenly weighted language; avoid emotive intensifiers.',
      friendly: 'Tone semantics: warm, approachable, positive—avoid slang; keep clarity first.',
      formal: 'Tone semantics: precise, professional register; avoid contractions; maintain impartial phrasing.',
      technical: 'Tone semantics: domain-specific vocabulary, unambiguous definitions, prioritize precision over flair.',
      persuasive: 'Tone semantics: benefit-led phrasing, confident active voice, avoid unsupported superlatives.'
    };
    const t = options.tone as keyof typeof toneMap;
    if (toneMap[t]) semanticExpansions.push(toneMap[t]);
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
    if (detailMap[d]) semanticExpansions.push(detailMap[d]);
  }
  if (options?.format === 'json') {
    semanticExpansions.push('Format semantics: output must be a single JSON object only—no prose, no fences. make the object structure clear and unambiguous.');
  } else if (options?.format === 'markdown') {
    semanticExpansions.push('Format semantics: Structure your response using proper Markdown formatting with clear hierarchy. Use headings (# ## ###), bullet points (-), numbered lists (1. 2. 3.), and other markdown elements to organize the content logically. Break content into sections with appropriate headings and use lists to present information clearly.');
  } else if (options?.format === 'plain') {
  semanticExpansions.push('Format semantics: plain text prompt body with headings or meta labels. Do NOT wrap in JSON or markdown image syntax. The prompt should still be structured properly, but in plain text that is not wrapped but directly in the chat.');
  }
  if (options?.language && options.language.toLowerCase() !== 'english') {
    semanticExpansions.push(`Language semantics: write entirely in ${options.language} (keep technical terms accurate).`);
  }
  if (taskType === 'image') {
    semanticExpansions.push('Image semantics: Structure content using clear headings and lists. Organize information logically without using code blocks or text wrappers.');
    if (options?.aspectRatio) semanticExpansions.push('Include aspect ratio specification (e.g., 16:9, 1:1, 9:16)');
    if (options?.detail === 'detailed') semanticExpansions.push('Provide comprehensive details with clear organization and hierarchy.');
    const shortImage = rawUserInput.split(/\s+/).length < 12;
    if (shortImage) {
      semanticExpansions.push('For brief requests, infer missing elements (environment, lighting, mood, style) and organize them clearly.');
      semanticExpansions.push('Provide structured output without asking follow-up questions.');
    }
  }
  if (taskType === 'coding' && options?.includeTests) semanticExpansions.push('Testing semantics: append concise test case specifications after main instruction (inputs + expected outputs).');
  if (taskType === 'research' && options?.requireCitations) semanticExpansions.push('Citation semantics: each factual claim requiring support followed immediately by [SourceName](URL).');
  const semanticsBlock = semanticExpansions.length ? `Option Semantics:\n- ${semanticExpansions.join('\n- ')}` : null;
  const formatFooter = options?.format === 'json'
    ? [
        'Return only a single valid JSON object without markdown fences.',
        'No comments or trailing commas.',
      ].join(' ')
    : options?.format === 'markdown'
    ? [
        'Structure your output using proper Markdown formatting:',
        '- Use headings (# ## ###) to organize sections',
        '- Use bullet points (-) or numbered lists (1. 2. 3.) for items',
        '- Use **bold** and *italic* for emphasis where appropriate',
        '- Break content into logical sections with clear hierarchy',
        '- Do NOT output as a single line - use proper markdown structure'
      ].join(' ')
  : 'Return only the final prompt text. No headings like "Instruction:" unless user input already contained them. Do not output JSON objects, code fences, or markdown image/link syntax unless the user explicitly asked for that format in the Format semantics.';

  return [
    systemPrompt ? `System Instructions:\n${systemPrompt}` : null,
    MODE_GUIDELINES[mode] ? `Mode Guidelines:\n${MODE_GUIDELINES[mode]}` : null,
    typeGuidelines ? `Task Type Guidelines:\n${typeGuidelines}` : null,
    optionLines.length ? `Constraints:\n- ${optionLines.join('\n- ')}` : null,
  semanticsBlock,
  `User Input Raw:\n${rawUserInput}`,
  'Output Contract:\n- For JSON format: Provide valid JSON without code fences.\n- For Markdown format: Use proper markdown structure with headings, lists, and formatting.\n- For Plain format: Provide clean text without markdown syntax.\n- Never ask clarifying questions, instead infer reasonable defaults.',
  'Failure Handling:\nIf you cannot comply due to insufficient detail, reply with exactly INPUT_INSUFFICIENT (no punctuation).',
  formatFooter,
  ].filter(Boolean).join('\n\n');
}
