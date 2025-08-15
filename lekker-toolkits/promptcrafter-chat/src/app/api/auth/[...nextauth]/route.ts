import { handlers, signOut } from "@/server/auth";
import type { NextRequest } from "next/server";

export const { POST } = handlers;

export async function GET(req: NextRequest) {
	const url = new URL(req.url);
	// If the route is the signout endpoint, sign out immediately without confirmation
	if (url.pathname.endsWith("/signout")) {
		const redirectTo = url.searchParams.get("callbackUrl") ?? "/auth/signin";
		return signOut({ redirectTo });
	}
	// Delegate other auth routes to NextAuth's default handler
	return handlers.GET(req);
}
