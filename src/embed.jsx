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
 * @param {string} [config.apiKey] - X-API-Key only if your gateway requires it
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
