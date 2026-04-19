import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from './embed.jsx';
import { PUBLIC_WIDGET_API_BASE } from './publicApiBase.js';

function HostPreview() {
  return (
    <div>
      <h1>Got it</h1>
    </div>
    // <div
    //   style={{
    //     minHeight: '100vh',
    //     padding: 32,
    //     background: '#1e293b',
    //     color: '#f1f5f9',
    //     fontFamily: 'system-ui, sans-serif',
    //   }}
    // >
    //   <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 700 }}>Host site preview</h1>
    //   <p style={{ maxWidth: 560, color: '#94a3b8', lineHeight: 1.6 }}>
    //     Banking API target defaults to{' '}
    //     <code style={{ color: '#7dd3fc' }}>http://localhost:9000</code> (override with{' '}
    //     <code style={{ color: '#7dd3fc' }}>API_PROXY_TARGET</code> /{' '}
    //     <code style={{ color: '#7dd3fc' }}>VITE_API_BASE_URL</code> in{' '}
    //     <code style={{ color: '#7dd3fc' }}>.env</code>). With{' '}
    //     <code style={{ color: '#7dd3fc' }}>apiBaseUrl: ''</code>, chat uses{' '}
    //     <code style={{ color: '#7dd3fc' }}>/api/v1/chat</code> through this dev server proxy.
    //   </p>
    // </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HostPreview />
  </StrictMode>
);

/**
 * Default: Render public API (`src/publicApiBase.js`). Set `VITE_DEV_WIDGET_API_BASE=` (empty) in
 * `.env` for same-origin `/api` when you add a dev proxy; set a full URL to override.
 */
const rawWidgetApi = import.meta.env.VITE_DEV_WIDGET_API_BASE;
const apiBaseUrl =
  rawWidgetApi === undefined || rawWidgetApi === null
    ? PUBLIC_WIDGET_API_BASE
    : String(rawWidgetApi).trim();

const tenantId = import.meta.env.VITE_TENANT_ID?.trim();
const embedKey = import.meta.env.VITE_EMBED_KEY?.trim();
const accessToken = import.meta.env.VITE_ACCESS_TOKEN?.trim() || '';
const apiKey = import.meta.env.VITE_GENERAL_API_KEY?.trim() || '';

init({
  apiBaseUrl,
  title: 'Girmitian AI',
  chatPath: '/api/v1/chat',
  ...(tenantId ? { tenantId } : {}),
  ...(embedKey ? { embedKey } : {}),
  ...(accessToken ? { accessToken } : {}),
  ...(apiKey ? { apiKey } : {}),
});
