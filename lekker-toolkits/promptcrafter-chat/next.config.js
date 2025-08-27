/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

const isElectron = Boolean(process.env.ELECTRON);

/**
 * Minimal, stable Next config for both web and Electron builds.
 * We rely on the build script setting NEXT_DISABLE_FILE_TRACE=1 to avoid
 * file tracing that was walking protected Windows junctions (EPERM errors).
 * All custom webpack hacks were removed to eliminate schema / ESM issues.
 * If you need further tweaks, add them incrementally and avoid using require() here (ESM file).
 * @type {import('next').NextConfig}
 */
// We attempted 'export' for Electron, but dynamic API routes (NextAuth) require a server.
// So always build the normal server output. Standalone tracing is disabled via env (NEXT_DISABLE_FILE_TRACE=1)
// to avoid EPERM on Windows junctions.
const config = {
	output: undefined,
	basePath: process.env.NEXT_BASE_PATH || "",
	eslint: { ignoreDuringBuilds: true },
	typescript: { ignoreBuildErrors: true },
	images: { unoptimized: true },
};

export default config;
