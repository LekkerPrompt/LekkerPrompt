// Centralized descriptive expansions for image style presets.
// These get woven into generated image prompts (plain format) to enrich output
// while staying concise and avoiding copyrighted proper nouns.

export type ImageStylePreset = "photorealistic" | "illustration" | "3d" | "anime" | "watercolor";

interface StyleDescriptor {
  label: string;
  baseTags: string[];      // core stylistic tokens
  lighting?: string[];     // optional lighting adjectives
  renderingHints?: string[]; // medium / rendering engine style hints
  colorHints?: string[];   // palette suggestions
}

export const IMAGE_STYLE_PRESETS: Record<ImageStylePreset, StyleDescriptor> = {
  photorealistic: {
    label: "Photorealistic",
    baseTags: ["ultra realistic", "high dynamic range", "sharp focus", "8k detailed"],
    lighting: ["natural light", "soft global illumination"],
    renderingHints: ["cinematic depth of field"],
    colorHints: ["balanced color grading"],
  },
  illustration: {
    label: "Illustration",
    baseTags: ["detailed digital illustration", "clean line art", "crisp edges"],
    lighting: ["soft diffuse lighting"],
    renderingHints: ["vector-inspired shading"],
    colorHints: ["harmonious palette"],
  },
  "3d": {
    label: "3D Render",
    baseTags: ["high detail 3d render", "physically based materials", "ray traced reflections"],
    lighting: ["studio lighting", "subtle volumetrics"],
    renderingHints: ["unreal engine look"],
    colorHints: ["cinematic color grade"],
  },
  anime: {
    label: "Anime",
    baseTags: ["polished anime style", "expressive characters", "clean cel shading", "true hand drawn japanese anime styling", "studio quality"],
    lighting: ["soft rim lighting", "gentle glow"],
    renderingHints: ["high fidelity line work"],
    colorHints: ["vibrant yet balanced palette"],
  },
  watercolor: {
    label: "Watercolor",
    baseTags: ["delicate watercolor painting", "organic pigment diffusion", "subtle paper texture"],
    lighting: ["ambient daylight"],
    renderingHints: ["layered translucent washes"],
    colorHints: ["soft complementary tones"],
  },
};

export function buildStylePresetPhrase(preset: ImageStylePreset): string {
  const p = IMAGE_STYLE_PRESETS[preset];
  const parts = [
    ...p.baseTags,
    ...(p.lighting || []),
    ...(p.renderingHints || []),
    ...(p.colorHints || []),
  ];
  return Array.from(new Set(parts)).join(", ");
}
