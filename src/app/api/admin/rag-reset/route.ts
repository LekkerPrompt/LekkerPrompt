import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { dataLayer } from "@/server/storage/data-layer";

const BodySchema = z.object({
  action: z.literal("reset-all")
});

export async function POST(req: Request) {
  const session = await auth();
  const isElectron = !!(process as any)?.versions?.electron;
  
  if (!session?.user && !isElectron) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    // Reset all message feedback in the database
    await dataLayer.resetAllMessageFeedback();
    
    return NextResponse.json({ 
      ok: true, 
      message: "RAG learning environment reset successfully" 
    });
  } catch (error) {
    console.error('Failed to reset RAG learning environment:', error);
    return NextResponse.json({ 
      error: "Failed to reset learning environment" 
    }, { status: 500 });
  }
}
