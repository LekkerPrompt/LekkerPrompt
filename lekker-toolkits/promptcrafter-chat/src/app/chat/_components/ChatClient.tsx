"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FiltersSidebar from "./FiltersSidebar";

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
  const [audience, setAudience] = useState("");
  const [language, setLanguage] = useState("English");
  const [styleGuidelines, setStyleGuidelines] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  // Type-specific
  const [stylePreset, setStylePreset] = useState("photorealistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [includeTests, setIncludeTests] = useState(true);
  const [requireCitations, setRequireCitations] = useState(true);
  const [remember, setRemember] = useState(true);
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
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    const max = 200;
    const needed = Math.min(el.scrollHeight, max);
    el.style.height = `${needed}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, []);

  useEffect(() => {
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

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);
  const applyPreset = useCallback((p: { name: string; mode: Mode; taskType: TaskType; options?: any }) => {
    setPresetName(p.name);
    setMode(p.mode);
    setTaskType(p.taskType);
    const o = p.options ?? {};
    if (o.tone) setTone(o.tone);
    if (o.detail) setDetail(o.detail);
    if (o.format) setFormat(o.format);
    setAudience(o.audience ?? "");
    setLanguage(o.language ?? "English");
    setStyleGuidelines(o.styleGuidelines ?? "");
    setTemperature(typeof o.temperature === "number" ? o.temperature : 0.7);
    setStylePreset(o.stylePreset ?? "photorealistic");
    setAspectRatio(o.aspectRatio ?? "1:1");
    setIncludeTests(!!o.includeTests);
    setRequireCitations(!!o.requireCitations);
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
            audience: audience || undefined,
            language: language || undefined,
            styleGuidelines: styleGuidelines || undefined,
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
  }, [presetName, mode, taskType, tone, detail, format, audience, language, styleGuidelines, temperature, stylePreset, aspectRatio, includeTests, requireCitations, presets]);

  const send = useCallback(async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput("");
    setError(null);
    const userMsg: MessageItem = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
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
            audience: audience || undefined,
            language: language || undefined,
            styleGuidelines: styleGuidelines || undefined,
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
      setMessages((m) => [...m, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [canSend, input, mode, taskType, tone, detail, format, audience, language, styleGuidelines, temperature, stylePreset, aspectRatio, includeTests, requireCitations]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

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
      {/* Mobile backdrop */}
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
          "fixed inset-y-0 left-0 z-40 w-80 -translate-x-full transform transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen && "translate-x-0"
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
          audience={audience}
          setAudience={setAudience}
          temperature={temperature}
          setTemperature={setTemperature}
          remember={remember}
          setRemember={setRemember}
          stylePreset={stylePreset}
          setStylePreset={setStylePreset}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          includeTests={includeTests}
          setIncludeTests={setIncludeTests}
          requireCitations={requireCitations}
          setRequireCitations={setRequireCitations}
          styleGuidelines={styleGuidelines}
          setStyleGuidelines={setStyleGuidelines}
        />
      </div>

      {/* Chat area */}
      <div className="flex min-h-svh flex-1 flex-col">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-800 bg-gray-900/80 px-4 py-3 backdrop-blur md:border-none md:bg-transparent">
          <button
            type="button"
            className="rounded-md border border-gray-700 px-2 py-1 text-sm text-gray-200 transition hover:border-blue-500 hover:text-white md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open filters sidebar"
          >
            ☰
          </button>
          <div className="text-lg font-semibold text-blue-400">PromptCrafter AI Chat by sammyhamwi.ai</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
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
                        "relative max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 pr-9 text-sm shadow-sm " +
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

        <div className="sticky bottom-0 z-10 border-t border-gray-800 bg-gray-900/80 px-3 py-3 backdrop-blur md:px-4">
          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onInput={autoResize}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={mode === "build" ? "Describe what you want to build..." : "Paste your prompt to enhance..."}
              className="flex-1 resize-none rounded-2xl border border-white/10 bg-gray-900/60 p-3 text-sm text-gray-100 shadow-sm transition-[height] duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
              style={{ maxHeight: 200, overflowY: "auto" }}
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
    </div>
  );
}


