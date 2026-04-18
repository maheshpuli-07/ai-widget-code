# Chat embed widget

Standalone **React + Tailwind** IIFE bundle for third-party sites (`ChatWidgetEmbed.init(...)`).

Deploy the built **`dist`** folder to any **static host** (S3 + CloudFront, Cloudflare Pages, a CDN bucket, your own Nginx, etc.).

### Reference architecture (product-help widget) vs this repo

| Reference | Here |
|-----------|------|
| `widget-loader.js` | `public/widget-loader.js` — one tag: loads CSS + `chat-widget.js` + `init()`. Optional `data-api-base` (omit = default from `src/publicApiBase.js`, injected at `npm run build`). Supports **`async`**. |
| `widget.js` / `widget.css` | `chat-widget.js` / `chat-widget.css` (IIFE + Tailwind build) |
| `data-site-key` | Mapped to **`embedKey`** → `X-Embed-Key` on chat requests |
| `data-client-id` | Mapped to **`tenantId`** → `X-Tenant-Id` |
| `data-access-token` | Sent as **`Authorization: Bearer …`** (optional). Safer: set **`window.__EW_CHAT_ACCESS_TOKEN__`** before the loader script so the token is not hard-coded in static HTML. |
| `data-api-base` | **`apiBaseUrl`**. Omit attribute → default public API. `data-api-base=""` → same origin as the host page. |

## Why the site root used to 404

The raw Vite widget build only produced `chat-widget.js` + `chat-widget.css`. Many hosts map `/` to **`index.html`**. With no `index.html` in the published folder, the **site root can 404**.

**Fix:** `npm run build` runs **`scripts/patch-dist.mjs`**, which adds **`dist/index.html`**, **`demo-live.html`**, **`demo-loader.html`**, **`_headers`** (optional; see below), and **content-hashes** the bundle filenames so caches cannot serve a stale wrong file for a fixed URL.

## Deploy (static host)

1. **`npm install`** then **`npm run build`**. That creates **`dist/`** (widget assets, **`widget-loader.js`**, landing **`index.html`**, demos, **`_headers`**).
2. Upload the **entire `dist` folder** to your host (root of the bucket/site so `/index.html` and `/widget-loader.js` resolve).
3. Open your deployed **`/`**. The page uses **`location.origin`** in the copy boxes so script URLs match your real CDN hostname.
4. Paste the **Copy loader snippet** (or manual snippet) before **`</body>`** on partner sites. Your chat API must allow **CORS** from every origin that embeds the widget.

**`_headers`:** Some static hosts read this file for cache headers; others ignore it — safe to leave in `dist/`.

## Deploy on [Render](https://render.com) (static site)

This project is **static files** after `npm run build` — use Render’s **Static Site** (not a Web Service unless you add your own server).

1. In Render: **New +** → **Static Site**.
2. Connect the GitHub repo (**`maheshpuli-07/ai-widget-code`** or your fork).
3. Settings:
   - **Branch:** `main`
   - **Root directory:** leave empty (repo root).
   - **Build command:** `npm ci && npm run build`
   - **Publish directory:** `dist`
4. **Create static site.** Wait for the first deploy.
5. Open the Render URL (e.g. `https://chat-embed-widget.onrender.com/`). Use **Copy loader snippet** on `/` for embed tags pointing at **that** host.
6. **Important:** Do **not** turn on a single-page-app rule that sends **all routes** to `index.html` — that can make `*.js` requests return HTML and break the widget. The repo includes `render.yaml` with `staticPublishPath: dist` only.

If **`dist/` is committed** to Git, you can still keep the build command above so each deploy rebuilds from source (recommended). If you ever publish **without** rebuilding, ensure `dist/` matches the latest `src/`.

## Client demo checklist

1. **`npm run build`**, deploy **`dist/`**.
2. Open **`https://YOUR-CDN/demo-live.html`** — chat pill should appear (proves JS/CSS). Sending messages needs your API up and **CORS** allowing your CDN origin.
3. Open **`/`** on the same host to copy snippets with the current **hashed** asset names.

## Develop

```bash
cd chat-embed-widget
npm install
npm run dev
```

