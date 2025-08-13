import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { env } from "@/env";
import {
  readSystemPromptForModeFromDb,
  writeSystemPromptForModeToDb,
} from "@/server/settings";

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const build = (await readSystemPromptForModeFromDb("build")) ?? env.GOOGLE_GEMINI_SYSTEM_PROMPT_BUILD ?? env.GOOGLE_GEMINI_SYSTEM_PROMPT ?? "";
  const enhance = (await readSystemPromptForModeFromDb("enhance")) ?? env.GOOGLE_GEMINI_SYSTEM_PROMPT_ENHANCE ?? env.GOOGLE_GEMINI_SYSTEM_PROMPT ?? "";
  return NextResponse.json({ build, enhance });
}

const BodySchema = z.object({ build: z.string().optional(), enhance: z.string().optional() });

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.email)) {
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
    await writeSystemPromptForModeToDb("build", parsed.build);
  }
  if (parsed.enhance !== undefined) {
    await writeSystemPromptForModeToDb("enhance", parsed.enhance);
  }
  return NextResponse.json({ ok: true });
}


