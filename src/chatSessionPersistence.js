/**
 * Anonymous embed session: stable sessionId + conversationId in localStorage
 * (scoped by API origin + path + tenant + embed key). Falls back to in-memory
 * when localStorage is missing or throws (e.g. private mode).
 */

const NS = 'ew_chat_widget_v1';

/** @type {Map<string, { sessionId: string, conversationId: string }>} */
const memoryFallback = new Map();

function randomUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @param {{ apiBaseUrl?: string, chatPath?: string, tenantId?: string, embedKey?: string }} parts
 */
export function getPersistScopeKey(parts) {
  const base = String(parts.apiBaseUrl ?? '').replace(/\/$/, '');
  const path = String(parts.chatPath ?? '/api/v1/chat');
  const tenant = String(parts.tenantId ?? '');
  const embed = String(parts.embedKey ?? '');
  return `${NS}|${base}|${path}|${tenant}|${embed}`;
}

function readRaw(scopeKey) {
  try {
    if (typeof localStorage === 'undefined') {
      return memoryFallback.get(scopeKey) ?? null;
    }
    const raw = localStorage.getItem(scopeKey);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    return {
      sessionId: typeof o.sessionId === 'string' ? o.sessionId : '',
      conversationId: typeof o.conversationId === 'string' ? o.conversationId : '',
    };
  } catch {
    return memoryFallback.get(scopeKey) ?? null;
  }
}

function writeRaw(scopeKey, state) {
  try {
    if (typeof localStorage === 'undefined') {
      memoryFallback.set(scopeKey, state);
      return;
    }
    localStorage.setItem(scopeKey, JSON.stringify(state));
  } catch {
    memoryFallback.set(scopeKey, state);
  }
}

/**
 * @param {string} scopeKey
 * @returns {string} non-empty session UUID
 */
export function getOrCreateSessionId(scopeKey) {
  const cur = readRaw(scopeKey);
  if (cur?.sessionId) return cur.sessionId;
  const sessionId = randomUuid();
  writeRaw(scopeKey, {
    sessionId,
    conversationId: cur?.conversationId ?? '',
  });
  return sessionId;
}

/**
 * @param {string} scopeKey
 * @returns {string}
 */
export function getStoredConversationId(scopeKey) {
  return readRaw(scopeKey)?.conversationId?.trim() ?? '';
}

/**
 * @param {string} scopeKey
 * @param {string} conversationId
 */
export function setStoredConversationId(scopeKey, conversationId) {
  const sid = readRaw(scopeKey)?.sessionId || getOrCreateSessionId(scopeKey);
  writeRaw(scopeKey, {
    sessionId: sid,
    conversationId: String(conversationId ?? '').trim(),
  });
}
