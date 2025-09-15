import { NextResponse } from "next/server";
import { z } from "zod";
import { setPrivacyConsentForRemoteAPI, hasPrivacyConsentForRemoteAPI } from "@/server/local-model";

const Body = z.object({
  accepted: z.boolean(),
});

export async function GET() {
  try {
    const hasConsent = await hasPrivacyConsentForRemoteAPI();
    return NextResponse.json({ accepted: hasConsent });
  } catch (e) {
    console.error('[api/model/privacy-consent] GET failed', e);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = Body.parse(json);
    await setPrivacyConsentForRemoteAPI(parsed.accepted);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/model/privacy-consent] POST failed', err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
