// Electron main process for PromptCrafter standalone
// @ts-nocheck
const path = require('path');
const { app, BrowserWindow, shell, session, dialog, ipcMain, Menu } = require('electron');
const fs = require('fs');
const http = require('http');
/** @type {number|null} */
let nextServerPort = null;
let dataDirPath = null; // resolved chosen data directory
const CONFIG_FILENAME = 'promptcrafter-config.json';

function getConfigPath() {
  return path.join(app.getPath('userData'), CONFIG_FILENAME);
}

function loadConfig() {
  try {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2), 'utf8');
  } catch (e) { /* ignore */ }
}

// Treat anything not packaged as dev. Rely on app.isPackaged instead of NODE_ENV
// because packaged builds often don't set NODE_ENV.
const isDev = !app.isPackaged;

// Load persisted config early - but don't set default data directory automatically
const cfg = loadConfig();
if (cfg.dataDir) {
  dataDirPath = cfg.dataDir;
  // Ensure directory exists
  try { fs.mkdirSync(dataDirPath, { recursive: true }); } catch (e) { /* ignore */ }
  // Set DATA_DIR so backend uses chosen directory for JSON/vector storage
  process.env.DATA_DIR = dataDirPath;
}
// If no dataDir is configured, we'll prompt the user before setting DATA_DIR
if (!isDev && !dataDirPath) {
  try {
    const fallback = path.join(app.getPath('userData'), 'data');
    fs.mkdirSync(fallback, { recursive: true });
    dataDirPath = fallback;
    process.env.DATA_DIR = dataDirPath;
    console.log('[Electron] No persisted dataDir. Using fallback at', fallback);
  } catch (e) {
    console.warn('[Electron] Failed to create fallback data directory', e);
  }
}

