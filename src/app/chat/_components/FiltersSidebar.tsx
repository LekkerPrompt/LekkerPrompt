"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Icon } from "@/components/Icon";
import { createPortal } from 'react-dom';
import { api } from "@/trpc/react";
import { CustomSelect } from "@/components/CustomSelect";
import RagInfoViewer from "@/components/RagInfoViewer";

type Mode = "build" | "enhance";
type TaskType = "general" | "coding" | "image" | "research" | "writing" | "marketing";
type Tone = "neutral" | "friendly" | "formal" | "technical" | "persuasive";
type Detail = "brief" | "normal" | "detailed";
type Format = "plain" | "markdown" | "json";

interface UserInfo {
  name?: string | null;
  image?: string | null;
  email?: string | null;
}

interface PresetModel {
  id?: string;
  name: string;
  mode: Mode;
  taskType: TaskType;
  options?: any;
}

interface FiltersSidebarProps {
  user?: UserInfo;
  onClose?: () => void;
  openAccount?: () => void;
  openInfo?: () => void;
  // Presets
  presets: PresetModel[];
  selectedPresetKey: string;
  setSelectedPresetKey: (val: string) => void;
  loadingPresets: boolean;
  applyPreset: (p: PresetModel) => void;
  savePreset: () => void;
  refreshPresets?: () => Promise<void> | void;
  defaultPresetId?: string | null;
  setDefaultPresetId?: (id: string | null) => void;
  presetName: string;
  setPresetName: (val: string) => void;
  // Chats
  chats?: Array<{ id: string; title: string; updatedAt: number; messageCount: number }>;
  currentChatId?: string | null;
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  // Filters
  taskType: TaskType;
  setTaskType: (val: TaskType) => void;
  mode: Mode;
  setMode: (val: Mode) => void;
  tone: Tone;
  setTone: (val: Tone) => void;
  detail: Detail;
  setDetail: (val: Detail) => void;
  format: Format;
  setFormat: (val: Format) => void;
  language: string;
  setLanguage: (val: string) => void;
  temperature: number;
  setTemperature: (val: number) => void;
  // Type-specific
  stylePreset: string;
  setStylePreset: (val: string) => void;
  aspectRatio: string;
  setAspectRatio: (val: string) => void;
  includeTests: boolean;
  setIncludeTests: (val: boolean) => void;
  requireCitations: boolean;
  setRequireCitations: (val: boolean) => void;
}

const cn = (...arr: Array<string | false | null | undefined>) => arr.filter(Boolean).join(" ");

interface ModelInfo {
  current: string | null;
  available: string[];
  error?: string;
}

