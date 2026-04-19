/**
 * Single-tag embed: loads chat-widget CSS + JS from the same origin as this file, then init().
 *
 * Production (minimal — optional `async`; omit `data-api-base` for default API — keep in sync with src/publicApiBase.js):
 *   <script async src="https://YOUR-CDN/widget-loader.js" data-site-key="pk_xxx" data-client-id="client-id"></script>
 *
 * Prefer id="ew-chat-widget-loader" on the tag when multiple external scripts exist (Angular, etc.).
 *
 * Attributes:
 *   data-api-base       — API origin; omit for default public API
 *   data-chat-path      — default /api/v1/chat
 *   data-site-key       — X-Embed-Key
 *   data-client-id      — X-Tenant-Id
 *   data-access-token   — Bearer (optional; prefer window.__EW_CHAT_ACCESS_TOKEN__)
 *
 * CHAT_WIDGET_JS / CHAT_WIDGET_CSS: stable names in repo; npm run build rewrites them to hashed names in dist.
 */
var __ewExecutingLoaderScript = document.currentScript;
(function () {
  var DEFAULT_API_BASE = "https://ai-assistance-service.onrender.com";
  /** Replaced in dist by scripts/patch-dist.mjs (must match this line exactly). */
  var CHAT_WIDGET_JS = 'chat-widget.7246e9849b4e.js'; // ew-dist-hashed-js
  var CHAT_WIDGET_CSS = 'chat-widget.ea636d9274fb.css'; // ew-dist-hashed-css

  function findLoaderScript() {
    var cur = __ewExecutingLoaderScript || document.currentScript;
    if (cur && cur.src && /widget-loader\.js(\?|#|$)/i.test(cur.src)) return cur;
    var byId = document.getElementById('ew-chat-widget-loader');
    if (byId && byId.src) return byId;
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var el = scripts[i];
      var src = el.src || '';
      if (/widget-loader\.js(\?|#|$)/i.test(src)) return el;
    }
    return null;
  }

  var loader = findLoaderScript();

  function injectAndInit() {
    if (!loader || !loader.src) {
      console.error(
        '[widget-loader] Could not resolve loader <script> — add id="ew-chat-widget-loader" to your script tag.',
      );
      return;
    }
    if (window.__EW_WIDGET_LOADER_DONE__) return;

    var baseUrl = new URL('.', loader.src).href.replace(/\/?$/, '');
    var apiAttr = loader.getAttribute('data-api-base');
    var apiBase;
    if (apiAttr === null) {
      apiBase = DEFAULT_API_BASE;
    } else if (apiAttr === 'undefined') {
      apiBase = '';
    } else {
      apiBase = String(apiAttr).trim();
    }

    var chatPath = loader.getAttribute('data-chat-path') || '/api/v1/chat';
    var siteKey = loader.getAttribute('data-site-key') || '';
    var clientId = loader.getAttribute('data-client-id') || '';
    var accessToken = (loader.getAttribute('data-access-token') || '').trim();
    if (
      !accessToken &&
      typeof window !== 'undefined' &&
      typeof window.__EW_CHAT_ACCESS_TOKEN__ === 'string'
    ) {
      accessToken = window.__EW_CHAT_ACCESS_TOKEN__.trim();
    }

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = baseUrl + '/' + CHAT_WIDGET_CSS;
    document.head.appendChild(link);

    var s = document.createElement('script');
    s.src = baseUrl + '/' + CHAT_WIDGET_JS;
    s.async = false;
    s.onerror = function () {
      console.error('[widget-loader] failed to load', s.src, '(open URL in a tab — must be JavaScript, not HTML)');
    };
    (document.body || document.documentElement).appendChild(s);

    if (typeof ChatWidgetEmbed === 'undefined') {
      console.error(
        '[widget-loader] chat-widget.js ran but ChatWidgetEmbed is missing — wrong file or HTML error page served for',
        s.src,
      );
      return;
    }
    try {
      var initCfg = {
        apiBaseUrl: apiBase,
        chatPath: chatPath,
        embedKey: siteKey,
        tenantId: clientId,
        title: 'Support',
        position: 'bottom-center',
        launcherLabel: "I'm here to help — ask me anything!",
      };
      if (accessToken) initCfg.accessToken = accessToken;
      ChatWidgetEmbed.init(initCfg);
      window.__EW_WIDGET_LOADER_DONE__ = true;
    } catch (err) {
      console.error('[widget-loader] ChatWidgetEmbed.init() threw', err);
    }
  }

  function start() {
    if (!document.body) return;
    injectAndInit();
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', function onEwDomReady() {
      document.removeEventListener('DOMContentLoaded', onEwDomReady);
      start();
    });
  }
})();
