import { NextResponse } from "next/server";
import { env } from "@/env";
import { z } from "zod";

import { auth } from "@/server/auth";
import { readSystemPromptForMode, writeSystemPromptForMode } from "@/server/settings";

// Electron-only: all local users are treated as admin.
function isAdmin(): boolean { return true; }

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const build = (await readSystemPromptForMode("build")) ?? env.GOOGLE_SYSTEM_PROMPT_BUILD ?? "";
  const enhance = (await readSystemPromptForMode("enhance")) ?? env.GOOGLE_SYSTEM_PROMPT_ENHANCE ?? "";
  return NextResponse.json({ build, enhance });
}

const BodySchema = z.object({ build: z.string().optional(), enhance: z.string().optional() });

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!parsed.build && !parsed.enhance) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (parsed.build !== undefined) {
  await writeSystemPromptForMode("build", parsed.build);
  }
  if (parsed.enhance !== undefined) {
  await writeSystemPromptForMode("enhance", parsed.enhance);
  }
  return NextResponse.json({ ok: true });
}


