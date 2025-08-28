import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { dataLayer } from "@/server/storage/data-layer";

const BodySchema = z.object({
  messageId: z.string(),
  feedback: z.enum(["like", "dislike"]),
});

const DeleteBodySchema = z.object({
  messageId: z.string(),
});

export async function POST(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const success = await dataLayer.setMessageFeedback(parsed.messageId, parsed.feedback);

  if (success) {
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  if (!session?.user && !isElectron) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof DeleteBodySchema>;
  try {
    const body = await req.json();
    parsed = DeleteBodySchema.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const success = await dataLayer.removeMessageFeedback(parsed.messageId);

  if (success) {
    return NextResponse.json({ ok: true });
  } else {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
}
