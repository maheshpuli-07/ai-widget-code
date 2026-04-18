/**
 * Netlify (and similar hosts) serve `/` as `index.html`.
 * Vite outputs chat-widget.js + chat-widget.css; this script renames them to content-hashed filenames
 * (avoids browsers/CDNs reusing a stale 304 body for a fixed /chat-widget.js URL).
 * This script adds a small landing page after `vite build`.
 */
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PUBLIC_WIDGET_API_BASE } from '../src/publicApiBase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');

const jsPath = path.join(dist, 'chat-widget.js');
const cssPath = path.join(dist, 'chat-widget.css');
if (!fs.existsSync(jsPath) || !fs.existsSync(cssPath)) {
  console.error(
    '[patch-dist-for-netlify] Missing dist/chat-widget.js or dist/chat-widget.css. Run vite build (widget config) first.',
  );
  process.exit(1);
}

const jsBytes = fs.readFileSync(jsPath);
const cssBytes = fs.readFileSync(cssPath);
const assetHash = crypto.createHash('sha256').update(jsBytes).digest('hex').slice(0, 12);
const cssHash = crypto.createHash('sha256').update(cssBytes).digest('hex').slice(0, 12);
const jsNamed = `chat-widget.${assetHash}.js`;
const cssNamed = `chat-widget.${cssHash}.css`;
fs.renameSync(jsPath, path.join(dist, jsNamed));
fs.renameSync(cssPath, path.join(dist, cssNamed));
/** Stable names for quick embeds; <code>no-store</code> avoids poisoned long-lived 304 on this URL. */
fs.copyFileSync(path.join(dist, jsNamed), path.join(dist, 'chat-widget.js'));
fs.copyFileSync(path.join(dist, cssNamed), path.join(dist, 'chat-widget.css'));

