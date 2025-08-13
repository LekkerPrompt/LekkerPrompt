import { existsSync, cpSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {...string} segments
 * @returns {string}
 */
const resolveFromRoot = (...segments) => path.join(__dirname, ...segments);
const standaloneRoot = resolveFromRoot(".next", "standalone");
const standaloneServerAbs = path.join(standaloneRoot, "server.js");

if (!existsSync(standaloneServerAbs)) {
	console.log("[app] .next/standalone not found. Installing dependencies and building (standalone)...");
	const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

	// Install dependencies if needed
	const nodeModulesPath = resolveFromRoot("node_modules");
	if (!existsSync(nodeModulesPath)) {
		const installResult = spawnSync(npmCmd, ["ci"], {
			stdio: "inherit",
			env: process.env,
			cwd: __dirname,
		});
		if (installResult.status !== 0) {
			throw new Error("[app] npm ci failed. See logs above.");
		}
	}

	// Build app (skip strict env validation in CI/host environments)
	const buildResult = spawnSync(npmCmd, ["run", "build"], {
		stdio: "inherit",
		env: { ...process.env, SKIP_ENV_VALIDATION: "true" },
		cwd: __dirname,
	});
	if (buildResult.status !== 0) {
		throw new Error("[app] Build failed. See logs above.");
	}
}

if (!existsSync(standaloneServerAbs)) {
	throw new Error("[app] Standalone server not found after build at .next/standalone/server.js");
}

// Ensure static assets are available where standalone server expects them
const sourcePublic = resolveFromRoot("public");
const destPublic = path.join(standaloneRoot, "public");
if (existsSync(sourcePublic) && !existsSync(destPublic)) {
	console.log("[app] Copying public/ into .next/standalone/public ...");
	cpSync(sourcePublic, destPublic, { recursive: true });
}

const sourceStatic = resolveFromRoot(".next", "static");
const destStatic = path.join(standaloneRoot, ".next", "static");
if (existsSync(sourceStatic) && !existsSync(destStatic)) {
	console.log("[app] Copying .next/static into .next/standalone/.next/static ...");
	mkdirSync(path.dirname(destStatic), { recursive: true });
	cpSync(sourceStatic, destStatic, { recursive: true });
}

// Attempt to apply database migrations if a schema exists and DATABASE_URL is provided
const prismaSchemaPath = resolveFromRoot("prisma", "schema.prisma");
const shouldSkipMigrate = process.env.PRISMA_SKIP_MIGRATE === "true";
if (!shouldSkipMigrate && existsSync(prismaSchemaPath) && process.env.DATABASE_URL) {
	const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
	console.log("[app] Applying database migrations (prisma migrate deploy)...");
	const migrate = spawnSync(npxCmd, ["prisma", "migrate", "deploy"], {
		stdio: "inherit",
		cwd: __dirname,
		env: process.env,
	});
	if (migrate.status !== 0) {
		console.warn("[app] prisma migrate deploy failed.");
		if (process.env.PRISMA_DB_PUSH_ON_FAIL === "true") {
			console.warn("[app] Attempting prisma db push as a fallback...");
			const push = spawnSync(npxCmd, ["prisma", "db", "push"], {
				stdio: "inherit",
				cwd: __dirname,
				env: process.env,
			});
			if (push.status !== 0) {
				console.warn("[app] prisma db push also failed. Continuing without schema sync.");
			}
		}
	}
}

if (!process.env.NODE_ENV) Reflect.set(process.env, "NODE_ENV", "production");
const effectiveHostname = process.env.HOSTNAME || process.env.HOST || "0.0.0.0";
Reflect.set(process.env, "HOSTNAME", effectiveHostname);
if (!process.env.PORT) Reflect.set(process.env, "PORT", "3000");
if (process.env.AUTH_TRUST_HOST === undefined) Reflect.set(process.env, "AUTH_TRUST_HOST", "true");

// Run server from the standalone directory so relative paths match Next's expectations
process.chdir(standaloneRoot);
const serverModuleUrl = pathToFileURL(path.join(standaloneRoot, "server.js")).href;
await import(serverModuleUrl);


