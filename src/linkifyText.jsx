/**
 * Linkifies:
 * - `http(s)://…` and `www.…` (trailing `.,;:!?` peeled from href; final `.`/`!`/`?` after the last URL at end of segment is omitted)
 * - Markdown `[label](https://…)` (same trimming on the URL target)
 * - Bare hostnames like `example.com` / `example.com/path` (https assumed), with TLD checks
 *   to avoid common file-extension false positives — not a per-customer domain list.
 */
const HTTPS_OR_WWW =
  /\b(https?:\/\/[^\s<>'"[\]{}|\\^`]+|www\.[^\s<>'"[\]{}|\\^`]+)/gi;

const MD_LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** Bare domain: not preceded by @ or word (skip emails / `user.name`). */
const BARE_DOMAIN =
  /(?<![@\w])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>'"[\]{}|\\^`]*)?/gi;

/** TLDs that are usually file extensions, not websites. */
const AMBIGUOUS_TLD = new Set([
  'txt',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'zip',
  'rar',
  '7z',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'log',
  'csv',
  'tsv',
  'sql',
  'md',
  'rst',
  'json',
  'xml',
  'yml',
  'yaml',
  'toml',
  'ini',
  'cfg',
  'conf',
  'sh',
  'bat',
  'ps1',
  'env',
  'css',
  'scss',
  'less',
  'sass',
  'map',
  'vue',
  'jsx',
  'tsx',
  'c',
  'h',
  'cpp',
  'hpp',
  'java',
  'class',
  'jar',
  'war',
  'kt',
  'swift',
  'go',
  'rs',
  'rb',
  'py',
  'pyc',
  'php',
  'pl',
  'pm',
  'r',
  'lua',
  'dart',
  'html',
  'htm',
  'asp',
  'aspx',
  'jsp',
  'cgi',
]);

const LINK_CLASS =
  'ew-break-words ew-text-blue-600 ew-underline ew-decoration-blue-600/70 hover:ew-text-blue-800 hover:ew-decoration-blue-800';

/** Sentence punctuation often glued after URLs; must not be part of `href` or link label. */
const TRAILING_AFTER_URL = new Set(['.', ',', ';', ':', '!', '?']);

/**
 * @param {string} raw
 * @returns {{ base: string, trailing: string }}
 */
function stripTrailingSentencePunctFromUrl(raw) {
  const s = String(raw ?? '');
  if (!s) return { base: s, trailing: '' };
  let base = s;
  let trailing = '';
  while (base.length > 0 && TRAILING_AFTER_URL.has(base[base.length - 1])) {
    trailing = base[base.length - 1] + trailing;
    base = base.slice(0, -1);
  }
  return { base, trailing };
}

/** `.` / `!` / `?` after a URL at end of line or paragraph (with or without space before it). */
const EOS_AFTER_URL = /^\s*[.!?]+\s*$/;

/**
 * Removes sentence-ending punctuation after the last https/www URL when it is
 * the only thing left in the segment (so paragraphs can end on a clean link).
 * Skips when the URL is immediately followed by `)` (markdown `](...)`).
 */
function truncateEosSentencePunctAfterLastHttpUrl(s) {
  const t = s.trimEnd();
  if (!t) return s;
  const trailingWs = s.slice(t.length);

  const re = /\b(https?:\/\/[^\s<>'"[\]{}|\\^`]+|www\.[^\s<>'"[\]{}|\\^`]+)/gi;
  let lastIndex = -1;
  let rawMatch = '';
  let m;
  while ((m = re.exec(t)) !== null) {
    lastIndex = m.index;
    rawMatch = m[0];
  }
  if (lastIndex < 0 || !rawMatch) return s;

  const withScheme = rawMatch.startsWith('http') ? rawMatch : `https://${rawMatch}`;
  const { base } = stripTrailingSentencePunctFromUrl(withScheme);
  const trailingRemoved = withScheme.length - base.length;
  const logicalEnd = lastIndex + rawMatch.length - trailingRemoved;
  const afterUrl = t.slice(logicalEnd);
  if (afterUrl.startsWith(')')) return s;
  if (!EOS_AFTER_URL.test(afterUrl)) return s;

  return t.slice(0, logicalEnd) + trailingWs;
}

function dropEosOnlySentencePunctAfterTrailingLink(parts) {
  let p = parts;
  while (p.length >= 2) {
    const last = p[p.length - 1];
    const prev = p[p.length - 2];
    if (last.kind !== 'text' || prev.kind !== 'link') break;
    if (!EOS_AFTER_URL.test(last.value)) break;
    p = p.slice(0, -1);
  }
  return p;
}

function bareHostTldOk(raw) {
  const hostPart = raw.split('/')[0].replace(/\.$/, '');
  const segs = hostPart.split('.');
  const tld = segs[segs.length - 1]?.toLowerCase() ?? '';
  if (tld.length < 2) return false;
  if (AMBIGUOUS_TLD.has(tld)) return false;
  return true;
}

/** Split into { kind:'text'|'link', ... } with https/www only. */
function splitHttpsWww(s) {
  const parts = [];
  let last = 0;
  let m;
  HTTPS_OR_WWW.lastIndex = 0;
  while ((m = HTTPS_OR_WWW.exec(s)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', value: s.slice(last, m.index) });
    const raw = m[0];
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
    const { base, trailing } = stripTrailingSentencePunctFromUrl(withScheme);
    parts.push({ kind: 'link', href: base, label: base });
    if (trailing) parts.push({ kind: 'text', value: trailing });
    last = m.index + raw.length;
  }
  if (last < s.length) parts.push({ kind: 'text', value: s.slice(last) });
  const merged = parts.length ? parts : [{ kind: 'text', value: s }];
  return dropEosOnlySentencePunctAfterTrailingLink(merged);
}

function pushBareIntoText(text, keyPrefix, kRef, out) {
  if (!text) return;
  const hits = [];
  let m;
  BARE_DOMAIN.lastIndex = 0;
  while ((m = BARE_DOMAIN.exec(text)) !== null) {
    if (bareHostTldOk(m[0])) hits.push({ index: m.index, raw: m[0] });
  }
  let last = 0;
  for (const hit of hits) {
    if (hit.index > last) {
      const chunk = text.slice(last, hit.index);
      if (chunk) out.push(<span key={`${keyPrefix}-${kRef.i++}`}>{chunk}</span>);
    }
    const raw = hit.raw;
    const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
    const { base, trailing } = stripTrailingSentencePunctFromUrl(withScheme);
    out.push(
      <a
        key={`${keyPrefix}-${kRef.i++}`}
        href={base}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
      >
        {base}
      </a>,
    );
    if (trailing) {
      out.push(<span key={`${keyPrefix}-${kRef.i++}`}>{trailing}</span>);
    }
    last = hit.index + raw.length;
  }
  if (last < text.length) {
    const rest = text.slice(last);
    if (rest) out.push(<span key={`${keyPrefix}-${kRef.i++}`}>{rest}</span>);
  }
}

function pushAutoChunks(s, keyPrefix, kRef, out) {
  for (const seg of splitHttpsWww(s)) {
    if (seg.kind === 'link') {
      out.push(
        <a
          key={`${keyPrefix}-${kRef.i++}`}
          href={seg.href}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          {seg.label}
        </a>,
      );
    } else {
      pushBareIntoText(seg.value, keyPrefix, kRef, out);
    }
  }
}

/** Linkify one segment that must not contain markdown links (pre-split). */
function linkifyPlainSegment(segment, keyPrefix, kRef) {
  const out = [];
  pushAutoChunks(segment, keyPrefix, kRef, out);
  return out.length ? out : null;
}

/**
 * @param {string} text
 * @param {string} [keyPrefix='lk']
 * @returns {import('react').ReactNode}
 */
export function linkifyText(text, keyPrefix = 'lk') {
  const s0 = String(text ?? '');
  if (!s0) return null;
  const s = truncateEosSentencePunctAfterLastHttpUrl(s0);

  const kRef = { i: 0 };
  const out = [];
  let last = 0;
  let mdLinkCount = 0;
  let m;
  MD_LINK.lastIndex = 0;
  while ((m = MD_LINK.exec(s)) !== null) {
    if (m.index > last) {
      const before = s.slice(last, m.index);
      const inner = linkifyPlainSegment(before, keyPrefix, kRef);
      if (inner) out.push(...inner);
      else if (before) out.push(<span key={`${keyPrefix}-${kRef.i++}`}>{before}</span>);
    }
    const labelRaw = m[1];
    const hrefRaw = m[2];
    const { base: href, trailing: afterHref } =
      stripTrailingSentencePunctFromUrl(hrefRaw);
    const labelLooksLikeUrl = /^\s*https?:\/\//i.test(labelRaw);
    const displayLabel = labelLooksLikeUrl
      ? stripTrailingSentencePunctFromUrl(labelRaw).base
      : labelRaw;
    out.push(
      <a
        key={`${keyPrefix}-${kRef.i++}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASS}
      >
        {displayLabel}
      </a>,
    );
    const restAfterMd = s.slice(m.index + m[0].length);
    const mdAtSegmentTail = /^\s*$/.test(restAfterMd);
    if (afterHref && !(mdAtSegmentTail && EOS_AFTER_URL.test(afterHref))) {
      out.push(<span key={`${keyPrefix}-${kRef.i++}`}>{afterHref}</span>);
    }
    last = m.index + m[0].length;
    mdLinkCount += 1;
  }
  if (last < s.length) {
    const tail = s.slice(last);
    if (mdLinkCount > 0 && EOS_AFTER_URL.test(tail)) {
      /* omit */
    } else {
      const inner = linkifyPlainSegment(tail, keyPrefix, kRef);
      if (inner) out.push(...inner);
      else if (tail) out.push(<span key={`${keyPrefix}-${kRef.i++}`}>{tail}</span>);
    }
  }

  if (out.length === 0) {
    return linkifyPlainSegment(s, keyPrefix, kRef) || s;
  }
  return out;
}
