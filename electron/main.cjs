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
let pendingDataDirInfo = null; // one-time info message to show after window creation

// Ensure a stable userData path labeled "PromptCrafter" in dev and prod so
// both Electron and the Next.js dev server read the same config file location.
try {
  const desiredUserData = path.join(app.getPath('appData'), 'PromptCrafter');
  app.setPath('userData', desiredUserData);
} catch (_) { /* ignore */ }

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

// Load or create data directory: default to Documents/PromptCrafter for all OS
const cfg = loadConfig();

// Expose userData path to renderer/server processes for unified config resolution
try { process.env.PROMPTCRAFTER_USER_DATA_DIR = app.getPath('userData'); } catch(_) {}

function getDefaultDataDir() {
  try {
    const docs = app.getPath('documents');
    return path.join(docs, 'PromptCrafter');
  } catch (_) {
    // Last resort if documents is unavailable
    return path.join(app.getPath('userData'), 'PromptCrafter');
  }
}

function ensureDirWritable(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return canWriteToDir(dir);
}

function resolveAndPersistDataDirInternal() {
  try {
    const configured = cfg.dataDir;
    if (configured) {
      if (ensureDirWritable(configured)) {
        dataDirPath = configured;
      } else {
        const fallback = getDefaultDataDir();
        if (ensureDirWritable(fallback)) {
          dataDirPath = fallback;
          cfg.dataDir = fallback;
          saveConfig(cfg);
          pendingDataDirInfo = `Data folder was missing or not writable. Using default at: ${fallback}`;
        } else {
          const lastResort = path.join(app.getPath('userData'), 'PromptCrafter');
          if (ensureDirWritable(lastResort)) {
            dataDirPath = lastResort;
            cfg.dataDir = lastResort;
            saveConfig(cfg);
            pendingDataDirInfo = `Data folder was not writable. Using app data at: ${lastResort}`;
          }
        }
      }
    } else {
      const fallback = getDefaultDataDir();
      if (ensureDirWritable(fallback)) {
        dataDirPath = fallback;
        cfg.dataDir = fallback;
        saveConfig(cfg);
        pendingDataDirInfo = `Created data folder at: ${fallback}`;
      } else {
        const lastResort = path.join(app.getPath('userData'), 'PromptCrafter');
        if (ensureDirWritable(lastResort)) {
          dataDirPath = lastResort;
          cfg.dataDir = lastResort;
          saveConfig(cfg);
          pendingDataDirInfo = `Created data folder at: ${lastResort}`;
        }
      }
    }
    if (dataDirPath) {
      // Expose for any backend code that reads env, but we do not rely on this
      process.env.DATA_DIR = dataDirPath;
    }
  } catch (e) {
    console.warn('[Electron] Failed to resolve data directory', e);
  }
  return dataDirPath;
}

resolveAndPersistDataDirInternal();

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
ipcMain.handle('promptcrafter:getConfig', () => {
  try {
    return { dataDir: dataDirPath };
  } catch (e) {
    return { dataDir: null };
  }
});
ipcMain.handle('promptcrafter:isDbConfigured', () => {
  try {
    const cfg = loadConfig();
    const dir = cfg.dataDir || dataDirPath;
    const writable = !!dir && canWriteToDir(dir);
    return { configured: !!(dir && writable), writable, dataDir: dir };
  } catch (e) {
    return { configured: false, error: e?.message || 'unknown', writable: false };
  }
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
  try {
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
    return { ok: true, dataDir: dataDirPath };
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to select directory' };
  }
});
ipcMain.handle('promptcrafter:getEnvSafety', () => {
  const execPath = process.execPath;
  const inDownloads = /[\\/](Downloads|downloads)[\\/]/.test(execPath);
  const zone = checkAndOptionallyClearZoneIdentifier();
  return { execPath, inDownloads, zoneIdentifierPresent: zone.zoneIdentifierPresent, zoneRemoved: zone.removed };
});

