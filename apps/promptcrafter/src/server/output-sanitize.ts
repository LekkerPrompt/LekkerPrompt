import type { TaskType, GenerationOptions } from '@/server/googleai';

export interface SanitizationResult {
  cleaned: string;
  driftReasons: string[];
}

// Detect placeholder markdown image (like ![desc](16:9) or empty alt)
function isMarkdownImageOnly(s: string) {
  return /^!\[[^\]]*\]\([^)]*\)\s*$/m.test(s.trim());
}

// Detect incomplete / partial markdown image start (e.g., model began image syntax)
function startsLikeMarkdownImage(s: string) {
  return /^!\[[^\]]*$/.test(s.trim()) || /^!\[[^\]]*\]\([^)]*$/.test(s.trim());
}

function isHtmlImgOnly(s: string) {
  const t = s.trim();
  // <img ...> possibly self closing and maybe wrapped in backticks accidentally
  return /^<img\s+[^>]*>$/i.test(t) || /^<img\s+[^>]*\/?>$/i.test(t);
}

function unwrapJsonIfSinglePromptObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\{[\s\S]*\}$/.test(trimmed)) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const candidate = (parsed.prompt || parsed.image_prompt || parsed.text || parsed.data);
      if (typeof candidate === 'string') return candidate.trim();
    }
  } catch { /* ignore */ }
  return null;
}

export function sanitizeAndDetectDrift(taskType: TaskType, options: GenerationOptions | undefined, rawOutput: string): SanitizationResult {
  let cleaned = String(rawOutput ?? '').trim();
  const driftReasons: string[] = [];
  const requestedFormat = options?.format || 'plain';

  // Only handle JSON format issues when JSON was specifically requested
  if (requestedFormat === 'json') {
    // Remove code fences if JSON is wrapped in them
    const fenced = /^```(json)?[\r\n]+([\s\S]*?)```\s*$/i.test(cleaned);
    if (fenced) {
      cleaned = cleaned.replace(/^```(json)?[\r\n]+/i, '').replace(/```\s*$/, '').trim();
      driftReasons.push('removed_json_fences');
    }
    
    // Validate JSON only for reporting, don't modify
    try {
      JSON.parse(cleaned);
    } catch {
      driftReasons.push('invalid_json_format');
    }
  }

  // Only remove obvious wrapper artifacts, not legitimate content
  if (requestedFormat !== 'json' && requestedFormat !== 'markdown') {
    // Remove only clear "Prompt:" or "Image prompt:" prefixes
    if (/^(prompt|image\s+prompt)\s*:\s*/i.test(cleaned)) {
      cleaned = cleaned.replace(/^(prompt|image\s+prompt)\s*:\s*/i, '').trim();
      driftReasons.push('removed_prompt_prefix');
    }
    
    // Only unwrap JSON if it's clearly a wrapper object with a single prompt field
    const unwrapped = unwrapJsonIfSinglePromptObject(cleaned);
    if (unwrapped && unwrapped.length > cleaned.length * 0.7) { // Only if unwrapped content is substantial
      cleaned = unwrapped;
      driftReasons.push('unwrapped_json_object');
    }
  }

  // Minimal cleanup - just basic whitespace normalization
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return { cleaned, driftReasons };
}
