import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Relax schema when running under Electron (standalone local app)
const isElectron = !!(process?.versions?.electron) || process.env.ELECTRON === "1";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		GOOGLE_API_KEY: z.string().optional(),
		GOOGLE_BASE_URL: z.string().url().optional(),
		GOOGLE_PROXY_URL: z.string().url().optional(), // Remote proxy endpoint (do not bundle API key locally)
		GOOGLE_PROXY_AUTH_TOKEN: z.string().optional(), // Shared secret for proxy auth
		OPENROUTER_API_KEY: z.string().optional(), // If ever needed locally (avoid bundling when distributing)
		OPENROUTER_REFERRER: z.string().optional(),
		OPENROUTER_SITE_NAME: z.string().optional(),
		GOOGLE_SYSTEM_PROMPT: z.string().optional(),
		GOOGLE_SYSTEM_PROMPT_BUILD: z.string().optional(),
		GOOGLE_SYSTEM_PROMPT_ENHANCE: z.string().optional(),
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_BASE_PATH: z.string().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
		GOOGLE_BASE_URL: process.env.GOOGLE_BASE_URL,
		GOOGLE_PROXY_URL: process.env.GOOGLE_PROXY_URL,
		GOOGLE_PROXY_AUTH_TOKEN: process.env.GOOGLE_PROXY_AUTH_TOKEN,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		OPENROUTER_REFERRER: process.env.OPENROUTER_REFERRER,
		OPENROUTER_SITE_NAME: process.env.OPENROUTER_SITE_NAME,
		GOOGLE_SYSTEM_PROMPT: process.env.GOOGLE_SYSTEM_PROMPT,
		GOOGLE_SYSTEM_PROMPT_BUILD: process.env.GOOGLE_SYSTEM_PROMPT_BUILD,
		GOOGLE_SYSTEM_PROMPT_ENHANCE: process.env.GOOGLE_SYSTEM_PROMPT_ENHANCE,
		NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
		NODE_ENV: process.env.NODE_ENV,
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
