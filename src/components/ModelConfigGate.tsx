"use client";
import { useEffect, useState } from 'react';
import { isElectronRuntime } from '@/lib/runtime';
import { CustomSelect } from './CustomSelect';

interface Props { children: React.ReactNode }

export default function ModelConfigGate({ children }: Props) {
  // Detect Electron at build/SSR via env; fall back to client runtime detection.
  const initialElectron = typeof process !== 'undefined' && (process.env.NEXT_PUBLIC_ELECTRON === '1' || process.env.ELECTRON === '1');
  const [electronMode, setElectronMode] = useState<boolean>(initialElectron);
  const [fetching, setFetching] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Store Ollama base URL separately so API provider never overwrites user local choice
  const [localBaseUrl, setLocalBaseUrl] = useState('http://localhost:11434');
  const [model, setModel] = useState<string>('');
  const [provider] = useState<'ollama'>('ollama');
  const [saving, setSaving] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [validating, setValidating] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [previouslyConfigured, setPreviouslyConfigured] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<'ollama' | null>(null);
  const [hasValidDefault, setHasValidDefault] = useState(false);
  const [showProviderSelection, setShowProviderSelection] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  // Legacy DB reset state removed (no longer using SQLite); keep placeholders if needed for future migration features
  // const [resettingDb, setResettingDb] = useState(false);
  // const [resetNote, setResetNote] = useState<string | null>(null);
  // const [showRestartModal, setShowRestartModal] = useState(false);
  // Ollama detection state
  const [ollamaCheckPerformed, setOllamaCheckPerformed] = useState(false);
  const [showOllamaMissingModal, setShowOllamaMissingModal] = useState(false);
  // Local test state for Ollama connection (mirrors Local Gemma3 Models modal behavior)
  const [testingLocal, setTestingLocal] = useState(false);
  const [localTestResult, setLocalTestResult] = useState<null | { success: boolean; url: string; models?: string[]; error?: string; duration?: number }>(null);
  // Available models from Ollama
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Client side enhancement: if we didn't know on SSR, detect now (may cause gating AFTER first paint in rare cases where env var missing) but we avoid unmounting children if already rendered to prevent hydration mismatch warnings.
  useEffect(() => {
    if (!electronMode && (isElectronRuntime() || process.env.NEXT_PUBLIC_ELECTRON === '1')) {
      setElectronMode(true);
    }
  }, [electronMode]);

  // Load configuration and default provider on startup
  useEffect(() => {
    if (!electronMode || loadedOnce) return;
    let cancelled = false;
    
    const load = async () => {
      setFetching(true);
      try {
        // Load both config and default provider preference
        const configRes = await fetch('/api/model/config').catch(() => null);

        if (cancelled) return;

        // Default to Ollama since it's the only option
        setDefaultProvider('ollama');

        // Load existing configuration if available
        if (configRes?.ok) {
          try {
            const configData = await configRes.json();
            if (configData?.config) {
              setConfig(configData.config);
              if (configData.config.provider === 'ollama') {
                setLocalBaseUrl(configData.config.baseUrl || 'http://localhost:11434');
                // Store the configured model, but don't set it as selected until we check availability
                const configuredModel = configData.config.model;
                
                // Load available models immediately
                testLocalConnection(configData.config.baseUrl, configuredModel);
              }
              setPreviouslyConfigured(true);

              // Always validate loaded config; only proceed if validation passes
              try {
                setValidating(true);
                const validateRes = await fetch('/api/model/validate');
                if (validateRes.ok) {
                  const validateData = await validateRes.json();
                  if (validateData.ok) {
                    setHasValidDefault(true);
                    setConnectionError(null);
                    setShowProviderSelection(false);
                    return;
                  } else {
                    setConnectionError(validateData.error || 'Connection failed');
                  }
                } else {
                  setConnectionError('Connection failed');
                }
              } catch (e) {
                setConnectionError('Connection failed');
              } finally {
                setValidating(false);
              }
            }
          } catch (e) {
            console.warn('Failed to parse config response:', e);
          }
        }

        // Show provider selection if no valid default
        setShowProviderSelection(true);
        
      } catch (err) {
        console.error('Failed to load configuration:', err);
        if (!cancelled) {
          setError('Failed to load Gemma 3 configuration');
          setShowProviderSelection(true);
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
          setLoadedOnce(true);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [electronMode, loadedOnce]);

  // App is gated if we're in electron mode and either:
  // 1. Still loading, OR
  // 2. Need to show provider selection, OR  
  // 3. Don't have a valid config yet
  const gated = electronMode && (fetching || showProviderSelection || (!hasValidDefault && !config));

  // Detect if Ollama is running when provider selection first appears (initial launch, not previously configured)
  useEffect(() => {
    if (!showProviderSelection) return;
    if (previouslyConfigured) return; // don't override existing settings
    if (ollamaCheckPerformed) return; // run once until user retries
    let cancelled = false;
    const detect = async () => {
      setOllamaCheckPerformed(true);
      // Only probe the default URL; if user already changed baseUrl, skip
      const defaultUrl = 'http://localhost:11434';
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(defaultUrl + '/api/tags', { signal: controller.signal });
        clearTimeout(t);
        if (cancelled) return;
        if (!res.ok) throw new Error('status ' + res.status);
        // success -> keep default base URL
      } catch (_err) {
        if (cancelled) return;
        // Not reachable: blank out the URL so user explicitly sets it and show modal
        setLocalBaseUrl('');
        setShowOllamaMissingModal(true);
      }
    };
    void detect();
    return () => { cancelled = true; };
  }, [showProviderSelection, provider, previouslyConfigured, ollamaCheckPerformed]);

  // Allow retry from modal
  const retryOllamaDetection = async () => {
    setOllamaCheckPerformed(false);
    setShowOllamaMissingModal(false);
    // trigger effect by manual check immediate
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2500);
      const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) {
        setLocalBaseUrl('http://localhost:11434');
      } else {
        setLocalBaseUrl('');
        setShowOllamaMissingModal(true);
      }
    } catch {
      setLocalBaseUrl('');
      setShowOllamaMissingModal(true);
    } finally {
      setOllamaCheckPerformed(true);
    }
  };

  // Test connection to local Ollama server using specified baseUrl (or current localBaseUrl if not provided)
  // If configuredModel is provided, it will be selected if found in available models
  const testLocalConnection = async (baseUrlParam?: string, configuredModel?: string) => {
    const url = (baseUrlParam || localBaseUrl || '').replace(/\/$/, '');
    if (!url) return;
    
    setTestingLocal(true);
    setLocalTestResult(null);
    const start = Date.now();
    
    try {
      const res = await fetch(`/api/model/available?baseUrl=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));
      const duration = Date.now() - start;
      
      if (data.error) {
        setLocalTestResult({ success: false, url, error: data.error, duration });
        setAvailableModels([]);
      } else {
        const models = data.available || [];
        setLocalTestResult({ success: true, url, models, duration });
        setAvailableModels(models);
        
        // If a configured model was provided, set it if it's in the available models
        // Otherwise, select the first available model if there are any
        if (configuredModel && models.includes(configuredModel)) {
          setModel(configuredModel);
        } else if (models.length > 0) {
          setModel(models[0]);
        } else {
          setModel('');
        }
      }
    } catch (e:any) {
      const duration = Date.now() - start;
      setLocalTestResult({ success: false, url, error: 'Connection failed', duration });
      setAvailableModels([]);
    } finally {
      setTestingLocal(false);
    }
  };

  return (
    <SystemPromptEditorWrapper>
      <OpenProviderSelectionListener onOpen={() => setShowProviderSelection(true)} />
      <div className="relative w-full h-full" data-model-gate={electronMode ? (config ? 'ready' : 'pending') : 'disabled'}>
        {!gated && children}
        {electronMode && gated && (
          <div className="fixed inset-0 z-40 flex items-center justify-center modal-backdrop-blur">
            {(fetching && !loadedOnce) || validating ? (
              <div className="text-center">
                <div className="text-light text-sm mb-2">
                  {validating ? 'Validating Gemma 3 connection…' : 'Loading Gemma 3 configuration…'}
                </div>
                <div className="text-surface-400 text-xs">
                  {validating ? 'Testing your default provider…' : 'Checking for saved settings…'}
                </div>
              </div>
            ) : showProviderSelection ? (
              <div className="w-full max-w-md rounded-xl border border-surface-a40 bg-surface-a10 p-6 text-light shadow-2xl" style={{ backgroundColor: '#1e2028', borderColor: '#2d3039' }}>
                <h1 className="mb-4 text-xl font-semibold">Configure Local Ollama</h1>
                <p className="mb-4 text-sm text-surface-400">PromptCrafter requires a local Ollama installation with Gemma 3 models for complete privacy.</p>
                {previouslyConfigured && connectionError && (
                  <div className="mb-3 rounded border border-primary-400/40 bg-primary-100/20 px-3 py-2 text-[11px] text-light">
                    Previous configuration detected but connection failed ({connectionError}). Update values and save again.
                  </div>
                )}
                <form data-provider-form="true" onSubmit={async (e) => {
                  e.preventDefault();
                  setSaving(true); setError(null);
                  try {
                    const payload = { provider: 'ollama', baseUrl: localBaseUrl, model, setDefault: !!setAsDefault };
                    
                    const res = await fetch('/api/model/config', { 
                      method: 'POST', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: JSON.stringify(payload) 
                    });
                    if (!res.ok) throw new Error('Save failed');
                    
                    // Default provider is saved server-side via setDefault flag above
                    
                    // After saving validate immediately
                    setValidating(true);
                    try {
                      const vr = await fetch('/api/model/validate');
                      if (vr.ok) {
                        const vjson = await vr.json();
                        if (vjson.ok) {
                          setConfig(payload);
                          setConnectionError(null);
                          setPreviouslyConfigured(true);
                          setShowProviderSelection(false);
                          try { window.dispatchEvent(new Event('MODEL_CHANGED')); } catch {}
                        } else {
                          const errorMsg = vjson.error || 'Connection failed';
                          if (errorMsg === 'model-not-found') {
                            setConnectionError(`Model "${model}" not found in Ollama. Run: ollama pull ${model}`);
                          } else {
                            setConnectionError(errorMsg);
                          }
                        }
                      } else {
                        setConnectionError('Connection failed');
                      }
                    } finally { setValidating(false); }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                  } finally { setSaving(false); }
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wide text-surface-400 mb-1">Provider</label>
                    <div className="w-full rounded-md border border-surface-300/30 bg-surface-200 px-3 py-2 text-sm text-surface-400">
                      🏠 Ollama (Local, Private)
                    </div>
                  </div>
                  
                  {/* Ollama configuration */}
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-surface-400 mb-1" htmlFor="baseUrl">Base URL (local only)</label>
                        <div className="flex gap-2">
                          <input
                            id="baseUrl"
                            value={localBaseUrl}
                            onChange={e => { setLocalBaseUrl(e.target.value); setLocalTestResult(null); }}
                            required
                            className="flex-1 rounded-md border border-surface-300/30 bg-surface-200 px-3 py-2 text-sm"
                            placeholder="http://localhost:11434"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => testLocalConnection()}
                            disabled={testingLocal || !localBaseUrl}
                            className="rounded-md border border-primary-300/50 bg-primary/20 px-3 py-2 text-xs font-medium text-light hover:bg-primary/30 disabled:opacity-40 interactive-glow"
                            title="Check for available Ollama models"
                          >{testingLocal ? '...' : 'Check for models'}</button>
                        </div>
                        {localTestResult && (
                          <div className={`mt-2 rounded-md border px-3 py-2 text-[11px] ${localTestResult.success ? 'border-primary-400/40 bg-primary-a0/20 text-primary-300' : 'border-red-500/40 bg-red-900/20 text-red-300'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span>{localTestResult.success ? 'Connection successful' : 'Connection failed'}{localTestResult.duration != null && ` (${localTestResult.duration}ms)`}</span>
                            </div>
                            {!localTestResult.success && localTestResult.error && (
                              <div className="mt-1">{localTestResult.error}</div>
                            )}
                            {localTestResult.success && localTestResult.models && (
                              <div className="mt-1 max-h-28 overflow-y-auto space-y-1">
                                {localTestResult.models.length ? localTestResult.models.map(m => (
                                  <div key={m} className="flex items-center gap-2 text-[10px] bg-surface-200/50 rounded px-2 py-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />
                                    <span className="truncate">{m}</span>
                                  </div>
                                )) : <div className="text-[10px] opacity-70">No models reported</div>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-surface-400 mb-1" htmlFor="model">Ollama Model</label>
                        <CustomSelect
                          value={model}
                          onChange={(value) => setModel(value as string)}
                          options={
                            availableModels.length > 0 
                              ? availableModels.map(m => ({ value: m, label: m }))
                              : [{ value: "", label: "First check for available models", disabled: true }]
                          }
                          className="w-full"
                          disabled={availableModels.length === 0}
                        />
                      </div>
                      <div className="text-[11px] text-surface-400 leading-relaxed">
                        {availableModels.length === 0 ? (
                          <>Click "Check for models" to find available Ollama models. If none are found, install Ollama and pull a compatible model.</>
                        ) : (
                          <>Found {availableModels.length} available model{availableModels.length !== 1 ? 's' : ''}. Select one from the dropdown.</>
                        )}
                      </div>
                  
                  {(error || connectionError) && <div className="rounded border border-primary-400/40 bg-primary/30 px-3 py-2 text-xs text-light">{error || connectionError}</div>}
                  
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="setAsDefault"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                      className="rounded border-surface-300 bg-surface-200 text-primary"
                    />
                    <label htmlFor="setAsDefault" className="text-xs text-surface-400">
                      Set as default (auto-load this provider on startup)
                    </label>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <button 
                      disabled={saving || validating || (!model || model.trim() === '')}
                      className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-light disabled:opacity-60 interactive-glow"
                      title={(!model || model.trim() === '') ? 'Please check for models and select one' : undefined}
                    >
                      {saving || validating ? 'Validating…' : 'Start PromptCrafter'}
                    </button>
                  </div>
                </form>
                
                {/* Privacy consent modal removed - local only */}
              </div>
            ) : null}
            {showOllamaMissingModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop-blur">
                <div className="w-full max-w-lg rounded-xl border border-surface-a40 bg-surface-a10 p-6 text-light shadow-2xl" style={{ backgroundColor: '#1e2028', borderColor: '#2d3039' }}>
                  <h2 className="mb-3 text-lg font-semibold text-primary-300">Ollama Not Detected</h2>
                  <div className="mb-4 space-y-3 text-sm text-surface-400">
                    <p>Hmm you don't seem to have <strong>Ollama</strong> running or installed.</p>
                    <p>Make sure it is open and running in the background with your <code>gemma3</code> models pulled and downloaded.</p>
                    <p>If you don't have Ollama, download it here: <a className="text-primary-300 underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">https://ollama.com/download</a></p>
                    <p className="text-[11px] text-surface-400">After installing & starting Ollama, pull a model e.g.: <code>ollama pull gemma3:1b</code></p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={() => setShowOllamaMissingModal(false)} className="flex-1 rounded-md bg-surface-200 py-2 text-sm font-medium hover:bg-surface-300 interactive-glow">Close</button>
                    <button onClick={retryOllamaDetection} className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-light hover:bg-primary-200 interactive-glow">Retry Detection</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SystemPromptEditorWrapper>
  );
}

function SystemPromptEditorWrapper({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [build, setBuild] = useState('');
  const [enhance, setEnhance] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/system-prompts');
        if (res.ok) {
          const data = await res.json();
            setBuild(data.build || '');
            setEnhance(data.enhance || '');
        }
      } finally { setLoading(false); }
    };
    void load();
  }, [open]);

  return (
    <>
  {/* System Prompts open controlled via global event */}
  <OpenSystemPromptsListener onOpen={() => setOpen(true)} />
      {children}
      {open && (
        <div className="modal-container">
          <div className="modal-backdrop-blur" onClick={() => setOpen(false)} />
          <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit System Prompts</div>
              <button onClick={() => setOpen(false)} className="md-btn" style={{ padding: '6px 10px' }}>Close</button>
            </div>
            <div className="modal-body">
              <div className="system-prompts-container">
                {loading ? <div className="text-sm">Loading…</div> : (
                  <form className="system-prompts-form" onSubmit={async (e) => {
                    e.preventDefault();
                    setSaving(true); setError(null);
                    try {
                      const res = await fetch('/api/system-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ build, enhance }) });
                      if (!res.ok) throw new Error('Save failed');
                      setOpen(false);
                    } catch (err:any) { setError(err.message || 'Unknown error'); } finally { setSaving(false); }
                  }}>
                    <div className="system-prompts-field">
                      <label className="system-prompts-label">Build Mode Prompt</label>
                      <textarea value={build} onChange={e => setBuild(e.target.value)} className="system-prompts-textarea" />
                    </div>
                    <div className="system-prompts-field">
                      <label className="system-prompts-label">Enhance Mode Prompt</label>
                      <textarea value={enhance} onChange={e => setEnhance(e.target.value)} className="system-prompts-textarea" />
                    </div>
                    {error && <div className="system-prompts-error">{error}</div>}
                    <div className="system-prompts-actions">
                      <div className="system-prompts-actions-left">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Restore default system prompts? This will overwrite your current edits.')) return;
                            setSaving(true); setError(null);
                            try {
                              const res = await fetch('/api/system-prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
                              if (!res.ok) throw new Error('Reset failed');
                              const data = await res.json();
                              if (data.build) setBuild(data.build);
                              if (data.enhance) setEnhance(data.enhance);
                            } catch (err:any) {
                              setError(err.message || 'Unknown error');
                            } finally { setSaving(false); }
                          }}
                          className="md-btn"
                        >Restore Defaults</button>
                      </div>
                      <div className="system-prompts-actions-right">
                        <button type="button" onClick={() => setOpen(false)} className="md-btn">Cancel</button>
                        <button disabled={saving} className="md-btn md-btn--primary">{saving ? 'Saving…' : 'Save'}</button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OpenSystemPromptsListener({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    const handler = () => onOpen();
    window.addEventListener('open-system-prompts', handler as any);
    return () => window.removeEventListener('open-system-prompts', handler as any);
  }, [onOpen]);
  return null;
}

function OpenProviderSelectionListener({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    const handler = () => onOpen();
    window.addEventListener('open-provider-selection', handler as any);
    return () => window.removeEventListener('open-provider-selection', handler as any);
  }, [onOpen]);
  return null;
}

