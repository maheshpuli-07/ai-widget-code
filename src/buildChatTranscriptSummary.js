/**
 * Plain-text transcript for lead / email payloads (user + assistant turns only).
 * @param {Array<{ role: string, text?: string, error?: boolean }>} rows
 * @param {number} [maxChars=12000]
 */
export function buildChatTranscriptSummary(rows, maxChars = 12000) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const parts = [];
  for (const row of rows) {
    if (!row || row.error) continue;
    const role = row.role === 'user' ? 'User' : 'Assistant';
    const t = String(row.text ?? '').trim();
    if (!t) continue;
    parts.push(`${role}: ${t}`);
  }
  let out = parts.join('\n\n');
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars)}\n…[truncated]`;
  }
  return out;
}
