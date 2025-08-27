import { env } from '@/env';
import type { PromptMode, TaskType, GenerationOptions } from '@/server/googleai';

export interface ProxyChatInput {
  input: string;
  mode: PromptMode;
  taskType: TaskType;
  options?: GenerationOptions;
}

/**
 * Calls the remote proxy (which holds the real Google API key). Returns model output text.
 */
export async function callGoogleProxy(payload: ProxyChatInput): Promise<string> {
  if (!env.GOOGLE_PROXY_URL) {
    throw new Error('GOOGLE_PROXY_URL not configured');
  }

  const res = await fetch(env.GOOGLE_PROXY_URL.replace(/\/$/, '') + '/api/googleai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.GOOGLE_PROXY_AUTH_TOKEN ? { 'x-proxy-auth': env.GOOGLE_PROXY_AUTH_TOKEN } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  if (typeof data.output !== 'string') throw new Error('Invalid proxy response');
  return data.output;
}
