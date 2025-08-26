// src/corpus.js — load corpora, merge global lexicon, pick refs, derive contextual anchors

// -------- Public API --------
export async function loadCorpusWithLexicon(policy) {
  try {
    const filePath = resolvePath(policy?.corpus?.file);
    const globalPath = resolvePath('corpus/lexicon_global.json');

    const [corpusRes, globalRes] = await Promise.all([
      fetch(filePath), fetch(globalPath)
    ]);

    if (!corpusRes.ok) throw new Error(`Corpus HTTP ${corpusRes.status}`);
    if (!globalRes.ok) throw new Error(`Global lexicon HTTP ${globalRes.status}`);

    const corpus = await corpusRes.json();
    const global = await globalRes.json();

    // Expect structure:
    // corpus: { content_type, examples:[{...}], preferred_lexicon?, banned_phrases? }
    const preferred_lexicon = dedupe([
      ...(corpus.preferred_lexicon || []),
      ...(global.preferred || [])
    ]);

    const banned_lexicon = dedupe([
      ...(corpus.banned_phrases || corpus.banned_lexicon || []),
      ...(global.banned || [])
    ]);

    return {
      content_type: corpus.content_type || 'unknown',
      examples: Array.isArray(corpus.examples) ? corpus.examples : [],
      preferred_lexicon,
      banned_lexicon
    };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

/**
 * Pick N reference examples based on exact field matches on matchOn keys.
 * Falls back to partial/any matches if not enough.
 */
export function pickRefs(corpusPack, matchOn = [], params = {}, n = 3) {
  const ex = Array.isArray(corpusPack?.examples) ? corpusPack.examples : [];
  if (ex.length === 0) return [];

  const exact = [];
  const partial = [];
  const any = [];

  for (const e of ex) {
    if (!e || typeof e !== 'object') continue;
    let exactScore = 0, partialScore = 0;

    for (const key of matchOn) {
      const want = norm(params[key]);
      const got = norm(e[key]);
      if (!key) continue;
      if (want && got && want === got) exactScore++;
      else if (want && got && (got.includes(want) || want.includes(got))) partialScore++;
    }

    if (exactScore === matchOn.length && matchOn.length > 0) exact.push(e);
    else if (exactScore > 0 || partialScore > 0) partial.push(e);
    else any.push(e);
  }

  const out = [];
  pushSome(out, exact, n);
  if (out.length < n) pushSome(out, partial, n - out.length);
  if (out.length < n) pushSome(out, any, n - out.length);

  return out.slice(0, n);
}

/**
 * Derive lexicon anchors from selected refs (unigrams + bigrams).
 * Returns an array of short actionable phrases (max ~12 entries).
 */
export function deriveLexiconFromRefs(refs = [], maxPhrases = 12) {
  const text = refs.map(r => safeText(r.text || r.body || r.headline || '')).join(' ');
  if (!text.trim()) return [];

  const tokens = tokenize(text);
  const unigrams = countTerms(tokens.filter(t => isAnchorWord(t)));
  const bigrams = countTerms(makeNgrams(tokens, 2).filter(bg => isAnchorPhrase(bg)));

  // Score: bigrams 1.5x unigrams
  const merged = new Map();
  for (const [t, c] of Object.entries(unigrams)) merged.set(t, (merged.get(t) || 0) + c);
  for (const [t, c] of Object.entries(bigrams)) merged.set(t, (merged.get(t) || 0) + c * 1.5);

  const sorted = [...merged.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter(t => t.length >= 2 && t.length <= 28);

  return dedupe(sorted).slice(0, maxPhrases);
}

// -------- internals --------
const STOP = new Set((
  'a,an,the,of,in,on,for,to,from,by,at,as,and,or,but,so,if,then,than,that,which,who,whom,' +
  'with,without,within,about,into,over,under,it,its,this,these,those,be,is,are,was,were,am,' +
  'we,our,ours,you,your,yours,they,them,their,theirs,i,me,my,mine,he,she,his,her,hers,us'
).split(','));

const ACTION_HINTS = new Set([
  'join','rsvp','today','now','update','details','below','thanks','heads','up','bring','see','there',
  'team','everyone','all','hands','event','meet','meeting','call','agenda','next','steps','reminder'
]);

function resolvePath(p) {
  if (!p) return './corpus/microcopy_corpus.json';
  if (p.startsWith('http') || p.startsWith('/')) return p;
  // resolve from /public root
  return `./${p.replace(/^\.?\//, '')}`;
}

function dedupe(arr) {
  return Array.from(new Set(arr.map(s => String(s).trim()).filter(Boolean)));
}

function norm(v) {
  return String(v || '').toLowerCase().trim();
}

function safeText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[`*_()[\]{}<>#|~^$\\/]/g, ' ')
    .replace(/[“”"‘’]/g, '')
    .split(/\s+/)
    .map(t => t.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter(Boolean);
}

function isAnchorWord(t) {
  if (!t || t.length < 2) return false;
  if (STOP.has(t)) return false;
  // prefer actionable/common internal-comms words
  return ACTION_HINTS.has(t) || /^[a-z][a-z0-9]+$/.test(t);
}

function isAnchorPhrase(bg) {
  // Avoid phrases that start/end with stopwords
  const [a, b] = bg.split(' ');
  if (STOP.has(a) || STOP.has(b)) return false;
  return true;
}

function countTerms(list) {
  const m = {};
  for (const t of list) m[t] = (m[t] || 0) + 1;
  return m;
}

function makeNgrams(tokens, n) {
  const out = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(' '));
  }
  return out;
}

function pushSome(out, src, need) {
  for (const x of src) {
    if (out.length >= need + out.length) break;
    if (!out.includes(x)) out.push(x);
  }
}
