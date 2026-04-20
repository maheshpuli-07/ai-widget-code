/**
 * Banking API chat: POST /api/v1/chat
 * Body: { message, systemPrompt?, sessionId?, conversationId?, clientMessageId?, clientId?, clientIp?, apiKey?, ...optional secureFields } — ai_banking_ui shape plus optional `systemPrompt`.
 *
 * @param {object} opts
 * @param {string} opts.apiBaseUrl
 * @param {string} [opts.chatPath=/api/v1/chat]
 * @param {string} opts.message
 * @param {string} [opts.systemPrompt] - merged into JSON body when non-empty (backend may use as system / style instructions)
 * @param {string} [opts.messageFormatSuffix] - appended to `message` before send (for gateways that ignore `systemPrompt`)
 * @param {string} [opts.accessToken] - sets Authorization: Bearer (omit if gateway needs no auth)
 * @param {() => string | undefined | null} [opts.getAccessToken] - called each send; overrides accessToken if set
 * @param {string} [opts.apiKey] - when non-empty: sets `X-API-Key` header and JSON `apiKey` in the body
 * @param {string} [opts.sessionId] - anonymous browser session id (widget may generate and persist)
 * @param {string} [opts.conversationId] - omit on first message; send on follow-ups once the API returned one
 * @param {string} [opts.clientMessageId] - optional UUID per send for idempotent writes on retries
 * @param {string} [opts.clientId] - JSON `clientId` when non-empty (separate from `tenantId` / X-Tenant-Id)
 * @param {string} [opts.clientIp] - JSON `clientIp` (public IP is not visible in the browser; set from server-rendered config or `getClientIp`)
 * @param {() => string|undefined|null|Promise<string|undefined|null>} [opts.getClientIp] - optional; non-empty return overrides `clientIp`
 * @param {object} [opts.secureFields] - optional phoneNumber, customerId, accountNumber, transactionTrackingRef
 * @param {string} [opts.tenantId]
 * @param {string} [opts.embedKey]
 * @param {Record<string, string>} [opts.extraHeaders]
 * @param {number} [opts.timeoutMs=120000] - abort if no response (avoids infinite “typing” dots on hang/CORS)
 */

function buildAuthHeaders({
  accessToken,
  getAccessToken,
  apiKey,
  tenantId,
  embedKey,
  extraHeaders = {},
}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  const token =
    typeof getAccessToken === 'function' ? getAccessToken() : accessToken;
  if (token != null && String(token).trim()) {
    headers.Authorization = `Bearer ${String(token).trim()}`;
  }
  if (apiKey != null && String(apiKey).trim()) {
    headers['X-API-Key'] = String(apiKey).trim();
  }
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  if (embedKey) headers['X-Embed-Key'] = embedKey;
  return headers;
}

async function applyClientIpToBody(body, clientIp, getClientIp) {
  let ip = clientIp != null ? String(clientIp).trim() : '';
  if (typeof getClientIp === 'function') {
    try {
      const v = await Promise.resolve(getClientIp());
      if (v != null && String(v).trim()) ip = String(v).trim();
    } catch {
      /* ignore */
    }
  }
  if (ip) body.clientIp = ip;
}

