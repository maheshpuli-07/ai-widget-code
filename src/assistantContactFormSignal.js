/** Must match instructions in `widgetDefaults.js` (model emits this; widget strips it). */
export const EW_SHOW_CONTACT_FORM_TAG = '[EW_SHOW_CONTACT_FORM]';

/**
 * Detects the assistant "show callback form" signal and returns user-visible text only.
 * @param {unknown} raw
 * @returns {{ showContactForm: boolean, displayText: string }}
 */
export function parseAssistantReplyForContactForm(raw) {
  const s = String(raw ?? '').replace(/^\uFEFF/, '');
  const escaped = EW_SHOW_CONTACT_FORM_TAG.replace(/[[\]]/g, '\\$&');
  const prefixRe = new RegExp(
    `^\\s*${escaped}\\s*(?:(?:\\r?\\n)+|$)`,
  );
  if (!prefixRe.test(s)) {
    return { showContactForm: false, displayText: s };
  }
  const displayText = s.replace(prefixRe, '').replace(/^\s+/, '');
  return { showContactForm: true, displayText };
}
