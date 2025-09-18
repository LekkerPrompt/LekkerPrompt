/**
 * Tailwind config restricted to project directories to avoid globbing Windows
 * legacy junctions like "C:/Users/<user>/Application Data" that can throw EPERM
 * during fast-glob scans.
 */
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Construct absolute, normalized glob roots to keep fast-glob confined.
/** @param {string} p */
const rel = (p) => path.join(__dirname, p).replace(/\\/g, '/');

export default {
  content: [
    rel('src/**/*.{js,jsx,ts,tsx}'),
    rel('app/**/*.{js,jsx,ts,tsx}'),
    rel('components/**/*.{js,jsx,ts,tsx}'),
    rel('public/**/*.html')
  ],
  theme: { 
    extend: {
      colors: {
        // Base colors
        'dark': 'var(--darkA0)',
        'light': 'var(--lightA0)',
        // Accent color (emerald green)
        'accent': 'var(--accentA0)',
        'accentA0': 'var(--accentA0)',
        
        // Primary theme colors - vibrant blue for CTAs and interactive elements
        'primary': {
          DEFAULT: 'var(--primaryA0)',
          '100': 'var(--primaryA30)',
          '200': 'var(--primaryA40)',
          '300': 'var(--primaryA50)',
          '400': 'var(--primaryA0)',
          '500': 'var(--primaryA0)',
          '600': 'var(--primaryA0)',
          'a0': 'var(--primaryA0)',
          'a10': 'var(--primaryA10)',
          'a20': 'var(--primaryA20)',
          'a30': 'var(--primaryA30)',
          'a40': 'var(--primaryA40)',
          'a50': 'var(--primaryA50)'
        },
        
        // Surface colors
        'surface': {
          DEFAULT: 'var(--surfaceA10)',
          '0': 'var(--surfaceA0)',
          '100': 'var(--surfaceA10)',
          '200': 'var(--surfaceA20)',
          '300': 'var(--surfaceA30)',
          '400': 'var(--surfaceA40)',
          '500': 'var(--surfaceA50)',
          'a0': 'var(--surfaceA0)',
          'a10': 'var(--surfaceA10)',
          'a20': 'var(--surfaceA20)',
          'a30': 'var(--surfaceA30)',
          'a40': 'var(--surfaceA40)',
          'a50': 'var(--surfaceA50)'
        },
        
        // Surface tonal colors
        'surface-tonal': {
          DEFAULT: 'var(--surfaceTonalA10)',
          '0': 'var(--surfaceTonalA0)',
          '100': 'var(--surfaceTonalA10)',
          '200': 'var(--surfaceTonalA20)',
          '300': 'var(--surfaceTonalA30)',
          '400': 'var(--surfaceTonalA40)',
          '500': 'var(--surfaceTonalA50)'
        },
      }
    } 
  },
  plugins: [],
};