const GemmaConnectionModal: React.FC<{ onClose: () => void; onModelSwitched?: () => void }> = ({ onClose, onModelSwitched }) => {
  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfo>({ current: null, available: [] });
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [baseUrl, setBaseUrl] = useState<string>('http://localhost:11434');
  const [switching, setSwitching] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<{
    show: boolean;
    success: boolean;
    url: string;
    models?: string[];
    error?: string;
    duration?: number;
  }>({ show: false, success: false, url: '' });

  // Fetch current configuration and available models
  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      // First get current config
      const configRes = await fetch('/api/model/config');
      const configData = await configRes.json();
      
      if (configData.config) {
        setCurrentConfig(configData.config);
        setBaseUrl(configData.config.baseUrl || 'http://localhost:11434');
      }

      // Then get available models
      const res = await fetch('/api/model/available');
      const data = await res.json();
      setModelInfo(data);
      setSelectedModel(data.current || '');
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setModelInfo({ current: null, available: [], error: 'Failed to fetch models' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Function to test connection and fetch models from a specific URL
  const testConnection = async (url: string) => {
    console.log('testConnection called with:', url);
    setTesting(true);
    console.log('setTesting(true) called');
    
    const startTime = Date.now();
    
    try {
      console.log('Starting fetch request...');
      const res = await fetch(`/api/model/available?baseUrl=${encodeURIComponent(url)}`);
      console.log('Fetch response received:', res.status);
      const data = await res.json();
      console.log('Response data:', data);
      
      const duration = Date.now() - startTime;
      
      if (data.error) {
        console.log('Error in response:', data.error);
        setModelInfo({ current: modelInfo.current, available: [], error: data.error });
        setTestResults({
          show: true,
          success: false,
          url,
          error: data.error,
          duration
        });
        return { success: false, error: data.error };
      } else {
        console.log('Success, available models:', data.available);
        setModelInfo({ current: modelInfo.current, available: data.available, error: undefined });
        setTestResults({
          show: true,
          success: true,
          url,
          models: data.available,
          duration
        });
        return { success: true, models: data.available };
      }
    } catch (e: any) {
      console.log('Exception caught:', e);
      const error = 'Connection failed';
      const duration = Date.now() - startTime;
      setModelInfo({ current: modelInfo.current, available: [], error });
      setTestResults({
        show: true,
        success: false,
        url,
        error,
        duration
      });
      return { success: false, error };
    } finally {
      console.log('setTesting(false) called');
      setTesting(false);
    }
  };

  const handleSwitchModel = async () => {
    if (!selectedModel) return;
    
    // Validate base URL format
    if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl.replace(/\/$/, ""))) {
      alert('Base URL must be a local address (e.g., http://localhost:11434)');
      return;
    }
    
    setSwitching(true);
    try {
      const res = await fetch('/api/model/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'ollama',
          baseUrl: baseUrl,
          model: selectedModel,
        }),
      });
      
      if (res.ok) {
        await fetchModels(); // Refresh to show new current model
        onModelSwitched?.(); // Notify parent component
        alert(`Successfully switched to ${selectedModel} at ${baseUrl}`);
  try { window.dispatchEvent(new Event('MODEL_CHANGED')); } catch {}
      } else {
        const error = await res.json();
        alert(`Failed to switch model: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to switch model: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg bg-gray-900 border border-gray-700 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Local Gemma 3 Model(s)</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-2 text-gray-400">Loading models...</p>
          </div>
        ) : testing ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-400">Testing connection...</p>
          </div>
        ) : modelInfo.error ? (
          <div className="text-center py-4">
            <p className="text-red-400 mb-2">{
              modelInfo.error === 'not-configured' ? 'No model configuration found' :
              modelInfo.error === 'unreachable' ? 'Cannot connect to Ollama server' :
              modelInfo.error === 'timeout' ? 'Connection timed out' :
              modelInfo.error
            }</p>
            <button
              onClick={fetchModels}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Model: <span className="text-white">{modelInfo.current || 'None'}</span>
              </label>
              {currentConfig && (
                <p className="text-xs text-gray-400">
                  Connected to: {currentConfig.baseUrl}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Base URL:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Test button clicked');
                    testConnection(baseUrl);
                  }}
                  disabled={testing || switching}
                  className="px-3 py-2 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {testing ? '...' : 'Test'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter the URL where Ollama is running (e.g., http://localhost:11434)
              </p>
            </div>

            {modelInfo.available.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Switch to:
                </label>
                <CustomSelect
                  value={selectedModel}
                  onChange={setSelectedModel}
                  options={modelInfo.available.map((model) => ({
                    value: model,
                    label: model
                  }))}
                  placeholder="Select model..."
                  className="w-full"
                />
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No Gemma 3 models available at this URL</p>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              {modelInfo.available.length > 0 && (
                <button
                  type="button"
                  onClick={handleSwitchModel}
                  disabled={switching || !selectedModel}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {switching ? 'Applying...' : 'Apply Configuration'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Test Results Overlay */}
      {testResults.show && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg bg-gray-900 border border-gray-700 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {testResults.success ? 'Connection Test - Success' : 'Connection Test - Failed'}
              </h3>
              <button
                onClick={() => setTestResults({ ...testResults, show: false })}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-800">
                <div className={`w-3 h-3 rounded-full ${testResults.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <p className="text-white font-medium">
                    {testResults.success ? 'Connection Successful' : 'Connection Failed'}
                  </p>
                  <p className="text-sm text-gray-400">
                    Tested URL: {testResults.url}
                  </p>
                  {testResults.duration && (
                    <p className="text-xs text-gray-500">
                      Response time: {testResults.duration}ms
                    </p>
                  )}
                </div>
              </div>
              
              {testResults.success ? (
                <div>
                  <h4 className="text-white font-medium mb-2">Available Models:</h4>
                  {testResults.models && testResults.models.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {testResults.models.map((model, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-800 rounded text-sm">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span className="text-gray-300">{model}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">No models found</p>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="text-white font-medium mb-2">Error Details:</h4>
                  <div className="p-3 bg-red-900/20 border border-red-500/30 rounded">
                    <p className="text-red-300 text-sm">{testResults.error}</p>
                  </div>
                  <div className="mt-3 p-3 bg-gray-800 rounded text-xs text-gray-400">
                    <p className="font-medium mb-2">Troubleshooting:</p>
                    <ul className="space-y-1">
                      <li>• Make sure Ollama is running on {testResults.url}</li>
                      <li>• Check if the URL is correct and accessible</li>
                      <li>• Verify that no firewall is blocking the connection</li>
                      <li>• Ensure Ollama API is enabled and listening on the specified port</li>
                    </ul>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end pt-4 border-t border-gray-700">
                <button
                  onClick={() => setTestResults({ ...testResults, show: false })}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Avatar: React.FC<{ name?: string | null; email?: string | null; image?: string | null }> = ({ name, email, image }) => {
  // Always show a cog icon instead of initials per requirement
  const fullName = name ?? (email ? email.split("@")[0] : undefined) ?? "App Settings";
  const visibleName = 'App Settings';
  return (
    <div className="flex items-center gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={fullName} className="h-9 w-9 rounded-full object-cover" />
      ) : (
  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-white"><Icon name="gear" /></div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-100" title={fullName}>{visibleName}</div>
      </div>
    </div>
  );
};

const UserMenu: React.FC<{ user?: UserInfo; openAccount?: () => void; currentModel: string | null; onModelChange: (model: string) => void }> = ({ user, openAccount, currentModel, onModelChange }) => {
  const [open, setOpen] = useState(false);
  const [sysOpen, setSysOpen] = useState(false);
  const [gemmaConnectionOpen, setGemmaConnectionOpen] = useState(false);
  const [ragInfoOpen, setRagInfoOpen] = useState(false);
  const sysBtnRef = useRef<HTMLButtonElement | null>(null);
  const sysTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{top:number; left:number} | null>(null);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (sysTimeoutRef.current) {
        clearTimeout(sysTimeoutRef.current);
      }
    };
  }, []);
  
  const toggle = () => setOpen(o => !o);
  const fullName = user?.name || user?.email?.split('@')[0] || 'User';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center justify-between rounded-md border border-gray-700 bg-gray-800/50 px-2 py-1.5 text-left text-sm text-gray-200 transition',
          'hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500'
        )}
  title="App Settings menu"
      >
        <span className="flex items-center gap-2">
          <Avatar name={user?.name} email={user?.email ?? undefined} image={user?.image ?? undefined} />
        </span>
        <svg className={cn('ml-2 h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="menu-panel absolute left-0 right-0 z-50 mt-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-1 overflow-visible"
        >
          {/* System Settings first */}
          <div className="relative">
            <button
              ref={sysBtnRef}
              type="button"
              onMouseEnter={() => {
                // Clear any pending close timeout
                if (sysTimeoutRef.current) {
                  clearTimeout(sysTimeoutRef.current);
                  sysTimeoutRef.current = null;
                }
                if (!sysOpen) {
                  const r = sysBtnRef.current?.getBoundingClientRect();
                  if (r) setSubmenuPos({ top: r.top, left: r.right + 4 });
                  setSysOpen(true);
                }
              }}
              onMouseLeave={() => {
                // Set a timeout to close the submenu
                sysTimeoutRef.current = setTimeout(() => {
                  setSysOpen(false);
                }, 150); // 150ms grace period
              }}
              onClick={() => {
                // Clear timeout on click
                if (sysTimeoutRef.current) {
                  clearTimeout(sysTimeoutRef.current);
                  sysTimeoutRef.current = null;
                }
                setSysOpen(s => {
                  const next = !s;
                  if (next) {
                    const r = sysBtnRef.current?.getBoundingClientRect();
                    if (r) setSubmenuPos({ top: r.top, left: r.right + 4 });
                  }
                  return next;
                });
              }}
              className="flex items-center justify-between menu-item"
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={sysOpen}
              aria-controls="user-menu-system-settings"
              onKeyDown={(e) => { if (e.key === 'ArrowRight') { const r = sysBtnRef.current?.getBoundingClientRect(); if (r) setSubmenuPos({ top: r.top, left: r.right + 4 }); setSysOpen(true);} if (e.key === 'Escape') setSysOpen(false); }}
            >
              <span>System Settings</span>
              <span className="text-[10px] opacity-60">▸</span>
            </button>
            {sysOpen && submenuPos && typeof document !== 'undefined' && createPortal(
              <div
                id="user-menu-system-settings"
                role="menu"
                className="menu-panel fixed z-[9999] w-56"
                style={{ top: Math.max(8, submenuPos.top), left: submenuPos.left }}
                onMouseEnter={() => {
                  // Clear any pending close timeout when entering submenu
                  if (sysTimeoutRef.current) {
                    clearTimeout(sysTimeoutRef.current);
                    sysTimeoutRef.current = null;
                  }
                }}
                onMouseLeave={() => {
                  // Close immediately when leaving submenu
                  setSysOpen(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => { window.dispatchEvent(new CustomEvent('open-db-location')); setOpen(false); setSysOpen(false); }}
                  className="menu-item"
                  role="menuitem"
                >Data Location</button>
                <button
                  type="button"
                  onClick={() => { window.dispatchEvent(new CustomEvent('open-system-prompts')); setOpen(false); setSysOpen(false); }}
                  className="menu-item"
                  role="menuitem"
                >System Prompts</button>
                <button
                  type="button"
                  onClick={() => { setGemmaConnectionOpen(true); setOpen(false); setSysOpen(false); }}
                  className="menu-item"
                  role="menuitem"
                >Local Gemma 3 Model(s)</button>
                <button
                  type="button"
                  onClick={() => { setRagInfoOpen(true); setOpen(false); setSysOpen(false); }}
                  className="menu-item"
                  role="menuitem"
                >RAG Learning Data</button>
              </div>, document.body)
            }
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); openAccount?.(); }}
            className="menu-item"
            role="menuitem"
          >
            Saved Data
          </button>
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-provider-selection'));
              setOpen(false);
            }}
            className="menu-item text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 focus:bg-indigo-500/10"
            role="menuitem"
          >
            Change Provider
          </button>
        </div>
      )}
      {gemmaConnectionOpen && typeof document !== 'undefined' && createPortal(
        <GemmaConnectionModal 
          onClose={() => setGemmaConnectionOpen(false)}
          onModelSwitched={async () => {
            // Refresh current model when a switch happens
            try {
              const res = await fetch('/api/model/available');
              const data = await res.json();
              onModelChange(data.current);
            } catch (err) {
              console.error('Failed to refresh model after switch:', err);
            }
          }}
        />, 
        document.body
      )}
      {ragInfoOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">RAG Learning Data</h2>
              <button
                type="button"
                onClick={() => setRagInfoOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close RAG info"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <RagInfoViewer />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default function FiltersSidebar(props: FiltersSidebarProps) {
  const {
    user,
    onClose,
    openAccount,
    openInfo,
    presets,
    selectedPresetKey,
    setSelectedPresetKey,
    loadingPresets,
    applyPreset,
    savePreset,
    refreshPresets,
    defaultPresetId,
    setDefaultPresetId,
    presetName,
    setPresetName,
    chats,
    currentChatId,
    onSelectChat,
    onDeleteChat,
    taskType,
    setTaskType,
    mode,
    setMode,
    tone,
    setTone,
    detail,
    setDetail,
    format,
    setFormat,
    language,
    setLanguage,
    temperature,
    setTemperature,
    stylePreset,
    setStylePreset,
    aspectRatio,
    setAspectRatio,
    includeTests,
    setIncludeTests,
    requireCitations,
    setRequireCitations,
  } = props;

  const [tab, setTab] = useState<"settings" | "chats">("settings");
  const [currentModel, setCurrentModel] = useState<string | null>(null);

  // Fetch current model on component mount
  useEffect(() => {
    const fetchCurrentModel = async () => {
      try {
        const res = await fetch('/api/model/available');
        const data = await res.json();
        setCurrentModel(data.current);
        
        // If gemma3:1b is connected and language is not English, set to English
        if (data.current === 'gemma3:1b' && language !== 'English') {
          setLanguage('English');
        }
      } catch (err) {
        console.error('Failed to fetch current model:', err);
      }
    };
    fetchCurrentModel();
  }, [language, setLanguage]);

  // Handle model change from the Gemma 3 Connection modal
  const handleModelChanged = useCallback(async (newModel: string) => {
    setCurrentModel(newModel);
    // If gemma3:1b is connected and language is not English, set to English
    if (newModel === 'gemma3:1b' && language !== 'English') {
      setLanguage('English');
    }
  }, [language, setLanguage]);

  const sortedChats = useMemo(() => {
    return (chats ?? []).slice().sort((a, b) => b.updatedAt - a.updatedAt);
  }, [chats]);

  const selectedPreset = useMemo(() => {
    return presets.find((p) => (p.id ?? p.name) === selectedPresetKey) ?? null;
  }, [presets, selectedPresetKey]);

  const [renameName, setRenameName] = useState("");
  useEffect(() => {
    setRenameName(selectedPreset?.name ?? "");
  }, [selectedPreset?.name]);

  // Detect if current settings differ from the selected preset (to enable Update)
  const isDirty = useMemo(() => {
    if (!selectedPreset) return false;
    const currentName = (renameName || selectedPreset.name).trim();
    const current = {
      name: currentName,
      mode,
      taskType,
      options: {
        tone,
        detail,
        format,
        language: language || undefined,
        temperature,
        ...(taskType === "image" ? { stylePreset, aspectRatio } : {}),
        ...(taskType === "coding" ? { includeTests } : {}),
        ...(taskType === "research" ? { requireCitations } : {}),
      },
    } as const;
    const sel = {
      name: selectedPreset.name,
      mode: selectedPreset.mode,
      taskType: selectedPreset.taskType,
      options: {
        tone: selectedPreset.options?.tone,
        detail: selectedPreset.options?.detail,
        format: selectedPreset.options?.format,
        language: selectedPreset.options?.language,
        temperature: typeof selectedPreset.options?.temperature === "number" ? selectedPreset.options?.temperature : undefined,
        ...(selectedPreset.taskType === "image" ? { stylePreset: selectedPreset.options?.stylePreset, aspectRatio: selectedPreset.options?.aspectRatio } : {}),
        ...(selectedPreset.taskType === "coding" ? { includeTests: !!selectedPreset.options?.includeTests } : {}),
        ...(selectedPreset.taskType === "research" ? { requireCitations: !!selectedPreset.options?.requireCitations } : {}),
      },
    } as const;
    return JSON.stringify(current) !== JSON.stringify(sel);
  }, [selectedPreset, renameName, mode, taskType, tone, detail, format, language, temperature, stylePreset, aspectRatio, includeTests, requireCitations]);

  return (
    <div className="flex h-full w-80 flex-col overflow-hidden border-r border-gray-800 bg-gray-900 p-3 md:p-4">
      <UserMenu user={user} openAccount={openAccount} currentModel={currentModel} onModelChange={handleModelChanged} />
      <div className="mt-4 mx-1 flex items-center gap-2 rounded-md border border-gray-800 bg-gray-900/60 p-1 text-xs">
        <button
          className={cn(
            "flex-1 rounded-sm px-3 py-1 transition",
            tab === "settings" ? "bg-gray-800 text-gray-100" : "text-gray-400 hover:text-gray-200"
          )}
          onClick={() => setTab("settings")}
          type="button"
        >
          Settings
        </button>
        <button
          className={cn(
            "flex-1 rounded-sm px-3 py-1 transition",
            tab === "chats" ? "bg-gray-800 text-gray-100" : "text-gray-400 hover:text-gray-200"
          )}
          onClick={() => setTab("chats")}
          type="button"
        >
          Chats
        </button>
      </div>

      {tab === "settings" ? (
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1 pl-1">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-gray-400">Presets</div>
            <button
              type="button"
              onClick={() => openInfo && openInfo()}
              className="cursor-pointer text-blue-300 hover:text-blue-200 transition inline-flex items-center justify-center h-4 w-4"
              title="Learn about each setting"
              aria-label="Preset info"
            >
              <Icon name="info" className="text-[13px]" />
            </button>
          </div>
        <div>
          <CustomSelect
            value={selectedPresetKey}
            onChange={(key) => {
              setSelectedPresetKey(key);
              const p = presets.find((x) => (x.id ?? x.name) === key);
              if (p) applyPreset(p);
            }}
            options={[
              { value: "", label: loadingPresets ? "Loading…" : presets.length ? "Select a preset" : "No presets - create one!", disabled: true },
              ...presets.map((p) => ({
                value: p.id ?? p.name,
                label: `${(defaultPresetId && p.id === defaultPresetId) ? "(Default) " : ""}${p.name}`
              }))
            ]}
            className="w-full"
          />
          {selectedPreset && (
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-400">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!(defaultPresetId && selectedPreset.id === defaultPresetId)}
                  onChange={async (e) => {
                    if (!selectedPreset?.id) return;
                    if (e.target.checked) {
                      await fetch("/api/presets/default", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetId: selectedPreset.id }) });
                      setDefaultPresetId?.(selectedPreset.id);
                    } else {
                      await fetch("/api/presets/default", { method: "DELETE" });
                      setDefaultPresetId?.(null);
                    }
                  }}
                />
                <span>Set as default</span>
              </label>
            </div>
          )}
          {/* Preset utilities */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={async () => {
                // Reset settings to app defaults for a clean Add experience
                setSelectedPresetKey("");
                setPresetName("");
                setMode("build");
                setTaskType("general");
                setTone("neutral");
                setDetail("normal");
                setFormat("markdown");
                setLanguage("English");
                setTemperature(0.7);
                setStylePreset("photorealistic");
                setAspectRatio("1:1");
                setIncludeTests(true);
                setRequireCitations(true);
              }}
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-gray-700"
            >
              Add New Preset
            </button>
            <button
              type="button"
              disabled={!selectedPreset}
              onClick={async () => {
                if (!selectedPreset) return;
                const defaultName = `${selectedPreset.name} (copy)`;
                setPresetName(defaultName);
                setSelectedPresetKey("");
              }}
              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-200 transition enabled:hover:bg-gray-700 disabled:opacity-50"
            >
              Duplicate Preset
            </button>
          </div>
        </div>

        <div className="h-px w-full bg-gray-800" />

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-gray-400">Preset Name</label>
            <input
              value={selectedPreset ? renameName : presetName}
              onChange={(e) => (selectedPreset ? setRenameName(e.target.value) : setPresetName(e.target.value))}
              placeholder="Preset name"
              className={cn(
                "w-full rounded-md border bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm focus:outline-none focus:ring-2",
                // Red border if name duplicates an existing preset name (excluding selected one)
                (() => {
                  const name = (selectedPreset ? renameName : presetName).trim();
                  if (!name) return "border-gray-700 focus:ring-blue-500";
                  const exists = presets.some((p) => p.name === name && (selectedPreset ? p.name !== selectedPreset.name : true));
                  return exists ? "border-red-600 focus:ring-red-600" : "border-gray-700 focus:ring-blue-500";
                })()
              )}
              aria-invalid={(() => {
                const name = (selectedPreset ? renameName : presetName).trim();
                if (!name) return false;
                return presets.some((p) => p.name === name && (selectedPreset ? p.name !== selectedPreset.name : true));
              })()}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Type</label>
            <CustomSelect
              value={taskType}
              onChange={(value) => setTaskType(value as TaskType)}
              options={[
                { value: "general", label: "General" },
                { value: "coding", label: "Coding" },
                { value: "image", label: "Image" },
                { value: "research", label: "Research" },
                { value: "writing", label: "Writing" },
                { value: "marketing", label: "Marketing" }
              ]}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Mode</label>
            <CustomSelect
              value={mode}
              onChange={(value) => setMode(value as Mode)}
              options={[
                { value: "build", label: "Build" },
                { value: "enhance", label: "Enhance" }
              ]}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Tone</label>
            <CustomSelect
              value={tone}
              onChange={(value) => setTone(value as Tone)}
              options={[
                { value: "neutral", label: "Neutral" },
                { value: "friendly", label: "Friendly" },
                { value: "formal", label: "Formal" },
                { value: "technical", label: "Technical" },
                { value: "persuasive", label: "Persuasive" }
              ]}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Detail</label>
            <CustomSelect
              value={detail}
              onChange={(value) => setDetail(value as Detail)}
              options={[
                { value: "brief", label: "Brief" },
                { value: "normal", label: "Normal" },
                { value: "detailed", label: "Detailed" }
              ]}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Format</label>
            <CustomSelect
              value={format}
              onChange={(value) => setFormat(value as Format)}
              options={[
                { value: "plain", label: "Plain" },
                { value: "markdown", label: "Markdown" },
                { value: "json", label: "JSON" }
              ]}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Language</label>
            <CustomSelect
              value={language}
              onChange={(value) => setLanguage(value)}
              options={[
                { value: "English", label: "English" },
                ...(currentModel !== 'gemma3:1b' ? [
                  { value: "Dutch", label: "Dutch" },
                  { value: "Arabic", label: "Arabic" },
                  { value: "Mandarin Chinese", label: "Mandarin Chinese" },
                  { value: "Spanish", label: "Spanish" },
                  { value: "French", label: "French" },
                  { value: "Russian", label: "Russian" },
                  { value: "Urdu", label: "Urdu" }
                ] : [])
              ]}
              className="w-full text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Temperature</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-400">{temperature.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {taskType === "image" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Image Style</label>
              <CustomSelect
                value={stylePreset}
                onChange={(value) => setStylePreset(value)}
                options={[
                  { value: "photorealistic", label: "Photorealistic" },
                  { value: "illustration", label: "Illustration" },
                  { value: "3d", label: "3D" },
                  { value: "anime", label: "Anime" },
                  { value: "watercolor", label: "Watercolor" }
                ]}
                className="w-full text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Aspect Ratio</label>
              <CustomSelect
                value={aspectRatio}
                onChange={(value) => setAspectRatio(value)}
                options={[
                  { value: "1:1", label: "1:1" },
                  { value: "16:9", label: "16:9" },
                  { value: "9:16", label: "9:16" },
                  { value: "4:3", label: "4:3" }
                ]}
                className="w-full text-xs"
              />
            </div>
          </div>
        )}

        {taskType === "coding" && (
          <label className="flex items-center gap-2 text-xs text-gray-200">
            <input type="checkbox" checked={includeTests} onChange={(e) => setIncludeTests(e.target.checked)} />
            Include tests
          </label>
        )}

        {taskType === "research" && (
          <label className="flex items-center gap-2 text-xs text-gray-200">
            <input type="checkbox" checked={requireCitations} onChange={(e) => setRequireCitations(e.target.checked)} />
            Require citations
          </label>
        )}

        {/* Bottom actions: Add or Update/Delete */}
        {!selectedPreset ? (
          <div className="mt-2">
            <button
              onClick={async () => {
                const name = (presetName || "").trim();
                if (!name) return;
                await savePreset();
                await refreshPresets?.();
                try {
                  const res = await fetch('/api/presets');
                  if (res.ok) {
                    const data = await res.json();
                    const list = Array.isArray(data?.presets) ? data.presets : [];
                    const found = list.find((p: any) => p.name === name);
                    if (found) {
                      setSelectedPresetKey(found.id ?? found.name);
                      // Optionally apply immediately for consistency
                      try { applyPreset(found); } catch {}
                    }
                  }
                } catch {
                  // noop
                }
              }}
              className="w-full rounded-md bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-700 active:bg-green-800"
            >
              Add
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isDirty}
              onClick={async () => {
                try {
                  const newName = (renameName || selectedPreset.name).trim();
                  setPresetName(newName);
                  // Save via POST with id to ensure true rename
                  await fetch('/api/presets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      id: selectedPreset.id,
                      name: newName,
                      mode,
                      taskType,
                      options: {
                        tone,
                        detail,
                        format,
                        language: language || undefined,
                        temperature,
                        ...(taskType === 'image' ? { stylePreset, aspectRatio } : {}),
                        ...(taskType === 'coding' ? { includeTests } : {}),
                        ...(taskType === 'research' ? { requireCitations } : {}),
                      },
                    }),
                  });
                  await refreshPresets?.();
                  // Load latest list to find the newly saved preset
                  let newPreset: any | null = null;
                  try {
                    const res = await fetch('/api/presets');
                    const data = await res.json();
                    const list = Array.isArray(data?.presets) ? data.presets : [];
                    newPreset = list.find((p: any) => p.name === newName) ?? null;
                  } catch {}
                  // Select the updated preset by id if available
                  if (newPreset) {
                    setSelectedPresetKey(newPreset.id ?? newPreset.name);
                    try { applyPreset(newPreset); } catch {}
                  }
                } finally {
                  // noop
                }
              }}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Update
            </button>
            <button
              type="button"
              onClick={async () => {
                const confirmBox = document.createElement("div");
                confirmBox.className = "fixed inset-0 z-50 flex items-center justify-center";
                confirmBox.innerHTML = `
                  <div class=\"absolute inset-0 bg-black/60\"></div>
                  <div class=\"relative z-10 w-[92vw] max-w-sm rounded-xl border border-white/10 bg-gray-900 p-4 text-gray-100 shadow-2xl\">
                    <div class=\"text-base font-semibold mb-2\">Delete preset?</div>
                    <div class=\"text-sm text-gray-300\">This action cannot be undone.</div>
                    <div class=\"mt-4 flex items-center justify-end gap-2\">
                      <button id=\"pc_cancel\" class=\"rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm\">Cancel</button>
                      <button id=\"pc_confirm\" class=\"rounded-md border border-red-600 bg-red-600/20 px-3 py-1.5 text-sm text-red-200\">Delete</button>
                    </div>
                  </div>`;
                document.body.appendChild(confirmBox);
                const remove = () => confirmBox.remove();
                const cancelBtn = document.getElementById("pc_cancel");
                const confirmBtn = document.getElementById("pc_confirm");
                const onCancel = () => remove();
                const onConfirm = async () => {
                  try {
                    const query = selectedPreset.id
                      ? `id=${encodeURIComponent(selectedPreset.id)}`
                      : `name=${encodeURIComponent(selectedPreset.name)}`;
                    await fetch(`/api/presets?${query}`, { method: "DELETE" });
                    await refreshPresets?.();
                  } finally {
                    // After deletion: auto-open default preset; if none, open first; if none remain, reset to system defaults
                    try {
                      const defRes = await fetch('/api/presets/default');
                      const defData = await defRes.json().catch(() => ({}));
                      let defaultId = typeof defData?.defaultPresetId === 'string' ? defData.defaultPresetId : null;
                      const listRes = await fetch('/api/presets');
                      const listData = await listRes.json().catch(() => ({}));
                      const list = Array.isArray(listData?.presets) ? listData.presets : [];

                      // If stored default no longer exists, clear it server-side and in-memory
                      const defaultExists = defaultId ? list.some((p: any) => p.id === defaultId) : false;
                      if (defaultId && !defaultExists) {
                        try { await fetch('/api/presets/default', { method: 'DELETE' }); } catch {}
                        defaultId = null;
                        try { setDefaultPresetId?.(null); } catch {}
                      }

                      const pick = (defaultId && list.find((p: any) => p.id === defaultId)) || list[0] || null;
                      if (pick) {
                        setSelectedPresetKey(pick.id ?? pick.name);
                        try { applyPreset(pick); } catch {}
                      } else {
                        // No presets left: switch to system default prompt settings
                        setSelectedPresetKey("");
                        try {
                          setPresetName("");
                          setMode("build");
                          setTaskType("general");
                          setTone("neutral");
                          setDetail("normal");
                          setFormat("markdown");
                          setLanguage("English");
                          setTemperature(0.7);
                          setStylePreset("photorealistic");
                          setAspectRatio("1:1");
                          setIncludeTests(true);
                          setRequireCitations(true);
                        } catch {}
                      }
                    } catch {
                      setSelectedPresetKey("");
                    }
                    remove();
                  }
                };
                cancelBtn?.addEventListener("click", onCancel, { once: true });
                confirmBtn?.addEventListener("click", onConfirm, { once: true });
              }}
              className="rounded-md border border-red-600/60 bg-red-600/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-600/20"
            >
              Delete
            </button>
          </div>
        )}
        
        {/* Bottom actions: Add New Preset / Duplicate Preset (hidden in add mode) */}
      </div>
      ) : (
      <ChatsTab
        chats={sortedChats}
        currentChatId={currentChatId}
        onSelectChat={onSelectChat}
        onDeleteChat={onDeleteChat}
      />
      )}
      {/* Removed deprecated Tutorial button section */}
    </div>
  );
}

