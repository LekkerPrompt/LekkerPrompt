"use client";
import React from "react";

declare global {
  interface Window {
    promptcrafter?: {
      getConfig: () => Promise<{ dataDir?: string }>;
      isDbConfigured: () => Promise<{ configured: boolean }>;
      chooseDataDir: () => Promise<{ ok: boolean; dataDir?: string }>;
  getDbInfo: () => Promise<{ ok: boolean; dataDir?: string; dbPath?: string; sizeBytes?: number; error?: string }>;
    };
  }
}

export const DbLocationModalWrapper: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [dir, setDir] = React.useState<string>("");
  const [dbPath, setDbPath] = React.useState<string>("");
  const [sizeBytes, setSizeBytes] = React.useState<number>(0);
  const [error, setError] = React.useState<string>("");
  const [serverDbPath, setServerDbPath] = React.useState<string>("");
  const [serverDbSize, setServerDbSize] = React.useState<number>(0);
  const [serverExists, setServerExists] = React.useState<boolean>(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-db-location', handler);
    return () => window.removeEventListener('open-db-location', handler);
  }, []);

  const isElectron = typeof window !== 'undefined' && !!window.promptcrafter;

  const refreshInfo = React.useCallback(async () => {
    if (!isElectron) return;
    try {
      const info = await window.promptcrafter?.getDbInfo?.();
      if (info?.ok) {
        setDir(info.dataDir || '');
        setDbPath(info.dbPath || '');
        setSizeBytes(info.sizeBytes || 0);
      } else if (info?.dataDir) {
        setDir(info.dataDir);
      }
      // fetch server-side actual DATABASE_URL resolution
      try {
        const res = await fetch('/api/admin/db-info');
        if (res.ok) {
          const json = await res.json();
          if (json.activeDbFile) setServerDbPath(json.activeDbFile);
          if (typeof json.activeDbSizeBytes === 'number') setServerDbSize(json.activeDbSizeBytes);
          setServerExists(!!json.activeDbExists);
        }
      } catch { /* ignore */ }
    } catch (e:any) { /* ignore */ }
  }, [isElectron]);

  React.useEffect(() => { if (open) void refreshInfo(); }, [open, refreshInfo]);

  if (!isElectron) return null;

  const choose = async () => {
    setError("");
    setPending(true);
    try {
      const res = await window.promptcrafter?.chooseDataDir();
      if (res?.ok && res.dataDir) {
        setDir(res.dataDir);
      } else if (!res?.ok) {
        setError("Selection canceled");
      }
    } catch (e:any) {
      setError(e?.message || "Failed to choose directory");
    } finally {
      setPending(false);
    }
  };

  // Normalize paths (Windows + mixed slash styles) for comparison
  const normalizePath = React.useCallback((p: string) => {
    if (!p) return '';
    // Remove surrounding quotes if any
    let out = p.replace(/^"|"$/g, '');
    // Convert backslashes to forward
    out = out.replace(/\\/g, '/');
    // Collapse multiple slashes (but keep leading protocol e.g., file:// if present)
    out = out.replace(/(^[a-zA-Z]+:)?\/+/g, (m, proto) => proto ? proto + '/' : '/');
    // Lowercase drive letter (Windows) for case-insensitive compare
    out = out.replace(/^([a-zA-Z]):/, (m, d) => d.toLowerCase() + ':');
    return out.trim();
  }, []);

  const mismatch = !!(serverDbPath && dbPath && normalizePath(serverDbPath) !== normalizePath(dbPath));
  const serverExistsNormalized = serverExists; // semantic alias

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-[92vw] max-w-lg rounded-xl border border-white/10 bg-gray-900 p-5 text-gray-100 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Database Location</h2>
          <button onClick={() => setOpen(false)} className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs">Close</button>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Current Directory</div>
            <code className="block whitespace-pre-wrap break-all rounded bg-gray-800/60 p-2 text-xs">{dir || 'Not set'}</code>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-400 uppercase tracking-wide mb-1">Configured (Electron)</div>
              <div className="break-all">{dbPath || 'electron.db (pending)'}</div>
            </div>
            <div>
              <div className="text-gray-400 uppercase tracking-wide mb-1">Configured Size</div>
              <div>{sizeBytes ? `${(sizeBytes/1024).toFixed(1)} KB` : '0 KB'}</div>
            </div>
            <div>
              <div className="text-gray-400 uppercase tracking-wide mb-1">Active (Server)</div>
              <div className="break-all">{serverDbPath || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-gray-400 uppercase tracking-wide mb-1">Active Size</div>
              <div>{serverDbSize ? `${(serverDbSize/1024).toFixed(1)} KB` : '0 KB'}</div>
            </div>
          </div>
          {mismatch && (
            <div className="rounded border border-amber-500/40 bg-amber-900/30 px-3 py-2 text-[11px] text-amber-200">
              Mismatch detected: Electron configured directory differs from server active DB file. The app may have been started before a directory change. Restart Electron to apply or migrate data manually.
            </div>
          )}
          {(!serverExistsNormalized && serverDbPath) && (
            <div className="rounded border border-red-500/40 bg-red-900/30 px-3 py-2 text-[11px] text-red-200">
              Active DB file not found yet. It will be created on first write. If data appears in the UI, writes may be pointed at a different path. Verify permissions.
            </div>
          )}
          <p className="text-xs leading-relaxed text-gray-300">
            This SQLite database stores chats, presets, and system prompt overrides locally. Changing the directory updates where new reads/writes occur. Existing data is <strong>not automatically migrated</strong>—manually move the database file if you want to retain prior content.
          </p>
          {error && <div className="rounded border border-red-500/40 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={choose} disabled={pending} className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {pending ? 'Selecting…' : 'Choose Directory'}
            </button>
            <button onClick={() => { void refreshInfo(); }} className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs">Refresh</button>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default DbLocationModalWrapper;
