# Chat embed widget

Standalone **React + Tailwind** IIFE bundle for third-party sites (`ChatWidgetEmbed.init(...)`).

This repo lives **outside** `ai_banking_ui` so you can version and deploy it on its own (e.g. S3 + CloudFront).

### Reference architecture (product-help widget) vs this repo

| Reference | Here |
|-----------|------|
| `widget-loader.js` | `public/widget-loader.js` — one tag: loads CSS + `chat-widget.js` + `init()`. Optional `data-api-base` (omit = default from `src/publicApiBase.js`, injected at `npm run build`). Supports **`async`**. |
| `widget.js` / `widget.css` | `chat-widget.js` / `chat-widget.css` (IIFE + Tailwind build) |
| `data-site-key` | Mapped to **`embedKey`** → `X-Embed-Key` on chat requests |
| `data-client-id` | Mapped to **`tenantId`** → `X-Tenant-Id` |
| `data-access-token` | Sent as **`Authorization: Bearer …`** (optional). Safer: set **`window.__EW_CHAT_ACCESS_TOKEN__`** before the loader script so the token is not hard-coded in static HTML. |
| `data-api-base` | **`apiBaseUrl`**. Omit attribute → default public API. `data-api-base=""` → same origin as the host page. |

## Why Netlify showed “Page not found” before

The widget build only produced `chat-widget.js` + `chat-widget.css`. Netlify serves `/` as **`index.html`**. With no `index.html` in the published folder, the **site root 404s**.

**Fix:** `npm run build` runs a patch script that adds **`dist/index.html`**, **`demo-live.html`**, **`_headers`**, and **renames** the bundle to **content-hashed** `chat-widget.<hash>.js` / `chat-widget.<hash>.css` so caches cannot serve a stale wrong file for a fixed URL.

## Deploy on Netlify manually (browser, e.g. sign in with Google)

1. On your PC, in this folder: **`npm install`** then **`npm run build`**. That creates the **`dist`** folder (widget JS/CSS, **`widget-loader.js`**, **`index.html`** with copy buttons, demos, **`_headers`**).
2. In your browser go to [Netlify](https://www.netlify.com/), sign up or log in (you can use **Continue with Google**).
3. **Sites** → **Add new site** → **Deploy manually** (or drag-and-drop area).
4. **Drag the entire `dist` folder** onto the deploy zone (not the repo root). Wait until the deploy finishes.
5. Open your new site URL (for example **`https://random-name-123.netlify.app/`**). The home page **Copy loader snippet** uses **`location.origin`** and a **single `async` `<script>`** (no separate link/scripts). Omitting **`data-api-base`** uses the default API from **`src/publicApiBase.js`** (written into **`widget-loader.js`** at build time).
6. Click **Copy loader snippet** or **Copy snippet**, then paste **before `</body>`** on any other site. Chat works only if that API allows **CORS** from that site’s origin (and from your Netlify domain for the demos).

**After each code change:** run **`npm run build`** again and upload the new **`dist`** (same manual flow, or connect Git later for auto deploy).

## Client demo checklist

1. **`npm run build`** then deploy the whole **`dist`** folder to Netlify (see above).
2. Open **`https://YOUR-SITE.netlify.app/demo-live.html`** — you should see the **chat pill** (proves JS/CSS deploy). Sending messages needs your API **up** on Render and **CORS** allowing your Netlify origin.
3. Open **`/`** on the same site to copy embed code with the correct **hashed** asset names and your **live** Netlify origin.

## Develop

```bash
cd chat-embed-widget
npm install
npm run dev
```

Preview: [http://localhost:5174](http://localhost:5174). `/api` and `/auth` proxy to the **Banking API**, default **`http://localhost:9000`** (override with `API_PROXY_TARGET` or `VITE_API_BASE_URL` in `.env`). CBA UAPI stays server-side; the widget only talks to the Banking API.

## Build (for Netlify Drop / any static host)

```bash
npm run build
```

**Deploy the whole `dist` folder** (must include):

- `index.html` — landing + copy-paste snippet (correct hashed asset URLs)
- `demo-live.html` — smoke test
- `chat-widget.<hash>.js` and `chat-widget.<hash>.css` — primary, immutable cache
- `chat-widget.js` / `chat-widget.css` — copies with `no-store` for fixed-URL quick tests (e.g. local demos)
- `_headers` — long cache for immutable hashed assets

Do **not** upload the repo root or `src/` only.

## Netlify

- **Drag & drop:** drag **`dist`** onto [Netlify Drop](https://app.netlify.com/drop) or use **Deploy manually** in the dashboard (see **Deploy on Netlify manually** above).
- **Git:** connect repo; `netlify.toml` sets `publish = "dist"` and `command = "npm run build"`.

## Production embed (recommended: one line)

After deploy, use **Copy loader snippet** on **`/`**, or paste this shape (replace host and keys):

```html
<script
  id="ew-chat-widget-loader"
  async
  src="https://YOUR-CLOUDFRONT-OR-NETLIFY-DOMAIN/widget-loader.js"
  data-site-key="pk_xxx"
  data-client-id="client-id"
></script>
```

Optional: `data-api-base`, `data-chat-path`, `data-access-token`, or `window.__EW_CHAT_ACCESS_TOKEN__` before the script (see `public/widget-loader.js`).

## Embed snippet (manual / advanced)

After each `npm run build`, open your deployed **`index.html`** and use **Copy snippet** for hashed asset URLs. Example shape:

```html
<link rel="stylesheet" href="https://YOUR-SITE.netlify.app/chat-widget.0123456789ab.css" />
<script src="https://YOUR-SITE.netlify.app/chat-widget.0123456789ab.js"></script>
<script>
  ChatWidgetEmbed.init({
    apiBaseUrl: 'https://ai-assistance-service.onrender.com',
    accessToken: '', // optional Bearer; omit or use getAccessToken() for fresh tokens
    chatPath: '/api/v1/chat',
  });
</script>
```

Prefer the **Copy snippet** button on your deployed **`/`** so `YOUR-SITE` and the **hash** match the current build. Change the API URL in **`src/publicApiBase.js`** if you use a different backend; your API must allow **CORS** from every origin that embeds the widget.

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
<script src="https://YOUR-NETLIFY/chat-widget.YOUR_HASH.js"></script>
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
