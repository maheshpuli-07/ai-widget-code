/**
 * Production chat API (Render). Used for:
 * - `dist/` copy-paste snippets and `widget-loader.js` default (via patch-dist)
 * - Fallback for production builds of the dev app when `VITE_WIDGET_API_BASE` is unset
 */
export const PUBLIC_WIDGET_API_BASE =
  'https://ai-assistance-service.onrender.com';

/** Default chat API when running the Vite dev server (`main.jsx`) with no `.env`. */
export const DEV_WIDGET_API_BASE = 'http://localhost:3090';

/**
 * Chat API for the dev host preview (`src/main.jsx` only — not the shipped IIFE).
 *
 * Vite dev (`npm run dev`, `npm run dev:app`): uses `VITE_WIDGET_API_BASE` from `.env` if set;
 * otherwise `DEV_WIDGET_API_BASE`. Production build of the dev app (`build:dev-app`):
 * uses `PUBLIC_WIDGET_API_BASE` unless `VITE_WIDGET_API_BASE` is set for that build.
 */
export function resolveWidgetApiBase() {
  try {
    const raw = import.meta.env?.VITE_WIDGET_API_BASE;
    if (raw !== undefined && raw !== null) {
      const t = String(raw).trim();
      if (t) return t;
    }
    if (import.meta.env?.DEV) return DEV_WIDGET_API_BASE;
    return PUBLIC_WIDGET_API_BASE;
  } catch {
    return PUBLIC_WIDGET_API_BASE;
  }
}
