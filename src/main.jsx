import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { init } from './embed.jsx';
import { resolveWidgetApiBase } from './publicApiBase.js';
import {
  WIDGET_DEFAULT_PLACEHOLDER,
  WIDGET_DEFAULT_TITLE,
} from './widgetDefaults.js';

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

/** Chat API: `.env` → `VITE_WIDGET_API_BASE`; dev server defaults in `src/publicApiBase.js`. */
const apiBaseUrl = resolveWidgetApiBase();

const tenantId = import.meta.env.VITE_TENANT_ID?.trim();
const embedKey = import.meta.env.VITE_EMBED_KEY?.trim();
const accessToken = import.meta.env.VITE_ACCESS_TOKEN?.trim() || '';
const apiKey = import.meta.env.VITE_GENERAL_API_KEY?.trim() || '';
const clientId = import.meta.env.VITE_CLIENT_ID?.trim();
const clientIp = import.meta.env.VITE_CLIENT_IP?.trim();
/** Set to '' to hide the callback card in dev. Default shows the form; POST may 404 until your API implements the route. */
const contactLeadPath =
  import.meta.env.VITE_CONTACT_LEAD_PATH !== undefined
    ? String(import.meta.env.VITE_CONTACT_LEAD_PATH).trim()
    : '/api/v1/contact-lead';

init({
  apiBaseUrl,
  title: WIDGET_DEFAULT_TITLE,
  placeholder: WIDGET_DEFAULT_PLACEHOLDER,
  chatPath: '/api/v1/chat',
  /** Local dev: drag the closed launcher to reposition (saved in localStorage). Set `false` to match production embeds. */
  draggableLauncher: true,
  ...(contactLeadPath ? { contactLeadPath } : {}),
  ...(tenantId ? { tenantId } : {}),
  ...(embedKey ? { embedKey } : {}),
  ...(accessToken ? { accessToken } : {}),
  ...(apiKey ? { apiKey } : {}),
  ...(clientId ? { clientId } : {}),
  ...(clientIp ? { clientIp } : {}),
});
