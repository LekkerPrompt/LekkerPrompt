import { PrismaAdapter } from "@auth/prisma-adapter";
import type { DefaultSession, NextAuthConfig } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import EmailProvider from "next-auth/providers/email";
import { env } from "@/env";

import { db } from "@/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			// ...other properties
			// role: UserRole;
		} & DefaultSession["user"];
	}

	// interface User {
	//   // ...other properties
	//   // role: UserRole;
	// }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
    providers: [
        // Discord provider only if configured
        ...((env.AUTH_DISCORD_ID && env.AUTH_DISCORD_SECRET) ? [DiscordProvider] : []),
        // Email magic link provider (added conditionally if env is present)
        ...((env.EMAIL_FROM && (env.EMAIL_SERVER || env.EMAIL_SERVER_HOST))
            ? [
                EmailProvider({
                    server: env.EMAIL_SERVER
                        ? env.EMAIL_SERVER
                        : {
                            host: env.EMAIL_SERVER_HOST!,
                            port: env.EMAIL_SERVER_PORT ? Number(env.EMAIL_SERVER_PORT) : 587,
                            secure: env.EMAIL_SERVER_SECURE ? ["true", "1"].includes(env.EMAIL_SERVER_SECURE) : false,
                            auth: {
                                user: env.EMAIL_SERVER_USER!,
                                pass: env.EMAIL_SERVER_PASSWORD!,
                            },
                        },
                    from: env.EMAIL_FROM,
                }),
            ]
            : []),
    ],
	adapter: PrismaAdapter(db),
	callbacks: {
		session: ({ session, user }) => {
			const derivedName = session.user?.name ?? (session.user?.email ? session.user.email.split("@")[0] : undefined);
			return {
				...session,
				user: {
					...session.user,
					id: user.id,
					name: derivedName ?? session.user?.name,
				},
			};
		},
	},
    pages: {
        signIn: "/auth/signin",
    },
} satisfies NextAuthConfig;
