// guardrail.js — TRS = Rules 40 + Lexicon 20 + Critic 40
// Robust critic: never throws; always returns a numeric score.
// Compatible with llmClient.generateText returning { ok, text, latency_ms }.
// Also tolerates older shapes by probing .content and raw string.

import { generateText } from './llmClient.js';

const PASS = 80;
const BORDER = 72;

const SLANG = [" lol ", " btw ", " pls ", " u ", " thx ", " emoji "];
const MICRO_MAX_WORDS = 5;

function toLowerSpaced(s) { return (" " + String(s || "").toLowerCase() + " "); }
function wc(s) { return String(s || "").trim().split(/\s+/).filter(Boolean).length; }
function containsAnySpaced(s, arr) {
  const L = toLowerSpaced(s);
  return (arr || []).some(w => L.includes(" " + String(w).toLowerCase() + " "));
}
function uniqKeywords(raw, cap = 8) {
  const words = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s:-]/g, " ")
    .split(/\s+/)
    .filter(w => w && w.length >= 3);
  const out = [];
  for (const w of words) if (!out.includes(w)) out.push(w);
  return out.slice(0, cap);
}
function clamp(n, lo, hi) {
  n = Number(n);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

// ---------- Rules (max 40) ----------
function rulesScore(text, contentType, inputs, policy) {
  let s = 40;
  const t = String(text || "");
  const L = toLowerSpaced(t);

  if (SLANG.some(sw => L.includes(sw))) s -= 6;

  if (contentType === "microcopy") {
    const n = wc(t);
    if (n === 0) s -= 30;
    if (n > MICRO_MAX_WORDS) s -= 15;
    if (/\band\b/i.test(t)) s -= 4;
    if (/[;,/]/.test(t)) s -= 4;

    const lex = (policy?.intentLexicon && policy.intentLexicon[inputs?.intent]) || { preferred: [] };
    const verbs = Array.isArray(lex.preferred) ? lex.preferred : [];
    if (verbs.length && !containsAnySpaced(L, verbs)) s -= 6;
  }

  if (contentType === "internal_comms") {
    // First sentence must include ≥2 keywords from title+key_update
    const first = t.split(/(?<=\.)\s+/)[0] || t;
    const kws = uniqKeywords(`${inputs?.title || ""} ${inputs?.key_update || ""}`, 8);
    let hits = 0;
    const FL = toLowerSpaced(first);
    for (const k of kws) if (FL.includes(" " + k + " ")) hits++;
    if (hits < 2) s -= 10;
  }

  if (contentType === "press_release") {
    const kws = uniqKeywords(`${inputs?.headline || ""} ${inputs?.key_message || ""}`, 8);
    let hits = 0;
    for (const k of kws) if (L.includes(" " + k + " ")) hits++;
    if (hits < 1) s -= 10;
    if (/(sign up|join us|try now|buy now)/i.test(t)) s -= 6;
  }

  return clamp(s, 0, 40);
}

// ---------- Lexicon (max 20) ----------
function lexiconScore(text, contentType, inputs, policy) {
  let s = 20;
  const lowerSp = toLowerSpaced(text);
  const inputsBlob = toLowerSpaced(JSON.stringify(inputs || {}));

  // Penalize banned words unless explicitly present in inputs
  for (const b of (policy?.bannedWords || [])) {
    const token = " " + String(b).toLowerCase() + " ";
    if (lowerSp.includes(token) && !inputsBlob.includes(token)) s -= 5;
  }

  if (contentType === "microcopy") {
    const pack = (policy?.intentLexicon && policy.intentLexicon[inputs?.intent]) || { preferred: [] };
    const verbs = Array.isArray(pack.preferred) ? pack.preferred : [];
    let hits = 0;
    for (const v of verbs) if (lowerSp.includes(" " + v.toLowerCase() + " ")) hits++;
    if (hits >= 1) s += 8;
    if (hits >= 2) s += 2;

    const startVerbs = ["close","confirm","continue","upload","pay","start","retry","cancel","help","done","ok","okay","back"];
    if (startVerbs.some(v => lowerSp.trim().startsWith(" " + v + " "))) s += 5;
  } else {
    const kws = contentType === "internal_comms"
      ? uniqKeywords(`${inputs?.title || ""} ${inputs?.key_update || ""}`, 8)
      : uniqKeywords(`${inputs?.headline || ""} ${inputs?.key_message || ""}`, 8);
    let hits = 0;
    for (const k of kws) if (lowerSp.includes(" " + k + " ")) hits++;
    s += Math.min(10, hits * 2); // up to +10
  }

  return clamp(s, 0, 20);
}

// ---------- Critic (max 40) ----------
async function criticScore(text, contentType) {
  const system =
    `You are a rigorous writing critic for an insurance brand.\n` +
    `Return STRICT JSON only: {"score": <0..40>, "detail": "<short>"}.\n` +
    `No prose, no preface, no fences.`;

  const rubric = (contentType === "microcopy")
    ? `Evaluate brevity (≤5 words), actionability, plain language, and absence of meta-preface.`
    : (contentType === "internal_comms")
      ? `Evaluate clarity, first-sentence relevance to title+key update, professional tone, and absence of marketing fluff.`
      : `Evaluate factual tone, presence of headline/key-message keywords, no CTA, professional style.`;

  const user = `TYPE: ${contentType}\nTEXT:\n${text}\n\nRUBRIC: ${rubric}\nOUTPUT: {"score": <0..40>, "detail": "…"}`;

  // Preferred interface: object template -> { ok, text, ... }
  try {
    const res = await generateText({ system, user, max_tokens: 80, temperature: 0 });
    const parsed = safeParseCritic(res?.text ?? res?.content ?? res);
    return { score: parsed.score, detail: parsed.detail, ok: true };
  } catch (_e1) {
    // fallthrough
  }

  // Legacy fallback: (messages, maxTokens)
  try {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user }
    ];
    const res2 = await generateText(messages, 80);
    const parsed2 = safeParseCritic(res2?.text ?? res2?.content ?? res2);
    return { score: parsed2.score, detail: parsed2.detail, ok: true };
  } catch (_e2) {
    // Final fallback: conservative default
    return { score: 12, detail: "critic_call_error", ok: false };
  }
}

