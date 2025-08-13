import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		AUTH_DISCORD_ID: z.string(),
		AUTH_DISCORD_SECRET: z.string(),
		DATABASE_URL: z.string().url(),
		NEXTAUTH_URL: z.string().url().optional(),
		AUTH_TRUST_HOST: z
			.enum(["true", "false", "1", "0"]) // optional: helpful in Docker
			.optional(),
		GOOGLE_GEMINI_API_KEY: z.string(),
		GOOGLE_GEMINI_BASE_URL: z.string().url(),
		GOOGLE_GEMINI_SYSTEM_PROMPT: z.string().optional(),
		GOOGLE_GEMINI_SYSTEM_PROMPT_BUILD: z.string().optional(),
		GOOGLE_GEMINI_SYSTEM_PROMPT_ENHANCE: z.string().optional(),
		ADMIN_EMAILS: z.string().optional(), // comma-separated list
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		// Email provider
		EMAIL_SERVER: z.string().url().optional(),
		EMAIL_FROM: z.string().email().optional(),
		EMAIL_SERVER_HOST: z.string().optional(),
		EMAIL_SERVER_PORT: z.string().optional(),
		EMAIL_SERVER_USER: z.string().optional(),
		EMAIL_SERVER_PASSWORD: z.string().optional(),
		EMAIL_SERVER_SECURE: z.enum(["true", "false", "1", "0"]).optional(),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		// NEXT_PUBLIC_CLIENTVAR: z.string(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_DISCORD_ID: process.env.AUTH_DISCORD_ID,
		AUTH_DISCORD_SECRET: process.env.AUTH_DISCORD_SECRET,
		DATABASE_URL: process.env.DATABASE_URL,
		NEXTAUTH_URL: process.env.NEXTAUTH_URL,
		AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
		GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
		GOOGLE_GEMINI_BASE_URL: process.env.GOOGLE_GEMINI_BASE_URL,
		GOOGLE_GEMINI_SYSTEM_PROMPT: process.env.GOOGLE_GEMINI_SYSTEM_PROMPT,
		GOOGLE_GEMINI_SYSTEM_PROMPT_BUILD: process.env.GOOGLE_GEMINI_SYSTEM_PROMPT_BUILD,
		GOOGLE_GEMINI_SYSTEM_PROMPT_ENHANCE: process.env.GOOGLE_GEMINI_SYSTEM_PROMPT_ENHANCE,
		ADMIN_EMAILS: process.env.ADMIN_EMAILS,
		NODE_ENV: process.env.NODE_ENV,
		EMAIL_SERVER: process.env.EMAIL_SERVER,
		EMAIL_FROM: process.env.EMAIL_FROM,
		EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST,
		EMAIL_SERVER_PORT: process.env.EMAIL_SERVER_PORT,
		EMAIL_SERVER_USER: process.env.EMAIL_SERVER_USER,
		EMAIL_SERVER_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
		EMAIL_SERVER_SECURE: process.env.EMAIL_SERVER_SECURE,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