// Utility: attempt write/delete test file to confirm directory is writable
function canWriteToDir(dir) {
  try {
    const testFile = path.join(dir, '.promptcrafter-write-test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
}

// Attempt to detect Windows Mark-of-the-Web ADS (Zone.Identifier) and optionally remove
function checkAndOptionallyClearZoneIdentifier() {
  const execPath = process.execPath;
  if (process.platform !== 'win32') return { zoneIdentifierPresent: false, removed: false };
  const adsPath = execPath + ':Zone.Identifier';
  try {
    if (fs.existsSync(adsPath)) {
      // Try read for diagnostics then remove
      let removed = false;
      try { fs.readFileSync(adsPath, 'utf8'); } catch(_) {}
      try { fs.unlinkSync(adsPath); removed = true; } catch(_) {}
      return { zoneIdentifierPresent: true, removed };
    }
  } catch(_) {}
  return { zoneIdentifierPresent: false, removed: false };
}

// Register IPC handlers early - before app.whenReady() to ensure they're available immediately
ipcMain.handle('promptcrafter:getConfig', () => ({ dataDir: dataDirPath }));
ipcMain.handle('promptcrafter:isDbConfigured', () => {
  const cfg = loadConfig();
  const dir = cfg.dataDir || dataDirPath;
  const writable = !!dir && canWriteToDir(dir);
  return { configured: !!(dir && writable), writable, dataDir: dir };
});
ipcMain.handle('promptcrafter:getDbInfo', () => {
  try {
    if (!dataDirPath) return { ok: false, error: 'Data directory not configured' };
    // Compute aggregate size of JSON/vector files for approximation
    let sizeBytes = 0;
    try {
      const entries = fs.readdirSync(dataDirPath);
      for (const f of entries) {
        if (/\.json$/i.test(f) || /-vectors\.json$/i.test(f)) {
          const full = path.join(dataDirPath, f);
            try { const st = fs.statSync(full); if (st.isFile()) sizeBytes += st.size; } catch(_) {}
        }
      }
    } catch(_) {}
    // Provide representative data file path (first json file or directory marker)
    let representative = null;
    try {
      const files = fs.readdirSync(dataDirPath).filter(f => f.endsWith('.json'));
      representative = files[0] ? path.join(dataDirPath, files[0]) : dataDirPath;
    } catch(_) { representative = dataDirPath; }
    return { ok: true, dataDir: dataDirPath, dbPath: representative, sizeBytes, writable: canWriteToDir(dataDirPath) };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to read data directory info' };
  }
});
// Reset DB configuration: allow user to pick a new directory and optionally rebuild DB file
ipcMain.handle('promptcrafter:resetDataDir', async () => {
  try {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Select new data directory' });
    if (result.canceled || !result.filePaths?.[0]) return { ok: false, cancelled: true };
    const selected = result.filePaths[0];
    try { fs.mkdirSync(selected, { recursive: true }); } catch (_) {}
    if (!canWriteToDir(selected)) {
      return { ok: false, error: 'Selected folder is not writable. Choose another location (avoid protected folders).' };
    }
    // Persist new config
    const cfg2 = loadConfig();
    cfg2.dataDir = selected;
    saveConfig(cfg2);
    dataDirPath = selected;
  // No single DB file now; JSON & vector stores will populate lazily.
    // Point process env at new data directory path
    process.env.DATA_DIR = dataDirPath;
    // Create data directory to confirm writability
    try { fs.mkdirSync(dataDirPath, { recursive: true }); } catch (_) {}
    return { ok: true, dataDir: dataDirPath, dbPath: dataDirPath, note: 'Data directory updated successfully.' };
  } catch (e) {
    return { ok: false, error: e?.message || 'Reset failed' };
  }
});

// Restart the Electron application (used after DB reset)
ipcMain.handle('promptcrafter:restartApp', () => {
  try {
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to restart' };
  }
});
ipcMain.handle('promptcrafter:chooseDataDir', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false };
  const selected = result.filePaths[0];
  try { fs.mkdirSync(selected, { recursive: true }); } catch (e) {}
  if (!canWriteToDir(selected)) {
    return { ok: false, error: 'Selected folder is not writable. Choose another location (avoid Downloads or protected folders).' };
  }
  const cfg2 = loadConfig();
  cfg2.dataDir = selected;
  saveConfig(cfg2);
  dataDirPath = selected;
  // Legacy DATABASE_URL removed; storage now uses DATA_DIR environment variable only.
  return { ok: true, dataDir: dataDirPath };
});
ipcMain.handle('promptcrafter:getEnvSafety', () => {
  const execPath = process.execPath;
  const inDownloads = /[\\/](Downloads|downloads)[\\/]/.test(execPath);
  const zone = checkAndOptionallyClearZoneIdentifier();
  return { execPath, inDownloads, zoneIdentifierPresent: zone.zoneIdentifierPresent, zoneRemoved: zone.removed };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 600,
    minHeight: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
  preload: path.join(__dirname, 'preload.cjs'),
  // Enable built-in Chromium spellchecker
  spellcheck: true,
    },
    title: 'PromptCrafter',
  });

  // Hard guard against programmatic or edge-case resize attempts below limits
  win.on('will-resize', (event, newBounds) => {
    if (newBounds.width < 600 || newBounds.height < 800) {
      event.preventDefault();
    }
  });

  // Only open DevTools if explicitly requested via env flag during development
  if (isDev && process.env.PROMPTCRAFTER_ELECTRON_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Simple fix: Override console after page loads to filter autofill errors
  win.webContents.once('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      (function() {
        const originalError = console.error;
        console.error = function(...args) {
          const message = args.join(' ');
          // Filter out harmless DevTools autofill errors
          if (message.includes("Request Autofill.enable failed") || 
              message.includes("Request Autofill.setAddresses failed")) {
            return; // Just ignore these specific errors
          }
          originalError.apply(console, args);
        };
      })();
    `);
  });

  // Basic spellchecker language setup (can be expanded later)
  try {
    const langs = ['en-US'];
    win.webContents.session.setSpellCheckerLanguages(langs);
  } catch (e) { /* ignore if not available */ }

  // Track spellcheck toggle state manually
  let spellcheckEnabled = true;

  // Enhanced context menu with spellcheck suggestions
  win.webContents.on('context-menu', (event, params) => {
    /** @type {import('electron').MenuItemConstructorOptions[]} */
    const template = [];

    // If there is a misspelled word under cursor, show suggestions first
    if (params.misspelledWord) {
      const suggestions = (params.dictionarySuggestions || []).slice(0, 6);
      if (suggestions.length) {
        suggestions.forEach((s, idx) => {
          template.push({
            label: s,
            // Use bold for first suggestion for subtle emphasis
            accelerator: idx === 0 ? undefined : undefined,
            click: () => {
              try { win.webContents.replaceMisspelling(s); } catch(_) {}
            }
          });
        });
      } else {
        template.push({ label: 'No Suggestions', enabled: false });
      }
      template.push({ type: 'separator' });
      template.push({
        label: `Add to Dictionary: "${params.misspelledWord}"`,
        click: () => {
          try { win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord); } catch(_) {}
        }
      });
      template.push({ type: 'separator' });
    }

    // Standard editing actions
    template.push(
      { label: 'Undo', role: 'undo', enabled: params.editFlags.canUndo },
      { label: 'Redo', role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
      { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
      { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll },
      { type: 'separator' }
    );

    // Spelling submenu
    template.push({
      label: 'Spelling',
      submenu: [
        {
          label: 'Check Spelling While Typing',
          type: 'checkbox',
          checked: spellcheckEnabled,
          click: () => {
            spellcheckEnabled = !spellcheckEnabled;
            try {
              if (spellcheckEnabled) {
                win.webContents.session.setSpellCheckerLanguages(['en-US']);
              } else {
                // Clearing languages effectively disables suggestions
                win.webContents.session.setSpellCheckerLanguages([]);
              }
            } catch(_) {}
          }
        }
      ]
    });

    const contextMenu = Menu.buildFromTemplate(template);
    contextMenu.popup();
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : (nextServerPort ? `http://localhost:${nextServerPort}` : 'about:blank');
  win.loadURL(startUrl).catch(err => {
    console.error('Failed to load start URL', startUrl, err);
  });

  // Show a basic fallback message if something goes wrong in production
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (!isDev) {
      const msg = `Failed to load application (code ${errorCode}): ${errorDescription} URL=${validatedURL}`;
      console.error(msg);
      win.webContents.executeJavaScript(`document.body.innerHTML = '<div style="font-family:system-ui;padding:2rem;">'+${JSON.stringify('PromptCrafter failed to load.')}+'<br><pre style="white-space:pre-wrap;color:#900;">'+${JSON.stringify('Restart the app. If the issue persists, report this log:')}+'\n'+${JSON.stringify(' ')}+${JSON.stringify(msg)}+'</pre></div>'`);
    }
  });

  /** @param {any} details */
  win.webContents.setWindowOpenHandler((details) => {
    const url = details.url;
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  // Build a custom application menu that:
  // - Keeps File & Edit menus (standard roles)
  // - Keeps View but removes Developer Tools toggle
  // - Removes Help and Window menus entirely
  // - Adds macOS app menu if on darwin
  try {
    const isMac = process.platform === 'darwin';
    /** @type {import('electron').MenuItemConstructorOptions[]} */
    const template = [];
    if (isMac) {
      template.push({
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      });
    }
    template.push(
      {
        label: 'File',
        submenu: isMac ? [
          { role: 'close' }
        ] : [
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
          // Intentionally omitted: toggleDevTools
        ]
      }
    );
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } catch (e) {
    console.warn('[Electron] Failed to set custom menu:', e);
  }
  
  // Disable CSP in dev to allow Next.js hot reload inside Electron
  if (isDev) {
  /** @param {any} details @param {any} cb */
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:"]
        }
      });
    });
    createWindow(); // Create window immediately in dev mode
  } else {
    // Production: start embedded Next.js server (needed for dynamic routes like NextAuth)
    process.env.ELECTRON = '1';
  process.env.NODE_ENV = 'production';
    try {
  console.log('[Electron] Starting embedded Next.js server (packaged). __dirname=', __dirname, 'node', process.version, 'platform', process.platform, 'electron', process.versions.electron);
      let appDir = path.join(__dirname, '..');
      // If inside asar, adjust (Electron unpacks app.asar automatically for fs reads)
      if (appDir.includes('app.asar')) {
        console.log('[Electron] Detected asar packaging path');
      }
      const nextDir = path.join(appDir, '.next');
      if (!fs.existsSync(nextDir)) {
        console.warn('[Electron] .next directory missing at', nextDir);
      } else {
        try {
          const files = fs.readdirSync(nextDir).slice(0, 20);
          console.log('[Electron] .next contents sample:', files);
        } catch (e) { console.warn('[Electron] Could not list .next contents', e); }
      }
      let nextFactory = null;
      try {
        nextFactory = require('next');
      } catch (eReq) {
        console.error('[Electron] Failed to require("next") direct, attempting dist path', eReq?.stack || eReq);
        try {
          const alt = require('next/dist/server/next');
          nextFactory = typeof alt === 'function' ? alt : (typeof alt.default === 'function' ? alt.default : alt.next || alt.default?.next);
        } catch (eAlt) {
          console.error('[Electron] Secondary require attempt failed', eAlt?.stack || eAlt);
          throw eReq;
        }
      }
      if (typeof nextFactory !== 'function') {
        throw new Error('Resolved Next factory is not a function: type=' + typeof nextFactory);
      }
      const nextApp = nextFactory({ dev: false, dir: appDir });
      await nextApp.prepare();
      console.log('[Electron] Next.js prepared. Creating HTTP server...');
      const handle = nextApp.getRequestHandler();
      const server = http.createServer((req, res) => handle(req, res));
      await new Promise((resolve) => server.listen(0, () => resolve(undefined)));
      const addr = server.address();
      console.log('[Electron] Server listening on', addr);
      if (addr && typeof addr === 'object') nextServerPort = addr.port;
      createWindow();
    } catch (e) {
  console.error('Failed to start embedded Next.js server', e?.stack || e);
      let wrote = false;
      try {
        const errPath = path.join(app.getPath('userData'), 'startup-error.log');
        fs.mkdirSync(app.getPath('userData'), { recursive: true });
        fs.writeFileSync(errPath, `Error starting server:\n${e?.stack || e}`);
        wrote = true;
      } catch(_) { /* ignore */ }
      // Attempt static fallback: serve pre-rendered /chat if available
      try {
        const fallbackHtml = path.join(__dirname, '..', '.next', 'server', 'app', 'chat', 'index.html');
        if (fs.existsSync(fallbackHtml)) {
          console.log('[Electron] Using static fallback HTML');
          const staticServer = http.createServer((req, res) => {
            fs.createReadStream(fallbackHtml).pipe(res);
          });
            await new Promise(r => staticServer.listen(0, () => r(undefined)));
            const addr = staticServer.address();
            if (addr && typeof addr === 'object') nextServerPort = addr.port;
            createWindow();
            return;
        }
      } catch (e2) { console.error('Static fallback failed', e2); }
      dialog.showErrorBox('Startup Error', 'Failed to start internal server. '+(wrote?'See startup-error.log in app data.':''));
      app.quit();
      return;
    }
    return;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
