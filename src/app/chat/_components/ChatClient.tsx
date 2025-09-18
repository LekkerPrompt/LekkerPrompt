"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/trpc/react";
import { CustomSelect } from "@/components/CustomSelect";
import MessageFeedback from "@/components/MessageFeedback";
import RagInfoViewer from "@/components/RagInfoViewer";
import { Icon } from "@/components/Icon";
import { isElectronRuntime } from '@/lib/runtime';
import Titlebar from "@/components/Titlebar";

type MessageRole = "user" | "assistant";
interface MessageItem { id: string; role: MessageRole; content: string; userFeedback?: 'like' | 'dislike' | undefined; }
type UserInfo = { name?: string | null; image?: string | null; email?: string | null };

export default function ChatClient(_props: { user?: UserInfo }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string>("Gemma 3 4B");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelMenuUp, setModelMenuUp] = useState(false);
  const modelBtnRef = useRef<HTMLButtonElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [showAllChatsOpen, setShowAllChatsOpen] = useState(false);
  const [ragInfoOpen, setRagInfoOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<'default' | 'warm' | 'light'>('default');
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [presetSelectorOpen, setPresetSelectorOpen] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Material UI + app settings (presets)
type Mode = "build" | "enhance";
type TaskType = "general" | "coding" | "image" | "research" | "writing" | "marketing";
type Tone = "neutral" | "friendly" | "formal" | "technical" | "persuasive";
type Detail = "brief" | "normal" | "detailed";
type Format = "plain" | "markdown" | "json";

  const [mode, setMode] = useState<Mode>("build");
  const [taskType, setTaskType] = useState<TaskType>("general");
  const [tone, setTone] = useState<Tone>("neutral");
  const [detail, setDetail] = useState<Detail>("normal");
  const [format, setFormat] = useState<Format>("markdown");
  const [language, setLanguage] = useState("English");
  const [temperature, setTemperature] = useState(0.7);
  const [stylePreset, setStylePreset] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [includeTests, setIncludeTests] = useState(true);
  const [requireCitations, setRequireCitations] = useState(true);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<Array<{ id?: string; name: string; taskType: TaskType; options?: any }>>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState("");
  const [defaultPresetId, setDefaultPresetId] = useState<string | null>(null);

  // TRPC
  const utils = api.useUtils();
  const { data: chatList } = api.chat.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const createChat = api.chat.create.useMutation();
  const appendMessages = api.chat.appendMessages.useMutation({ onSuccess: async () => { await utils.chat.list.invalidate(); } });
  const removeChat = api.chat.remove.useMutation({ onSuccess: async () => { await utils.chat.list.invalidate(); } });

  // Load local Ollama models only
  useEffect(() => {
    const load = async () => {
      try {
        // Load current config and available models
        const [cfgRes, availRes] = await Promise.all([
          fetch('/api/model/config'),
          fetch('/api/model/available?baseUrl=http://localhost:11434')
        ]);
        
        if (availRes.ok) {
          const av = await availRes.json();
          setAvailableModels(Array.isArray(av?.available) ? av.available : []);
        }
        
        if (cfgRes.ok) {
          const cfgData = await cfgRes.json();
          const cfg = cfgData?.config;
          if (cfg && cfg.provider === 'ollama' && typeof cfg.model === 'string') {
          const size = (cfg.model.split(':')[1] || '').toUpperCase();
            setModelLabel(size ? `Gemma 3 ${size}` : 'Gemma 3');
          }
        }
      } catch {/* ignore */}
    };
    load();
  }, []);

  // Theme management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-preference') as 'default' | 'warm' | 'light' | null;
    if (savedTheme) {
      setCurrentTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme === 'default' ? '' : savedTheme);
    }
  }, []);

  const setTheme = useCallback((theme: 'default' | 'warm' | 'light') => {
    setCurrentTheme(theme);
    document.documentElement.setAttribute('data-theme', theme === 'default' ? '' : theme);
    localStorage.setItem('theme-preference', theme);
    setThemeMenuOpen(false);
  }, []);

  const themes = [
    { id: 'default', name: 'Default'},
    { id: 'light', name: 'Light'},
    { id: 'warm', name: 'Earth'},
  ] as const;

  // Refresh available models
  const refreshModels = useCallback(async () => {
    try {
      const directRes = await fetch('/api/model/available?baseUrl=http://localhost:11434');
      if (directRes.ok) {
        const directData = await directRes.json();
        setAvailableModels(Array.isArray(directData?.available) ? directData.available : []);
      }
                } catch {
      setAvailableModels([]);
    }
  }, []);

  // Handle responsive sidebar
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmall = window.innerWidth < 1024; // lg breakpoint
      setIsSmallScreen(isSmall);
      if (!isSmall) setSidebarOpen(false); // Auto-close sidebar on large screens
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Position model dropdown to avoid viewport overflow
  useEffect(() => {
    if (!modelMenuOpen) return;
    const btn = modelBtnRef.current;
    const menu = modelMenuRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedMenuH = Math.min(320, menu?.getBoundingClientRect().height || 240);
    setModelMenuUp(spaceBelow < estimatedMenuH && spaceAbove > spaceBelow);

    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!btn.contains(target) && !(menu && menu.contains(target))) {
        setModelMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setModelMenuOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [modelMenuOpen]);

  // Ensure chat exists or create one
  const ensureChat = useCallback(async (firstLine: string) => {
    if (currentChatId) return currentChatId;
    const title = (firstLine || "New chat").slice(0, 40) || "New chat";
    const created = await createChat.mutateAsync({ title });
    setCurrentChatId(created.id);
    return created.id;
  }, [currentChatId, createChat]);

  // Presets load / helpers
  useEffect(() => {
    const load = async () => {
      setLoadingPresets(true);
      try {
        const [res, defRes] = await Promise.all([
          fetch("/api/presets"),
          fetch("/api/presets/default").catch(() => null),
        ]);
        let defId: string | null = null;
        if (defRes && defRes.ok) {
          const d = await defRes.json().catch(() => ({}));
          defId = typeof d?.defaultPresetId === "string" ? d.defaultPresetId : null;
          setDefaultPresetId(defId);
        }
        if (res.ok) {
          const data = await res.json();
          const list = (data.presets ?? []).map((p: any) => ({ id: p.id, name: p.name, taskType: p.taskType, options: p.options }));
          setPresets(list);
          if (!selectedPresetKey) {
            const pick = (defId && list.find((p: any) => p.id === defId)) || list[0] || null;
            if (pick) {
              setSelectedPresetKey(pick.id ?? pick.name);
              applyPreset(pick);
            }
          }
        }
      } finally {
        setLoadingPresets(false);
      }
    };
    void load();
  }, []);

  const reloadPresets = useCallback(async () => {
    setLoadingPresets(true);
    try {
      const res = await fetch("/api/presets");
      if (res.ok) {
        const data = await res.json();
        setPresets((data.presets ?? []).map((p: any) => ({ id: p.id, name: p.name, taskType: p.taskType, options: p.options })));
      }
    } finally { setLoadingPresets(false); }
  }, []);

  const applyPreset = useCallback((p: { name: string; taskType: TaskType; options?: any }) => {
    setPresetName(p.name);
    setTaskType(p.taskType);
    const o = p.options ?? {};
    if (o.tone) setTone(o.tone);
    if (o.detail) setDetail(o.detail);
    if (o.format) setFormat(o.format);
    setLanguage(o.language ?? "English");
    setTemperature(typeof o.temperature === "number" ? o.temperature : 0.7);
    setStylePreset(o.stylePreset ?? "photorealistic");
    setAspectRatio(o.aspectRatio ?? "1:1");
    setIncludeTests(!!o.includeTests);
    setRequireCitations(!!o.requireCitations);
  }, []);

  const savePreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name) return;
    await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          taskType,
          options: {
          tone, detail, format, language: language || undefined, temperature,
            stylePreset: taskType === "image" ? stylePreset : undefined,
            aspectRatio: taskType === "image" ? aspectRatio : undefined,
            includeTests: taskType === "coding" ? includeTests : undefined,
            requireCitations: taskType === "research" ? requireCitations : undefined,
          },
        }),
      });
  }, [presetName, taskType, tone, detail, format, language, temperature, stylePreset, aspectRatio, includeTests, requireCitations]);

  const deletePreset = useCallback(async (presetId: string, presetName: string) => {
    if (!confirm(`Delete preset "${presetName}"? This cannot be undone.`)) return;
    
    setDeletingPresetId(presetId);
    try {
      const query = presetId ? `id=${encodeURIComponent(presetId)}` : `name=${encodeURIComponent(presetName)}`;
      await fetch(`/api/presets?${query}`, { method: 'DELETE' });
      await reloadPresets();
      
      // If deleted preset was selected, clear selection
      if (selectedPresetKey === presetId || selectedPresetKey === presetName) {
        setSelectedPresetKey("");
      }
    } catch (err) {
      setError('Failed to delete preset');
    } finally {
      setDeletingPresetId(null);
    }
  }, [selectedPresetKey, reloadPresets]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
        const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    const chatId = await ensureChat(text);
    const user: MessageItem = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, user]);
    try {
      // Persist user message and update ID
      try { 
        const userResult = await appendMessages.mutateAsync({ chatId, messages: [{ id: user.id, role: user.role, content: user.content }], cap: 50 });
        // Update the user message ID with the database ID
        const createdUserMessages = userResult?.createdMessages;
        const createdUserId = createdUserMessages?.[0]?.id;
        if (createdUserId) {
          setMessages((m) => m.map(msg => msg.id === user.id ? { ...msg, id: createdUserId } : msg));
        }
      } catch {}

      const res = await fetch('/api/googleai/chat', {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
          body: JSON.stringify({
            input: text,
            mode,
            taskType,
            options: {
              tone,
              detail,
              format,
              language: language || undefined,
              temperature,
              stylePreset: taskType === 'image' ? stylePreset : undefined,
              aspectRatio: taskType === 'image' ? aspectRatio : undefined,
              includeTests: taskType === 'coding' ? includeTests : undefined,
              requireCitations: taskType === 'research' ? requireCitations : undefined,
          }
          }),
        });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error((json?.error && (json.error.message || json.error)) || 'Request failed');
      const output = (json?.data?.output ?? json?.output);
      if (typeof output !== 'string') throw new Error('Invalid response');
      const assistant: MessageItem = { id: crypto.randomUUID(), role: 'assistant', content: output };
      setMessages((m) => [...m, assistant]);
      try { 
        const result = await appendMessages.mutateAsync({ chatId, messages: [{ id: assistant.id, role: assistant.role, content: assistant.content }], cap: 50 });
        // Update the message ID with the database ID for proper feedback tracking
          const createdAssistantMessages = result?.createdMessages;
          const createdAssistantId = createdAssistantMessages?.[0]?.id;
          if (createdAssistantId) {
            setMessages((m) => m.map(msg => msg.id === assistant.id ? { ...msg, id: createdAssistantId } : msg));
          }
      } catch {}
    } catch (e: any) {
      // Handle abort signal specifically
      if (e?.name === 'AbortError' || e?.message?.includes('aborted')) {
        // Don't show error for abort - handled by stopGenerating
      } else {
        setError(e?.message || 'Something went wrong');
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [input, sending, ensureChat, appendMessages, mode, taskType, tone, detail, format, language, temperature, stylePreset, aspectRatio, includeTests, requireCitations]);

  const stopGenerating = useCallback(() => {
    try { 
      abortRef.current?.abort(); 
      // Add aborted message as a chat bubble
      const abortedMsg: MessageItem = { 
        id: crypto.randomUUID(), 
        role: 'assistant', 
        content: 'Response aborted' 
      };
      setMessages((m) => [...m, abortedMsg]);
    } catch {}
    setSending(false);
  }, []);

  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, sending]);

  const hasMessages = messages.length > 0;
  const recentChats = useMemo(() => (chatList ?? []).slice().sort((a: any, b: any) => new Date(b.updatedAt as any).getTime() - new Date(a.updatedAt as any).getTime()), [chatList]);
  const recentThree = useMemo(() => recentChats.slice(0, 3), [recentChats]);

  // Chat selection & deletion
  const selectChat = useCallback(async (id: string) => {
    // Optimistically set active selection for immediate visual feedback
    const prevId = currentChatId;
    setCurrentChatId(id);
    try {
      if (!chatList) void utils.chat.list.invalidate();
      const data = await utils.chat.get.fetch({ chatId: id, limit: 50 });
      const loaded: MessageItem[] = (data.messages ?? []).map((m: any) => ({ id: m.id, role: m.role, content: m.content, userFeedback: m.userFeedback }));
      setMessages(loaded);
    } catch (e) {
      setError('Failed to load chat');
      setCurrentChatId(prevId ?? null);
    }
  }, [chatList, utils.chat.get, utils.chat.list, currentChatId]);

  const deleteChat = useCallback(async (id: string) => {
    try { await removeChat.mutateAsync({ chatId: id }); await utils.chat.list.invalidate(); } catch {}
    if (currentChatId === id) { setCurrentChatId(null); setMessages([]); }
  }, [removeChat, utils.chat.list, currentChatId]);

  // Copy message content
  const copyMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  }, []);

  // Render message content with code block support
  const renderMessageContent = useCallback((content: string, messageId: string) => {
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        const textBefore = content.slice(lastIndex, match.index);
        if (textBefore.trim()) {
          parts.push(
            <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
              {textBefore}
            </span>
          );
        }
      }

      const [, language, code] = match;
      const codeId = `code-${messageId}-${match.index}`;
      
      parts.push(
        <div key={`code-${match.index}`} className="bubble-code-block">
          <div className="bubble-code-header">
            <span className="bubble-code-lang">{language || 'code'}</span>
            <button
              type="button"
              className="bubble-code-copy"
              onClick={() => copyMessage(codeId, code || '')}
              title="Copy code"
            >
              <Icon name={copiedMessageId === codeId ? 'check' : 'copy'} />
            </button>
          </div>
          <div className="bubble-code-content">{code}</div>
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      if (remainingText.trim()) {
        parts.push(
          <span key={`text-${lastIndex}`} style={{ whiteSpace: 'pre-wrap' }}>
            {remainingText}
          </span>
        );
      }
    }

    return parts.length > 0 ? <>{parts}</> : <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>;
  }, [copyMessage, copiedMessageId]);

  return (
    <>
    {/* Electron Titlebar */}
    {isElectronRuntime() && <Titlebar />}
    
    <div className={isSmallScreen ? "app-shell--mobile" : "app-shell"} style={{ paddingTop: isElectronRuntime() ? 32 : 0 }}>
      {/* Sidebar backdrop for mobile */}
      {isSmallScreen && sidebarOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 25 }}
        onClick={() => setSidebarOpen(false)}
      />
      )}
      
      {/* Left rail (Material list of presets + chat history) */}
      <aside className={isSmallScreen ? `app-rail--mobile ${sidebarOpen ? 'open' : ''}` : "app-rail"} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
        <button type="button" className="md-btn md-btn--primary" style={{ width: '100%' }} onClick={() => { setMessages([]); setCurrentChatId(null); setInput(""); }}>
          New Chat
        </button>

        <div className="text-secondary" style={{ fontSize: 12, letterSpacing: 0.4 }}>CURRENT PRESET</div>
        {loadingPresets ? (
          <div className="text-secondary" style={{ fontSize: 12 }}>Loading…</div>
        ) : (
          <>
            {selectedPresetKey ? (
              (() => {
                const selectedPreset = presets.find(p => (p.id ?? p.name) === selectedPresetKey);
                return selectedPreset ? (
                  <div className="md-card" style={{ padding: 12, borderRadius: 10, borderColor: 'var(--color-primary)', boxShadow: 'var(--shadow-2)' }}>
                    <div style={{ fontWeight: 600 }}>{selectedPreset.name}</div>
                    <div className="text-secondary" style={{ fontSize: 11, marginTop: 2 }}>{selectedPreset.taskType.charAt(0).toUpperCase() + selectedPreset.taskType.slice(1)}</div>
                  </div>
                ) : (
                  <div className="text-secondary" style={{ fontSize: 12 }}>No preset selected</div>
                );
              })()
            ) : (
              <div className="text-secondary" style={{ fontSize: 12 }}>No preset selected</div>
            )}
            
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="md-btn" onClick={() => setPresetSelectorOpen(true)} style={{ flex: 1 }}>
                Select Preset
              </button>
              <button className="md-btn" onClick={() => {
                const sel = presets.find(p => (p.id ?? p.name) === selectedPresetKey);
                if (sel) {
                  // Prefill editor with selected values for editing
                  setPresetName(sel.name);
                  setTaskType(sel.taskType as any);
                  const o = sel.options || {};
                  setTone(o.tone ?? 'neutral');
                  setDetail(o.detail ?? 'normal');
                  setFormat(o.format ?? 'markdown');
                  setLanguage(o.language ?? 'English');
                  setTemperature(typeof o.temperature === 'number' ? o.temperature : 0.7);
                  setStylePreset(o.stylePreset ?? 'photorealistic');
                  setAspectRatio(o.aspectRatio ?? '1:1');
                  setIncludeTests(!!o.includeTests);
                  setRequireCitations(!!o.requireCitations);
                } else {
                  // Create new preset with current settings (don't change selection)
                  setPresetName("");
                  // Keep current settings as starting point
                }
                setPresetEditorOpen(true);
              }}>
                {selectedPresetKey ? 'Edit' : 'Create'}
              </button>
      </div>
          </>
        )}

        {/* Recent chats pinned to bottom */}
        <div style={{ marginTop: 'auto' }}>
          <div className="text-secondary" style={{ fontSize: 11, letterSpacing: 0.4, marginBottom: 8 }}>RECENT CHATS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentThree.map((c: any) => {
              const isActive = currentChatId === c.id;
              return (
            <button
                  key={c.id}
              type="button"
                  onClick={() => { void selectChat(c.id); }}
                  title={c.title ?? 'Untitled'}
                  style={{
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 0',
                    cursor: 'pointer',
                    color: isActive ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    transition: 'color 120ms ease'
                  }}
                >
                  {(c.title ?? 'Untitled') + ' ...'}
            </button>
              );
            })}
            {recentThree.length === 0 && (
              <div className="text-secondary" style={{ fontSize: 12, padding: '4px 0' }}>No chats yet</div>
            )}
            </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="md-btn" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setShowAllChatsOpen(true)}>Show all</button>
          </div>
            </div>
      </aside>

      {/* Main content */}
      <section className={isSmallScreen ? "app-content--mobile" : "app-content"} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header actions */}
        <div className="app-header" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Hamburger menu for mobile */}
          {isSmallScreen && (
              <button
              className="md-btn" 
              style={{ padding: 8 }} 
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle sidebar"
            >
              ☰
              </button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <button className="md-btn" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setThemeMenuOpen((v) => !v)} title="Change theme">
                <Icon name="palette" />
                <Icon name="chevronDown" className={`dropdown-arrow ${themeMenuOpen ? 'dropdown-arrow--open' : ''}`} />
              </button>
              {themeMenuOpen && (
                <div className="menu-panel" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180 }}>
                  {themes.map((theme) => (
              <button
                      key={theme.id} 
                      className="menu-item" 
                      onClick={() => setTheme(theme.id as 'default' | 'warm' | 'light')}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'flex-start',
                        background: currentTheme === theme.id ? 'var(--color-primary)' : 'transparent',
                        color: currentTheme === theme.id ? 'var(--color-on-primary)' : 'var(--color-on-surface)'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{theme.name}</div>
              </button>
                  ))}
            </div>
          )}
        </div>
            <button className="md-btn" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setSettingsMenuOpen((v) => !v)}>
              Settings
              <Icon name="chevronDown" className={`dropdown-arrow ${settingsMenuOpen ? 'dropdown-arrow--open' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content area (scrolls) */}
        <div style={{ padding: 24, paddingBottom: 200, flex: 1, overflow: 'auto' }}>
          <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            {!hasMessages ? (
              <div>
                <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>How can I help you craft prompts today?</h1>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {messages.map((m) => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div className="bubble-container">
                      <div className={`bubble ${m.role === 'user' ? 'bubble--user' : 'bubble--assistant'}`}>
                        {renderMessageContent(m.content, m.id)}

                      {m.role === 'assistant' && m.content !== 'Response aborted' && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-outline)' }}>
                            <MessageFeedback
                              messageId={m.id}
                              initialFeedback={m.userFeedback ?? null}
                              onChange={(fb) => {
                              setMessages((prev) => prev.map((msg) => 
                                msg.id === m.id ? (fb ? { ...msg, userFeedback: fb } : { ...msg, userFeedback: undefined }) : msg
                              ));
                              }}
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Copy button outside bubble */}
                      <button
                        type="button"
                        className={`bubble-copy ${m.role === 'user' ? 'bubble-copy--user' : 'bubble-copy--assistant'}`}
                        onClick={() => copyMessage(m.id, m.content)}
                        title="Copy message"
                      >
                        <Icon name={copiedMessageId === m.id ? 'check' : 'copy'} />
                      </button>
                    </div>
                      </div>
                ))}
                {sending && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
                    <div className="bubble bubble--assistant" style={{ opacity: .95, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, border: '2px solid var(--color-on-surface-variant)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' }} className="md-spin" />
                      <span>Generating</span>
                      <AnimatedDots />
                      <button
                        type="button"
                        title="Stop generating"
                        onClick={stopGenerating}
                        style={{ 
                          marginLeft: 12, 
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%', 
                          border: '1px solid #dc2626', 
                          background: 'rgba(220, 38, 38, 0.1)', 
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 150ms ease',
                          boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dc2626';
                          e.currentTarget.style.color = '#ffffff';
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(220, 38, 38, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
                          e.currentTarget.style.color = '#dc2626';
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(220, 38, 38, 0.2)';
                        }}
                      >
                        <Icon name="stop" />
                      </button>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}

            {error && (
              <div className="md-card" style={{ padding: 12, marginTop: 12, borderLeft: '4px solid var(--color-primary)' }}>{error}</div>
            )}
          </div>
        </div>

        {/* Floating Composer */}
        <div style={{ position: 'fixed', bottom: 24, left: isSmallScreen ? 24 : 344, right: 24, zIndex: 20 }}>
          <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            <div className="md-card" style={{ padding: '16px', borderRadius: '20px', background: 'var(--color-surface-variant)', border: '1px solid var(--color-outline)' }}>
              {/* Text input (full width) */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="Send a message to start crafting prompts…"
                className="md-input"
                rows={1}
                style={{ resize: 'none', minHeight: 40, maxHeight: 160, background: 'var(--color-surface)', border: '1px solid var(--color-outline)', marginBottom: 12, width: '100%' }}
              />

              {/* Controls row below input */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Model selection (left) */}
                <div style={{ position: 'relative' }}>
                  <button ref={modelBtnRef} type="button" className="md-btn" title="Select model" onClick={() => {
                    const wasOpen = modelMenuOpen;
                    setModelMenuOpen((v) => !v);
                    // Auto-refresh models when opening dropdown
                    if (!wasOpen) {
                      refreshModels();
                    }
                  }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {modelLabel}
                    <Icon name="chevronDown" className={`dropdown-arrow ${modelMenuOpen ? 'dropdown-arrow--open' : ''}`} />
                  </button>
                  {modelMenuOpen && (
                    <div
                      ref={modelMenuRef}
                      className="menu-panel"
                      style={{ position: 'absolute', left: 0, top: modelMenuUp ? 'auto' : 'calc(100% + 6px)', bottom: modelMenuUp ? 'calc(100% + 6px)' : 'auto', maxHeight: 320, overflowY: 'auto' }}
                    >
                      {availableModels.length > 0 ? (
                        availableModels.map((m) => (
                          <button key={m} className="menu-item" onClick={async () => {
                            await fetch('/api/model/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'ollama', baseUrl: 'http://localhost:11434', model: m }) });
                            setModelLabel(`Gemma 3 ${(m.split(':')[1] || '').toUpperCase()}`);
                            setModelMenuOpen(false);
                          }}>{`Gemma 3 ${(m.split(':')[1] || '').toUpperCase()}`}</button>
                        ))
                      ) : (
                        <div>
                          <div className="menu-item" style={{ opacity: 0.6, cursor: 'default' }}>No local models found</div>
                          <button className="menu-item" onClick={() => { refreshModels(); }} style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon name="refresh" />
                            Refresh
                          </button>
                          <div className="menu-divider" />
                          <div className="menu-item" style={{ opacity: 0.6, cursor: 'default', fontSize: 12, padding: '8px 12px' }}>
                            Install Ollama and pull gemma3 models:<br/>
                            <code style={{ fontSize: 11 }}>ollama pull gemma3:1b</code>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Mode + Send (right) */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div className="mode-toggle">
                    <div className={`mode-toggle-slider ${mode === 'enhance' ? 'mode-toggle-slider--enhance' : ''}`} />
                <button
                  type="button"
                      className={`mode-toggle-option ${mode === 'build' ? 'mode-toggle-option--active' : 'mode-toggle-option--inactive'}`}
                      onClick={() => setMode('build')}
                    >
                  Build
                </button>
                <button
                  type="button"
                      className={`mode-toggle-option ${mode === 'enhance' ? 'mode-toggle-option--active' : 'mode-toggle-option--inactive'}`}
                      onClick={() => setMode('enhance')}
                    >
                  Enhance
                </button>
            </div>

              <button
                  type="button"
                    className="md-btn md-btn--primary" 
                onClick={() => void send()}
                    disabled={!input.trim() || sending}
                    style={{ width: 40, height: 40, borderRadius: '50%', padding: 0 }}
                    title="Send message"
                  >
                    ↑
              </button>
            </div>
          </div>
        </div>
        </div>
        </div>
      </section>
    </div>
    {/* App Settings Menu (top-right) */}
    {settingsMenuOpen && (
      <div className="fixed inset-0 z-50" onClick={() => setSettingsMenuOpen(false)}>
        <div className="menu-panel" style={{ position: 'absolute', right: 16, top: 56 }} onClick={(e) => e.stopPropagation()}>
          <button className="menu-item" onClick={() => { try { window.dispatchEvent(new CustomEvent('open-db-location')); } catch {}; setSettingsMenuOpen(false); }}>Data Location</button>
          <button className="menu-item" onClick={() => { try { window.dispatchEvent(new CustomEvent('open-system-prompts')); } catch {}; setSettingsMenuOpen(false); }}>System Prompts</button>
          {/* Model Configuration removed - selection handled via model dropdown */}
          <button className="menu-item" onClick={() => { setRagInfoOpen(true); setSettingsMenuOpen(false); }}>RAG Learning Data</button>
        </div>
      </div>
    )}

    {/* All Chats Modal */}
    {showAllChatsOpen && (
      <div className="modal-container" aria-modal="true" role="dialog" onClick={() => setShowAllChatsOpen(false)}>
        <div className="modal-backdrop-blur" />
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">All Chats</div>
            <button className="md-btn" onClick={() => setShowAllChatsOpen(false)} style={{ padding: '6px 10px' }}>Close</button>
          </div>
          <div className="modal-body">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {(recentChats).map((c: any) => {
                const isActive = currentChatId === c.id;
                return (
                  <li key={c.id}>
              <button
                type="button"
                      aria-current={isActive ? 'true' : undefined}
                      className="md-btn"
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: isActive ? 'rgba(108,140,255,0.12)' : 'transparent',
                        outline: isActive ? '2px solid var(--color-primary)' : 'none',
                        outlineOffset: -2,
                        cursor: 'pointer'
                      }}
                      onClick={() => { void selectChat(c.id); setShowAllChatsOpen(false); }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isActive ? 600 : 500 }}>{c.title ?? 'Untitled'}</span>
                      <span className="text-secondary" style={{ fontSize: 12 }}>{new Date(c.updatedAt as any).toLocaleString()}</span>
              </button>
                  </li>
                );
              })}
                    </ul>
                  </div>
                    </div>
                    </div>
    )}
    {/* Removed separate preset manage menu; Manage opens the editor directly */}

    {/* Preset Editor Modal */}
    {presetEditorOpen && (
      <div className="modal-container" aria-modal="true" role="dialog" onClick={() => setPresetEditorOpen(false)}>
        <div className="modal-backdrop-blur" />
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Edit Preset</div>
            <button className="md-btn" onClick={() => setPresetEditorOpen(false)} style={{ padding: '6px 10px' }}>Close</button>
                    </div>
          <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="text-secondary" style={{ fontSize: 12 }}>Preset Name&emsp;</label>
              <input className="md-input" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" />
                    </div>
            <div>
              <label className="text-secondary" style={{ fontSize: 12 }}>Type</label>
              <CustomSelect value={taskType} onChange={(v) => setTaskType(v as any)} options={[{value:'general',label:'General'},{value:'coding',label:'Coding'},{value:'image',label:'Image'},{value:'research',label:'Research'},{value:'writing',label:'Writing'},{value:'marketing',label:'Marketing'}]} />
                    </div>
            <div>
              <label className="text-secondary" style={{ fontSize: 12 }}>Tone</label>
              <CustomSelect value={tone} onChange={(v) => setTone(v as any)} options={[{value:'neutral',label:'Neutral'},{value:'friendly',label:'Friendly'},{value:'formal',label:'Formal'},{value:'technical',label:'Technical'},{value:'persuasive',label:'Persuasive'}]} />
                    </div>
            <div>
              <label className="text-secondary" style={{ fontSize: 12 }}>Detail</label>
              <CustomSelect value={detail} onChange={(v) => setDetail(v as any)} options={[{value:'brief',label:'Brief'},{value:'normal',label:'Normal'},{value:'detailed',label:'Detailed'}]} />
                  </div>
            <div>
              <label className="text-secondary" style={{ fontSize: 12 }}>Format</label>
              <CustomSelect value={format} onChange={(v) => setFormat(v as any)} options={[{value:'plain',label:'Plain'},{value:'markdown',label:'Markdown'},{value:'json',label:'JSON'}]} />
                </div>
            <div>
              <label className="text-secondary" style={{ fontSize: 12 }}>Language</label>
              <CustomSelect value={language} onChange={(v) => setLanguage(v)} options={[{value:'English',label:'English'},{value:'Dutch',label:'Dutch'},{value:'Arabic',label:'Arabic'},{value:'Mandarin Chinese',label:'Mandarin Chinese'},{value:'Spanish',label:'Spanish'},{value:'French',label:'French'},{value:'Russian',label:'Russian'},{value:'Urdu',label:'Urdu'}]} />
                    </div>
            {taskType === 'image' && (
              <>
                <div>
                  <label className="text-secondary" style={{ fontSize: 12 }}>Image Style</label>
                  <CustomSelect value={stylePreset} onChange={(v) => setStylePreset(v)} options={[{value:'photorealistic',label:'Photorealistic'},{value:'illustration',label:'Illustration'},{value:'3d',label:'3D'},{value:'anime',label:'Anime'},{value:'watercolor',label:'Watercolor'}]} />
                  </div>
                <div>
                  <label className="text-secondary" style={{ fontSize: 12 }}>Aspect Ratio</label>
                  <CustomSelect value={aspectRatio} onChange={(v) => setAspectRatio(v)} options={[{value:'1:1',label:'1:1'},{value:'16:9',label:'16:9'},{value:'9:16',label:'9:16'},{value:'4:3',label:'4:3'}]} />
                  </div>
              </>
              )}
                  </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="md-btn" onClick={() => setPresetEditorOpen(false)}>Cancel</button>
              <button className="md-btn md-btn--primary" onClick={async () => { await savePreset(); await reloadPresets(); setPresetEditorOpen(false); }}>Save</button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* RAG Info Modal */}
    {ragInfoOpen && (
      <div className="modal-container" aria-modal="true" role="dialog" onClick={() => setRagInfoOpen(false)}>
        <div className="modal-backdrop-blur" />
        <div className="modal-content modal-content--large" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">RAG Learning Data</div>
            <button className="md-btn" onClick={() => setRagInfoOpen(false)} style={{ padding: '6px 10px' }}>Close</button>
          </div>
          <div className="modal-body">
            <RagInfoViewer />
          </div>
        </div>
      </div>
    )}

    {/* Preset Selector Modal */}
    {presetSelectorOpen && (
      <div className="modal-container" aria-modal="true" role="dialog" onClick={() => setPresetSelectorOpen(false)}>
        <div className="modal-backdrop-blur" />
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title">Select Preset</div>
            <button className="md-btn" onClick={() => setPresetSelectorOpen(false)} style={{ padding: '6px 10px' }}>Close</button>
          </div>
          <div className="modal-body">
            <div style={{ display: 'grid', gap: 12 }}>
              {/* Create New Preset button at top */}
                    <button
                className="md-btn md-btn--primary" 
                      onClick={() => {
                  // Don't change selectedPresetKey - keep current selection
                  setPresetName("");
                  // Reset form to defaults for new preset creation
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
                  setPresetEditorOpen(true);
                  setPresetSelectorOpen(false);
                }}
                style={{ padding: '12px 16px' }}
              >
                + Create New Preset
                    </button>

              {presets.length > 0 ? (
                presets.map((p) => {
                  const isSel = (p.id ?? p.name) === selectedPresetKey;
                  const presetId = p.id ?? p.name;
                  const isDeleting = deletingPresetId === presetId;
                  
                  return (
                    <div key={presetId} className="md-card" style={{ 
                      padding: 16, 
                      borderRadius: 12, 
                      position: 'relative',
                      borderColor: isSel ? 'var(--color-primary)' : 'var(--color-outline)',
                      borderWidth: isSel ? '2px' : '1px'
                    }}>
                      <div
                        style={{
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: 'transparent',
                          color: isSel ? 'var(--color-primary)' : 'var(--color-on-surface)',
                          padding: 0,
                          border: 'none'
                        }}
                        onClick={() => { 
                          setSelectedPresetKey(presetId); 
                          applyPreset(p); 
                          setPresetSelectorOpen(false);
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{p.taskType.charAt(0).toUpperCase() + p.taskType.slice(1)}</div>
                        {p.options && (
                          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.7 }}>
                            {p.options.tone && `${p.options.tone} tone`}
                            {p.options.detail && ` • ${p.options.detail} detail`}
                            {p.options.format && ` • ${p.options.format}`}
                </div>
              )}
            </div>
                      
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset(presetId, p.name);
                        }}
                        disabled={isDeleting}
                        className="md-btn"
                        style={{ 
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          padding: '4px 8px',
                          fontSize: 11,
                          opacity: isDeleting ? 0.6 : 1
                        }}
                        title={`Delete preset "${p.name}"`}
                      >
                        {isDeleting ? '...' : 'Delete'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="text-secondary" style={{ textAlign: 'center', padding: 24 }}>
                  No presets available. Create your first preset to get started.
          </div>
        )}
      </div>
    </div>
        </div>
      </div>
    )}
    </>
  );
}

function AnimatedDots() {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTicks((t) => (t + 1) % 3), 500);
    return () => clearInterval(id);
  }, []);
  const dots = '.'.repeat((ticks % 3) + 1);
  return <span className="text-secondary" style={{ width: 16, display: 'inline-block' }}>{dots}</span>;
}
