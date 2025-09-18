"use client";
import React from "react";
import { isElectronRuntime } from '@/lib/runtime';

declare global {
  interface Window {
    promptcrafter?: {
  getConfig: () => Promise<{ dataDir?: string }>;
  isDbConfigured: () => Promise<{ configured: boolean; writable?: boolean; dataDir?: string }>;
  chooseDataDir: () => Promise<{ ok: boolean; dataDir?: string; error?: string }>;
  getDbInfo: () => Promise<{ ok: boolean; dataDir?: string; dbPath?: string; sizeBytes?: number; error?: string; writable?: boolean }>;
  getEnvSafety?: () => Promise<{ execPath: string; inDownloads: boolean; zoneIdentifierPresent: boolean; zoneRemoved: boolean }>; 
  resetDataDir?: () => Promise<{ ok: boolean; dataDir?: string; dbPath?: string; error?: string; note?: string; cancelled?: boolean }>;
  restartApp?: () => Promise<{ ok: boolean; error?: string }>;
    };
  }
}

interface Props { 
  children: React.ReactNode;
}

export default function DatabaseSetupGate({ children }: Props) {
  // Detect Electron at build/SSR via env; fall back to client runtime detection.
  const initialElectron = typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_ELECTRON === '1' || process.env.ELECTRON === '1');
  const [electronMode, setElectronMode] = React.useState<boolean>(initialElectron);
  const [checking, setChecking] = React.useState(false);
  const [configured, setConfigured] = React.useState(false);
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const [selecting, setSelecting] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [envWarning, setEnvWarning] = React.useState<string>("");
  const [writable, setWritable] = React.useState<boolean | null>(null);

  // Client side enhancement: if we didn't know on SSR, detect now
  React.useEffect(() => {
    if (!electronMode && (isElectronRuntime() || process.env.NEXT_PUBLIC_ELECTRON === '1')) {
      setElectronMode(true);
    }
  }, [electronMode]);

  // Fetch environment safety diagnostics (download location, zone identifier) once
  React.useEffect(() => {
    if (!electronMode) return;
    if (!(window as any).promptcrafter?.getDbInfo) return; // wait for preload readiness
    (async () => {
      try {
        // @ts-ignore
        if (window.promptcrafter?.getEnvSafety) {
          // @ts-ignore
          const envInfo = await window.promptcrafter.getEnvSafety();
          if (envInfo.inDownloads) {
            setEnvWarning(prev => prev + 'The app executable is running from your Downloads folder. Move it to Program Files or another permanent location to avoid Windows blocking writes. ');
          }
          if (envInfo.zoneIdentifierPresent && !envInfo.zoneRemoved) {
            setEnvWarning(prev => prev + 'Windows SmartScreen mark detected; write operations may be restricted. Right-click the .exe, open Properties, and check "Unblock" if available. ');
          } else if (envInfo.zoneIdentifierPresent && envInfo.zoneRemoved) {
            setEnvWarning(prev => prev + 'Removed Windows SmartScreen quarantine mark for this session. ');
          }
        }
      } catch (_) { /* ignore */ }
    })();
  }, [electronMode]);

  // Check if database is configured on startup
  React.useEffect(() => {
    if (!electronMode || loadedOnce) return;
    
    let cancelled = false;
    
    const checkDbStatus = async () => {
      setChecking(true);
      
      // Add a small delay to ensure Electron IPC handlers are fully registered
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        if (!window.promptcrafter?.isDbConfigured) {
          throw new Error('Electron IPC not available');
        }
        
  const result = await window.promptcrafter.isDbConfigured();
        if (cancelled) return;
        
        if (result?.configured) {
          setConfigured(true);
          setWritable(typeof result.writable === 'boolean' ? result.writable : true);
        } else {
          // Database is not configured - show the setup UI
          setConfigured(false);
          if (typeof result?.writable === 'boolean') setWritable(result.writable);
        }
      } catch (err: any) {
        console.error('Failed to check database configuration:', err);
        if (!cancelled) {
          setError(`Failed to check database configuration: ${err?.message || 'Unknown error'}`);
          // Assume not configured if we can't check
          setConfigured(false);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
          setLoadedOnce(true);
        }
      }
    };

    void checkDbStatus();
    return () => { cancelled = true; };
  }, [electronMode, loadedOnce]);

  const handleChooseDirectory = async () => {
    setError("");
    setSelecting(true);
    try {
      if (!window.promptcrafter?.chooseDataDir) {
        throw new Error('Electron IPC not available - chooseDataDir method missing');
      }
      
      const result = await window.promptcrafter.chooseDataDir();
      if (result?.ok && result.dataDir) {
        // Database location selected successfully, now refresh the server-side connection
        try {
          const refreshResponse = await fetch('/api/admin/db-refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (refreshResponse.ok) {
            setConfigured(true);
            setWritable(true);
          } else {
            const refreshData = await refreshResponse.json();
            setError(`Database setup failed: ${refreshData.error || 'Unknown error'}`);
          }
        } catch (refreshError: any) {
          setError(`Failed to initialize database: ${refreshError.message || 'Unknown error'}`);
        }
      } else if (!result?.ok) {
        if ((result as any)?.error) {
          setError((result as any).error);
        } else {
          setError("Directory selection was canceled");
        }
      }
    } catch (err: any) {
      console.error('Directory selection error:', err);
      setError(err?.message || "Failed to select directory");
    } finally {
      setSelecting(false);
    }
  };

  // Gate the app if we're in electron mode and database isn't configured yet
  const gated = electronMode && !configured;

  // If not in electron mode, don't gate anything
  if (!electronMode) {
    return <>{children}</>;
  }

  // If database is configured, render children
  if (configured) {
    // If configured but not writable (edge case), force re-selection overlay
    if (writable === false) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop-blur">
          <div className="w-full max-w-lg rounded-xl border border-primary-a20/40 bg-surface-100 p-6 text-light shadow-2xl">
            <h1 className="mb-3 text-2xl font-semibold text-primary-a20">Database Folder Not Writable</h1>
            <p className="text-sm mb-4 text-surface-300">The selected data folder can't be written to. Choose a different location (avoid Downloads, Program Files, or read-only folders).</p>
            {envWarning && <div className="mb-4 rounded border border-accentA0/40 bg-accentA0/20 p-3 text-xs text-accentA0 whitespace-pre-line">{envWarning}</div>}
            {error && <div className="mb-4 rounded border border-primary-a20/40 bg-primary-a20/20 p-3 text-xs text-primary-a20">{error}</div>}
            <div className="flex justify-center">
              <button onClick={handleChooseDirectory} disabled={selecting} className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-light hover:bg-primary-a10 disabled:opacity-60 disabled:cursor-not-allowed">{selecting ? 'Selecting Folder…' : 'Choose Different Folder'}</button>
            </div>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  // Show the database setup UI
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop-blur">
      {checking && !loadedOnce ? (
        <div className="text-center">
          <div className="text-surface-200 text-sm mb-2">Checking database configuration…</div>
          <div className="text-surface-500 text-xs">Please wait while we verify your setup…</div>
        </div>
      ) : (
        <div className="w-full max-w-lg rounded-xl border border-surface-400/30 bg-surface-100 p-6 text-light shadow-2xl">
          <div className="mb-6 text-center">
            <h1 className="mb-2 text-2xl font-semibold">Welcome to PromptCrafter</h1>
            <p className="text-sm text-surface-300">Let's set up your database location</p>
          </div>
          
          <div className="mb-6 space-y-4">
            <div className="rounded-lg border border-primary-300/40 bg-primary-300/20 p-4">
              <h3 className="mb-2 text-sm font-medium text-primary-300">📂 Choose Your Data Location</h3>
              <p className="mb-3 text-xs text-primary-300 leading-relaxed">
                PromptCrafter stores your chats, presets, and settings as local JSON data and a vector index. 
                Choose where you'd like this data to be saved.
              </p>
              <ul className="text-xs text-primary-300 space-y-1 ml-4 list-disc">
                <li>Pick any folder on your computer</li>
                <li>The database file will be created automatically</li>
                <li>You can move this location later if needed</li>
                <li>Your data stays completely private and local</li>
              </ul>
            </div>
            
            <div className="rounded-lg border border-accentA0/40 bg-accentA0/20 p-4">
              <h3 className="mb-2 text-sm font-medium text-accentA0">💡 Recommended Locations</h3>
              <ul className="text-xs text-accentA0 space-y-1 ml-4 list-disc">
                <li><strong>Documents folder:</strong> Easy to find and backup</li>
                <li><strong>Dedicated folder:</strong> Create "PromptCrafter Data" somewhere convenient</li>
                <li><strong>Cloud sync folder:</strong> Sync across devices (Dropbox, OneDrive, etc.)</li>
              </ul>
            </div>
            {envWarning && (
              <div className="rounded-lg border border-accentA0/40 bg-accentA0/25 p-4 text-xs text-accentA0 whitespace-pre-line">
                {envWarning}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded border border-primary-a20/40 bg-primary-a20/20 px-3 py-2 text-xs text-primary-a20">
              <details>
                <summary className="cursor-pointer">Error Details</summary>
                <div className="mt-2 text-xs">
                  <div><strong>Error:</strong> {error}</div>
                  <div><strong>Electron detected:</strong> {electronMode ? 'Yes' : 'No'}</div>
                  <div><strong>IPC available:</strong> {typeof window !== 'undefined' && window.promptcrafter ? 'Yes' : 'No'}</div>
                  <div><strong>Methods available:</strong></div>
                  <ul className="ml-4 list-disc">
                    <li>isDbConfigured: {typeof window !== 'undefined' && window.promptcrafter?.isDbConfigured ? 'Yes' : 'No'}</li>
                    <li>chooseDataDir: {typeof window !== 'undefined' && window.promptcrafter?.chooseDataDir ? 'Yes' : 'No'}</li>
                  </ul>
                </div>
              </details>
            </div>
          )}

          <div className="flex justify-center">
            <button 
              onClick={handleChooseDirectory}
              disabled={selecting}
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-light hover:bg-primary-a10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {selecting ? 'Selecting Folder…' : '📂 Choose Database Location'}
            </button>
          </div>
          
          <p className="mt-4 text-center text-xs text-surface-500">
            This setup only happens once. You can change the location later from the settings.
          </p>
        </div>
      )}
    </div>
  );
}
