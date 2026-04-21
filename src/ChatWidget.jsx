import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Send } from 'lucide-react';
import { AgenticFabGlyph, AssistantGlyph } from './ChatakAgentIcon.jsx';
import { cn } from './cn.js';
import { AssistantReply } from './AssistantReply.jsx';
import { linkifyText } from './linkifyText.jsx';
import { buildChatTranscriptSummary } from './buildChatTranscriptSummary.js';
import {
  extractContactPrefillFromChatLine,
  hasContactHintInChatMessage,
} from './contactPrefillFromChat.js';
import { parseAssistantReplyForContactForm } from './assistantContactFormSignal.js';
import {
  extractConversationIdFromChatResponse,
  formatAssistantReply,
  sendChatMessage,
  sendContactLead,
} from './api.js';
import {
  getOrCreateSessionId,
  getPersistScopeKey,
  getStoredConversationId,
  setStoredConversationId,
} from './chatSessionPersistence.js';
import {
  WIDGET_DEFAULT_PLACEHOLDER,
  WIDGET_DEFAULT_REPLY_FORMAT_PROMPT,
  WIDGET_DEFAULT_TITLE,
  WIDGET_REPLY_FORMAT_MESSAGE_SUFFIX,
} from './widgetDefaults.js';

const PORTAL_ID = 'ew-chat-widget-portal';

/** Max FAB footprint used when measuring is unavailable (pill is clamped on resize). */
const LAUNCHER_CLAMP_W = 320;
const LAUNCHER_CLAMP_H = 88;
/** Upper bound for open panel width; must stay in sync with `ew-w-[min(100vw-1.25rem,400px)]`. */
const PANEL_MAX_W_PX = 400;

function launcherPosStorageKey(scopeKey) {
  return `ew_launcher_pos_v1|${scopeKey}`;
}

function clampLauncherDock(left, bottom, boxW, boxH) {
  if (typeof window === 'undefined') {
    return { left: Math.max(8, left), bottom: Math.max(8, bottom) };
  }
  const margin = 8;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bw = Math.min(boxW || LAUNCHER_CLAMP_W, w - margin * 2);
  const bh = Math.min(boxH || LAUNCHER_CLAMP_H, h - margin * 2);
  return {
    left: Math.min(Math.max(margin, left), Math.max(margin, w - bw - margin)),
    bottom: Math.min(Math.max(margin, bottom), Math.max(margin, h - bh - margin)),
  };
}

function defaultLauncherDock(position, widePill) {
  if (typeof window === 'undefined') {
    return { left: 20, bottom: 20 };
  }
  const margin = 14;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fabW = widePill ? Math.min(LAUNCHER_CLAMP_W, w - margin * 2) : 72;
  const fabH = widePill ? 56 : 72;
  if (position === 'bottom-left') return { left: margin, bottom: margin };
  if (position === 'bottom-center') {
    return { left: Math.max(margin, Math.round((w - fabW) / 2)), bottom: margin };
  }
  return { left: Math.max(margin, w - margin - fabW), bottom: margin };
}

function readSavedLauncherDock(scopeKey) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(launcherPosStorageKey(scopeKey));
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.left !== 'number' || typeof p?.bottom !== 'number') return null;
    return clampLauncherDock(p.left, p.bottom, LAUNCHER_CLAMP_W, LAUNCHER_CLAMP_H);
  } catch {
    return null;
  }
}

