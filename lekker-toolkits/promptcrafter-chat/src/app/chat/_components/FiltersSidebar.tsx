"use client";

import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/trpc/react";

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
  openTutorial?: () => void;
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

const Avatar: React.FC<{ name?: string | null; email?: string | null; image?: string | null }> = ({ name, email, image }) => {
  const fullName = name ?? (email ? email.split("@")[0] : undefined) ?? "User";
  const visibleName = fullName.length > 10 ? fullName.slice(0, 10) : fullName;
  const initials = fullName
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={fullName} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-sm text-white">{initials}</div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-100" title={fullName}>{visibleName}</div>
      </div>
    </div>
  );
};

export default function FiltersSidebar(props: FiltersSidebarProps) {
  const {
    user,
    onClose,
    openTutorial,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar name={user?.name} email={user?.email ?? undefined} image={user?.image ?? undefined} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-200 transition hover:border-indigo-500 hover:text-white"
            title="Account"
            onClick={() => openAccount && openAccount()}
          >
            👤
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-200 transition hover:border-red-500 hover:text-white"
            onClick={() => {
              const box = document.createElement("div");
              box.className = "fixed inset-0 z-50 flex items-center justify-center";
              box.innerHTML = `
                <div class=\"absolute inset-0 bg-black/60\"></div>
                <div class=\"relative z-10 w-[92vw] max-w-sm rounded-xl border border-white/10 bg-gray-900 p-4 text-gray-100 shadow-2xl\">
                  <div class=\"text-base font-semibold mb-2\">Confirm logout</div>
                  <div class=\"text-sm text-gray-300\">Are you sure you want to log out?</div>
                  <div class=\"mt-4 flex items-center justify-end gap-2\">
                    <button id=\"pc_cancel\" class=\"rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm\">Cancel</button>
                    <a id=\"pc_confirm\" href=\"/api/auth/signout\" class=\"rounded-md border border-red-600 bg-red-600/20 px-3 py-1.5 text-sm text-red-200\">Logout</a>
                  </div>
                </div>`;
              document.body.appendChild(box);
              const remove = () => box.remove();
              document.getElementById("pc_cancel")?.addEventListener("click", () => remove(), { once: true });
            }}
          >
            Logout
          </button>
        </div>
      </div>
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
        <div className="text-xs font-semibold text-gray-400">Presets</div>
        <div>
          <select
            value={selectedPresetKey}
            onChange={(e) => {
              const key = e.target.value;
              setSelectedPresetKey(key);
              const p = presets.find((x) => (x.id ?? x.name) === key);
              if (p) applyPreset(p);
            }}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>{loadingPresets ? "Loading…" : presets.length ? "Select a preset" : "No presets - create one!"}</option>
            {presets.map((p) => (
              <option key={p.id ?? p.name} value={p.id ?? p.name}>
                {(defaultPresetId && p.id === defaultPresetId) ? "(Default) " : ""}{p.name}
              </option>
            ))}
          </select>
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
            <button
              type="button"
              onClick={() => openInfo && openInfo()}
              className="inline-flex items-center gap-1 rounded border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-300 transition hover:bg-blue-500/20 hover:text-blue-200"
              title="Learn about each setting"
            >
              ℹ️ Info
            </button>
          </div>
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
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as TaskType)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="coding">Coding</option>
              <option value="image">Image</option>
              <option value="research">Research</option>
              <option value="writing">Writing</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="build">Build</option>
              <option value="enhance">Enhance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="neutral">Neutral</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="technical">Technical</option>
              <option value="persuasive">Persuasive</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Detail</label>
            <select
              value={detail}
              onChange={(e) => setDetail(e.target.value as Detail)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="brief">Brief</option>
              <option value="normal">Normal</option>
              <option value="detailed">Detailed</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Format)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="plain">Plain</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="English">English</option>
              <option value="Dutch">Dutch</option>
              <option value="Arabic">Arabic</option>
              <option value="Mandarin Chinese">Mandarin Chinese</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="Russian">Russian</option>
              <option value="Urdu">Urdu</option>
            </select>
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
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="photorealistic">Photorealistic</option>
                <option value="illustration">Illustration</option>
                <option value="3d">3D</option>
                <option value="anime">Anime</option>
                <option value="watercolor">Watercolor</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1:1">1:1</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="4:3">4:3</option>
              </select>
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
        {/* Note: Tutorial button moved to fixed bottom section for visual separation */}
      </div>
      ) : (
      <ChatsTab
        chats={sortedChats}
        currentChatId={currentChatId}
        onSelectChat={onSelectChat}
        onDeleteChat={onDeleteChat}
      />
      )}

      <div className="shrink-0 border-t border-gray-800 pt-3">
        {/* Separated Tutorial button for clarity */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => openTutorial && openTutorial()}
            className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-md border border-indigo-500/50 bg-indigo-500/10 px-3 py-2 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20 hover:text-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
            aria-label="Tutorial"
            title="Tutorial"
          >
            Tutorial
          </button>
        </div>
      </div>
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600/20 text-indigo-300">💬</div>
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

