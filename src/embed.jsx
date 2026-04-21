import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ChatWidget from './ChatWidget.jsx';
import './index.css';

let reactRoot = null;
let mountEl = null;
let weCreatedMount = false;

/**
 * Mount the chat widget on the host page (typically document.body).
 *
 * @param {object} config
 * @param {string} config.apiBaseUrl - API origin (use "" for same-origin). Loader omits `data-api-base` to use its baked-in default.
 * @param {string} [config.chatPath=/api/v1/chat]
 * @param {string} [config.tenantId]
 * @param {string} [config.embedKey]
 * @param {string} [config.accessToken] - Bearer token → `Authorization` (optional). Loader: `data-access-token` or `window.__EW_CHAT_ACCESS_TOKEN__`.
 * @param {() => string|undefined|null} [config.getAccessToken] - per-request token
 * @param {string} [config.apiKey] - `X-API-Key` header and JSON `apiKey` when set
 * @param {string} [config.clientId] - JSON body `clientId` (optional; separate from `tenantId` → `X-Tenant-Id`)
 * @param {string} [config.clientIp] - JSON body `clientIp` (usually injected server-side; browser has no true public IP)
 * @param {() => string|undefined|null|Promise<string|undefined|null>} [config.getClientIp] - optional override for `clientIp` each send
 * @param {object} [config.secureFields] - phoneNumber, customerId, accountNumber, transactionTrackingRef
 * @param {string} [config.title]
 * @param {string} [config.placeholder]
 * @param {'bottom-right'|'bottom-left'|'bottom-center'} [config.position]
 * @param {string} [config.launcherLabel] - Alloe-style pill text next to the icon (hides launcher while panel is open)
 * @param {number} [config.zIndex]
 * @param {boolean} [config.defaultOpen]
 * @param {string} [config.containerId=ew-chat-widget-root] - existing element to mount into
 * @param {boolean} [config.removeContainerOnDestroy=true] - if we created the container, remove on destroy
 * @param {Record<string, string>} [config.extraHeaders]
 * @param {string|false} [config.replyFormatPrompt] - sent as JSON `systemPrompt` when non-empty; `false`/`''` omits. Default instructions ask for paragraphs and "- " bullets.
 * @param {boolean} [config.replyFormatAppendToMessage=true] - append a short format hint after the user message in JSON (for APIs that ignore `systemPrompt`). Set `false` to send only `systemPrompt`.
 * @param {boolean} [config.persistChatSession=true] - send `sessionId` + `conversationId` (after first reply) on each POST; persist in localStorage. Set `false` to omit (no anonymous threading).
 * @param {boolean} [config.draggableLauncher=false] - when `true`, the closed chat launcher can be dragged on the page. Default `false` keeps the fixed `position` corner/center anchor.
 * @param {boolean} [config.draggablePanel] - when `true`, the open chat panel can be dragged by its dark header (not while maximized). When omitted, defaults to the same value as `draggableLauncher`. Set `false` to keep the panel fixed even if the launcher is draggable.
 * @param {boolean} [config.rememberLauncherPosition=false] - when `true` (with `draggableLauncher`), restore/save dragged launcher coordinates in localStorage (scoped like the chat session). Default `false`: each load uses `position` (e.g. bottom-right); drag applies until reload.
 * @param {string} [config.contactLeadPath=/api/v1/contact-lead] - when non-empty, the callback row (**Send** = POST `sendContactLead`) **appears and expands** only when the **user** message looks like a **name, email, or phone** in chat (prefill). Not driven by the model prompt — client-side heuristics only. Set `''` to hide the card. **Skip** or a successful **Send** removes the row; it can appear again on a later hint.
 * @param {string} [config.contactCardTitle]
 * @param {string} [config.contactCardSubtitle]
 * @param {string} [config.contactCardButtonLabel]
 * @param {number} [config.contactCardMaxSummaryChars=12000] - max chars of chat transcript in `chatSummary` body field
 * @returns {{ destroy: () => void }}
 */
function mountWidget(config) {
  try {
    if (!document.body) {
      console.error('[ChatWidgetEmbed] document.body is missing');
      return { destroy: () => {} };
    }

    const containerId = config.containerId || 'ew-chat-widget-root';
    mountEl = document.getElementById(containerId);

    if (!mountEl) {
      mountEl = document.createElement('div');
      mountEl.id = containerId;
      document.body.appendChild(mountEl);
      weCreatedMount = true;
    } else {
      weCreatedMount = false;
    }

    if (reactRoot) {
      reactRoot.unmount();
      reactRoot = null;
    }

    reactRoot = createRoot(mountEl);
    reactRoot.render(
      <StrictMode>
        <ChatWidget config={config} />
      </StrictMode>
    );
  } catch (err) {
    console.error('[ChatWidgetEmbed] init failed', err);
    return { destroy: () => {} };
  }

  return {
    destroy: () => {
      if (reactRoot) {
        reactRoot.unmount();
        reactRoot = null;
      }
      const remove =
        config.removeContainerOnDestroy !== false && weCreatedMount && mountEl?.parentNode;
      if (remove) {
        mountEl.remove();
      }
      mountEl = null;
      weCreatedMount = false;
    },
  };
}

export function init(config = {}) {
  if (typeof document === 'undefined') {
    console.warn('[ChatWidgetEmbed] init() requires a browser environment');
    return { destroy: () => {} };
  }

  let domReadyListener = null;
  let innerDestroy = null;
  let cancelled = false;

  const run = () => {
    if (cancelled) return;
    innerDestroy = mountWidget(config);
  };

  if (document.body) {
    run();
  } else {
    domReadyListener = () => {
      document.removeEventListener('DOMContentLoaded', domReadyListener);
      domReadyListener = null;
      run();
    };
    document.addEventListener('DOMContentLoaded', domReadyListener);
  }

  return {
    destroy: () => {
      cancelled = true;
      if (domReadyListener) {
        document.removeEventListener('DOMContentLoaded', domReadyListener);
        domReadyListener = null;
      }
      if (innerDestroy) {
        innerDestroy.destroy();
        innerDestroy = null;
      }
    },
  };
}

export const version = '1.0.0';

/** Single public object — always attach synchronously so `ChatWidgetEmbed.init` works immediately after the script tag. */
const ChatWidgetEmbedApi = { init, version };

function publishGlobal() {
  try {
    if (typeof globalThis !== 'undefined') {
      globalThis.ChatWidgetEmbed = ChatWidgetEmbedApi;
    }
    if (typeof window !== 'undefined') {
      window.ChatWidgetEmbed = ChatWidgetEmbedApi;
    }
  } catch {
    /* ignore */
  }
}

publishGlobal();