export async function sendChatMessage({
  apiBaseUrl,
  chatPath = '/api/v1/chat',
  message,
  systemPrompt,
  messageFormatSuffix,
  accessToken,
  getAccessToken,
  apiKey,
  sessionId,
  conversationId,
  clientMessageId,
  clientId,
  clientIp,
  getClientIp,
  secureFields,
  tenantId,
  embedKey,
  extraHeaders = {},
  timeoutMs = 120000,
}) {
  const base = (apiBaseUrl || '').replace(/\/$/, '');
  const path = chatPath.startsWith('/') ? chatPath : `/${chatPath}`;
  const url = `${base}${path}`;

  const headers = buildAuthHeaders({
    accessToken,
    getAccessToken,
    apiKey,
    tenantId,
    embedKey,
    extraHeaders,
  });

  const suffix =
    messageFormatSuffix != null ? String(messageFormatSuffix) : '';
  const outMessage = suffix ? `${message}${suffix}` : message;
  const body = { message: outMessage };
  const sys = systemPrompt != null ? String(systemPrompt).trim() : '';
  if (sys) body.systemPrompt = sys;

  const cid = clientId != null ? String(clientId).trim() : '';
  if (cid) body.clientId = cid;

  await applyClientIpToBody(body, clientIp, getClientIp);

  const keyTrim = apiKey != null ? String(apiKey).trim() : '';
  if (keyTrim) body.apiKey = keyTrim;

  const sid = sessionId != null ? String(sessionId).trim() : '';
  if (sid) body.sessionId = sid;
  const conv = conversationId != null ? String(conversationId).trim() : '';
  if (conv) body.conversationId = conv;
  const cmid = clientMessageId != null ? String(clientMessageId).trim() : '';
  if (cmid) body.clientMessageId = cmid;

  if (secureFields && typeof secureFields === 'object') {
    const { phoneNumber, customerId, accountNumber, transactionTrackingRef } = secureFields;
    if (phoneNumber != null && String(phoneNumber).trim())
      body.phoneNumber = String(phoneNumber).trim();
    if (customerId != null && String(customerId).trim())
      body.customerId = String(customerId).trim();
    if (accountNumber != null && String(accountNumber).trim())
      body.accountNumber = String(accountNumber).trim();
    if (transactionTrackingRef != null && String(transactionTrackingRef).trim())
      body.transactionTrackingRef = String(transactionTrackingRef).trim();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = { message: 'Invalid response' };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    const hint =
      'Check: API URL + path, server is up, and CORS allows this page origin (browser blocks cross-origin fetch otherwise).';
    return {
      ok: false,
      status: 0,
      data: {
        message: aborted
          ? `No response within ${Math.round(timeoutMs / 1000)}s (${hint})`
          : `Network error: ${err?.message || String(err)}. ${hint}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function formatAssistantReply(data) {
  if (!data || typeof data !== 'object') return String(data ?? '');
  return (
    data.reply ||
    data.message ||
    (data.path === 'rag' ? data.hint || 'RAG path' : null) ||
    JSON.stringify(data, null, 2)
  );
}

/** Reads common response shapes so the widget can persist thread id. */
export function extractConversationIdFromChatResponse(data) {
  if (!data || typeof data !== 'object') return '';
  const pick = (o) => {
    if (!o || typeof o !== 'object') return '';
    const v =
      o.conversationId ??
      o.conversation_id ??
      o.threadId ??
      o.thread_id ??
      o.chatId ??
      o.chat_id;
    if (v == null) return '';
    return String(v).trim();
  };
  return pick(data) || pick(data.data);
}

/**
 * POST lead to your backend (same origin as chat unless apiBaseUrl is absolute).
 * Backend should send the company email (SMTP/SES/etc.) — never put mail credentials in the widget.
 *
 * @param {object} opts
 * @param {string} opts.apiBaseUrl
 * @param {string} opts.contactLeadPath - e.g. `/api/v1/contact-lead`
 * @param {string} opts.name
 * @param {string} opts.email
 * @param {string} opts.phone
 * @param {string} [opts.userIntent] - free text: services / goals
 * @param {string} [opts.chatSummary] - transcript for staff
 * @param {string} [opts.sessionId]
 * @param {string} [opts.conversationId]
 */
export async function sendContactLead({
  apiBaseUrl,
  contactLeadPath,
  name,
  email,
  phone,
  userIntent,
  chatSummary,
  sessionId,
  conversationId,
  accessToken,
  getAccessToken,
  apiKey,
  tenantId,
  embedKey,
  clientId,
  clientIp,
  getClientIp,
  extraHeaders = {},
  timeoutMs = 60000,
}) {
  const base = (apiBaseUrl || '').replace(/\/$/, '');
  const rawPath = String(contactLeadPath || '').trim();
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const url = `${base}${path}`;

  const headers = buildAuthHeaders({
    accessToken,
    getAccessToken,
    apiKey,
    tenantId,
    embedKey,
    extraHeaders,
  });

  const body = {
    name: String(name ?? '').trim(),
    email: String(email ?? '').trim(),
    phone: String(phone ?? '').trim(),
  };
  const intent = userIntent != null ? String(userIntent).trim() : '';
  if (intent) body.userIntent = intent;
  const summary = chatSummary != null ? String(chatSummary).trim() : '';
  if (summary) body.chatSummary = summary;

  const sid = sessionId != null ? String(sessionId).trim() : '';
  if (sid) body.sessionId = sid;
  const conv = conversationId != null ? String(conversationId).trim() : '';
  if (conv) body.conversationId = conv;

  const cid = clientId != null ? String(clientId).trim() : '';
  if (cid) body.clientId = cid;

  await applyClientIpToBody(body, clientIp, getClientIp);

  const keyTrim = apiKey != null ? String(apiKey).trim() : '';
  if (keyTrim) body.apiKey = keyTrim;

  if (typeof location !== 'undefined' && location.href) {
    body.pageUrl = location.href;
  }
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    body.userAgent = navigator.userAgent;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text);
    } catch {
      data = { message: 'Invalid response' };
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    const aborted = err?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: {
        message: aborted
          ? `No response within ${Math.round(timeoutMs / 1000)}s`
          : `Network error: ${err?.message || String(err)}`,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
