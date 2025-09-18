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
    <div className="modal-container">
      <div className="modal-backdrop-blur" onClick={() => setOpen(false)} />
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Data Directory</div>
          <button onClick={() => setOpen(false)} className="md-btn" style={{ padding: '6px 10px' }}>Close</button>
        </div>
        <div className="modal-body">
          <div className="data-location-container">
            <div className="data-location-section">
              <div className="data-location-label">Current Directory</div>
              <code className="data-location-code">{dir || 'Not set'}</code>
            </div>
            
            <div className="data-location-grid">
              <div className="data-location-item">
                <div className="data-location-item-label">Data File (Primary)</div>
                <div className="data-location-item-value">{dataFilePath || 'Pending'}</div>
              </div>
              <div className="data-location-item">
                <div className="data-location-item-label">Approx Size</div>
                <div className="data-location-item-value">{approxSizeBytes ? `${(approxSizeBytes/1024).toFixed(1)} KB` : '0 KB'}</div>
              </div>
            </div>
            
            <p className="data-location-description">
              This directory stores your local JSON data and vector index (for RAG, chats, presets, feedback). You can relocate it at any time. Existing data is <strong>not automatically migrated</strong>—manually move the folder if you want to retain prior content.
            </p>
            
            {error && <div className="data-location-error">{error}</div>}
            
            <div className="data-location-actions">
              <button onClick={choose} disabled={pending} className="md-btn md-btn--primary">
                {pending ? 'Selecting…' : 'Choose Directory'}
              </button>
              <button onClick={() => { void refreshInfo(); }} className="md-btn">Refresh</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;
};

export default DataDirectoryModal;