function safeParseCritic(raw) {
  let txt = String(raw || "").trim();
  // strip possible fences
  txt = txt.replace(/```json/gi, "").replace(/```/g, "").trim();

  // try strict JSON
  try {
    const obj = JSON.parse(txt);
    const score = clamp(Math.round(Number(obj.score)), 0, 40);
    const detail = typeof obj.detail === "string" ? obj.detail : "";
    if (Number.isFinite(score)) return { score, detail };
  } catch {}

  // regex fallback to first number
  const m = txt.match(/(-?\d+(\.\d+)?)/);
  if (m) {
    const num = clamp(Math.round(parseFloat(m[1])), 0, 40);
    return { score: num, detail: "critic_json_parse_fallback" };
  }

  // last resort
  return { score: 12, detail: "critic_json_parse_error" };
}

// ---------- Public API ----------
/**
 * Accepts both old and new argument shapes.
 *   score({ text, contentType, inputs, policy })
 *   score({ type, text, params, policy })
 */
export async function score(args = {}) {
  const text        = args.text ?? "";
  const contentType = args.contentType ?? args.type ?? "";
  const inputs      = args.inputs ?? args.params ?? {};
  const policy      = args.policy ?? {};

  const rules  = rulesScore(text, contentType, inputs, policy);
  const lexicon= lexiconScore(text, contentType, inputs, policy);
  const critic = await criticScore(text, contentType);

  const trs = clamp(Math.round(rules + lexicon + critic.score), 0, 100);
  const verdict = trs >= PASS ? "pass" : (trs >= BORDER ? "borderline" : "fail");

  return {
    ok: true,
    trs,
    verdict,
    breakdown: {
      rules:   { score: rules,        max: 40 },
      lexicon: { score: lexicon,      max: 20 },
      critic:  { score: critic.score, max: 40, detail: critic.detail }
    }
  };
}
