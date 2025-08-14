"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FiltersSidebar from "./FiltersSidebar";
import { api } from "@/trpc/react";

type Mode = "build" | "enhance";
type TaskType = "general" | "coding" | "image" | "research" | "writing" | "marketing";
type Tone = "neutral" | "friendly" | "formal" | "technical" | "persuasive";
type Detail = "brief" | "normal" | "detailed";
type Format = "plain" | "markdown" | "json";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type UserInfo = { name?: string | null; image?: string | null; email?: string | null };

interface ChatClientProps { user?: UserInfo }

export default function ChatClient({ user }: ChatClientProps) {
  // Utility to compose class names
  const cn = (...arr: Array<string | false | null | undefined>) => arr.filter(Boolean).join(" ");

  const [mode, setMode] = useState<Mode>("build");
  const [taskType, setTaskType] = useState<TaskType>("general");
  const [tone, setTone] = useState<Tone>("neutral");
  const [detail, setDetail] = useState<Detail>("normal");
  const [format, setFormat] = useState<Format>("markdown");
  const [language, setLanguage] = useState("English");
  const [temperature, setTemperature] = useState(0.7);
  // Type-specific
  const [stylePreset, setStylePreset] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [includeTests, setIncludeTests] = useState(true);
  const [requireCitations, setRequireCitations] = useState(true);
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<Array<{ id?: string; name: string; mode: Mode; taskType: TaskType; options?: any }>>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [selectedPresetKey, setSelectedPresetKey] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [genDots, setGenDots] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const MAX_INPUT_HEIGHT = 200;
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // tRPC utilities and queries for chats
  const utils = api.useUtils();
  const { data: chatList } = api.chat.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const createChat = api.chat.create.useMutation();
  const appendMessages = api.chat.appendMessages.useMutation({
    onSuccess: async () => {
      await utils.chat.list.invalidate();
    },
  });
  const removeChat = api.chat.remove.useMutation({
    onSuccess: async () => {
      await utils.chat.list.invalidate();
    },
  });

  const responseEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    responseEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Animate generating ellipsis while awaiting AI response
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setGenDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, [loading]);

  const autoResize = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = MAX_INPUT_HEIGHT;
    const needed = Math.min(el.scrollHeight, max);
    el.style.height = `${needed}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [MAX_INPUT_HEIGHT]);

  // Close sidebar on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    autoResize();
  }, [autoResize]);

  useEffect(() => {
    const load = async () => {
      setLoadingPresets(true);
      try {
        const res = await fetch("/api/presets");
        if (res.ok) {
          const data = await res.json();
          setPresets(data.presets ?? []);
        }
      } finally {
        setLoadingPresets(false);
      }
    };
    void load();
  }, []);

  // Optional: restore last opened chat id from local storage (no writes back)
  useEffect(() => {
    try {
      const lastId = localStorage.getItem("pc_current_chat");
      if (lastId) setCurrentChatId(lastId);
    } catch {
      // noop
    }
  }, []);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);
  const applyPreset = useCallback((p: { name: string; mode: Mode; taskType: TaskType; options?: any }) => {
    setPresetName(p.name);
    setMode(p.mode);
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

  const startNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setError(null);
    setCurrentChatId(null);
    try { localStorage.removeItem("pc_current_chat"); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  
  

  const savePreset = useCallback(async () => {
    const name = presetName.trim();
    if (!name) {
      setError("Please enter a preset name");
      return;
    }
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mode,
          taskType,
          options: {
            tone,
            detail,
            format,
            language: language || undefined,
            temperature,
            stylePreset: taskType === "image" ? stylePreset : undefined,
            aspectRatio: taskType === "image" ? aspectRatio : undefined,
            includeTests: taskType === "coding" ? includeTests : undefined,
            requireCitations: taskType === "research" ? requireCitations : undefined,
          },
        }),
      });
      if (!res.ok) throw new Error("Failed to save preset");
      const data = await res.json();
      const updated = presets.filter((p) => p.name !== data.preset.name);
      updated.unshift(data.preset);
      setPresets(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [presetName, mode, taskType, tone, detail, format, language, temperature, stylePreset, aspectRatio, includeTests, requireCitations, presets]);

  const ensureChatId = useCallback(async (firstLineForTitle?: string) => {
    if (currentChatId) {
      // Prefer validating locally against loaded chat list to avoid noisy errors
      const list = chatList ?? (await utils.chat.list.fetch()).map((c: any) => ({ id: c.id }));
      const exists = Array.isArray(list) && list.some((c: any) => c.id === currentChatId);
      if (exists) return currentChatId;
      setCurrentChatId(null);
      try { localStorage.removeItem("pc_current_chat"); } catch {}
    }
    const title = (firstLineForTitle ?? "").slice(0, 40) || "New chat";
    const created = await createChat.mutateAsync({ title });
    setCurrentChatId(created.id);
    try { localStorage.setItem("pc_current_chat", created.id); } catch {}
    return created.id;
  }, [currentChatId, createChat, chatList, utils.chat.list]);

  const send = useCallback(async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    setError(null);
    // Ensure chat exists (create in DB if needed)
    let chatId: string;
    try {
      chatId = await ensureChatId(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start chat");
      return;
    }
    const userMsg: MessageItem = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => {
      // Cap chat at 50 messages
      const next = [...m, userMsg];
      return next.slice(Math.max(0, next.length - 50));
    });
    // Append user message to DB (cap enforced server-side)
    try {
      await appendMessages.mutateAsync({ chatId, messages: [{ id: userMsg.id, role: userMsg.role, content: userMsg.content }], cap: 50 });
    } catch (e) {
      // Keep UI responsive even if DB append fails
    }
    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${base}/api/gemini/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
            // type-specific
            stylePreset: taskType === "image" ? (stylePreset as any) : undefined,
            aspectRatio: taskType === "image" ? (aspectRatio as any) : undefined,
            includeTests: taskType === "coding" ? includeTests : undefined,
            requireCitations: taskType === "research" ? requireCitations : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Request failed");
      const assistantMsg: MessageItem = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.output as string,
      };
      setMessages((m) => {
        const next = [...m, assistantMsg];
        return next.slice(Math.max(0, next.length - 50));
      });
      // Append assistant message to DB
      try {
        await appendMessages.mutateAsync({ chatId, messages: [{ id: assistantMsg.id, role: assistantMsg.role, content: assistantMsg.content }], cap: 50 });
      } catch {
        // noop
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [canSend, input, mode, taskType, tone, detail, format, language, temperature, stylePreset, aspectRatio, includeTests, requireCitations, ensureChatId, appendMessages]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const selectChat = useCallback(async (id: string) => {
    setCurrentChatId(id);
    try {
      const data = await utils.chat.get.fetch({ chatId: id, limit: 50 });
      const loaded: MessageItem[] = data.messages.map((m: { id: string; role: string; content: string }) => ({ id: m.id, role: m.role as any, content: m.content }));
      setMessages(loaded);
      setInput("");
      try { localStorage.setItem("pc_current_chat", id); } catch {}
      // Scroll to bottom after hydration
      requestAnimationFrame(() => responseEndRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (err) {
      // Swallow errors from invalid chat id to avoid noisy query errors
      console.warn("Failed to load chat; clearing selection", err);
      setMessages([]);
      setCurrentChatId(null);
      try { localStorage.removeItem("pc_current_chat"); } catch {}
    }
  }, [utils.chat.get]);

  const deleteChat = useCallback(async (id: string) => {
    try {
      await removeChat.mutateAsync({ chatId: id });
      if (currentChatId === id) {
        setCurrentChatId(null);
        setMessages([]);
      }
      await utils.chat.list.invalidate();
    } catch {
      // noop
    }
  }, [removeChat, currentChatId, utils.chat.list]);

  const copyMessage = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 2000);
    } catch {
      // noop
    }
  }, []);

  return (
    <div className="relative flex min-h-svh w-full">
      {/* Sidebar backdrop (mobile only) */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden",
          sidebarOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={cn(
          // Mobile: slide-over
          "fixed inset-y-0 left-0 z-40 w-80 -translate-x-full transform transition-transform duration-200 md:relative md:inset-auto md:transform-none md:transition-[width] md:duration-200 md:shrink-0",
          sidebarOpen ? "translate-x-0 md:w-80 md:pointer-events-auto" : "-translate-x-full md:w-0 md:overflow-hidden md:pointer-events-none"
        )}
      >
        <FiltersSidebar
          user={user}
          onClose={() => setSidebarOpen(false)}
          presets={presets}
          selectedPresetKey={selectedPresetKey}
          setSelectedPresetKey={setSelectedPresetKey}
          loadingPresets={loadingPresets}
          applyPreset={applyPreset}
          savePreset={savePreset}
          presetName={presetName}
          setPresetName={setPresetName}
          chats={useMemo(() => (chatList ?? []).map((c: { id: string; title?: string | null; updatedAt: string | Date; messageCount?: number; _count?: { messages: number } }) => ({ id: c.id, title: c.title ?? "Untitled", updatedAt: (typeof c.updatedAt === "string" ? new Date(c.updatedAt).getTime() : (c.updatedAt as Date).getTime()), messageCount: c.messageCount ?? (c._count?.messages ?? 0) })), [chatList])}
          currentChatId={currentChatId}
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
          taskType={taskType}
          setTaskType={(v) => setTaskType(v)}
          mode={mode}
          setMode={(v) => setMode(v)}
          tone={tone}
          setTone={(v) => setTone(v)}
          detail={detail}
          setDetail={(v) => setDetail(v)}
          format={format}
          setFormat={(v) => setFormat(v)}
          language={language}
          setLanguage={setLanguage}
          temperature={temperature}
          setTemperature={setTemperature}
          stylePreset={stylePreset}
          setStylePreset={setStylePreset}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          includeTests={includeTests}
          setIncludeTests={setIncludeTests}
          requireCitations={requireCitations}
          setRequireCitations={setRequireCitations}
        />
      </div>

      {/* Chat area */}
      <div className="flex min-h-svh flex-1 flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md border border-gray-700 px-2 py-1 text-sm text-gray-200 transition hover:border-blue-500 hover:text-white"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Open filters sidebar"
              title="Toggle sidebar"
            >
              ☰
            </button>
            <div className="text-lg font-semibold text-blue-400">PromptCrafter <i>by sammyhamwi.ai</i></div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-200 transition hover:border-indigo-500 hover:text-white"
              aria-label="Start a new chat"
            >
              + New Chat
            </button>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-700 text-gray-200 transition hover:border-indigo-500 hover:text-white"
              aria-label="How to use"
              title="How to use"
            >
              ?
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="mx-auto w-full max-w-3xl">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400">Start by typing a request below and press Enter or Send.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={m.id} className={isUser ? "self-end" : "self-start"}>
                      <div
                        className={
                          "relative max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 pr-9 text-sm shadow-sm transition-[max-width,transform,background-color] duration-200 " +
                          (isUser
                            ? "rounded-br-sm bg-indigo-600 text-white"
                            : "rounded-bl-sm bg-gray-800 text-gray-100")
                        }
                      >
                        {m.content}
                        <button
                          type="button"
                          aria-label="Copy message"
                          onClick={() => void copyMessage(m.id, m.content)}
                          className="absolute right-2 top-2 rounded p-1 opacity-70 transition-opacity hover:bg-white/10 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/20"
                        >
                          {copiedId === m.id ? (
                            <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M9 9h9v12H9z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.2" />
                              <path d="M6 3h9v12H6z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="self-start">
                    <div className="relative max-w-[80%] rounded-2xl rounded-bl-sm bg-gray-800 px-4 py-3 pr-9 text-sm text-gray-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>Generating{".".repeat(genDots)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={responseEndRef} />
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-md border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">{error}</div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 border-t border-gray-800 bg-gray-900/80 px-3 py-3 backdrop-blur md:px-4">
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onInput={autoResize}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Ensure smooth growth while typing even if onInput coalesces
                  autoResize();
                }}
                onKeyDown={onKeyDown}
                placeholder={mode === "build" ? "Describe what you want to build..." : "Paste your prompt to enhance..."}
                className="flex-1 resize-none rounded-2xl border border-white/10 bg-gray-900/60 p-3 text-sm text-gray-100 shadow-sm transition-[height] duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
                rows={1}
                style={{ maxHeight: MAX_INPUT_HEIGHT, overflowY: "auto" }}
              />
              <button
                onClick={() => void send()}
                disabled={!canSend}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition enabled:hover:bg-indigo-700 disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {helpOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            aria-modal="true"
            role="dialog"
            aria-label="How to use PromptCrafter"
          >
            <div className="absolute inset-0 bg-black/60" onClick={() => setHelpOpen(false)} />
            <div
              className="relative z-10 w-[92vw] max-w-xl rounded-xl border border-white/10 bg-gray-900 p-5 text-gray-100 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-700 text-gray-300 transition hover:border-red-500 hover:text-white"
                aria-label="Close help"
                title="Close"
              >
                ✕
              </button>
              <div className="mb-3 text-lg font-semibold">How to use</div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-300">💬</div>
                  <div className="flex-1">
                    <div className="font-medium">Send a Message</div>
                    <div className="mt-1 flex items-center gap-2 text-gray-300">
                      <span className="text-xl">→</span>
                      <span>Type in the input bar below and press Enter or click <span className="rounded border border-white/20 px-1 py-0.5">Send</span>.</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-300">🗂️</div>
                  <div className="flex-1">
                    <div className="font-medium">Start a New Chat</div>
                    <div className="mt-1 flex items-center gap-2 text-gray-300">
                      <span className="text-xl">→</span>
                      <span>Click the <span className="rounded border border-white/20 px-1 py-0.5">New Chat</span> button in the header.</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-800/40 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600/20 text-blue-300">📜</div>
                  <div className="flex-1">
                    <div className="font-medium">View Chat History</div>
                    <div className="mt-1 flex items-center gap-2 text-gray-300">
                      <span className="text-xl">→</span>
                      <span>Open the sidebar and select from your conversations list.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


