const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

// Create a safe temp directory for the build
const tempBuildDir = path.join(os.tmpdir(), 'nextjs-electron-build-' + Date.now());

try {
  console.log('Starting Electron build with isolated environment...');
  
  // Set environment variables for safe build
  const env = {
    ...process.env,
    NODE_OPTIONS: '--max-old-space-size=4096',
    SKIP_ENV_VALIDATION: 'true',
    ELECTRON: '1',
    NEXT_PUBLIC_ELECTRON: '1',
    BUILDING_ELECTRON: '1', // custom flag to let runtime skip side-effectful DB init during build
    NEXT_DISABLE_FILE_TRACE: '1',
    TMPDIR: tempBuildDir,
    TEMP: tempBuildDir,
    TMP: tempBuildDir,
    // Prevent Next.js from scanning problematic directories
    NEXT_TELEMETRY_DISABLED: '1',
  // Constrain Tailwind scanning strictly to configured content globs
  TAILWIND_MODE: 'build',
  TAILWIND_DISABLE_TOUCH: '1',
  // Force any lib querying user profile dirs to stay in temp sandbox
  HOME: tempBuildDir,
  USERPROFILE: tempBuildDir,
  APPDATA: path.join(tempBuildDir, 'AppData', 'Roaming'),
  LOCALAPPDATA: path.join(tempBuildDir, 'AppData', 'Local'),
  };

  console.log('Building Prisma for Electron...');
  execSync('npm run build:electron:prisma', { stdio: 'inherit', env });

  console.log('Building Next.js app...');
  execSync('next build', { stdio: 'inherit', env, cwd: process.cwd() });

  console.log('Build completed successfully!');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Build failed:', message);
  process.exit(1);
}