/** Landing page: auto-fills copy-paste with this Netlify origin so CDN is never wrong. */
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Chat widget CDN</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 44rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; color: #0f172a; }
    code { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.78rem; white-space: pre-wrap; word-break: break-all; }
    a { color: #0284c7; }
    .ok { color: #15803d; font-weight: 600; }
    .warn { background: #fff7ed; border: 1px solid #fdba74; padding: 0.75rem 1rem; border-radius: 8px; margin: 1rem 0; }
    button.copy { margin-top: 0.5rem; padding: 0.4rem 0.75rem; cursor: pointer; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; }
  </style>
</head>
<body>
  <p class="ok">Deploy this entire <code>dist</code> folder to Netlify — <code>index.html</code> is in the root.</p>
  <h1>Chat embed widget</h1>

  <div class="warn">
    <strong>Use only this API:</strong> global <code>ChatWidgetEmbed.init({ ... })</code> with <code>apiBaseUrl</code> (default public API: <code>${PUBLIC_WIDGET_API_BASE}</code>).
    Snippets below use <strong>this page’s origin</strong> for widget files and that API for chat. Your API must allow <strong>CORS</strong> from sites where you paste the embed. Snippets that say <code>initChatWidget</code> or <code>localhost:3000</code> are <strong>wrong</strong>.
  </div>

  <p>Static assets: prefer <strong>hashed</strong> URLs in production (immutable cache). Stable names exist for quick tests.</p>
  <ul>
    <li><a href="./${jsNamed}"><code>${jsNamed}</code></a> (recommended)</li>
    <li><a href="./${cssNamed}"><code>${cssNamed}</code></a></li>
    <li><a href="./chat-widget.js"><code>chat-widget.js</code></a> / <a href="./chat-widget.css"><code>chat-widget.css</code></a> (<code>no-store</code>)</li>
    <li><a href="./widget-loader.js"><code>widget-loader.js</code></a> — <strong>one tag</strong> for third-party sites (loads CSS + JS + <code>init</code>)</li>
  </ul>
  <p><strong>Prove deploy:</strong> open <a href="./demo-live.html"><code>demo-live.html</code></a> or <a href="./demo-loader.html"><code>demo-loader.html</code></a> — you should see the chat pill.</p>

  <h2>Third-party sites: one <code>&lt;script&gt;</code> (recommended)</h2>
  <p>Paste anywhere (end of <code>&lt;body&gt;</code> is ideal). This snippet uses <strong>this site’s origin</strong> for the loader, <code>async</code>, and omits <code>data-api-base</code> so chat uses the default API (<code>${PUBLIC_WIDGET_API_BASE}</code>). Add <code>data-api-base=""</code> only for same-origin APIs; set <code>data-api-base="https://…"</code> to override.</p>
  <pre id="ew-loader-snippet" aria-label="Loader embed code"></pre>
  <button type="button" class="copy" id="ew-copy-loader-btn">Copy loader snippet</button>

  <h2>Copy-paste embed (manual: link + script + init)</h2>
  <p>Uses hashed asset URLs and <code>apiBaseUrl: '${PUBLIC_WIDGET_API_BASE}'</code>.</p>
  <pre id="ew-embed-snippet" aria-label="Embed code"></pre>
  <button type="button" class="copy" id="ew-copy-btn">Copy snippet</button>

  <p style="margin-top:1.5rem">The <strong>loader</strong> line supports <code>async</code>. The manual block below is optional (hashed assets + explicit <code>init</code>).</p>

  <script>
  (function () {
    var cdn = location.origin.replace(/\\/$/, '');
    var nl = String.fromCharCode(10);
    var snippet =
      '<link rel="stylesheet" href="' + cdn + '/${cssNamed}' + '" />' + nl +
      '<script src="' + cdn + '/${jsNamed}' + '"><\\/script>' + nl +
      '<script>' + nl +
      '  ChatWidgetEmbed.init({' + nl +
      "    apiBaseUrl: '${PUBLIC_WIDGET_API_BASE}'," + nl +
      "    accessToken: ''," + nl +
      "    chatPath: '/api/v1/chat'," + nl +
      "    title: 'Assistant'," + nl +
      "    position: 'bottom-left'," + nl +
      '  });' + nl +
      '<\\/script>';
    var pre = document.getElementById('ew-embed-snippet');
    if (pre) pre.textContent = snippet;
    var btn = document.getElementById('ew-copy-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        if (!pre) return;
        navigator.clipboard.writeText(pre.textContent).then(function () {
          btn.textContent = 'Copied!';
          setTimeout(function () { btn.textContent = 'Copy snippet'; }, 2000);
        });
      });
    }
    var loaderPre = document.getElementById('ew-loader-snippet');
    var loaderSnippet =
      '<script id="ew-chat-widget-loader" async src="' + cdn + '/widget-loader.js"' + nl +
      '  data-site-key="pk_YOUR_SITE_KEY"' + nl +
      '  data-client-id="YOUR_CLIENT_ID"' + nl +
      '></scr' + 'ipt>';
    if (loaderPre) loaderPre.textContent = loaderSnippet;
    var lbtn = document.getElementById('ew-copy-loader-btn');
    if (lbtn && loaderPre) {
      lbtn.addEventListener('click', function () {
        navigator.clipboard.writeText(loaderPre.textContent).then(function () {
          lbtn.textContent = 'Copied!';
          setTimeout(function () { lbtn.textContent = 'Copy loader snippet'; }, 2000);
        });
      });
    }
  })();
`;

const indexHtmlClose = '</scr' + 'ipt>\n</body>\n</html>\n';

const demoLiveHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Widget live check</title>
  <link rel="stylesheet" href="/${cssNamed}" />
  <style>
    body { font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 36rem; margin: 0 auto; line-height: 1.5; }
    .ok { color: #15803d; font-weight: 600; }
    .fail { color: #b91c1c; font-weight: 600; }
    #ew-status { margin: 1rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <p class="ok">If Netlify deployed correctly, an Alloe-style chat pill appears (bottom-center).</p>
  <p>The script uses a <strong>content-hashed filename</strong> (e.g. <code>/chat-widget.${assetHash}.js</code>) so caches cannot replay an old wrong body for a fixed <code>/chat-widget.js</code> URL. It is parser-inserted like production embeds.</p>
  <p>Paths are <strong>root-absolute</strong>. Unregister any <strong>service worker</strong> for this site if the script body is wrong.</p>
  <div id="ew-status">Loading widget script…</div>
  <p>Sending messages needs your Banking API at <code>apiBaseUrl</code> (and CORS).</p>
  <script src="/${jsNamed}"></script>
  <script>
  (function () {
    function setStatus(html, isError) {
      var el = document.getElementById('ew-status');
      if (!el) return;
      el.className = isError ? 'fail' : '';
      el.innerHTML = html;
    }
    var jsUrl = '/${jsNamed}';
    var api =
      typeof ChatWidgetEmbed !== 'undefined'
        ? ChatWidgetEmbed
        : typeof window !== 'undefined'
          ? window.ChatWidgetEmbed
          : typeof globalThis !== 'undefined'
            ? globalThis.ChatWidgetEmbed
            : undefined;
    if (api === undefined) {
      setStatus(
        'FAIL: <code>ChatWidgetEmbed</code> missing after script. Open <a href="' +
          jsUrl +
          '">' +
          jsUrl +
          '</a> — must start with <code>var ChatWidgetEmbed</code>. Check Console; unregister any service worker for this site if responses look wrong.',
        true,
      );
      return;
    }
    try {
      api.init({
        apiBaseUrl: '${PUBLIC_WIDGET_API_BASE}',
        chatPath: '/api/v1/chat',
        title: 'Demo',
        position: 'bottom-center',
        launcherLabel: "I'm here to help — ask me anything!",
      });
      setStatus(
        '<span class="ok">Widget script OK — Alloe-style bottom-center pill. Close with ✕. Elements: <code>ew-chat-widget-launcher</code>.</span>',
        false,
      );
    } catch (e) {
      setStatus('FAIL: <code>init()</code> threw: ' + (e && e.message ? e.message : String(e)), true);
    }
  })();
  </script>
</body>
</html>
`;

const demoLoaderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Widget loader check</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 1.5rem; max-width: 36rem; margin: 0 auto; line-height: 1.5; }
    .ok { color: #15803d; font-weight: 600; }
  </style>
</head>
<body>
  <p class="ok">Production-style: one <code>async</code> tag, no <code>data-api-base</code> (default API injected at build from <code>src/publicApiBase.js</code>).</p>
  <p>Override with <code>data-api-base="https://…"</code> if needed; CORS must allow this Netlify origin.</p>
  <script id="ew-chat-widget-loader" async src="/widget-loader.js" data-site-key="netlify-demo" data-client-id=""></script>
</body>
</html>
`;

fs.writeFileSync(
  path.join(dist, 'index.html'),
  indexHtml + indexHtmlClose,
  'utf8',
);
fs.writeFileSync(path.join(dist, 'demo-live.html'), demoLiveHtml, 'utf8');
fs.writeFileSync(path.join(dist, 'demo-loader.html'), demoLoaderHtml, 'utf8');

const loaderSrc = path.join(__dirname, '..', 'public', 'widget-loader.js');
const loaderDest = path.join(dist, 'widget-loader.js');
if (!fs.existsSync(loaderSrc)) {
  console.error(`[patch-dist-for-netlify] Missing ${loaderSrc}`);
  process.exit(1);
}
let loaderJs = fs.readFileSync(loaderSrc, 'utf8');
loaderJs = loaderJs.replace(
  /var DEFAULT_API_BASE = [^;]+;/,
  `var DEFAULT_API_BASE = ${JSON.stringify(PUBLIC_WIDGET_API_BASE)};`,
);
/** Same hashed assets as the manual embed (avoids stable /chat-widget.js returning HTML on some hosts). */
loaderJs = loaderJs.replace(
  /var CHAT_WIDGET_JS = 'chat-widget\.js'; \/\/ ew-dist-hashed-js/,
  `var CHAT_WIDGET_JS = '${jsNamed}'; // ew-dist-hashed-js`,
);
loaderJs = loaderJs.replace(
  /var CHAT_WIDGET_CSS = 'chat-widget\.css'; \/\/ ew-dist-hashed-css/,
  `var CHAT_WIDGET_CSS = '${cssNamed}'; // ew-dist-hashed-css`,
);
fs.writeFileSync(loaderDest, loaderJs, 'utf8');

const headersContent = `/${jsNamed}
  Cache-Control: public, max-age=31536000, immutable

/${cssNamed}
  Cache-Control: public, max-age=31536000, immutable

/chat-widget.js
  Cache-Control: no-store, no-cache, must-revalidate

/chat-widget.css
  Cache-Control: no-store, no-cache, must-revalidate

/widget-loader.js
  Cache-Control: no-store, no-cache, must-revalidate
`;
fs.writeFileSync(path.join(dist, '_headers'), headersContent, 'utf8');

/** No SPA catch-all: a <code>/* /index.html</code> rule can make missing <code>.js</code> requests return HTML and break the widget. */
const redirectsPath = path.join(dist, '_redirects');
if (fs.existsSync(redirectsPath)) fs.unlinkSync(redirectsPath);

console.log(
  `[patch-dist-for-netlify] wrote index.html, demo-live.html, demo-loader.html, widget-loader.js, _headers (${jsNamed}, ${cssNamed}; removed _redirects if present)`,
);
