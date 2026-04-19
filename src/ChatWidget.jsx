import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AgenticFabGlyph, AssistantGlyph } from './ChatakAgentIcon.jsx';
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
  placeholder: 'Ask Girmiti AI…',
  /** Shown at the top of the thread for the whole time the panel stays open (override per embed). */
  welcomeMessage:
    'Welcome to Girmiti Software Private Limited. We specialise in digital payments, acquiring, issuance, and enterprise payment solutions.',
  position: 'bottom-right',
  /** Alloe-style pill next to the icon; omit for a round icon-only launcher. */
  launcherLabel: '',
  /** Above typical site chrome (scroll-top, cookie bars); host can override. */
  zIndex: 2147483000,
  extraHeaders: {},
};

const PANEL_TAIL_FILL = 'rgba(255, 255, 255, 0.98)';
const PANEL_TAIL_STROKE = 'rgba(15, 23, 42, 0.08)';

/** Curved hook toward the launcher (sketch-style), not a straight triangle. */
function ChatPanelTail({ position }) {
  if (position === 'bottom-center') {
    return (
      <svg
        className="ew-pointer-events-none ew-absolute ew-left-1/2 ew-z-0 -ew-translate-x-1/2"
        width={44}
        height={18}
        viewBox="0 0 44 18"
        style={{ top: '100%', marginTop: -1 }}
        aria-hidden
      >
        <path
          d="M6 2 H38 C40.5 2 42 3.2 42 5.5 C42 9 38 13 32 15 C26 16.5 18 16.5 12 15 C6 13 2 9 2 5.5 C2 3.2 3.5 2 6 2 Z"
          fill={PANEL_TAIL_FILL}
          stroke={PANEL_TAIL_STROKE}
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  const pathHook =
    'M 5 1.5 L 27 1.5 C 32 1.5 35.5 4.5 36.5 9.5 C 37.5 14.5 35 19 30 20.5 C 24.5 22 17 18.5 12.5 12.5 C 9 8 6.5 4 5 1.5 Z';

  if (position === 'bottom-left') {
    return (
      <svg
        className="ew-pointer-events-none ew-absolute ew-z-0"
        width={42}
        height={24}
        viewBox="0 0 42 24"
        style={{ left: 14, top: '100%', marginTop: -1, transform: 'scaleX(-1)' }}
        aria-hidden
      >
        <path
          d={pathHook}
          fill={PANEL_TAIL_FILL}
          stroke={PANEL_TAIL_STROKE}
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className="ew-pointer-events-none ew-absolute ew-z-0"
      width={42}
      height={24}
      viewBox="0 0 42 24"
      style={{ right: 12, top: '100%', marginTop: -1 }}
      aria-hidden
    >
      <path
        d={pathHook}
        fill={PANEL_TAIL_FILL}
        stroke={PANEL_TAIL_STROKE}
        strokeWidth="0.75"
        strokeLinejoin="round"
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
    welcomeMessage,
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
  const inputRef = useRef(null);
  const prevLoadingRef = useRef(false);

  const positionClasses =
    position === 'bottom-left'
      ? 'ew-left-3 ew-bottom-3 sm:ew-left-5 sm:ew-bottom-5'
      : position === 'bottom-center'
        ? 'ew-bottom-3 sm:ew-bottom-5'
        : 'ew-right-3 ew-bottom-3 sm:ew-right-5 sm:ew-bottom-5';

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, rows, loading]);

  /** After send completes, return focus to the input so the user can type the next message. */
  useEffect(() => {
    if (!open) {
      prevLoadingRef.current = false;
      return;
    }
    if (prevLoadingRef.current && !loading) {
      inputRef.current?.focus();
    }
    prevLoadingRef.current = loading;
  }, [loading, open]);

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

  const dockBottom = open ? 36 : 14;
  const dockStyle =
    position === 'bottom-left'
      ? { left: 14, bottom: dockBottom, alignItems: 'flex-start' }
      : position === 'bottom-center'
        ? {
            left: '50%',
            bottom: dockBottom,
            transform: 'translateX(-50%)',
            alignItems: 'center',
          }
        : { right: 14, bottom: dockBottom, alignItems: 'flex-end' };

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
          gap: open ? 0 : 10,
          ...dockStyle,
        }}
      >
        {open ? (
          <div className="ew-relative ew-w-[min(100vw-1.25rem,400px)]">
            <div
              className="ew-flex ew-h-[min(520px,calc(100vh-5.5rem))] ew-w-full ew-max-h-[min(82vh,calc(100vh-4.5rem))] ew-flex-col ew-overflow-hidden ew-rounded-2xl ew-border ew-border-slate-200/95 ew-bg-white ew-shadow-panel"
              role="dialog"
              aria-label={title}
            >
            <div className="ew-flex ew-min-h-0 ew-flex-1 ew-flex-col ew-overflow-hidden ew-rounded-2xl">
            <div className="ew-flex ew-shrink-0 ew-items-center ew-justify-between ew-border-b ew-border-slate-200/90 ew-bg-white ew-px-3 ew-py-1.5">
              <div className="ew-flex ew-items-center ew-gap-2 ew-min-w-0">
                <span className="ew-flex ew-shrink-0 ew-items-center ew-justify-center ew-text-slate-900" aria-hidden>
                  <AssistantGlyph className="ew-h-[26px] ew-w-[26px]" />
                </span>
                <span className="ew-truncate ew-text-sm ew-font-semibold ew-tracking-tight ew-text-[#2d2d2d]">
                  {title}
                </span>
              </div>
              <button
                type="button"
                className="ew-flex ew-h-7 ew-w-7 ew-shrink-0 ew-items-center ew-justify-center ew-rounded-full ew-text-[#5b5b5b] ew-transition-colors hover:ew-bg-slate-100 hover:ew-text-slate-900"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                <span className="ew-text-lg ew-leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>
            <div
              ref={listRef}
              className="ew-chat-scroll ew-min-h-0 ew-flex-1 ew-space-y-2 ew-overflow-y-auto ew-overflow-x-hidden ew-overscroll-y-contain ew-bg-[#f4f6f4] ew-px-3 ew-py-2.5"
            >
              {String(welcomeMessage ?? '').trim() ? (
                <div className="ew-flex ew-shrink-0 ew-justify-start">
                  <div className="ew-max-w-[95%] ew-rounded-2xl ew-border ew-border-slate-200/90 ew-bg-white ew-px-3 ew-py-2 ew-text-[13px] ew-font-medium ew-leading-snug ew-text-[#333333] ew-shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    {welcomeMessage}
                  </div>
                </div>
              ) : null}
              {rows.map((row, i) => (
                <div
                  key={i}
                  className={`ew-flex ${row.role === 'user' ? 'ew-justify-end' : 'ew-justify-start'}`}
                >
                  <div
                    className={`ew-max-w-[90%] ew-whitespace-pre-wrap ew-rounded-2xl ew-px-2.5 ew-py-1.5 ew-text-[13px] ew-leading-snug ${
                      row.role === 'user'
                        ? 'ew-border ew-border-embed-accent/20 ew-bg-[#e8f5e9] ew-text-[#1b2e1c] ew-shadow-sm'
                        : row.error
                          ? 'ew-bg-red-50 ew-text-red-900 ew-ring-1 ew-ring-red-200/80'
                          : 'ew-border ew-border-slate-200/90 ew-bg-white ew-text-[#333333] ew-shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    {row.text}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="ew-flex ew-items-start ew-gap-2 ew-justify-start">
                  <span
                    className="ew-flex ew-shrink-0 ew-items-center ew-justify-center ew-text-slate-900"
                    aria-hidden
                  >
                    <AssistantGlyph className="ew-h-[26px] ew-w-[26px]" />
                  </span>
                  <div className="ew-rounded-2xl ew-border ew-border-slate-200/80 ew-bg-white ew-px-2.5 ew-py-2 ew-text-slate-400">
                    <span className="ew-inline-flex ew-gap-0.5 ew-text-[10px] ew-tracking-widest">
                      <span className="ew-animate-pulse">●</span>
                      <span className="ew-animate-pulse ew-delay-75">●</span>
                      <span className="ew-animate-pulse ew-delay-150">●</span>
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <form
              className="ew-shrink-0 ew-border-t ew-border-slate-200/90 ew-bg-white ew-p-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="ew-flex ew-items-center ew-gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholder}
                  disabled={loading}
                  className="ew-min-w-0 ew-flex-1 ew-rounded-2xl ew-border ew-border-slate-200 ew-bg-white ew-px-3 ew-py-2 ew-text-[13px] ew-text-[#2d2d2d] placeholder:ew-text-[#8a8a8a] focus:ew-border-embed-accent focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-embed-accent/20"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={loading || !text.trim()}
                  className="ew-shrink-0 ew-rounded-2xl ew-bg-embed-accent ew-px-3 ew-py-2 ew-text-[13px] ew-font-semibold ew-text-white ew-shadow-[0_2px_8px_rgba(49,166,0,0.35)] ew-transition-colors hover:ew-bg-embed-accentHover disabled:ew-opacity-45"
                >
                  Send
                </button>
              </div>
            </form>
            </div>
            </div>
            {/* <ChatPanelTail position={position} /> */}
          </div>
        ) : null}

        {!open && usePillLauncher ? (
          <button
            type="button"
            id="ew-chat-widget-launcher"
            onClick={() => setOpen(true)}
            className="ew-pointer-events-auto ew-flex ew-max-w-[min(calc(100vw-2rem),20rem)] ew-items-center ew-gap-0 ew-overflow-visible ew-rounded-full ew-border ew-border-embed-accent/20 ew-bg-white ew-py-1 ew-pl-1 ew-pr-3.5 ew-shadow-launcher ew-backdrop-blur-md ew-transition-transform hover:-ew-translate-y-0.5 focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-embed-teal/40 focus:ew-ring-offset-2 focus:ew-ring-offset-white"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Open chat"
          >
            <span
              className="ew-relative ew-flex ew-h-11 ew-w-11 ew-shrink-0 ew-items-center ew-justify-center ew-rounded-full ew-bg-white/90 ew-ring-[2.5px] ew-ring-white sm:ew-h-[52px] sm:ew-w-[52px]"
              aria-hidden
            >
              <span className="ew-fab-perspective ew-relative ew-flex ew-h-full ew-w-full ew-items-center ew-justify-center ew-rounded-full">
                <AgenticFabGlyph />
              </span>
            </span>
            <span className="ew-min-w-0 ew-flex-1 ew-overflow-hidden ew-pl-2 ew-pr-0.5 ew-text-left ew-text-[11px] ew-font-semibold ew-leading-snug ew-tracking-tight ew-text-[#2d2d2d] sm:ew-pl-2.5 sm:ew-text-xs">
              {launcherLabel}
            </span>
          </button>
        ) : !open ? (
          <button
            type="button"
            id="ew-chat-widget-launcher"
            onClick={() => setOpen(true)}
            className="ew-pointer-events-auto ew-relative ew-flex ew-h-16 ew-w-16 ew-shrink-0 ew-cursor-pointer ew-items-center ew-justify-center ew-rounded-full ew-border ew-border-slate-200/90 ew-bg-white/80 ew-shadow-[0_10px_28px_-6px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] ew-backdrop-blur-md ew-transition-[transform,box-shadow] ew-duration-200 hover:-ew-translate-y-0.5 hover:ew-scale-[1.04] hover:ew-shadow-[0_14px_36px_-6px_rgba(0,0,0,0.2),0_2px_10px_-2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] active:ew-scale-[0.97] focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-embed-accent/40 focus:ew-ring-offset-2 focus:ew-ring-offset-white"
            aria-label="Open chat"
          >
            <span
              className="ew-pointer-events-none ew-absolute ew-inset-[3px] ew-rounded-full ew-bg-gradient-to-b ew-from-white/50 ew-to-transparent ew-opacity-70"
              aria-hidden
            />
            <span
              className="ew-fab-perspective ew-relative ew-flex ew-h-[52px] ew-w-[52px] ew-items-center ew-justify-center ew-rounded-full"
              aria-hidden
            >
              <AgenticFabGlyph />
            </span>
          </button>
        ) : null}
      </div>
    </div>,
    portalHost,
  );
}