function persistLauncherDock(scopeKey, pos) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(launcherPosStorageKey(scopeKey), JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

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
  /** JSON body `clientId` (optional; separate from `tenantId` / X-Tenant-Id). */
  clientId: '',
  /** JSON body `clientIp` — set from server-side render or `getClientIp`; the browser cannot infer public IP by itself. */
  clientIp: '',
  getClientIp: undefined,
  secureFields: undefined,
  title: WIDGET_DEFAULT_TITLE,
  placeholder: WIDGET_DEFAULT_PLACEHOLDER,
  /** Shown at the top of the thread for the whole time the panel stays open (override per embed). */
  welcomeMessage:
    'Welcome to Girmiti Software Private Limited. We specialise in digital payments, acquiring, issuance, and enterprise payment solutions.',
  position: 'bottom-right',
  /** Alloe-style pill next to the icon; omit for a round icon-only launcher. */
  launcherLabel: '',
  /** Above typical site chrome (scroll-top, cookie bars); host can override. */
  zIndex: 2147483000,
  extraHeaders: {},
  /**
   * Sent as `systemPrompt` on each request (when your API accepts it).
   * `undefined` → default formatting instructions; `false` or `''` → omit.
   */
  replyFormatPrompt: undefined,
  /** When true (default), append `WIDGET_REPLY_FORMAT_MESSAGE_SUFFIX` to JSON `message` if the API ignores `systemPrompt`. */
  replyFormatAppendToMessage: true,
  /**
   * When true (default), generate `sessionId`, persist `conversationId` from API responses in localStorage,
   * and send both on each chat request (anonymous public-site threads).
   */
  persistChatSession: true,
  /**
   * When true, the closed chat launcher can be dragged anywhere on the page.
   * Default false — `position` preset is unchanged when off.
   */
  draggableLauncher: false,
  /**
   * When `draggableLauncher` is true: persist the dragged pixel position in localStorage (scoped like the chat session).
   * Default false — each page load starts from `position` (e.g. bottom-right); drag applies until reload.
   */
  rememberLauncherPosition: false,
  /**
   * POST path for callback / lead (relative to `apiBaseUrl`), e.g. `/api/v1/contact-lead`.
   * Empty hides the card. Your server must email staff — the browser cannot send SMTP safely.
   */
  contactLeadPath: '',
  contactCardTitle: 'Request a callback from Girmiti',
  contactCardSubtitle:
    'Please share your name and contact details below. We will reach out to you shortly.',
  contactCardButtonLabel: 'Send',
  contactCardMaxSummaryChars: 12000,
};

function isLikelyValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

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
    clientId,
    clientIp,
    getClientIp,
    secureFields,
    title,
    placeholder,
    welcomeMessage,
    position,
    launcherLabel,
    zIndex,
    extraHeaders,
    replyFormatPrompt,
    replyFormatAppendToMessage,
    persistChatSession,
    draggableLauncher,
    draggablePanel,
    rememberLauncherPosition,
    contactLeadPath,
    contactCardTitle,
    contactCardSubtitle,
    contactCardButtonLabel,
    contactCardMaxSummaryChars,
  } = config;

  /** Drag the open panel by its header; `undefined` → follow `draggableLauncher`. */
  const panelHeaderDragEnabled = draggablePanel ?? draggableLauncher;

  const sessionPersistenceKey = useMemo(
    () =>
      getPersistScopeKey({
        apiBaseUrl,
        chatPath,
        tenantId,
        embedKey,
      }),
    [apiBaseUrl, chatPath, tenantId, embedKey],
  );

  const mergedInit = useMemo(
    () => ({ ...defaultConfig, ...userConfig }),
    [userConfig],
  );

  const [launcherDockPx, setLauncherDockPx] = useState(() => {
    if (!mergedInit.draggableLauncher) return null;
    const scope = getPersistScopeKey({
      apiBaseUrl: mergedInit.apiBaseUrl,
      chatPath: mergedInit.chatPath,
      tenantId: mergedInit.tenantId,
      embedKey: mergedInit.embedKey,
    });
    const widePill = Boolean(
      mergedInit.launcherLabel && String(mergedInit.launcherLabel).trim(),
    );
    const base = defaultLauncherDock(mergedInit.position, widePill);
    if (mergedInit.rememberLauncherPosition) {
      return readSavedLauncherDock(scope) ?? base;
    }
    return base;
  });

  const launcherDockRef = useRef(launcherDockPx);
  useEffect(() => {
    launcherDockRef.current = launcherDockPx;
  }, [launcherDockPx]);

  const launcherDragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    origLeft: 0,
    origBottom: 0,
    boxW: LAUNCHER_CLAMP_W,
    boxH: LAUNCHER_CLAMP_H,
    dragged: false,
  });

  const onLauncherPointerDown = useCallback((e) => {
    if (!draggableLauncher || e.button !== 0) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const bottomPx =
      typeof window !== 'undefined' ? window.innerHeight - rect.bottom : 14;
    launcherDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origBottom: bottomPx,
      boxW: rect.width,
      boxH: rect.height,
      dragged: false,
    };
    el.setPointerCapture(e.pointerId);
  }, [draggableLauncher]);

  const onLauncherPointerMove = useCallback(
    (e) => {
      if (!draggableLauncher) return;
      if (launcherDragRef.current.pointerId !== e.pointerId) return;
      const d = launcherDragRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.dragged && Math.hypot(dx, dy) > 8) {
        d.dragged = true;
      }
      if (!d.dragged) return;
      const next = clampLauncherDock(
        d.origLeft + dx,
        d.origBottom - dy,
        d.boxW,
        d.boxH,
      );
      setLauncherDockPx(next);
    },
    [draggableLauncher],
  );

  const finishLauncherPointer = useCallback(
    (e) => {
      if (launcherDragRef.current.pointerId !== e.pointerId) return;
      const d = launcherDragRef.current;
      launcherDragRef.current = {
        pointerId: null,
        startX: 0,
        startY: 0,
        origLeft: 0,
        origBottom: 0,
        boxW: LAUNCHER_CLAMP_W,
        boxH: LAUNCHER_CLAMP_H,
        dragged: false,
      };
      const el = e.currentTarget;
      try {
        if (el.hasPointerCapture?.(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      if (!draggableLauncher) return;
      if (!d.dragged) {
        setOpen(true);
        return;
      }
      const pos = launcherDockRef.current;
      if (rememberLauncherPosition && pos) {
        persistLauncherDock(sessionPersistenceKey, pos);
      }
    },
    [draggableLauncher, rememberLauncherPosition, sessionPersistenceKey],
  );

  useEffect(() => {
    if (!draggableLauncher) return;
    const onResize = () => {
      setLauncherDockPx((p) =>
        p
          ? clampLauncherDock(p.left, p.bottom, LAUNCHER_CLAMP_W, LAUNCHER_CLAMP_H)
          : p,
      );
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draggableLauncher]);

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  );
  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const formatExtrasEnabled =
    replyFormatPrompt !== false && replyFormatPrompt !== '';

  const systemPromptForApi =
    !formatExtrasEnabled
      ? ''
      : replyFormatPrompt == null
        ? WIDGET_DEFAULT_REPLY_FORMAT_PROMPT
        : String(replyFormatPrompt).trim();

  const messageFormatSuffix =
    formatExtrasEnabled && replyFormatAppendToMessage !== false
      ? WIDGET_REPLY_FORMAT_MESSAGE_SUFFIX
      : undefined;

  const [open, setOpen] = useState(config.defaultOpen ?? false);
  const [rows, setRows] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [panelMaximized, setPanelMaximized] = useState(false);
  const [contactExpanded, setContactExpanded] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSending, setLeadSending] = useState(false);
  const [leadErr, setLeadErr] = useState('');
  const [contactCardRevealed, setContactCardRevealed] = useState(false);
  /** Pixel translate applied to the open panel so it stays on-screen (drag near top / narrow viewports). */
  const [panelViewportNudge, setPanelViewportNudge] = useState({ x: 0, y: 0 });
  /** User drag offset for the open panel (header drag); combined with `panelViewportNudge` for final transform. */
  const [panelUserDragPx, setPanelUserDragPx] = useState({ x: 0, y: 0 });
  const panelUserDragPxRef = useRef({ x: 0, y: 0 });
  const listRef = useRef(null);
  /** Outer non-maximized panel shell — used to keep the dialog inside the viewport when the launcher is near an edge. */
  const panelOuterRef = useRef(null);
  const panelHeaderDragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    origDx: 0,
    origDy: 0,
    dragged: false,
  });
  /** True while the user is actively dragging the chat header — skips auto viewport nudge so it does not fight the pointer. */
  const panelHeaderDraggingRef = useRef(false);
  const inputRef = useRef(null);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    panelUserDragPxRef.current = panelUserDragPx;
  }, [panelUserDragPx]);

  const onPanelHeaderPointerDown = useCallback(
    (e) => {
      if (!panelHeaderDragEnabled || panelMaximized || e.button !== 0) return;
      if (e.target.closest('button')) return;
      const el = e.currentTarget;
      panelHeaderDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origDx: panelUserDragPxRef.current.x,
        origDy: panelUserDragPxRef.current.y,
        dragged: false,
      };
      el.setPointerCapture(e.pointerId);
    },
    [panelHeaderDragEnabled, panelMaximized],
  );

  const onPanelHeaderPointerMove = useCallback(
    (e) => {
      if (!panelHeaderDragEnabled || panelMaximized) return;
      if (panelHeaderDragRef.current.pointerId !== e.pointerId) return;
      const d = panelHeaderDragRef.current;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (!d.dragged && Math.hypot(dx, dy) > 8) {
        d.dragged = true;
        panelHeaderDraggingRef.current = true;
      }
      if (!d.dragged) return;
      setPanelUserDragPx({
        x: d.origDx + dx,
        y: d.origDy + dy,
      });
    },
    [panelHeaderDragEnabled, panelMaximized],
  );

  const finishPanelHeaderPointer = useCallback((e) => {
    if (panelHeaderDragRef.current.pointerId !== e.pointerId) return;
    panelHeaderDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      origDx: 0,
      origDy: 0,
      dragged: false,
    };
    const el = e.currentTarget;
    try {
      if (el.hasPointerCapture?.(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    panelHeaderDraggingRef.current = false;
  }, []);

  const contactLeadEnabled = Boolean(String(contactLeadPath ?? '').trim());

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

  useEffect(() => {
    if (!open) setPanelMaximized(false);
  }, [open]);

  useEffect(() => {
    if (!open) setPanelUserDragPx({ x: 0, y: 0 });
  }, [open]);

  useEffect(() => {
    if (panelMaximized) setPanelUserDragPx({ x: 0, y: 0 });
  }, [panelMaximized]);

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

  /** Keep the open panel fully inside the viewport (e.g. launcher dragged to the top). */
  useLayoutEffect(() => {
    if (!open || panelMaximized) {
      setPanelViewportNudge({ x: 0, y: 0 });
      return;
    }
    if (panelHeaderDraggingRef.current) return;

    const margin = 12;
    const measure = () => {
      const el = panelOuterRef.current;
      if (!el || typeof window === 'undefined') return;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      /**
       * Measure with viewport nudge cleared but user header-drag offset kept — otherwise nudge is wrong
       * after Send, and `translate(0,0)` would ignore an in-progress panel drag offset.
       */
      const prevTransform = el.style.transform;
      const d = panelUserDragPxRef.current;
      el.style.transform = `translate(${d.x}px, ${d.y}px)`;
      void el.offsetHeight;
      const r = el.getBoundingClientRect();
      el.style.transform = prevTransform;

      let dx = 0;
      let dy = 0;
      if (r.top < margin) dy += margin - r.top;
      if (r.bottom + dy > vh - margin) dy -= r.bottom + dy - (vh - margin);
      if (r.left < margin) dx += margin - r.left;
      if (r.right + dx > vw - margin) dx -= r.right + dx - (vw - margin);
      setPanelViewportNudge((p) => (p.x === dx && p.y === dy ? p : { x: dx, y: dy }));
    };
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(measure);
    });
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', onResize);
    };
  }, [
    open,
    panelMaximized,
    draggableLauncher,
    launcherDockPx?.left,
    launcherDockPx?.bottom,
    position,
    rows.length,
    loading,
    contactExpanded,
    contactCardRevealed,
    viewportWidth,
    panelUserDragPx.x,
    panelUserDragPx.y,
  ]);

  const submit = useCallback(async () => {
    const msg = text.trim();
    if (!msg || loading) return;
    setText('');
    setRows((r) => [...r, { role: 'user', text: msg }]);
    if (contactLeadEnabled && hasContactHintInChatMessage(msg)) {
      const preEarly = extractContactPrefillFromChatLine(msg);
      setContactCardRevealed(true);
      setContactExpanded(true);
      /** One snapshot per message — avoids stale name/email/phone from an earlier hint (common prod vs local confusion). */
      setLeadName(preEarly.leadName || '');
      setLeadEmail(preEarly.leadEmail || '');
      setLeadPhone(preEarly.leadPhone || '');
    }
    setLoading(true);
    let ok;
    let status;
    let data;
    const persist = persistChatSession !== false;
    let sessionIdArg;
    let conversationIdArg;
    let clientMessageIdArg;
    if (persist) {
      sessionIdArg = getOrCreateSessionId(sessionPersistenceKey);
      conversationIdArg = getStoredConversationId(sessionPersistenceKey) || undefined;
      clientMessageIdArg =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `ew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    }
    try {
      ({ ok, status, data } = await sendChatMessage({
        apiBaseUrl,
        chatPath,
        message: msg,
        systemPrompt: systemPromptForApi || undefined,
        messageFormatSuffix,
        accessToken,
        getAccessToken,
        apiKey,
        sessionId: sessionIdArg,
        conversationId: conversationIdArg,
        clientMessageId: clientMessageIdArg,
        clientId,
        clientIp,
        getClientIp,
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
    if (persist) {
      const conv = extractConversationIdFromChatResponse(data);
      if (conv) setStoredConversationId(sessionPersistenceKey, conv);
    }
    const rawReply = formatAssistantReply(data);
    /** Strip UI marker only; never open the card from the tag alone (models often repeat it every reply). */
    const { displayText } = parseAssistantReplyForContactForm(rawReply);

    setRows((r) => [
      ...r,
      {
        role: 'assistant',
        text: displayText,
        raw: data,
      },
    ]);

    if (contactLeadEnabled && hasContactHintInChatMessage(msg)) {
      const pre = extractContactPrefillFromChatLine(msg);
      if (!contactCardRevealed) setContactCardRevealed(true);
      setContactExpanded(true);
      if (pre.leadName) setLeadName(pre.leadName);
      if (pre.leadEmail) setLeadEmail(pre.leadEmail);
      if (pre.leadPhone) setLeadPhone(pre.leadPhone);
    }
  }, [
    apiBaseUrl,
    chatPath,
    systemPromptForApi,
    messageFormatSuffix,
    accessToken,
    getAccessToken,
    apiKey,
    clientId,
    clientIp,
    getClientIp,
    secureFields,
    embedKey,
    extraHeaders,
    loading,
    tenantId,
    text,
    persistChatSession,
    sessionPersistenceKey,
    contactLeadEnabled,
  ]);

  const submitLead = useCallback(async () => {
    if (!contactLeadEnabled || leadSending) return;
    const name = leadName.trim();
    const em = leadEmail.trim();
    const ph = leadPhone.trim();
    if (!name || !em || !ph) {
      setLeadErr('Please fill in name, email, and phone.');
      return;
    }
    if (!isLikelyValidEmail(em)) {
      setLeadErr('Please enter a valid email address.');
      return;
    }
    setLeadErr('');
    setLeadSending(true);
    const persist = persistChatSession !== false;
    const sid = persist ? getOrCreateSessionId(sessionPersistenceKey) : '';
    const conv = persist ? getStoredConversationId(sessionPersistenceKey) : '';
    const summary = buildChatTranscriptSummary(rows, contactCardMaxSummaryChars);
    try {
      const { ok, status, data } = await sendContactLead({
        apiBaseUrl,
        contactLeadPath: String(contactLeadPath).trim(),
        name,
        email: em,
        phone: ph,
        userIntent: undefined,
        chatSummary: summary || undefined,
        sessionId: sid || undefined,
        conversationId: conv || undefined,
        accessToken,
        getAccessToken,
        apiKey,
        tenantId,
        embedKey,
        clientId,
        clientIp,
        getClientIp,
        extraHeaders,
      });
      if (!ok) {
        setLeadErr(
          (data && (data.message || data.error)) ||
            `Request failed (${status})`,
        );
        return;
      }
      setLeadName('');
      setLeadEmail('');
      setLeadPhone('');
      setLeadErr('');
      setContactExpanded(false);
      setContactCardRevealed(false);
    } catch (e) {
      setLeadErr(e?.message ? String(e.message) : 'Something went wrong');
    } finally {
      setLeadSending(false);
    }
  }, [
    contactLeadEnabled,
    leadSending,
    leadName,
    leadEmail,
    leadPhone,
    rows,
    apiBaseUrl,
    contactLeadPath,
    persistChatSession,
    sessionPersistenceKey,
    contactCardMaxSummaryChars,
    accessToken,
    getAccessToken,
    apiKey,
    tenantId,
    embedKey,
    clientId,
    clientIp,
    getClientIp,
    extraHeaders,
  ]);

  const dockBottom = open ? 36 : 14;

  const dockStyleResolved = useMemo(() => {
    if (draggableLauncher && launcherDockPx != null) {
      const rawLeft = launcherDockPx.left;
      const vw = viewportWidth;
      const margin = 12;
      let left = rawLeft;
      if (open && Number.isFinite(vw) && vw > 0) {
        const rem125 =
          typeof document !== 'undefined'
            ? parseFloat(getComputedStyle(document.documentElement).fontSize || '16') * 1.25
            : 20;
        const panelW = Math.min(PANEL_MAX_W_PX, Math.max(margin * 2, vw - rem125));
        const maxLeft = vw - panelW - margin;
        left = Math.max(margin, Math.min(rawLeft, Math.max(margin, maxLeft)));
      }
      return {
        left,
        bottom: launcherDockPx.bottom,
        right: 'auto',
        top: 'auto',
        transform: 'none',
        alignItems:
          position === 'bottom-left'
            ? 'flex-start'
            : position === 'bottom-center'
              ? 'center'
              : 'flex-end',
      };
    }
    if (position === 'bottom-left') {
      return { left: 14, bottom: dockBottom, alignItems: 'flex-start' };
    }
    if (position === 'bottom-center') {
      return {
        left: '50%',
        bottom: dockBottom,
        transform: 'translateX(-50%)',
        alignItems: 'center',
      };
    }
    return { right: 14, bottom: dockBottom, alignItems: 'flex-end' };
  }, [
    draggableLauncher,
    launcherDockPx,
    open,
    position,
    dockBottom,
    viewportWidth,
  ]);

  const launcherPointerProps = draggableLauncher
    ? {
        onPointerDown: onLauncherPointerDown,
        onPointerMove: onLauncherPointerMove,
        onPointerUp: finishLauncherPointer,
        onPointerCancel: finishLauncherPointer,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        },
        title: 'Drag to move on the page, or click to open chat',
      }
    : { onClick: () => setOpen(true) };

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
        className={cn(
          'ew-pointer-events-auto ew-fixed ew-flex ew-flex-col ew-gap-3',
          !draggableLauncher && positionClasses,
          !draggableLauncher &&
            (position === 'bottom-center' ? 'ew-items-center' : 'ew-items-end'),
        )}
        style={{
          position: 'fixed',
          zIndex,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: open ? 0 : 10,
          ...dockStyleResolved,
        }}
      >
        {open ? (
          <div
            ref={panelMaximized ? undefined : panelOuterRef}
            className={cn(
              panelMaximized
                ? 'ew-fixed ew-flex ew-flex-col'
                : 'ew-relative ew-w-[min(100vw-1.25rem,400px)]',
            )}
            style={
              panelMaximized
                ? {
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '95vw',
                    maxWidth: '95vw',
                    height: '95vh',
                    maxHeight: '95vh',
                    zIndex: zIndex + 2,
                  }
                : (() => {
                    const tx =
                      panelViewportNudge.x + panelUserDragPx.x;
                    const ty =
                      panelViewportNudge.y + panelUserDragPx.y;
                    return tx || ty
                      ? { transform: `translate(${tx}px, ${ty}px)` }
                      : undefined;
                  })()
            }
          >
            <div
              className={cn(
                'ew-flex ew-w-full ew-flex-col ew-overflow-hidden ew-rounded-2xl ew-border ew-border-slate-200/95 ew-bg-white ew-shadow-panel',
                panelMaximized
                  ? 'ew-h-full ew-max-h-full ew-min-h-0'
                  : 'ew-h-[min(600px,calc(100vh-4rem))] ew-max-h-[min(88vh,calc(100vh-3.5rem))]',
              )}
              role="dialog"
              aria-label={title}
            >
            <div className="ew-flex ew-min-h-0 ew-flex-1 ew-flex-col ew-overflow-hidden ew-rounded-2xl">
            <div
              className={cn(
                'ew-flex ew-shrink-0 ew-items-center ew-justify-between ew-border-b ew-border-white/10 ew-bg-[#1a1a1a] ew-px-3 ew-py-1.5',
                panelHeaderDragEnabled &&
                  !panelMaximized &&
                  'ew-cursor-grab ew-select-none active:ew-cursor-grabbing',
              )}
              onPointerDown={panelHeaderDragEnabled && !panelMaximized ? onPanelHeaderPointerDown : undefined}
              onPointerMove={panelHeaderDragEnabled && !panelMaximized ? onPanelHeaderPointerMove : undefined}
              onPointerUp={panelHeaderDragEnabled && !panelMaximized ? finishPanelHeaderPointer : undefined}
              onPointerCancel={panelHeaderDragEnabled && !panelMaximized ? finishPanelHeaderPointer : undefined}
            >
              <div className="ew-flex ew-items-center ew-gap-2 ew-min-w-0">
                <span className="ew-flex ew-shrink-0 ew-items-center ew-justify-center ew-text-white" aria-hidden>
                  <AssistantGlyph className="ew-h-[26px] ew-w-[26px]" />
                </span>
                <span className="ew-truncate ew-text-sm ew-font-semibold ew-tracking-tight ew-text-white">
                  {title}
                </span>
              </div>
              <div className="ew-flex ew-shrink-0 ew-items-center ew-gap-0.5">
                <button
                  type="button"
                  className="ew-flex ew-h-7 ew-w-7 ew-shrink-0 ew-items-center ew-justify-center ew-rounded-full ew-text-white/90 ew-transition-colors hover:ew-bg-white/10 hover:ew-text-white"
                  onClick={() => setPanelMaximized((m) => !m)}
                  aria-label={panelMaximized ? 'Restore chat size' : 'Expand chat'}
                  aria-pressed={panelMaximized}
                >
                  {panelMaximized ? (
                    <Minimize2 className="ew-h-3.5 ew-w-3.5" strokeWidth={2.25} aria-hidden />
                  ) : (
                    <Maximize2 className="ew-h-3.5 ew-w-3.5" strokeWidth={2.25} aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  className="ew-flex ew-h-7 ew-w-7 ew-shrink-0 ew-items-center ew-justify-center ew-rounded-full ew-text-white/90 ew-transition-colors hover:ew-bg-white/10 hover:ew-text-white"
                  onClick={() => {
                    setPanelMaximized(false);
                    setOpen(false);
                  }}
                  aria-label="Close chat"
                >
                  <span className="ew-text-lg ew-leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </div>
            </div>
            <div
              ref={listRef}
              className="ew-chat-scroll ew-min-h-0 ew-flex-1 ew-space-y-2 ew-overflow-y-auto ew-overflow-x-hidden ew-overscroll-y-contain ew-bg-[#f4f6f4] ew-px-3 ew-py-2.5"
            >
              {String(welcomeMessage ?? '').trim() ? (
                <div className="ew-flex ew-shrink-0 ew-justify-start">
                  <div className="ew-max-w-[95%] ew-rounded-2xl ew-border ew-border-slate-200/90 ew-bg-white ew-px-3 ew-py-2 ew-text-[13px] ew-font-medium ew-leading-snug ew-text-[#333333] ew-shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    {linkifyText(welcomeMessage, 'wm')}
                  </div>
                </div>
              ) : null}
              {rows.map((row, i) => (
                <div
                  key={i}
                  className={`ew-flex ${row.role === 'user' ? 'ew-justify-end' : 'ew-justify-start'}`}
                >
                  <div
                    className={`ew-max-w-[90%] ew-rounded-2xl ew-px-2.5 ew-py-1.5 ew-text-[13px] ew-leading-snug ${
                      row.role === 'user'
                        ? 'ew-whitespace-pre-wrap ew-border ew-border-white/10 ew-bg-[#1a1a1a] ew-text-white ew-shadow-sm [&_a]:ew-break-words [&_a]:ew-text-sky-200 [&_a]:ew-underline [&_a]:hover:ew-text-white'
                        : row.error
                          ? 'ew-whitespace-pre-wrap ew-bg-red-50 ew-text-red-900 ew-ring-1 ew-ring-red-200/80'
                          : 'ew-border ew-border-slate-200/90 ew-bg-white ew-text-[#333333] ew-shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                    }`}
                  >
                    {row.role === 'assistant' && !row.error ? (
                      <AssistantReply text={row.text} />
                    ) : (
                      linkifyText(row.text, `row-${i}`)
                    )}
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
            {contactLeadEnabled && contactCardRevealed ? (
              <div className="ew-shrink-0 ew-border-t ew-border-slate-200/90 ew-bg-white ew-px-2 ew-pt-1.5 ew-pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setContactExpanded((prev) => {
                      const next = !prev;
                      if (!next) setLeadErr('');
                      return next;
                    });
                  }}
                  className="ew-mb-1 ew-flex ew-w-full ew-items-center ew-justify-between ew-gap-2 ew-rounded-xl ew-border ew-border-slate-200 ew-bg-slate-50 ew-py-1.5 ew-pl-2 ew-pr-2 ew-text-left ew-text-[12px] ew-font-semibold ew-text-[#2d2d2d] hover:ew-bg-slate-100"
                  aria-expanded={contactExpanded}
                >
                  <span className="ew-truncate">{contactCardTitle}</span>
                  <span className="ew-shrink-0 ew-text-slate-500" aria-hidden>
                    {contactExpanded ? '▼' : '▶'}
                  </span>
                </button>
                {contactExpanded ? (
                  <div className="ew-mb-1 ew-rounded-xl ew-border ew-border-slate-200/90 ew-bg-[#f8faf8] ew-p-2">
                    <p className="ew-mb-2 ew-text-[11px] ew-leading-snug ew-text-[#5b5b5b]">
                      {contactCardSubtitle}
                    </p>
                    <label className="ew-mb-1 ew-block ew-text-[11px] ew-font-medium ew-text-[#333333]">
                      Name
                      <input
                        type="text"
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        disabled={leadSending}
                        className="ew-mt-0.5 ew-w-full ew-rounded-lg ew-border ew-border-slate-200 ew-bg-white ew-px-2 ew-py-1.5 ew-text-[13px] ew-text-[#2d2d2d] focus:ew-border-embed-accent focus:ew-outline-none focus:ew-ring-1 focus:ew-ring-embed-accent/25"
                        autoComplete="name"
                      />
                    </label>
                    <label className="ew-mb-1 ew-block ew-text-[11px] ew-font-medium ew-text-[#333333]">
                      Email
                      <input
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                        disabled={leadSending}
                        className="ew-mt-0.5 ew-w-full ew-rounded-lg ew-border ew-border-slate-200 ew-bg-white ew-px-2 ew-py-1.5 ew-text-[13px] ew-text-[#2d2d2d] focus:ew-border-embed-accent focus:ew-outline-none focus:ew-ring-1 focus:ew-ring-embed-accent/25"
                        autoComplete="email"
                      />
                    </label>
                    <label className="ew-mb-2 ew-block ew-text-[11px] ew-font-medium ew-text-[#333333]">
                      Phone
                      <input
                        type="tel"
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        disabled={leadSending}
                        className="ew-mt-0.5 ew-w-full ew-rounded-lg ew-border ew-border-slate-200 ew-bg-white ew-px-2 ew-py-1.5 ew-text-[13px] ew-text-[#2d2d2d] focus:ew-border-embed-accent focus:ew-outline-none focus:ew-ring-1 focus:ew-ring-embed-accent/25"
                        autoComplete="tel"
                      />
                    </label>
                    {leadErr ? (
                      <p className="ew-mb-1 ew-text-[11px] ew-text-red-700">{leadErr}</p>
                    ) : null}
                    <div className="ew-flex ew-gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLeadErr('');
                          setLeadName('');
                          setLeadEmail('');
                          setLeadPhone('');
                          setContactExpanded(false);
                          setContactCardRevealed(false);
                        }}
                        disabled={leadSending}
                        className="ew-flex-1 ew-rounded-xl ew-border ew-border-slate-200 ew-bg-white ew-py-2 ew-text-[13px] ew-font-semibold ew-text-[#2d2d2d] hover:ew-bg-slate-50 disabled:ew-opacity-50"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={() => void submitLead()}
                        disabled={leadSending}
                        className="ew-min-w-0 ew-flex-[1.4] ew-rounded-xl ew-bg-embed-accent ew-py-2 ew-text-[13px] ew-font-semibold ew-text-white ew-shadow-sm hover:ew-bg-embed-accentHover disabled:ew-opacity-50"
                      >
                        {leadSending ? 'Sending…' : contactCardButtonLabel}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <form
              className="ew-shrink-0 ew-border-t ew-border-slate-200/90 ew-bg-white ew-p-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <div className="ew-relative ew-min-w-0 ew-w-full">
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={placeholder}
                  disabled={loading}
                  className="ew-w-full ew-rounded-2xl ew-border ew-border-[#ff8c32] ew-bg-white ew-py-2 ew-pl-3 ew-pr-11 ew-text-[13px] ew-text-[#2d2d2d] placeholder:ew-text-[#8a8a8a] focus:ew-border-[#ff8c32] focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-[#ff8c32]/25"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={loading || !text.trim()}
                  aria-label="Send message"
                  className="ew-absolute ew-right-1.5 ew-top-1/2 ew-flex ew-h-8 ew-w-8 -ew-translate-y-1/2 ew-items-center ew-justify-center ew-rounded-full ew-bg-[#ff8c32] ew-text-white ew-shadow-[0_2px_8px_rgba(255,140,50,0.45)] ew-transition-colors hover:ew-bg-[#e67820] disabled:ew-pointer-events-none disabled:ew-opacity-40"
                >
                  <Send className="ew-h-4 ew-w-4" strokeWidth={2.25} aria-hidden />
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
            {...launcherPointerProps}
            className={cn(
              'ew-pointer-events-auto ew-flex ew-max-w-[min(calc(100vw-2rem),20rem)] ew-items-center ew-gap-0 ew-overflow-visible ew-rounded-full ew-border ew-border-embed-accent/20 ew-bg-white ew-py-1 ew-pl-1 ew-pr-3.5 ew-shadow-launcher ew-backdrop-blur-md ew-transition-transform hover:-ew-translate-y-0.5 focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-embed-teal/40 focus:ew-ring-offset-2 focus:ew-ring-offset-white',
              draggableLauncher && 'ew-cursor-grab ew-select-none active:ew-cursor-grabbing',
            )}
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
            {...launcherPointerProps}
            className={cn(
              'ew-pointer-events-auto ew-relative ew-flex ew-h-16 ew-w-16 ew-shrink-0 ew-items-center ew-justify-center ew-rounded-full ew-border ew-border-slate-200/90 ew-bg-white/80 ew-shadow-[0_10px_28px_-6px_rgba(0,0,0,0.18),0_2px_8px_-2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] ew-backdrop-blur-md ew-transition-[transform,box-shadow] ew-duration-200 hover:-ew-translate-y-0.5 hover:ew-scale-[1.04] hover:ew-shadow-[0_14px_36px_-6px_rgba(0,0,0,0.2),0_2px_10px_-2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] active:ew-scale-[0.97] focus:ew-outline-none focus:ew-ring-2 focus:ew-ring-embed-accent/40 focus:ew-ring-offset-2 focus:ew-ring-offset-white',
              draggableLauncher
                ? 'ew-cursor-grab ew-select-none active:ew-cursor-grabbing'
                : 'ew-cursor-pointer',
            )}
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