Preview: [http://localhost:5174](http://localhost:5174). `/api` and `/auth` proxy to the **Banking API**, default **`http://localhost:9000`** (override with `API_PROXY_TARGET` or `VITE_API_BASE_URL` in `.env`).

## Build

```bash
npm run build
```

**Deploy the whole `dist` folder** (must include):

- `index.html` — landing + copy-paste snippet (correct hashed asset URLs)
- `demo-live.html` — smoke test
- `chat-widget.<hash>.js` and `chat-widget.<hash>.css` — primary, immutable cache
- `chat-widget.js` / `chat-widget.css` — copies with `no-store` for fixed-URL quick tests
- `_headers` — optional cache hints for hosts that support them

Do **not** upload the repo root or `src/` only.

## Production embed (recommended: one line)

After deploy, use **Copy loader snippet** on **`/`**, or:

```html
<script
  id="ew-chat-widget-loader"
  async
  src="https://YOUR-CDN-DOMAIN/widget-loader.js"
  data-site-key="pk_xxx"
  data-client-id="client-id"
></script>
```

Optional: `data-api-base`, `data-chat-path`, `data-access-token`, or `window.__EW_CHAT_ACCESS_TOKEN__` before the script (see `public/widget-loader.js`).

## Embed snippet (manual / advanced)

After each `npm run build`, open your deployed **`index.html`** and use **Copy snippet**. Example shape:

```html
<link rel="stylesheet" href="https://YOUR-CDN/chat-widget.0123456789ab.css" />
<script src="https://YOUR-CDN/chat-widget.0123456789ab.js"></script>
<script>
  ChatWidgetEmbed.init({
    apiBaseUrl: 'https://ai-assistance-service.onrender.com',
    accessToken: '', // optional Bearer; omit or use getAccessToken() for fresh tokens
    chatPath: '/api/v1/chat',
  });
</script>
```

Prefer the **Copy snippet** button on your deployed **`/`** so `YOUR-CDN` and the **hash** match the current build. Change the API URL in **`src/publicApiBase.js`** if you use a different backend; your API must allow **CORS** from every origin that embeds the widget.

## `init` options

| Option | Description |
|--------|-------------|
| `apiBaseUrl` | Chat API origin (default in repo: `https://ai-assistance-service.onrender.com` via `src/publicApiBase.js`). Use `''` only with a same-origin proxy. |
| `chatPath` | Default `/api/v1/chat`. |
| `accessToken` | Optional `Authorization: Bearer` (omit if gateway needs no auth). |
| `getAccessToken` | Optional function, called each message, for fresh tokens. |
| `apiKey` | Optional `X-API-Key` (default gateway: leave unset). |
| `secureFields` | Optional `{ phoneNumber, customerId, accountNumber, transactionTrackingRef }` merged into JSON body (same as `ai_banking_ui`). |
| `tenantId`, `embedKey` | Sent as `X-Tenant-Id` / `X-Embed-Key` when set. |
| `extraHeaders` | Additional headers. |
| `title`, `placeholder`, `position`, `zIndex`, `defaultOpen`, `containerId` | UI / mount. |

Returns `{ destroy() }`.

## Widget not visible on some sites

- **Z-index:** the launcher uses a very high default `zIndex` and inline styles so it sits above scroll-to-top / call widgets.
- **CSS blocked:** the launcher still shows if `chat-widget.css` fails (inline fallback on the button). The panel still needs CSS.
- **Place scripts at end of `<body>`** so `document.body` exists.
- **Safe init after load** (avoids race with other scripts):

```html
<script src="https://YOUR-CDN/chat-widget.YOUR_HASH.js"></script>
<script>
  window.addEventListener('load', function () {
    if (typeof ChatWidgetEmbed === 'undefined') {
      console.error('chat-widget.js did not load (CSP or network)');
      return;
    }
    ChatWidgetEmbed.init({ apiBaseUrl: '...', chatPath: '/api/v1/chat' });
  });
</script>
```

- In DevTools → Elements, search for `ew-chat-widget-root` or `ew-chat-widget-launcher`. If missing, `init` did not run or threw — check Console for `[ChatWidgetEmbed]`.
