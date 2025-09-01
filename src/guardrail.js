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
    .filter(w => w && w.length >= 2); // Reduced from 3 to 2 characters
  const out = [];
  for (const w of words) if (!out.includes(w)) out.push(w);
  return out.slice(0, cap);
}

// Enhanced keyword matching with basic stemming and semantic recognition
function enhancedKeywordMatch(text, keywords, inputs) {
  const L = toLowerSpaced(text);
  let hits = 0;
  const semanticMatches = [];
  
  for (const keyword of keywords) {
    const k = keyword.toLowerCase();
    
    // Direct match
    if (L.includes(" " + k + " ")) {
      hits++;
      semanticMatches.push({ keyword, match: 'direct', score: 1 });
      continue;
    }
    
    // Basic stemming (plural to singular)
    if (k.endsWith('s') && L.includes(" " + k.slice(0, -1) + " ")) {
      hits++;
      semanticMatches.push({ keyword, match: 'stemmed', score: 0.9 });
      continue;
    }
    
    // Semantic variations for common cases
    if (k === 'dogs' && L.includes(" dog-free ")) {
      hits++;
      semanticMatches.push({ keyword, match: 'semantic', score: 0.8 });
      continue;
    }
    if (k === 'scare' && (L.includes(" comfortable ") || L.includes(" fear ") || L.includes(" anxiety "))) {
      hits++;
      semanticMatches.push({ keyword, match: 'semantic', score: 0.7 });
      continue;
    }
    if (k === 'no' && (L.includes(" not ") || L.includes(" free ") || L.includes(" ban "))) {
      hits++;
      semanticMatches.push({ keyword, match: 'semantic', score: 0.6 });
      continue;
    }
  }
  
  return { hits, semanticMatches };
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
    const uiContext = inputs?.uiContext || 'button';
    
    if (n === 0) s -= 30;
    
    // Different word limits for different UI contexts
    if (uiContext === 'button') {
      if (n > MICRO_MAX_WORDS) s -= 15; // Buttons: ≤5 words
    } else if (uiContext === 'error') {
      if (n > 15) s -= 10; // Errors: ≤15 words
    } else if (uiContext === 'tooltip') {
      if (n > 15) s -= 10; // Tooltips: ≤15 words
    } else {
      if (n > MICRO_MAX_WORDS) s -= 15; // Default: ≤5 words
    }
    
    if (/\band\b/i.test(t)) s -= 4;
    if (/[;,/]/.test(t)) s -= 4;

    const lex = (policy?.intentLexicon && policy.intentLexicon[inputs?.intent]) || { preferred: [] };
    const verbs = Array.isArray(lex.preferred) ? lex.preferred : [];
    if (verbs.length && !containsAnySpaced(L, verbs)) s -= 6;
    
    // Additional penalty for generic content that doesn't match intent
    const genericPhrases = [
      'click here', 'learn more', 'get started', 'find out', 'discover',
      'explore', 'see details', 'view more', 'read more'
    ];
    const hasGenericContent = genericPhrases.some(phrase => 
      L.includes(phrase.toLowerCase())
    );
    if (hasGenericContent && !containsAnySpaced(L, verbs)) {
      s -= 8; // Penalty for generic content without intent-specific verbs
    }
  }

  if (contentType === "internal_comms") {
    // First sentence must include ≥2 keywords from title+key_update
    const first = t.split(/(?<=\.)\s+/)[0] || t;
    const kws = uniqKeywords(`${inputs?.title || ""} ${inputs?.key_update || ""}`, 8);
    const matchResult = enhancedKeywordMatch(first, kws, inputs);
    
    if (matchResult.hits < 2) {
      s -= 10;
      // Store semantic matches for better feedback
      if (inputs) inputs._semanticMatches = matchResult.semanticMatches;
    }
    
    // Additional penalty for generic corporate content
    const genericPhrases = [
      'company', 'organization', 'team', 'we are committed', 'our mission',
      'we strive', 'we believe', 'we value', 'we are dedicated'
    ];
    const hasGenericContent = genericPhrases.some(phrase => 
      t.toLowerCase().includes(phrase.toLowerCase())
    );
    if (hasGenericContent && matchResult.hits < 3) {
      s -= 8; // Penalty for generic content without sufficient specific keywords
    }
  }

  if (contentType === "press_release") {
    const kws = uniqKeywords(`${inputs?.headline || ""} ${inputs?.key_message || ""}`, 8);
    const matchResult = enhancedKeywordMatch(t, kws, inputs);
    
    // Stricter keyword requirements for press releases
    if (matchResult.hits < 2) s -= 15; // Require at least 2 keywords, bigger penalty
    if (matchResult.hits < 1) s -= 25; // Severe penalty for no keywords
    
    // Store semantic matches for better feedback
    if (inputs) inputs._semanticMatches = matchResult.semanticMatches;
    
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
async function criticScore(text, contentType, params = {}) {
  const system =
    `You are a rigorous writing critic for an insurance brand.\n` +
    `Return STRICT JSON only: {"score": <0..40>, "detail": "<short>"}.\n` +
    `No prose, no preface, no fences.`;

  let rubric;
  if (contentType === "microcopy") {
    const uiContext = params?.uiContext || 'button';
    if (uiContext === 'button') {
      rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: clarity, actionability, appropriate length, professional tone. Score 0-10 for poor writing style (unclear, too long, unprofessional). Score 30-40 for excellent writing style (clear, concise, professional). Do NOT judge content validity - only evaluate how well it's written.`;
    } else if (uiContext === 'error') {
      rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: empathy, helpfulness, clarity, appropriate length. Score 0-10 for poor writing style (unclear, too long, not empathetic). Score 30-40 for excellent writing style (clear, empathetic, helpful). Do NOT judge content validity - only evaluate how well it's written.`;
    } else if (uiContext === 'tooltip') {
      rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: helpfulness, clarity, conciseness, appropriate length. Score 0-10 for poor writing style (unclear, too long, not helpful). Score 30-40 for excellent writing style (clear, helpful, concise). Do NOT judge content validity - only evaluate how well it's written.`;
    } else {
      rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: clarity, actionability, appropriate length, professional tone. Score 0-10 for poor writing style (unclear, too long, unprofessional). Score 30-40 for excellent writing style (clear, concise, professional). Do NOT judge content validity - only evaluate how well it's written.`;
    }
  } else if (contentType === "internal_comms") {
    rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: professional tone, clear structure, appropriate formatting, brand voice consistency. Score 0-10 for poor writing style (unclear, unprofessional tone, bad formatting). Score 30-40 for excellent writing style (clear, professional, well-structured). Do NOT judge content validity or business appropriateness - only evaluate how well it's written and presented.`;
  } else if (contentType === "press_release") {
    rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: professional tone, clear structure, appropriate formatting, brand voice consistency. Score 0-10 for poor writing style (unclear, unprofessional tone, bad formatting). Score 30-40 for excellent writing style (clear, professional, well-structured). Do NOT judge content validity or business appropriateness - only evaluate how well it's written and presented.`;
  } else {
    rubric = `Evaluate ONLY the writing style and presentation quality. Score based on: professional tone, clear structure, appropriate formatting. Score 0-10 for poor writing style (unclear, unprofessional tone, bad formatting). Score 30-40 for excellent writing style (clear, professional, well-structured). Do NOT judge content validity - only evaluate how well it's written.`;
  }

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
  const critic = await criticScore(text, contentType, inputs);

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
