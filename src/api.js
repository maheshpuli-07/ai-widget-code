/**
 * Banking API chat: POST /api/v1/chat
 * Body: { message, ...optional secureFields } — same shape as ai_banking_ui.
 *
 * @param {object} opts
 * @param {string} opts.apiBaseUrl
 * @param {string} [opts.chatPath=/api/v1/chat]
 * @param {string} opts.message
 * @param {string} [opts.accessToken] - sets Authorization: Bearer (omit if gateway needs no auth)
 * @param {() => string | undefined | null} [opts.getAccessToken] - called each send; overrides accessToken if set
 * @param {string} [opts.apiKey] - sets X-API-Key only when provided (default gateway: omit)
 * @param {object} [opts.secureFields] - optional phoneNumber, customerId, accountNumber, transactionTrackingRef
 * @param {string} [opts.tenantId]
 * @param {string} [opts.embedKey]
 * @param {Record<string, string>} [opts.extraHeaders]
 * @param {number} [opts.timeoutMs=120000] - abort if no response (avoids infinite “typing” dots on hang/CORS)
 */
export async function sendChatMessage({
  apiBaseUrl,
  chatPath = '/api/v1/chat',
  message,
  accessToken,
  getAccessToken,
  apiKey,
  secureFields,
  tenantId,
  embedKey,
  extraHeaders = {},
  timeoutMs = 120000,
}) {
  const base = (apiBaseUrl || '').replace(/\/$/, '');
  const path = chatPath.startsWith('/') ? chatPath : `/${chatPath}`;
  const url = `${base}${path}`;

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

  const body = { message };
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
