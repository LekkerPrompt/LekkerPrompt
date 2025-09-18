/**
 * PromptCrafter Theme System
 * 
 * This file contains theme definitions that can be used throughout the application.
 * Each theme contains color variables that are referenced in the Tailwind config.
 */

export interface ThemeColors {
  // Base colors
  darkA0: string;
  lightA0: string;
  
  // Primary colors
  primaryA0: string;
  primaryA10: string;
  primaryA20: string;
  primaryA30: string;
  primaryA40: string;
  primaryA50: string;
  
  // Accent and component tokens
  accentA0: string; // Light blue outline for glass

  // Component-specific tokens
  buttonBg: string;
  buttonText: string;
  dropdownBg: string;
  sliderBg: string;
  cardBg: string;
  shadowColor: string;
  
  // Surface colors
  surfaceA0: string;
  surfaceA10: string;
  surfaceA20: string;
  surfaceA30: string;
  surfaceA40: string;
  surfaceA50: string;
  
  // Surface tonal colors
  surfaceTonalA0: string;
  surfaceTonalA10: string;
  surfaceTonalA20: string;
  surfaceTonalA30: string;
  surfaceTonalA40: string;
  surfaceTonalA50: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
}

// Professional dark theme - properly designed for dark UI
export const defaultDarkTheme: Theme = {
  name: "dark",
  colors: {
    // Base colors
    darkA0: "#0d1117",         // GitHub-like dark background
    lightA0: "#ffffff",        // Pure white

    // Primary colors - Vibrant blues for CTAs and interactive elements
    primaryA0: "#3b82f6",      // Bright blue - primary actions (buttons, links)
    primaryA10: "#2563eb",     // Darker blue - hover states
    primaryA20: "#1d4ed8",     // Deep blue - pressed states
    primaryA30: "#60a5fa",     // Light blue - focus states
    primaryA40: "#93c5fd",     // Very light blue - highlights
    primaryA50: "#dbeafe",     // Whisper blue - subtle backgrounds

    // Accent color
    accentA0: "#1644c4",

    // Component-specific tokens - Dark theme optimized
    buttonBg: "#3b82f6",       // Blue button background for CTAs
    buttonText: "#ffffff",     // White text on buttons
    dropdownBg: "#1f2937",     // Dropdown background
    sliderBg: "#374151",       // Medium gray sliders
    cardBg: "#1e2028",         // Card background - matches surfaceA10 for consistency
    shadowColor: "#000000",    // Pure black shadows

    // Surface colors - High contrast dark theme hierarchy
    surfaceA0: "#0a0b0e",      // Main app background - nearly black
    surfaceA10: "#1e2028",     // Primary surfaces (cards, panels) - clearly visible
    surfaceA20: "#2a2d38",     // Secondary surfaces (hover states)
    surfaceA30: "#363a48",     // Tertiary surfaces (inputs, tooltips)
    surfaceA40: "#4a4f60",     // Quaternary surfaces (borders, dividers)
    surfaceA50: "#9ca3af",     // Light gray text

    // Surface tonal colors - Subtle warmth for depth
    surfaceTonalA0: "#1a1f2e", // Warm dark
    surfaceTonalA10: "#242a3a", // Warm primary
    surfaceTonalA20: "#2e3546", // Warm secondary
    surfaceTonalA30: "#384052", // Warm tertiary
    surfaceTonalA40: "#525a6d", // Warm quaternary
    surfaceTonalA50: "#8b949e", // Warm light
  }
};

/**
 * Theme Registry
 * 
 * To add a new theme:
 * 1. Create a new Theme object following the defaultDarkTheme structure
 * 2. Add it to the themes object below with a unique key
 * 3. The ThemeSwitcher will automatically show when multiple themes exist
 * 
 * Example:
 * export const newTheme: Theme = {
 *   name: "theme-name",
 *   colors: { ... }
 * };
 * 
 * Then add to registry:
 * themes: {
 *   dark: defaultDarkTheme,
 *   new: newTheme,
 * }
 */
export const themes: Record<string, Theme> = {
  dark: defaultDarkTheme,
};

// Default theme - always fallback to this
export const defaultTheme = defaultDarkTheme;

// Helper function to get theme by name with fallback
export function getTheme(name: string): Theme {
  return themes[name] || defaultTheme;
}

// Helper function to generate CSS variables from theme
export function generateThemeCssVariables(theme: Theme): Record<string, string> {
  const variables: Record<string, string> = {};
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    variables[`--${key}`] = value;
  });
  
  return variables;
}
