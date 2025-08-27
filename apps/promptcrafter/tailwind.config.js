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
  theme: { extend: {} },
  plugins: [],
};