function ChatsTab(props: {
  chats: Array<{ id: string; title: string; updatedAt: number; messageCount: number }>;
  currentChatId?: string | null;
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
}) {
  const { chats, currentChatId, onSelectChat, onDeleteChat } = props;
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const utils = api.useUtils();

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const anySelected = selectedIds.length > 0;

  const downloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = (ids: string[]) => {
    const list = ids.length ? chats.filter((c) => ids.includes(c.id)) : chats;
    const fetchChat = async (id: string) => {
      // Try tRPC utils first; fall back to HTTP query string if needed
      try {
        return await utils.chat.get.fetch({ chatId: id, limit: 200 });
      } catch {
        try {
          const res = await fetch(`/api/trpc/chat.get`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: JSON.stringify({ chatId: id, limit: 200 }) }),
          });
          const json = await res.json();
          return json?.result?.data ?? json;
        } catch {
          return null as any;
        }
      }
    };

    Promise.all(
      list.map(async (c) => {
        const payload = await fetchChat(c.id);
        const messages = Array.isArray(payload?.messages) ? payload.messages : [];
        return {
          id: c.id,
          title: c.title,
          messages: messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt ?? null })),
        };
      })
    ).then(async (full) => {
      // Create a zip on the fly (minimal no-dep zip)
      const jsonStr = JSON.stringify(full, null, 2);
      const files: Array<{ name: string; data: Uint8Array }> = [
        { name: "chats.json", data: new TextEncoder().encode(jsonStr) },
      ];
      const zipBlob = await createZip(files);
      downloadBlob(`chats-${ids.length ? "selected" : "all"}.zip`, zipBlob);
    });
  };

  // CSV export removed per request

  // Minimal ZIP creator (no compression, store method). Enough for small exports.
  const createZip = async (files: Array<{ name: string; data: Uint8Array }>): Promise<Blob> => {
    // ZIP format constants
    const encoder = new TextEncoder();
    const fileRecords: { local: Uint8Array; central: Uint8Array; size: number; crc: number; offset: number }[] = [];
    let offset = 0;

    const crc32 = (buf: Uint8Array): number => {
      let c = ~0;
      for (let i = 0; i < buf.length; i++) {
        c ^= buf[i] ?? 0;
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
      return ~c >>> 0;
    };

    const parts: Uint8Array[] = [];

    for (const f of files) {
      const nameBytes = encoder.encode(f.name);
      const crc = crc32(f.data);
      const size = f.data.length;
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const dv = new DataView(localHeader.buffer);
      dv.setUint32(0, 0x04034b50, true); // local file header signature
      dv.setUint16(4, 20, true); // version needed
      dv.setUint16(6, 0, true); // flags
      dv.setUint16(8, 0, true); // compression = 0 (store)
      dv.setUint16(10, 0, true); // mod time
      dv.setUint16(12, 0, true); // mod date
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true); // compressed size
      dv.setUint32(22, size, true); // uncompressed size
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true); // extra len
      localHeader.set(nameBytes, 30);

      parts.push(localHeader, f.data);

      const central = new Uint8Array(46 + nameBytes.length);
      const dv2 = new DataView(central.buffer);
      dv2.setUint32(0, 0x02014b50, true); // central dir header
      dv2.setUint16(4, 20, true); // version made
      dv2.setUint16(6, 20, true); // version needed
      dv2.setUint16(8, 0, true); // flags
      dv2.setUint16(10, 0, true); // compression
      dv2.setUint16(12, 0, true);
      dv2.setUint16(14, 0, true);
      dv2.setUint32(16, crc, true);
      dv2.setUint32(20, size, true);
      dv2.setUint32(24, size, true);
      dv2.setUint16(28, nameBytes.length, true);
      dv2.setUint16(30, 0, true);
      dv2.setUint16(32, 0, true);
      dv2.setUint16(34, 0, true);
      dv2.setUint16(36, 0, true);
      dv2.setUint32(38, 0, true);
      dv2.setUint32(42, offset, true);
      central.set(nameBytes, 46);

      fileRecords.push({ local: localHeader, central, size, crc, offset });
      offset += localHeader.length + size;
    }

    const centralParts: Uint8Array[] = [];
    for (const r of fileRecords) centralParts.push(r.central);
    const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
    const centralOffset = offset;

    const eocd = new Uint8Array(22);
    const dv3 = new DataView(eocd.buffer);
    dv3.setUint32(0, 0x06054b50, true); // EOCD
    dv3.setUint16(4, 0, true);
    dv3.setUint16(6, 0, true);
    dv3.setUint16(8, fileRecords.length, true);
    dv3.setUint16(10, fileRecords.length, true);
    dv3.setUint32(12, centralSize, true);
    dv3.setUint32(16, centralOffset, true);
    dv3.setUint16(20, 0, true);

    const finalParts = [...parts, ...centralParts, eocd];
    const totalLen = finalParts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const p of finalParts) { out.set(p, pos); pos += p.length; }
    return new Blob([out], { type: 'application/zip' });
  };

  const confirmDialog = (title: string, body: string, onConfirm: () => void) => {
    const box = document.createElement("div");
    box.className = "fixed inset-0 z-50 flex items-center justify-center";
    box.innerHTML = `
      <div class=\"absolute inset-0 bg-black/60\"></div>
      <div class=\"relative z-10 w-[92vw] max-w-sm rounded-xl border border-white/10 bg-gray-900 p-4 text-gray-100 shadow-2xl\">
        <div class=\"text-base font-semibold mb-2\">${title}</div>
        <div class=\"text-sm text-gray-300\">${body}</div>
        <div class=\"mt-4 flex items-center justify-end gap-2\">
          <button id=\"pc_cancel\" class=\"rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm\">Cancel</button>
          <button id=\"pc_confirm\" class=\"rounded-md border border-red-600 bg-red-600/20 px-3 py-1.5 text-sm text-red-200\">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(box);
    const remove = () => box.remove();
    document.getElementById("pc_cancel")?.addEventListener("click", () => remove(), { once: true });
    document.getElementById("pc_confirm")?.addEventListener("click", () => { try { onConfirm(); } finally { remove(); } }, { once: true });
  };

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 pl-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-gray-400">Past Chats</div>
      </div>

      {!selectMode && (
        <div>
          <button
            type="button"
            className="rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/5"
            onClick={() => setSelectMode(true)}
          >
            Select
          </button>
        </div>
      )}

      {selectMode && (
        <>
          {/* Box 1: Export All / Delete All */}
          <div className="rounded-md border border-gray-800 bg-gray-900/60 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="min-w-[110px] rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/5"
                onClick={() => exportJSON([])}
                title="Export all chats as JSON"
              >
                Export All
              </button>
              <button
                type="button"
                className="min-w-[110px] rounded-md border border-red-600 bg-red-600/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-600/20"
                onClick={() => confirmDialog("Delete ALL chats?", "This will remove all chats.", async () => {
                  for (const c of chats) await onDeleteChat?.(c.id);
                  setSelected({});
                  setSelectMode(false);
                })}
              >
                Delete All
              </button>
            </div>
          </div>

          {/* Box 2: Export Selected / Delete Selected */}
          <div className="rounded-md border border-gray-800 bg-gray-900/60 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="min-w-[110px] rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => exportJSON(selectedIds)}
                disabled={!anySelected}
              >
                Export Selected
              </button>
              <button
                type="button"
                className="min-w-[130px] rounded-md border border-red-600 bg-red-600/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => confirmDialog("Delete selected chats?", "This cannot be undone.", async () => {
                  for (const id of selectedIds) await onDeleteChat?.(id);
                  setSelected({});
                  setSelectMode(false);
                })}
                disabled={!anySelected}
              >
                Delete Selected
              </button>
            </div>
          </div>
        </>
      )}

      <div className="rounded-lg border border-gray-800 bg-gray-900/50">
        {chats.length === 0 ? (
          <div className="p-3 text-xs text-gray-500">No saved chats yet.</div>
        ) : (
          <ul className="divide-y divide-gray-800/80">
            {selectMode && (
              <li className="sticky top-0 z-10 flex items-center gap-3 bg-gray-900/70 px-2 py-1 backdrop-blur">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800"
                  checked={selectAllChecked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectAllChecked(checked);
                    if (checked) setSelected(chats.reduce((acc, c) => ({ ...acc, [c.id]: true }), {}));
                    else setSelected({});
                  }}
                />
                <div className="ml-1 text-[11px] text-gray-400">Select all</div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" className="rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/5" onClick={() => { setSelectMode(false); setSelectAllChecked(false); }}>Cancel</button>
                  <button type="button" className="rounded-md border border-gray-700 px-2 py-1 text-[11px] text-gray-200 hover:bg-white/5" onClick={() => { setSelected({}); setSelectAllChecked(false); }}>Clear</button>
                </div>
              </li>
            )}
            {chats.map((c) => (
              <li key={c.id} className={cn("flex items-center gap-3 p-2 transition hover:bg-gray-800/60", currentChatId === c.id && "bg-gray-800/50") }>
                {selectMode && (
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-600 bg-gray-800" checked={!!selected[c.id]} onChange={() => toggle(c.id)} />
                )}
                <button
                  type="button"
                  onClick={() => (selectMode ? toggle(c.id) : onSelectChat && onSelectChat(c.id))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={c.title}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600/20 text-indigo-300"><Icon name="comments" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm text-gray-200">{c.title || "Untitled"}</div>
                    <div className="text-[10px] text-gray-500">{new Date(c.updatedAt).toLocaleString()}</div>
                  </div>
                  <div className="ml-auto shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-300">{c.messageCount}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

