import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatAssistantReply, sendChatMessage } from './api.js';

const PORTAL_ID = 'ew-chat-widget-portal';

function getOrCreatePortalHost() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(PORTAL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PORTAL_ID;
    document.body.appendChild(el);
  }
  return el;
}

const defaultConfig = {
  apiBaseUrl: '',
  chatPath: '/api/v1/chat',
  tenantId: '',
  embedKey: '',
  accessToken: '',
  getAccessToken: undefined,
  apiKey: '',
  secureFields: undefined,
  title: 'Assistant',
  placeholder: 'Message…',
  position: 'bottom-right',
  /** Alloe-style pill next to the icon; omit for a round icon-only launcher. */
  launcherLabel: '',
  /** Above typical site chrome (scroll-top, cookie bars); host can override. */
  zIndex: 2147483000,
  extraHeaders: {},
};

function ChatIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function ChatWidget({ config: userConfig }) {
  const config = { ...defaultConfig, ...userConfig };
  const {
    apiBaseUrl,
    chatPath,
    tenantId,
    embedKey,
    accessToken,
    getAccessToken,
    apiKey,
    secureFields,
    title,
    placeholder,
    position,
    launcherLabel,
    zIndex,
    extraHeaders,
  } = config;

  const [open, setOpen] = useState(config.defaultOpen ?? false);
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const positionClasses =
    position === 'bottom-left'
      ? 'ew-left-4 ew-bottom-4 sm:ew-left-6 sm:ew-bottom-6'
      : position === 'bottom-center'
        ? 'ew-bottom-4 sm:ew-bottom-6'
        : 'ew-right-4 ew-bottom-4 sm:ew-right-6 sm:ew-bottom-6';

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, rows, loading]);

  const submit = useCallback(async () => {
    const msg = text.trim();
    if (!msg || loading) return;
    setText('');
    setRows((r) => [...r, { role: 'user', text: msg }]);
    setLoading(true);
    let ok;
    let status;
    let data;
    try {
      ({ ok, status, data } = await sendChatMessage({
        apiBaseUrl,
        chatPath,
        message: msg,
        accessToken,
        getAccessToken,
        apiKey,
        secureFields,
        tenantId,
        embedKey,
        extraHeaders,
      }));
    } catch (e) {
      ok = false;
      status = 0;
      data = { message: e?.message ? String(e.message) : 'Unexpected error' };
    } finally {
      setLoading(false);
    }
    if (!ok) {
      const err =
        data?.message || data?.error || `Request failed (${status})`;
      setRows((r) => [
        ...r,
        { role: 'assistant', text: err, error: true, raw: data },
      ]);
      return;
    }
    setRows((r) => [
      ...r,
      {
        role: 'assistant',
        text: formatAssistantReply(data),
        raw: data,
      },
    ]);
  }, [
    apiBaseUrl,
    chatPath,
    accessToken,
    getAccessToken,
    apiKey,
    secureFields,
    embedKey,
    extraHeaders,
    loading,
    tenantId,
    text,
  ]);

  const dockStyle =
    position === 'bottom-left'
      ? { left: 16, bottom: 16, alignItems: 'flex-start' }
      : position === 'bottom-center'
        ? {
            left: '50%',
            bottom: 16,
            transform: 'translateX(-50%)',
            alignItems: 'center',
          }
        : { right: 16, bottom: 16, alignItems: 'flex-end' };

  const usePillLauncher = Boolean(
    launcherLabel && String(launcherLabel).trim(),
  );

  const portalHost = getOrCreatePortalHost();

  useLayoutEffect(() => {
    if (!portalHost) return;
    portalHost.style.cssText = `position:fixed;inset:0;z-index:${zIndex};pointer-events:none;overflow:visible;`;
  }, [portalHost, zIndex]);

  if (!portalHost) return null;

  return createPortal(
    <div
      className="ew-pointer-events-none ew-fixed ew-inset-0"
      style={{
        zIndex,
        isolation: 'isolate',
        pointerEvents: 'none',
        position: 'fixed',
        inset: 0,
      }}
    >
      <div
        className={`ew-pointer-events-auto ew-fixed ${positionClasses} ew-flex ew-flex-col ew-gap-3 ${
          position === 'bottom-center' ? 'ew-items-center' : 'ew-items-end'
        }`}
        style={{
          position: 'fixed',
          zIndex,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          ...dockStyle,
        }}
      >
        {open ? (
          <div
            className="ew-flex ew-h-[min(520px,calc(100vh-6rem))] ew-w-[min(100vw-2rem,380px)] ew-flex-col ew-overflow-hidden ew-rounded-2xl ew-border ew-border-slate-700 ew-bg-slate-900 ew-shadow-2xl"
            role="dialog"
            aria-label={title}
          >
            <div className="ew-flex ew-items-center ew-justify-between ew-border-b ew-border-slate-700 ew-bg-slate-950/80 ew-px-4 ew-py-3">
              <span className="ew-font-semibold ew-text-white">{title}</span>
              <button
                type="button"
                className="ew-rounded-lg ew-px-2 ew-py-1 ew-text-sm ew-text-slate-400 hover:ew-bg-slate-800 hover:ew-text-white"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <div
              ref={listRef}
              className="ew-min-h-0 ew-flex-1 ew-space-y-3 ew-overflow-y-auto ew-bg-slate-900/60 ew-p-4"
            >
              {rows.length === 0 ? (
                <p className="ew-text-center ew-text-sm ew-text-slate-500">
                  Ask anything…
                </p>
              ) : (
                rows.map((row, i) => (
                  <div
                    key={i}
                    className={`ew-flex ${row.role === 'user' ? 'ew-justify-end' : 'ew-justify-start'}`}
                  >
                    <div
                      className={`ew-max-w-[88%] ew-whitespace-pre-wrap ew-rounded-2xl ew-px-3 ew-py-2 ew-text-sm ${
                        row.role === 'user'
                          ? 'ew-bg-embed-accent ew-text-white'
                          : row.error
                            ? 'ew-bg-red-950/70 ew-text-red-100 ew-ring-1 ew-ring-red-900/40'
                            : 'ew-bg-slate-800 ew-text-slate-100'
                      }`}
                    >
                      {row.text}
                    </div>
                  </div>
                ))
              )}
              {loading ? (
                <div className="ew-flex ew-justify-start">
                  <div className="ew-rounded-2xl ew-bg-slate-800 ew-px-3 ew-py-2 ew-text-sm ew-text-slate-400">
                    <span className="ew-inline-flex ew-gap-1">
                      <span className="ew-animate-pulse">●</span>
                      <span className="ew-animate-pulse ew-delay-75">●</span>
                      <span className="ew-animate-pulse ew-delay-150">●</span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <form
              className="ew-border-t ew-border-slate-700 ew-bg-slate-950/80 ew-p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="ew-flex ew-gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholder}
                  disabled={loading}
                  className="ew-min-w-0 ew-flex-1 ew-rounded-xl ew-border ew-border-slate-600 ew-bg-slate-900 ew-px-3 ew-py-2 ew-text-white placeholder:ew-text-slate-500 focus:ew-border-embed-accent focus:ew-outline-none focus:ew-ring-1 focus:ew-ring-embed-accent"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={loading || !text.trim()}
                  className="ew-shrink-0 ew-rounded-xl ew-bg-embed-accent ew-px-4 ew-py-2 ew-font-semibold ew-text-white hover:ew-bg-embed-accentHover disabled:ew-opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {open && usePillLauncher ? null : usePillLauncher ? (
          <button
            type="button"
            id="ew-chat-widget-launcher"
            onClick={() => setOpen(true)}
            className="ew-pointer-events-auto ew-flex ew-max-w-[min(calc(100vw-2rem),22rem)] ew-items-center ew-gap-0 ew-overflow-hidden ew-rounded-full ew-border ew-border-white/50 ew-bg-white/95 ew-py-1 ew-pl-1 ew-pr-4 ew-shadow-[0_16px_48px_-12px_rgba(15,23,42,0.35)] ew-backdrop-blur-md hover:-ew-translate-y-0.5 hover:ew-shadow-xl focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-sky-400/80 focus:ew-ring-offset-2 focus:ew-ring-offset-transparent"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Open chat"
          >
            <span
              className="ew-relative ew-flex ew-h-11 ew-w-11 ew-shrink-0 ew-items-center ew-justify-center ew-rounded-full ew-text-white ew-shadow-md ew-ring-[3px] ew-ring-white sm:ew-h-14 sm:ew-w-14"
              style={{
                background:
                  'linear-gradient(145deg, #38bdf8 0%, #0284c7 45%, #0369a1 100%)',
              }}
              aria-hidden
            >
              <ChatIcon />
            </span>
            <span className="ew-min-w-0 ew-flex-1 ew-pl-2 ew-pr-1 ew-text-left ew-text-xs ew-font-medium ew-leading-snug ew-text-slate-800 sm:ew-pl-3 sm:ew-text-sm">
              {launcherLabel}
            </span>
          </button>
        ) : (
          <button
            type="button"
            id="ew-chat-widget-launcher"
            onClick={() => setOpen((o) => !o)}
            className="ew-flex ew-h-14 ew-w-14 ew-items-center ew-justify-center ew-rounded-full ew-bg-embed-accent ew-text-2xl ew-text-white ew-shadow-lg hover:ew-bg-embed-accentHover focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-sky-300 focus:ew-ring-offset-2 focus:ew-ring-offset-slate-900"
            aria-label={open ? 'Close chat' : 'Open chat'}
            style={{
              width: 56,
              height: 56,
              minWidth: 56,
              minHeight: 56,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9999,
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
            }}
          >
            {open ? (
              <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
                ×
              </span>
            ) : (
              <ChatIcon />
            )}
          </button>
        )}
      </div>
    </div>,
    portalHost,
  );
}
