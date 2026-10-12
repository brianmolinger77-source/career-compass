// Deterministic checks on AI resume output: flags numbers and rate phrases the
// veteran never wrote, and recovers the veteran's own sentence for a bullet.

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17',
  eighteen: '18', nineteen: '19', twenty: '20', thirty: '30', forty: '40',
  fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  hundred: '100', thousand: '1000'
};
const NUMBER_WORD_RE = new RegExp(`\\b(${Object.keys(NUMBER_WORDS).join('|')})\\b`, 'g');
const NUMBER_RE = /\d+(?:\.\d+)?/g;
const RATE_WORD_RE = /\b(per|average|total|combined)\s+([a-z0-9-]+)\b/g;
const FIXED_PHRASES = ['up to', 'each run', 'every run', 'each trip'];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPhrase(text, phrase) {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`).test(text);
}

function normalizeNumbers(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(NUMBER_WORD_RE, w => NUMBER_WORDS[w]);
}

function normalizeForGuard(text) {
  return normalizeNumbers(text).replace(/\s+/g, ' ').trim();
}

function findGuardFlags(text, corpusText) {
  const t = normalizeForGuard(text);
  const c = normalizeForGuard(corpusText);
  const flags = new Set();

  const corpusNumbers = new Set(c.match(NUMBER_RE) || []);
  for (const n of t.match(NUMBER_RE) || []) {
    if (!corpusNumbers.has(n)) flags.add(`number:${n}`);
  }

  for (const m of t.matchAll(RATE_WORD_RE)) {
    const pair = `${m[1]} ${m[2]}`;
    if (!hasPhrase(c, pair)) flags.add(`phrase:${pair}`);
  }

  for (const phrase of FIXED_PHRASES) {
    if (hasPhrase(t, phrase) && !hasPhrase(c, phrase)) flags.add(`phrase:${phrase}`);
  }

  return [...flags];
}

function normalizePiece(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
}

function veteranSentenceFor(source, role) {
  const pieces = String(source || '').split('|').map(normalizePiece).filter(Boolean);
  if (pieces.length === 0 || !role) return null;

  const sentences = [role.whatIDid, role.howIDidIt, role.impact]
    .filter(Boolean)
    .flatMap(t => String(t).match(/[^.!?]+[.!?]*/g) || [])
    .map(s => s.trim())
    .filter(Boolean);

  for (const piece of pieces) {
    const hit = sentences.find(s => normalizePiece(s).includes(piece));
    if (hit) {
      const clean = hit.replace(/\.+$/, '').trim();
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }
  return null;
}

function joinPresent(values) {
  return values
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(String)
    .join(' ');
}

function roleGuardCorpus(role) {
  if (!role) return '';
  return joinPresent([
    role.title, role.organization, role.whatIDid, role.howIDidIt,
    role.impact, role.startYear, role.endYear
  ]);
}

function summaryGuardCorpus(mentee) {
  return joinPresent([
    ...(mentee?.roles || []).map(roleGuardCorpus),
    mentee?.strengths,
    mentee?.aspirations
  ]);
}

module.exports = {
  normalizeNumbers,
  findGuardFlags,
  veteranSentenceFor,
  roleGuardCorpus,
  summaryGuardCorpus
};
