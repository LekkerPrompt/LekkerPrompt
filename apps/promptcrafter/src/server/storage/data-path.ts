import path from 'path';
import os from 'os';

// Cache the resolved data directory to ensure consistency within a session
let cachedDataDir: string | null = null;

/**
 * Resolve the data directory with improved consistency:
 * 1. Respect DATA_DIR if provided.
 * 2. Check for Electron config file and use its dataDir setting.
 * 3. Otherwise use the user's Documents folder (cross-platform) with a subfolder `PromptCrafter`.
 */
export function resolveDataDir(custom?: string): string {
  if (custom) return custom;
  
  // Return cached result for consistency within the same process
  if (cachedDataDir) return cachedDataDir;
  
  if (process.env.DATA_DIR) {
    cachedDataDir = process.env.DATA_DIR;
    return cachedDataDir;
  }

  // Try to read Electron config file to get the configured data directory
  try {
    const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1';
    if (isElectron || process.env.NODE_ENV === 'development') {
      const configPath = getElectronConfigPath();
      if (configPath) {
        const fs = require('fs');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (config.dataDir && typeof config.dataDir === 'string') {
            cachedDataDir = config.dataDir;
            return config.dataDir;
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to read Electron config for data directory:', error);
  }

  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const isWin = process.platform === 'win32';

  // Attempt XDG_DOCUMENTS_DIR if present (Linux desktop); fallback to ~/Documents
  const xdgDocs = process.env.XDG_DOCUMENTS_DIR;
  let documentsBase = xdgDocs ? xdgDocs.replace('~', home) : path.join(home, 'Documents');

  // On Windows ensure standard 'Documents'
  if (isWin) {
    documentsBase = path.join(home, 'Documents');
  }

  cachedDataDir = path.join(documentsBase, 'PromptCrafter');
  return cachedDataDir;
}

/**
 * Get the Electron configuration file path
 */
function getElectronConfigPath(): string | null {
  try {
    const userDataPath = getUserDataPath();
    if (userDataPath) {
      return path.join(userDataPath, 'promptcrafter-config.json');
    }
  } catch (error) {
    // Ignore errors
  }
  return null;
}

/**
 * Get the user data path for Electron apps
 */
function getUserDataPath(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  
  switch (process.platform) {
    case 'win32':
      return path.join(home, 'AppData', 'Roaming', 'PromptCrafter');
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'PromptCrafter');
    case 'linux':
      return path.join(home, '.config', 'PromptCrafter');
    default:
      return null;
  }
}
