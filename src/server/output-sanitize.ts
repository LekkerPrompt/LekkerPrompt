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
  return /^<img\s+[^>]*>$/i.test(t) || /^<img\s+[^>]*\/>$/i.test(t);
}

// Inserted helpers for format-aware sanitization
function stripOuterFence(text: string): { inner: string; stripped: boolean } {
  const m = /^```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```\s*$/.exec(text.trim());
  if (!m) return { inner: text, stripped: false };
  return { inner: m[1] ?? text, stripped: true };
}

function removeFencedBlocksByLang(text: string, lang: string): string {
  const re = new RegExp('```' + lang + "\\r?\\n[\\s\\S]*?\\r?\\n```", 'gi');
  return text.replace(re, '').trim();
}

function extractTopLevelJson(text: string): string | null {
  const s = text;
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = false; continue; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        const candidate = s.slice(start, i + 1).trim();
        try { JSON.parse(candidate); return candidate; } catch { /* try next */ }
        start = -1;
      }
    }
  }
  return null;
}

function toPlainFromMarkdown(text: string): string {
  let out = text;
  // Unfence any blocks (keep content, drop fences)
  out = out.replace(/```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n```/g, '$1');
  // Drop images entirely
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  // Convert headings to plain lines
  out = out.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  // Remove emphasis markers
  out = out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1');
  // Remove inline code backticks
  out = out.replace(/`([^`]+)`/g, '$1');
  // Normalize bullet prefixes (keep a dash)
  out = out.replace(/^\s*[-*+]\s+/gm, '- ');
  // Collapse quotes to plain
  out = out.replace(/^\s*>\s?/gm, '');
  // Trim excess blank lines to max 2
  out = out.replace(/\n{3,}/g, '\n\n');
  return out.trim();
}

function keepPreferredMarkdown(text: string): string {
  let out = text;
  // If entire thing is fenced as markdown, unwrap
  const f = stripOuterFence(out);
  if (f.stripped) out = f.inner;
  // Remove any legacy "Output Contract" blocks or headings that leaked from older prompts
  out = out.replace(/^#+\s*Output\s+Contract[\s\S]*?$(\n)?/gim, '').trim();
  // Remove fenced JSON blocks entirely
  out = removeFencedBlocksByLang(out, 'json');
  // If there are labeled sections, prefer the markdown one
  const lines = out.split(/\r?\n/);
  const jsonHeadingIdx = lines.findIndex(l => /^\s*#{1,6}\s*JSON\s*Format\s*$/i.test(l));
  const mdHeadingIdx = lines.findIndex(l => /^\s*#{1,6}\s*Markdown\s*Format\s*$/i.test(l));
  if (jsonHeadingIdx !== -1 || mdHeadingIdx !== -1) {
    const cut = Math.min(...[jsonHeadingIdx, mdHeadingIdx].filter(i => i !== -1));
    const before = lines.slice(0, cut).join('\n').trim();
    if (before.length >= 80 || before.split(/\n/).filter(Boolean).length >= 3) {
      out = before;
    } else if (mdHeadingIdx !== -1) {
      // Keep from Markdown Format heading onward, but drop the heading label itself
      const tail = lines.slice(mdHeadingIdx + 1).join('\n');
      out = tail.trim();
    }
  }
  // Trim excess blank lines
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  return out;
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
  const driftReasons: string[] = [];
  const requestedFormat = options?.format || 'plain';
  let cleaned = String(rawOutput ?? '');

  if (requestedFormat === 'json') {
    // Unwrap outer fence if entire content is fenced
    const f = stripOuterFence(cleaned);
    if (f.stripped) { cleaned = f.inner; driftReasons.push('removed_json_fences'); }
    // Prefer extracting a valid top-level JSON
    let jsonCandidate: string | null = null;
    const direct = cleaned.trim();
    if (direct.startsWith('{') && direct.endsWith('}')) {
      try { JSON.parse(direct); jsonCandidate = direct; } catch { /* ignore */ }
    }
    if (!jsonCandidate) {
      // Look for fenced JSON blocks
      const match = /```json\r?\n([\s\S]*?)\r?\n```/i.exec(cleaned);
      if (match && match[1]) {
        const inner = match[1].trim();
        try { JSON.parse(inner); jsonCandidate = inner; driftReasons.push('extracted_json_block'); } catch { /* ignore */ }
      }
    }
    if (!jsonCandidate) {
      const extracted = extractTopLevelJson(cleaned);
      if (extracted) { jsonCandidate = extracted; driftReasons.push('extracted_top_level_json'); }
    }
    if (jsonCandidate) cleaned = jsonCandidate;
    // Validate JSON (for reporting only)
    try { JSON.parse(cleaned.trim()); } catch { driftReasons.push('invalid_json_format'); }
    return { cleaned: cleaned.trim(), driftReasons };
  }

  if (requestedFormat === 'markdown') {
    cleaned = keepPreferredMarkdown(cleaned);
    // Ensure no JSON fenced blocks remain
    cleaned = removeFencedBlocksByLang(cleaned, 'json');
    return { cleaned: cleaned.trim(), driftReasons };
  }

  // Plain text: remove markdown constructs conservatively
  // Remove only clear "Prompt:" or "Image prompt:" prefixes
  if (/^(prompt|image\s+prompt)\s*:\s*/i.test(cleaned.trim())) {
    cleaned = cleaned.replace(/^(prompt|image\s+prompt)\s*:\s*/i, '').trim();
    driftReasons.push('removed_prompt_prefix');
  }
  // Only unwrap JSON if it's clearly a wrapper object with a single prompt field
  const unwrapped = unwrapJsonIfSinglePromptObject(cleaned);
  if (unwrapped && unwrapped.length > cleaned.length * 0.7) {
    cleaned = unwrapped;
    driftReasons.push('unwrapped_json_object');
  }
  cleaned = toPlainFromMarkdown(cleaned);
  return { cleaned, driftReasons };
}
