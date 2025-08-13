"use client";

import React from "react";

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
  // Presets
  presets: PresetModel[];
  selectedPresetKey: string;
  setSelectedPresetKey: (val: string) => void;
  loadingPresets: boolean;
  applyPreset: (p: PresetModel) => void;
  savePreset: () => void;
  presetName: string;
  setPresetName: (val: string) => void;
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
  audience: string;
  setAudience: (val: string) => void;
  temperature: number;
  setTemperature: (val: number) => void;
  remember: boolean;
  setRemember: (val: boolean) => void;
  // Type-specific
  stylePreset: string;
  setStylePreset: (val: string) => void;
  aspectRatio: string;
  setAspectRatio: (val: string) => void;
  includeTests: boolean;
  setIncludeTests: (val: boolean) => void;
  requireCitations: boolean;
  setRequireCitations: (val: boolean) => void;
  styleGuidelines: string;
  setStyleGuidelines: (val: string) => void;
}

const cn = (...arr: Array<string | false | null | undefined>) => arr.filter(Boolean).join(" ");

const Avatar: React.FC<{ name?: string | null; email?: string | null; image?: string | null }> = ({ name, email, image }) => {
  const displayName = name ?? (email ? email.split("@")[0] : undefined) ?? "User";
  const initials = displayName
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
        <img src={image} alt={displayName} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-700 text-sm text-white">{initials}</div>
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-100">{displayName}</div>
      </div>
    </div>
  );
};

export default function FiltersSidebar(props: FiltersSidebarProps) {
  const {
    user,
    onClose,
    presets,
    selectedPresetKey,
    setSelectedPresetKey,
    loadingPresets,
    applyPreset,
    savePreset,
    presetName,
    setPresetName,
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
    audience,
    setAudience,
    temperature,
    setTemperature,
    remember,
    setRemember,
    stylePreset,
    setStylePreset,
    aspectRatio,
    setAspectRatio,
    includeTests,
    setIncludeTests,
    requireCitations,
    setRequireCitations,
    styleGuidelines,
    setStyleGuidelines,
  } = props;

  return (
    <div className="flex h-full w-80 flex-col gap-4 border-r border-gray-800 bg-gray-900 p-3 md:p-4">
      <div className="flex items-center justify-between">
        <Avatar name={user?.name} email={user?.email ?? undefined} image={user?.image ?? undefined} />
        <a
          href="/api/auth/signout"
          className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-200 transition hover:border-red-500 hover:text-white"
        >
          Logout
        </a>
      </div>

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
          <option value="">{loadingPresets ? "Loading…" : presets.length ? "Select a preset" : "No presets yet"}</option>
          {presets.map((p) => (
            <option key={p.id ?? p.name} value={p.id ?? p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2">
        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name"
          className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={savePreset} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:bg-blue-800">
          Save
        </button>
      </div>

      <div className="h-px w-full bg-gray-800" />

      <div className="grid grid-cols-2 gap-3">
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
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Audience</label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-2 text-xs text-gray-100 shadow-sm transition hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
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
        <label className="flex items-center gap-2 text-xs text-gray-200">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember my settings
        </label>
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

      <div>
        <label className="mb-1 block text-xs text-gray-400">Additional style guidelines</label>
        <textarea
          value={styleGuidelines}
          onChange={(e) => setStyleGuidelines(e.target.value)}
          className="min-h-[60px] w-full resize-y rounded-lg border border-gray-700 bg-gray-800 p-2 text-xs text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mt-auto pt-2 text-[10px] text-gray-500">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onClose) onClose();
          }}
          className="inline md:hidden"
        >
          Close
        </a>
      </div>
    </div>
  );
}


