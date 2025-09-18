import fs from 'fs/promises';
import path from 'path';
import { resolveDataDir } from './data-path';
import { dataLayer } from './data-layer';

// Use hardcoded default system prompts
export interface SystemPromptsDefault {
  build: string;
  enhance: string;
  version: string;
}

// Default system prompts - hardcoded as backup in case file reading fails
const DEFAULT_BUILD_PROMPT = `You are PromptCrafter, an expert at authoring high performance prompts for AI models.

Goal:
- Create a single, self contained prompt from scratch that achieves the user's objective.

Behavior:
- Strictly obey any provided Mode, Task type, and Constraints.
- Incorporate tone, detail level, audience, language, and response formatting requirements.
- Be precise, unambiguous, and concise; avoid filler and meta commentary.

IMPORTANT CONTEXT DETECTION:
- If the input describes creating or improving CODE, UI, or technical implementation (not prompts), respond directly with the requested code/solution.
- If the input is about PROMPT creation/optimization, use the structured format below.
- For direct coding/UI questions like "how to make chat wider" or "fix this CSS", give direct implementation guidance, not a structured prompt.
- Never force structured format when user wants direct technical help.

When creating prompts, structure as (no extra explanation):
1) Instruction to the assistant (clear objective and role)
2) Inputs to consider (summarize and normalize the user input)
3) Steps/Policy (how to think, what to do, what to avoid)
4) Constraints and acceptance criteria (must/should; edge cases)

Rules:
- Do not include code fences or rationale.
- Prefer measurable criteria over vague language.
- When constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.
- FORMAT RULE: If JSON format is requested, specify keys and rules WITHIN the constraints section above, NOT as a separate section.
- FORMAT RULE: Do NOT add any "Response structure" or "Output format" sections to the prompt you create.`;

const DEFAULT_ENHANCE_PROMPT = `You are PromptCrafter, an expert at improving existing prompts for clarity, reliability, and results.

Goal:
- Rewrite the user's prompt to preserve intent while removing ambiguity and tightening scope.

Behavior:
- Strictly obey any provided Mode, Task type, and Constraints.
- Improve structure, add missing constraints or acceptance criteria, and integrate response formatting requirements directly.
- Keep it concise and high signal; remove redundancy and vague wording.

IMPORTANT CONTEXT DETECTION:
- If the input contains EXISTING PROMPT TEXT to enhance, use structured format below.
- If the input is about improving CODE, UI, or technical implementation (not prompts), respond directly with improved code/solution.
- For questions like "how to fix this CSS" or "make the chat wider", give direct technical guidance, not wrapped in prompt structure.
- Only use structured format when enhancing actual prompts.

When enhancing existing prompts, produce only the improved prompt (no commentary), organized as:
1) Instruction to the assistant (refined objective/role)
2) Key inputs/assumptions (crisp, minimal)
3) Steps/Policy (how to reason, what to check)
4) Constraints and acceptance criteria (must/should; edge cases)

Rules:
- No code fences or meta explanation.
- Prefer explicit, testable requirements over generalities.
- If constraints conflict, prioritize explicit Constraints, then Task type guidelines, then general quality.
- FORMAT RULE: If JSON format is requested, specify keys and rules WITHIN the constraints section above, NOT as a separate section.
- FORMAT RULE: Do NOT add any "Response structure" or "Output format" sections to the prompt you create.`;

// Initialize system prompts default file
export async function ensureSystemPromptsDefaultFile(): Promise<SystemPromptsDefault> {
  const dataDir = resolveDataDir();
  const defaultFilePath = path.join(dataDir, 'system-prompts-default.json');
  
  try {
    // Try to read the existing default file
    console.log('Attempting to read system prompts from:', defaultFilePath);
    const content = await fs.readFile(defaultFilePath, 'utf-8');
    const defaults = JSON.parse(content) as SystemPromptsDefault;
    console.log('Successfully loaded system prompts from file');
    return defaults;
  } catch (error) {
    console.log('System prompts file not found or invalid, creating new one...');
    // File doesn't exist or can't be read, create it
    try {
      console.log('Using hardcoded default system prompts');
      const buildContent = DEFAULT_BUILD_PROMPT;
      const enhanceContent = DEFAULT_ENHANCE_PROMPT;
      
      const defaults: SystemPromptsDefault = {
        build: buildContent.trim(),
        enhance: enhanceContent.trim(),
        version: '1.0.0'
      };
      
      // Ensure the data directory exists
      await fs.mkdir(dataDir, { recursive: true });
      
      // Write the defaults to the file
      console.log('Writing system prompts defaults to:', defaultFilePath);
      await fs.writeFile(defaultFilePath, JSON.stringify(defaults, null, 2), 'utf-8');
      
      return defaults;
    } catch (initError) {
      console.error('Failed to initialize system-prompts-default.json:', initError);
      // Fallback to hardcoded defaults
      console.log('Using hardcoded defaults as last resort');
      return {
        build: DEFAULT_BUILD_PROMPT,
        enhance: DEFAULT_ENHANCE_PROMPT,
        version: '1.0.0'
      };
    }
  }
}

// Initialize system prompts in app settings if they don't exist or are empty
export async function initializeSystemPrompts(): Promise<void> {
  console.log('Initializing system prompts...');
  try {
    // Check if system prompts already exist in app settings
    const buildPrompt = await dataLayer.findAppSetting('SYSTEM_PROMPT_BUILD');
    const enhancePrompt = await dataLayer.findAppSetting('SYSTEM_PROMPT_ENHANCE');
    
    // Get the defaults regardless - will either read from file or create from MD files
    const defaults = await ensureSystemPromptsDefaultFile();
    console.log('System prompts default file loaded/created successfully');
    
    // Always check if prompts exist and are not empty
    const needsBuildPrompt = !buildPrompt?.value || buildPrompt.value.trim() === '';
    const needsEnhancePrompt = !enhancePrompt?.value || enhancePrompt.value.trim() === '';
    
    if (needsBuildPrompt) {
      console.log('Setting BUILD system prompt from defaults');
      await dataLayer.upsertAppSetting('SYSTEM_PROMPT_BUILD', defaults.build);
    } else {
      console.log('BUILD system prompt already exists');
    }
    
    if (needsEnhancePrompt) {
      console.log('Setting ENHANCE system prompt from defaults');
      await dataLayer.upsertAppSetting('SYSTEM_PROMPT_ENHANCE', defaults.enhance);
    } else {
      console.log('ENHANCE system prompt already exists');
    }
    
    console.log('System prompts initialization complete');
  } catch (error) {
    console.error('Failed to initialize system prompts:', error);
    // Try one more time with hardcoded defaults
    try {
      await dataLayer.upsertAppSetting('SYSTEM_PROMPT_BUILD', DEFAULT_BUILD_PROMPT);
      await dataLayer.upsertAppSetting('SYSTEM_PROMPT_ENHANCE', DEFAULT_ENHANCE_PROMPT);
      console.log('System prompts initialized with hardcoded defaults after error');
    } catch (fallbackError) {
      console.error('Final fallback for system prompts failed:', fallbackError);
    }
  }
}
