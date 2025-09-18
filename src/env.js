import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		GOOGLE_SYSTEM_PROMPT_BUILD: z.string().optional(),
		GOOGLE_SYSTEM_PROMPT_ENHANCE: z.string().optional(),
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	},
	client: {
		NEXT_PUBLIC_BASE_PATH: z.string().optional(),
	},
	runtimeEnv: {
		GOOGLE_SYSTEM_PROMPT_BUILD: process.env.GOOGLE_SYSTEM_PROMPT_BUILD,
		GOOGLE_SYSTEM_PROMPT_ENHANCE: process.env.GOOGLE_SYSTEM_PROMPT_ENHANCE,
		NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
		NODE_ENV: process.env.NODE_ENV,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
