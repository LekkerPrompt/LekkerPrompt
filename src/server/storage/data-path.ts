import path from 'path';
import os from 'os';

// Cache the resolved data directory to ensure consistency within a session
let cachedDataDir: string | null = null;

export function resetDataDirCache() {
  cachedDataDir = null;
}

/**
 * Resolve the data directory with improved consistency:
 * 1. Respect DATA_DIR if provided.
 * 2. Check for Electron config file and use its dataDir setting.
 * 3. Otherwise use the user's Documents folder (cross-platform) with a subfolder `PromptCrafter`.
 */
export function resolveDataDir(custom?: string): string {
  if (custom) {
    console.log(`[data-path] Using custom data dir: ${custom}`);
    return custom;
  }
  
  // Return cached result for consistency within the same process
  if (cachedDataDir) {
    console.log(`[data-path] Using cached data dir: ${cachedDataDir}`);
    return cachedDataDir;
  }
  
  if (process.env.DATA_DIR) {
    cachedDataDir = process.env.DATA_DIR;
    console.log(`[data-path] Using DATA_DIR from env: ${cachedDataDir}`);
    return cachedDataDir;
  }

  // Try to read Electron config file to get the configured data directory
  try {
    const isElectron = !!(process as any)?.versions?.electron || process.env.ELECTRON === '1' || process.env.NEXT_PUBLIC_ELECTRON === '1';
    console.log(`[data-path] isElectron=${isElectron}, NODE_ENV=${process.env.NODE_ENV}`);
    
    if (isElectron || process.env.NODE_ENV === 'development') {
      const configPath = getElectronConfigPath();
      console.log(`[data-path] Electron config path: ${configPath || 'not found'}`);
      
      if (configPath) {
        const fs = require('fs');
        if (fs.existsSync(configPath)) {
          console.log(`[data-path] Electron config exists at ${configPath}`);
          const content = fs.readFileSync(configPath, 'utf-8');
          console.log(`[data-path] Electron config content: ${content}`);
          
          const config = JSON.parse(content);
          if (config.dataDir && typeof config.dataDir === 'string') {
            cachedDataDir = config.dataDir;
            console.log(`[data-path] Using dataDir from Electron config: ${cachedDataDir}`);
            return config.dataDir;
          }
        } else {
          console.log(`[data-path] Electron config file does not exist: ${configPath}`);
        }
      }
    }
  } catch (error) {
    console.warn('[data-path] Failed to read Electron config for data directory:', error);
  }

  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  const isWin = process.platform === 'win32';

  // Attempt XDG_DOCUMENTS_DIR if present (Linux desktop)
  let documentsBase: string | null = null;
  const xdgDocs = process.env.XDG_DOCUMENTS_DIR;
  if (xdgDocs) {
    documentsBase = xdgDocs.replace('~', home);
  } else if (process.platform === 'linux') {
    // Parse ~/.config/user-dirs.dirs for XDG_DOCUMENTS_DIR
    try {
      const fs = require('fs');
      const configPath = path.join(home, '.config', 'user-dirs.dirs');
      if (fs.existsSync(configPath)) {
        const txt = fs.readFileSync(configPath, 'utf-8');
        const match = /XDG_DOCUMENTS_DIR=(?:\"([^\"]+)\"|([^\n]+))/i.exec(txt);
        const raw = (match && (match[1] || match[2])) || '';
        if (raw) {
          // Replace $HOME and ~ tokens
          const resolved = raw.replace(/^\$HOME/, home).replace('~', home);
          documentsBase = resolved;
        }
      }
    } catch {}
  }
  if (!documentsBase) {
    documentsBase = path.join(home, 'Documents');
  }

  // On Windows ensure standard 'Documents'
  if (isWin) {
    documentsBase = path.join(home, 'Documents');
  }

  cachedDataDir = path.join(documentsBase, 'PromptCrafter');
  console.log(`[data-path] Using default data dir: ${cachedDataDir}`);
  
  // Ensure the directory exists
  try {
    const fs = require('fs');
    fs.mkdirSync(cachedDataDir, { recursive: true });
    console.log(`[data-path] Created default data directory: ${cachedDataDir}`);
  } catch (error) {
    console.warn(`[data-path] Failed to create default data directory: ${error}`);
  }
  
  return cachedDataDir;
}

/**
 * Get the Electron configuration file path
 */
function getElectronConfigPath(): string | null {
  try {
    const userDataPath = getUserDataPath();
    console.log(`[data-path] User data path: ${userDataPath || 'not found'}`);
    if (userDataPath) {
      const configPath = path.join(userDataPath, 'promptcrafter-config.json');
      console.log(`[data-path] Config path: ${configPath}`);
      return configPath;
    }
  } catch (error) {
    console.warn('[data-path] Error getting Electron config path:', error);
  }
  return null;
}

/**
 * Get the user data path for Electron apps
 */
function getUserDataPath(): string | null {
  // Prefer Electron-provided userData dir if injected via env by main process
  if (process.env.PROMPTCRAFTER_USER_DATA_DIR) {
    console.log(`[data-path] Using PROMPTCRAFTER_USER_DATA_DIR: ${process.env.PROMPTCRAFTER_USER_DATA_DIR}`);
    return process.env.PROMPTCRAFTER_USER_DATA_DIR;
  }
  
  const home = process.env.HOME || process.env.USERPROFILE || os.homedir();
  let userDataPath: string | null = null;
  
  switch (process.platform) {
    case 'win32':
      userDataPath = path.join(home, 'AppData', 'Roaming', 'PromptCrafter');
      break;
    case 'darwin':
      userDataPath = path.join(home, 'Library', 'Application Support', 'PromptCrafter');
      break;
    case 'linux':
      userDataPath = path.join(home, '.config', 'PromptCrafter');
      break;
    default:
      userDataPath = null;
  }
  
  console.log(`[data-path] Resolved user data path for platform ${process.platform}: ${userDataPath}`);
  return userDataPath;
}
