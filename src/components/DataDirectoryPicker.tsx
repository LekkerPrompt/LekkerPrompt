"use client";
import React from "react";

declare global {
  interface Window {
    promptcrafter?: {
  getConfig: () => Promise<{ dataDir?: string }>;
  isDbConfigured: () => Promise<{ configured: boolean; writable?: boolean; dataDir?: string }>;
  chooseDataDir: () => Promise<{ ok: boolean; dataDir?: string; error?: string }>;
	getDbInfo: () => Promise<{ ok: boolean; dataDir?: string; dbPath?: string; sizeBytes?: number; error?: string; writable?: boolean }>;
  resetDataDir?: () => Promise<{ ok: boolean; dataDir?: string; dbPath?: string; error?: string; note?: string; cancelled?: boolean }>;
	getEnvSafety?: () => Promise<{ execPath: string; inDownloads: boolean; zoneIdentifierPresent: boolean; zoneRemoved: boolean }>;
  restartApp?: () => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

export const DataDirectoryModal: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [dir, setDir] = React.useState<string>("");
  const [dataFilePath, setDataFilePath] = React.useState<string>("");
  const [approxSizeBytes, setApproxSizeBytes] = React.useState<number>(0);
  const [error, setError] = React.useState<string>("");
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
        setDataFilePath(info.dbPath || '');
        setApproxSizeBytes(info.sizeBytes || 0);
      } else if (info?.dataDir) {
        setDir(info.dataDir);
      }
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

  // Legacy mismatch logic removed (single data directory now)

  return open ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-[92vw] max-w-lg rounded-xl border border-white/10 bg-gray-900 p-5 text-gray-100 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Data Directory</h2>
          <button onClick={() => setOpen(false)} className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs">Close</button>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Current Directory</div>
            <code className="block whitespace-pre-wrap break-all rounded bg-gray-800/60 p-2 text-xs">{dir || 'Not set'}</code>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-400 uppercase tracking-wide mb-1">Data File (Primary)</div>
              <div className="break-all">{dataFilePath || 'Pending'}</div>
            </div>
            <div>
              <div className="text-gray-400 uppercase tracking-wide mb-1">Approx Size</div>
              <div>{approxSizeBytes ? `${(approxSizeBytes/1024).toFixed(1)} KB` : '0 KB'}</div>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-gray-300">
            This directory stores your local JSON data and vector index (for RAG, chats, presets, feedback). You can relocate it at any time. Existing data is <strong>not automatically migrated</strong>—manually move the folder if you want to retain prior content.
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

export default DataDirectoryModal;
