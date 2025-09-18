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
 * @type {object}
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
	turbopack: {
		rules: {
			// Configure any specific rules for Turbopack here if needed
		},
	},
	// Workaround: on some Windows build environments the native lightningcss binary
	// fails to be present (Cannot find module '../lightningcss.win32-x64-msvc.node').
	// We alias to the wasm fallback only on Windows to avoid performance hit elsewhere.
	// Only apply webpack config when not using Turbopack
	...(process.env.TURBOPACK ? {} : {
		webpack: /** @param {any} cfg */ (cfg) => {
			if (process.platform === 'win32') {
				cfg.resolve = cfg.resolve || {};
				cfg.resolve.alias = {
					...(cfg.resolve.alias || {}),
					lightningcss: 'lightningcss-wasm',
				};
			}
			return cfg;
		},
	}),
};

export default config;
