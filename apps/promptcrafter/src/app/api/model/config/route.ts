import { NextResponse } from "next/server";
import { z } from "zod";
import { readLocalModelConfig, writeLocalModelConfig } from "@/server/local-model";
import { env } from "@/env";

const AllowedModels = ["gemma3:1b", "gemma3:4b", "gemma3:12b", "gemma3:27b"] as const;
const OllamaBody = z.object({
  provider: z.literal("ollama"),
  baseUrl: z.string().refine(v => /^https?:\/\/(localhost|127\.0\.0\.1)(:11434)?$/.test(v.replace(/\/$/, "")), "Base URL must be local (http://localhost:11434)"),
  model: z.enum(AllowedModels),
});
const OpenRouterProxyBody = z.object({
  provider: z.literal("openrouter-proxy"),
  baseUrl: z.literal("https://promptcrafter.sammyhamwi.ai"),
  model: z.literal("env-token").transform(() => env.GOOGLE_PROXY_AUTH_TOKEN || "missing-token"), // Use env variable
});
const Body = z.union([OllamaBody, OpenRouterProxyBody]);

export async function GET() {
  try {
    const cfg = await readLocalModelConfig();
    return NextResponse.json({ config: cfg });
  } catch (e) {
    return NextResponse.json({ config: null, error: 'uninitialized' }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.parse(json);
    await writeLocalModelConfig(parsed);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/model/config] save failed', err);
    if (err instanceof Error && err.message.includes('Base URL')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