// Window controls for custom frameless UI
ipcMain.handle('promptcrafter:window:minimize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.minimize();
});
ipcMain.handle('promptcrafter:window:maximizeToggle', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  if (w.isMaximized()) w.unmaximize(); else w.maximize();
});
ipcMain.handle('promptcrafter:window:close', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (w) w.close();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 600,
    minHeight: 800,
    ...(process.platform === 'darwin' ? { frame: false } : {}),
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
    try {
      if (pendingDataDirInfo) {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Data Folder Initialized',
          message: pendingDataDirInfo,
        }).catch(() => {});
        pendingDataDirInfo = null;
      }
    } catch (_) { /* ignore */ }
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

    // Developer tools entries
    template.push({ type: 'separator' });
    template.push({
      label: 'Inspect Element',
      click: () => {
        try { win.webContents.inspectElement(params.x, params.y); } catch(_) {}
      }
    });
    template.push({
      label: 'Open DevTools',
      click: () => {
        try { win.webContents.openDevTools({ mode: 'detach' }); } catch(_) {}
      }
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
  
  // Secure CSP configuration for both dev and production
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://localhost:*",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' http://localhost:* https://localhost:* https://fonts.googleapis.com https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'X-XSS-Protection': ['1; mode=block']
      }
    });
  });

  if (isDev) {
    createWindow(); // Create window immediately in dev mode
  } else {
    // Production: start embedded Next.js server (needed for dynamic routes like NextAuth)
    process.env.ELECTRON = '1';
  process.env.NODE_ENV = 'production';
    try {
  console.log('[Electron] Starting embedded Next.js server (packaged). __dirname=', __dirname, 'node', process.version, 'platform', process.platform, 'electron', process.versions.electron);
      let appDir = path.join(__dirname, '..');
      // Determine the correct application directory that contains .next when packaged
      const resourcesDir = process.resourcesPath || path.join(__dirname, '..', '..');
      const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
      const candidateDirs = [
        unpackedDir,
        appDir
      ];
      let nextAppDir = candidateDirs.find(d => {
        try { return fs.existsSync(path.join(d, '.next')); } catch (_) { return false; }
      }) || appDir;
      const nextDir = path.join(nextAppDir, '.next');
      if (!fs.existsSync(nextDir)) {
        console.warn('[Electron] .next directory missing at', nextDir);
      } else {
        try {
          const files = fs.readdirSync(nextDir).slice(0, 20);
          console.log('[Electron] .next contents sample:', files);
        } catch (e) { console.warn('[Electron] Could not list .next contents', e); }
      }
      try { process.chdir(nextAppDir); } catch(_) {}
      // Robustly resolve Next factory from packaged node_modules
      let nextFactory = null;
      const nextCandidates = [
        path.join(unpackedDir, 'node_modules', 'next', 'dist', 'server', 'next.js'),
        path.join(nextAppDir, 'node_modules', 'next', 'dist', 'server', 'next.js')
      ];
      for (const p of nextCandidates) {
        try {
          if (fs.existsSync(p)) {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            const mod = require(p);
            nextFactory = typeof mod === 'function' ? mod : (typeof mod.default === 'function' ? mod.default : mod.next || mod.default?.next);
            break;
          }
        } catch (_) { /* ignore and continue */ }
      }
      if (!nextFactory) {
        try { nextFactory = require('next'); } catch (eReq) {
          console.error('[Electron] Failed to require("next") direct, attempting dist path', eReq?.stack || eReq);
          try {
            const alt = require('next/dist/server/next');
            nextFactory = typeof alt === 'function' ? alt : (typeof alt.default === 'function' ? alt.default : alt.next || alt.default?.next);
          } catch (eAlt) {
            console.error('[Electron] Secondary require attempt failed', eAlt?.stack || eAlt);
            throw eReq;
          }
        }
      }
      if (typeof nextFactory !== 'function') {
        throw new Error('Resolved Next factory is not a function: type=' + typeof nextFactory);
      }
      const nextApp = nextFactory({ dev: false, dir: nextAppDir });
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
      // Attempt static fallback: serve pre-rendered HTML if available
      try {
        const htmlCandidates = [
          path.join(nextAppDir, '.next', 'server', 'app', 'chat', 'index.html'),
          path.join(nextAppDir, '.next', 'server', 'app', 'index.html')
        ];
        const fallbackHtml = htmlCandidates.find(p => { try { return fs.existsSync(p); } catch(_) { return false; } });
        if (fallbackHtml) {
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
  app.quit();
});
