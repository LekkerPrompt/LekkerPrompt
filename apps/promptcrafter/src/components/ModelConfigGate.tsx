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
  const [model, setModel] = useState<'gemma3:1b' | 'gemma3:4b' | 'gemma3:12b' | 'gemma3:27b'>('gemma3:1b');
  const [provider, setProvider] = useState<'ollama' | 'openrouter-proxy'>('ollama');
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [validating, setValidating] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [previouslyConfigured, setPreviouslyConfigured] = useState(false);
  const [defaultProvider, setDefaultProvider] = useState<'ollama' | 'openrouter-proxy' | null>(null);
  const [hasValidDefault, setHasValidDefault] = useState(false);
  const [showProviderSelection, setShowProviderSelection] = useState(false);
  const [setAsDefault, setSetAsDefault] = useState(false);
  // Ollama detection state
  const [ollamaCheckPerformed, setOllamaCheckPerformed] = useState(false);
  const [showOllamaMissingModal, setShowOllamaMissingModal] = useState(false);
  // Local test state for Ollama connection (mirrors Local Gemma3 Models modal behavior)
  const [testingLocal, setTestingLocal] = useState(false);
  const [localTestResult, setLocalTestResult] = useState<null | { success: boolean; url: string; models?: string[]; error?: string; duration?: number }>(null);

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
        const [configRes, defaultRes] = await Promise.all([
          fetch('/api/model/config').catch(() => null),
          fetch('/api/model/default-provider').catch(() => null)
        ]);

        if (cancelled) return;

        // Check if we have a valid default provider setting
        let defaultProviderSetting = null;
        if (defaultRes?.ok) {
          try {
            const defaultData = await defaultRes.json();
            defaultProviderSetting = defaultData.provider || null;
          } catch (e) {
            console.warn('Failed to parse default provider response:', e);
          }
        }
        setDefaultProvider(defaultProviderSetting);

        // Load existing configuration if available
        if (configRes?.ok) {
          try {
            const configData = await configRes.json();
            if (configData?.config) {
              setConfig(configData.config);
              if (configData.config.provider === 'ollama') {
                setLocalBaseUrl(configData.config.baseUrl || 'http://localhost:11434');
              }
              if (configData.config.provider === 'openrouter-proxy') {
                setProvider('openrouter-proxy');
                // privacy consent load unchanged
              } else {
                setProvider('ollama');
                setModel(configData.config.model);
              }
              setPreviouslyConfigured(true);

              // If we have a default provider and it matches the config, validate and auto-load
              if (defaultProviderSetting && defaultProviderSetting === configData.config.provider) {
                setValidating(true);
                try {
                  const validateRes = await fetch('/api/model/validate');
                  if (validateRes.ok) {
                    const validateData = await validateRes.json();
                    if (validateData.ok) {
                      // Default is valid - auto-load the app
                      setHasValidDefault(true);
                      setConnectionError(null);
                      return; // Skip showing provider selection
                    }
                  }
                } catch (e) {
                  console.warn('Validation failed:', e);
                } finally {
                  setValidating(false);
                }
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
    if (provider !== 'ollama') return; // only for ollama selection
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

  // Test connection to local Ollama server using current localBaseUrl
  const testLocalConnection = async () => {
    if (!localBaseUrl) return;
    const url = localBaseUrl.replace(/\/$/, '');
    setTestingLocal(true);
    setLocalTestResult(null);
    const start = Date.now();
    try {
      const res = await fetch(`/api/model/available?baseUrl=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => ({}));
      const duration = Date.now() - start;
      if (data.error) {
        setLocalTestResult({ success: false, url, error: data.error, duration });
      } else {
        setLocalTestResult({ success: true, url, models: data.available || [], duration });
      }
    } catch (e:any) {
      const duration = Date.now() - start;
      setLocalTestResult({ success: false, url, error: 'Connection failed', duration });
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
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950">
            {(fetching && !loadedOnce) || validating ? (
              <div className="text-center">
                <div className="text-gray-200 text-sm mb-2">
                  {validating ? 'Validating Gemma 3 connection…' : 'Loading Gemma 3 configuration…'}
                </div>
                <div className="text-gray-500 text-xs">
                  {validating ? 'Testing your default provider…' : 'Checking for saved settings…'}
                </div>
              </div>
            ) : showProviderSelection ? (
              <div className="w-full max-w-md rounded-xl border border-white/10 bg-gray-900 p-6 text-gray-100 shadow">
                <h1 className="mb-4 text-xl font-semibold">Select Model Provider</h1>
                <p className="mb-4 text-sm text-gray-300">Choose between local Ollama (private) or hosted Gemma 3 27B API (convenience).</p>
                {previouslyConfigured && connectionError && (
                  <div className="mb-3 rounded border border-yellow-500/40 bg-yellow-900/30 px-3 py-2 text-[11px] text-yellow-300">
                    Previous configuration detected but connection failed ({connectionError}). Update values and save again.
                  </div>
                )}
                <form data-provider-form="true" onSubmit={async (e) => {
                  e.preventDefault();
                  if (provider === 'openrouter-proxy' && !privacyAccepted) {
                    setShowPrivacyConsent(true);
                    return;
                  }
                  setSaving(true); setError(null);
                  try {
                    const payload = provider === 'ollama'
                      ? { provider: 'ollama', baseUrl: localBaseUrl, model }
                      : { provider: 'openrouter-proxy', baseUrl: 'https://promptcrafter.sammyhamwi.ai', model: 'env-token' };
                    
                    const res = await fetch('/api/model/config', { 
                      method: 'POST', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: JSON.stringify(payload) 
                    });
                    if (!res.ok) throw new Error('Save failed');
                    
                    // Save default provider preference if checkbox is checked
                    if (setAsDefault) {
                      try {
                        await fetch('/api/model/default-provider', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ provider })
                        });
                      } catch (e) {
                        console.warn('Failed to save default provider preference:', e);
                      }
                    }
                    
                    // Save privacy consent for remote API
                    if (provider === 'openrouter-proxy') {
                      await fetch('/api/model/privacy-consent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ accepted: true })
                      });
                    }
                    
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
                        } else {
                          const errorMsg = vjson.error || 'Connection failed';
                          if (errorMsg.includes('proxy-')) {
                            if (errorMsg.includes('dns-error')) {
                              setConnectionError('Cannot reach promptcrafter.sammyhamwi.ai. Please check your internet connection.');
                            } else if (errorMsg.includes('timeout')) {
                              setConnectionError('Connection to Gemma 3 27B service timed out. Please try again.');
                            } else if (errorMsg.includes('error-404')) {
                              setConnectionError('Gemma 3 27B service endpoint not found. The service may be down.');
                            } else if (errorMsg.includes('error-401') || errorMsg.includes('error-403')) {
                              setConnectionError('Authentication failed. The service access token may have changed.');
                            } else {
                              setConnectionError('Remote Gemma 3 27B service is unreachable. Please try again later.');
                            }
                          } else if (errorMsg === 'model-not-found') {
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
                    <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Provider</label>
                    <CustomSelect
                      value={provider}
                      onChange={(value) => {
                        const next = value as 'ollama' | 'openrouter-proxy';
                        setProvider(next);
                        if (next === 'ollama' && !localBaseUrl) setLocalBaseUrl('http://localhost:11434');
                      }}
                      options={[
                        { value: 'ollama', label: '🏠 Ollama (Local, Private)' },
                        { value: 'openrouter-proxy', label: '🌐 Gemma 3 27B API (Remote)' }
                      ]}
                      className="w-full"
                    />
                  </div>
                  
                  {provider === 'ollama' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-1" htmlFor="baseUrl">Base URL (local only)</label>
                        <div className="flex gap-2">
                          <input
                            id="baseUrl"
                            value={localBaseUrl}
                            onChange={e => { setLocalBaseUrl(e.target.value); setLocalTestResult(null); }}
                            required
                            className="flex-1 rounded-md border border-white/10 bg-gray-800 px-3 py-2 text-sm"
                            placeholder="http://localhost:11434"
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={testLocalConnection}
                            disabled={testingLocal || !localBaseUrl}
                            className="rounded-md border border-indigo-500/50 bg-indigo-600/20 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-600/30 disabled:opacity-40"
                            title="Test local Ollama connection"
                          >{testingLocal ? '...' : 'Test'}</button>
                        </div>
                        {localTestResult && (
                          <div className={`mt-2 rounded-md border px-3 py-2 text-[11px] ${localTestResult.success ? 'border-green-500/40 bg-green-900/20 text-green-200' : 'border-red-500/40 bg-red-900/20 text-red-300'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span>{localTestResult.success ? 'Connection successful' : 'Connection failed'}{localTestResult.duration != null && ` (${localTestResult.duration}ms)`}</span>
                              <button type="button" onClick={() => setLocalTestResult(null)} className="text-xs opacity-70 hover:opacity-100">×</button>
                            </div>
                            {!localTestResult.success && localTestResult.error && (
                              <div className="mt-1">{localTestResult.error}</div>
                            )}
                            {localTestResult.success && localTestResult.models && (
                              <div className="mt-1 max-h-28 overflow-y-auto space-y-1">
                                {localTestResult.models.length ? localTestResult.models.map(m => (
                                  <div key={m} className="flex items-center gap-2 text-[10px] bg-gray-800/50 rounded px-2 py-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                    <span className="truncate">{m}</span>
                                  </div>
                                )) : <div className="text-[10px] opacity-70">No models reported</div>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-gray-400 mb-1" htmlFor="model">Gemma 3 Model</label>
                        <CustomSelect
                          value={model}
                          onChange={(value) => setModel(value as any)}
                          options={[
                            { value: "gemma3:1b", label: "gemma3:1b (Gemma 3 1B)" },
                            { value: "gemma3:4b", label: "gemma3:4b (Gemma 3 4B)" },
                            { value: "gemma3:12b", label: "gemma3:12b (Gemma 3 12B)" },
                            { value: "gemma3:27b", label: "gemma3:27b (Gemma 3 27B)" }
                          ]}
                          className="w-full"
                        />
                      </div>
                      <div className="text-[11px] text-gray-500 leading-relaxed">Install Ollama, then pull one model: <code>ollama pull gemma3:1b</code>, <code>ollama pull gemma3:4b</code>, <code>ollama pull gemma3:12b</code>, or <code>ollama pull gemma3:27b</code>.</div>
                    </>
                  )}
                  
                  {provider === 'openrouter-proxy' && (
                    <>
                      <div className="rounded border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-xs text-amber-200">
                        <strong>⚠️ Privacy Notice:</strong> Using the hosted API sends your prompts to external servers (Gemma 3 27B via OpenRouter). For complete privacy, use local Ollama instead.
                      </div>
                      <div className="text-[11px] text-gray-500 leading-relaxed">
                        Free <b>Gemma 3 27B API</b> usage, hosted by PromptCrafter.
                      </div>
                    </>
                  )}
                  
                  {(error || connectionError) && <div className="rounded border border-red-500/40 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error || connectionError}</div>}
                  
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="setAsDefault"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-indigo-600"
                    />
                    <label htmlFor="setAsDefault" className="text-xs text-gray-300">
                      Set as default (auto-load this provider on startup)
                    </label>
                  </div>
                  
                  <button disabled={saving || validating} className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {saving || validating ? 'Validating…' : (previouslyConfigured ? 'Start PromptCrafter' : 'Start PromptCrafter')}
                  </button>
                </form>
                
                {showPrivacyConsent && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                    <div className="w-full max-w-lg rounded-xl border border-red-500/40 bg-gray-900 p-6 text-gray-100 shadow-2xl">
                      <h2 className="mb-4 text-lg font-semibold text-red-400">⚠️ Data Privacy Acknowledgment</h2>
                      <div className="mb-4 space-y-3 text-sm text-gray-300">
                        <p><strong>You are about to send your prompts to external servers.</strong></p>
                        <p>By using the hosted Gemma 3 27B API:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Your prompts and responses will be transmitted over the internet</li>
                          <li>Data may be logged or processed by OpenRouter and Google</li>
                          <li>Complete privacy cannot be guaranteed</li>
                        </ul>
                        <p className="font-medium text-amber-300">Recommended: Install Ollama locally for the same functionality with complete privacy.</p>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => { setShowPrivacyConsent(false); setPrivacyAccepted(false); }}
                          className="flex-1 rounded-md bg-gray-700 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => { 
                            setPrivacyAccepted(true); 
                            setShowPrivacyConsent(false);
                            // Trigger form submission programmatically
                            setTimeout(() => {
                              const form = document.querySelector('form[data-provider-form="true"]') as HTMLFormElement;
                              if (form) {
                                const event = new Event('submit', { cancelable: true, bubbles: true });
                                form.dispatchEvent(event);
                              }
                            }, 100);
                          }}
                          className="flex-1 rounded-md bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500"
                        >
                          I Accept the Risk
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {showOllamaMissingModal && provider === 'ollama' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
                <div className="w-full max-w-lg rounded-xl border border-amber-500/40 bg-gray-900 p-6 text-gray-100 shadow-2xl">
                  <h2 className="mb-3 text-lg font-semibold text-amber-300">Ollama Not Detected</h2>
                  <div className="mb-4 space-y-3 text-sm text-gray-300">
                    <p>Hmm you don't seem to have <strong>Ollama</strong> running or installed.</p>
                    <p>Make sure it is open and running in the background with your <code>gemma3</code> models pulled and downloaded.</p>
                    <p>If you don't have Ollama, download it here: <a className="text-indigo-400 underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">https://ollama.com/download</a></p>
                    <p className="text-[11px] text-gray-500">After installing & starting Ollama, pull a model e.g.: <code>ollama pull gemma3:1b</code></p>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button onClick={() => setShowOllamaMissingModal(false)} className="flex-1 rounded-md bg-gray-700 py-2 text-sm font-medium hover:bg-gray-600">Close</button>
                    <button onClick={retryOllamaDetection} className="flex-1 rounded-md bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500">Retry Detection</button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-[90vw] max-w-3xl rounded-xl border border-white/10 bg-gray-900 p-5 text-gray-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit System Prompts</h2>
              <button onClick={() => setOpen(false)} className="rounded-md border border-gray-600 px-2 py-1 text-sm">Close</button>
            </div>
            {loading ? <div className="text-sm">Loading…</div> : (
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                setSaving(true); setError(null);
                try {
                  const res = await fetch('/api/system-prompts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ build, enhance }) });
                  if (!res.ok) throw new Error('Save failed');
                  setOpen(false);
                } catch (err:any) { setError(err.message || 'Unknown error'); } finally { setSaving(false); }
              }}>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Build Mode Prompt</label>
                  <textarea value={build} onChange={e => setBuild(e.target.value)} rows={10} className="w-full rounded-md border border-white/10 bg-gray-800 p-2 text-xs font-mono" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">Enhance Mode Prompt</label>
                  <textarea value={enhance} onChange={e => setEnhance(e.target.value)} rows={10} className="w-full rounded-md border border-white/10 bg-gray-800 p-2 text-xs font-mono" />
                </div>
                {error && <div className="rounded border border-red-500/40 bg-red-900/30 px-3 py-2 text-xs text-red-300">{error}</div>}
                <div className="flex items-center justify-between gap-2 flex-wrap">
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
                    className="rounded-md border border-red-600/60 bg-red-800/30 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:border-red-500 hover:text-red-200"
                  >Restore Defaults</button>
                  <div className="flex items-center gap-2 ml-auto">
                    <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-gray-600 bg-gray-700/40 px-3 py-1.5 text-xs">Cancel</button>
                    <button disabled={saving} className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button>
                  </div>
                </div>
              </form>
            )}
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

