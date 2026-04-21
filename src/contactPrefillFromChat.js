/** Strip BOM / zero-width chars so pasted lines from email, Word, or mobile still match heuristics. */
function scrubInvisible(s) {
  return String(s)
    .replace(/^\uFEFF+/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function firstLine(raw) {
  return String(raw ?? '')
    .split(/\r?\n/)
    .map((l) => scrubInvisible(l.trim()))
    .find(Boolean) ?? '';
}

/**
 * Tokens that are not a person’s name: chitchat, greetings, questions, company, etc.
 * (Stops "hi", "hello", "thanks" from opening the callback form.)
 */
const NOT_A_PERSON_NAME_TOKEN = new Set([
  'tell',
  'me',
  'about',
  'what',
  'who',
  'how',
  'when',
  'where',
  'why',
  'which',
  'can',
  'could',
  'would',
  'should',
  'please',
  'need',
  'want',
  'know',
  'the',
  'and',
  'or',
  'for',
  'with',
  'from',
  'your',
  'our',
  'girmiti',
  'giriti',
  'girmity',
  'hi',
  'hello',
  'hey',
  'hiya',
  'yo',
  'sup',
  'thanks',
  'thank',
  'thx',
  'cheers',
  'bye',
  'goodbye',
  'ciao',
  'ok',
  'okay',
  'k',
  'yes',
  'no',
  'yep',
  'yup',
  'nah',
  'nope',
  'nvm',
  'lol',
  'haha',
  'pls',
  'plz',
  'sir',
  'madam',
  'mr',
  'mrs',
  'ms',
  'dr',
  'good',
  'morning',
  'afternoon',
  'evening',
  'night',
  'there',
  'here',
  'this',
  'that',
  'doing',
  'fine',
  'well',
  'test',
  'demo',
  'admin',
  'user',
  'guest',
  'null',
  'qwerty',
  'asdf',
  'hii',
  'hiii',
  'heyy',
  'yoo',
  'okk',
  'byee',
]);

/** Greeting / noise spellings as a whole token (not always in NOT_A_PERSON_NAME_TOKEN as stems). */
const NOT_A_NAME_WHOLE_WORD = new Set([
  'hii',
  'hiii',
  'hiiii',
  'heyy',
  'heyyy',
  'yoo',
  'yooo',
  'okk',
  'okkk',
  'byee',
  'byeee',
  'helloo',
  'helo',
  'ello',
]);

function maxConsonantRun(lettersOnly) {
  let run = 0;
  let maxRun = 0;
  for (const ch of lettersOnly) {
    if (/[aeiouy]/i.test(ch)) {
      run = 0;
    } else if (/[a-z]/i.test(ch)) {
      run += 1;
      maxRun = Math.max(maxRun, run);
    }
  }
  return maxRun;
}

/**
 * Rejects keyboard-mash (no vowels, long consonant runs) and stretched greetings ("hii").
 * Email/phone paths are handled separately before this runs.
 */
function lettersLookLikePlausiblePersonName(line) {
  const letters = line.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 2) return false;

  const words = line
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    if (NOT_A_NAME_WHOLE_WORD.has(w)) return false;
  }

  const vowels = letters.match(/[aeiouy]/gi);
  const v = vowels ? vowels.length : 0;
  if (v === 0) return false;

  const n = letters.length;
  if (n >= 6 && v / n < 0.12) return false;
  if (maxConsonantRun(letters) >= 5) return false;
  if (/^(.)\1{2,}$/.test(letters)) return false;

  return true;
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function isLikelyNameOrContactReply(raw) {
  let t = firstLine(raw);
  if (!t || t.length > 80) return false;
  if (t.includes('?')) return false;

  t = t.replace(/^name\s*:\s*/i, '').trim();
  if (!t) return false;

  const digits = (t.match(/\d/g) || []).length;
  const nonSpace = t.replace(/\s/g, '').length;
  if (digits >= 8 && nonSpace > 0 && digits / nonSpace >= 0.45) {
    return true;
  }

  const words = t.split(/\s+/).filter(Boolean);
  /** Real names in chat are usually short; longer all-alpha lines are often questions. */
  if (words.length < 1 || words.length > 3) return false;
  if (words.some((w) => NOT_A_PERSON_NAME_TOKEN.has(w.toLowerCase()))) return false;
  if (!words.every((w) => /^[a-zA-Z][a-zA-Z'\-.]*$/.test(w))) return false;
  /** Greetings like "hi" / "ok" are 1–2 letters or blocked above; require a plausible name token. */
  if (!words.some((w) => w.length >= 3)) return false;
  return lettersLookLikePlausiblePersonName(t);
}

/**
 * @param {string} raw
 * @returns {{ leadName: string, leadPhone: string }}
 */
export function prefillLeadFromChatMessage(raw) {
  let t = firstLine(raw).replace(/^name\s*:\s*/i, '').trim();
  if (!t) return { leadName: '', leadPhone: '' };

  const digits = (t.match(/\d/g) || []).length;
  const nonSpace = t.replace(/\s/g, '').length;
  if (digits >= 8 && nonSpace > 0 && digits / nonSpace >= 0.45) {
    return { leadName: '', leadPhone: t };
  }

  return { leadName: t, leadPhone: '' };
}

/**
 * @param {string} raw
 * @returns {{ leadName: string, leadEmail: string, leadPhone: string }}
 */
export function extractContactPrefillFromChatLine(raw) {
  const line = firstLine(raw);
  const out = { leadName: '', leadEmail: '', leadPhone: '' };
  if (!line) return out;

  const em = line.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (em) out.leadEmail = em[1];

  if (isLikelyNameOrContactReply(line)) {
    const p = prefillLeadFromChatMessage(line);
    if (p.leadPhone) out.leadPhone = p.leadPhone;
    else if (p.leadName) out.leadName = p.leadName;
  }

  return out;
}

/**
 * @param {string} raw
 */
export function hasContactHintInChatMessage(raw) {
  const p = extractContactPrefillFromChatLine(raw);
  return Boolean(p.leadEmail || p.leadPhone || p.leadName);
}
