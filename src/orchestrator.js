// src/orchestrator.js
// LLM-first pipeline with streaming logs: policy → normalize(params) → validate → corpus(+lexicon) → generate
// → log RAW + SHAPED → TRS → iterative revise (until PASS/BORDERLINE or cap)
// Dev feature: visible "Verbose prompts" toggle + ?verbose=1 support

import { getPolicy, validateRequired, getTraits, getIntentLexicon } from './policy.js';
import { compactTraits, labelFor, enforceOutputShape } from './util.js';
import { genTemplate_generate, genTemplate_revise } from './prompts.js';
import { generateText } from './llmClient.js';
import { loadCorpusWithLexicon, pickRefs } from './corpus.js';
import { score as scoreTRS } from './guardrail.js';

const MAX_TRIES = 4;

// --- Dev verbose toggle ---
function isVerbose() {
  try {
    if (typeof window !== 'undefined' && window.__DEV_VERBOSE === true) return true;
    const usp = new URLSearchParams(window.location.search);
    return usp.has('verbose') && usp.get('verbose') !== '0';
  } catch { return false; }
}
function setVerbose(v) {
  try {
    window.__DEV_VERBOSE = !!v;
    const usp = new URLSearchParams(window.location.search);
    if (v) usp.set('verbose', '1'); else usp.delete('verbose');
    const url = `${location.pathname}?${usp.toString()}${location.hash || ''}`.replace(/\?$/, '');
    history.replaceState(null, '', url);
    const panel = document.getElementById('log-panel');
    if (panel) {
      const line = document.createElement('div');
      line.textContent = `[dev] Verbose prompts: ${v ? 'ON' : 'OFF'}`;
      panel.appendChild(line);
      panel.scrollTop = panel.scrollHeight;
    }
  } catch {}
}
function injectVerboseToggleOnce() {
  if (typeof window === 'undefined') return;
  if (window.__VERBOSE_CTRL_INIT__) return;
  window.__VERBOSE_CTRL_INIT__ = true;

  document.addEventListener('DOMContentLoaded', () => {
    const logPanel = document.getElementById('log-panel');
    if (!logPanel) return;

    const bar = document.createElement('div');
    bar.id = 'log-dev-controls';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.gap = '12px';
    bar.style.margin = '8px 0';

    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '6px';
    label.style.cursor = 'pointer';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'toggle-verbose-prompts';
    cb.checked = isVerbose();
    cb.addEventListener('change', () => setVerbose(cb.checked));

    const span = document.createElement('span');
    span.textContent = 'Verbose prompts';
    span.title = 'Show full SYSTEM + USER prompts in the log. Toggle off to show short snippets.';

    label.appendChild(cb);
    label.appendChild(span);
    bar.appendChild(label);

    const parent = logPanel.parentElement || logPanel;
    parent.insertBefore(bar, logPanel);

    setVerbose(cb.checked);
  });
}
injectVerboseToggleOnce();

const snip = (t, n = 140) => {
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};

function scoringLine(tag, s) {
  // expects guardrail.score to return { ok, trs, verdict, breakdown:{ rules, lexicon, critic } }
  const rules = s?.breakdown?.rules?.score ?? 0;
  const lex   = s?.breakdown?.lexicon?.score ?? 0;
  const crit  = s?.breakdown?.critic?.score ?? 0;
  return `${tag} TRS = ${s.trs} — rules ${rules}/40, lexicon ${lex}/20, critic ${crit}/40 → ${String(s.verdict || '').toUpperCase()}`;
}

function makeRuleFixes(type, rules) {
  const fixes = [];
  for (const rawKey of (rules?.fails || [])) {
    const key = String(rawKey).replace(/\(.*\)$/, '');
    switch (key) {
      case 'contractions':
        fixes.push(`Use contractions ("we're", "it's", "you’re").`); break;
      case 'sentence_length':
        fixes.push(type === 'microcopy'
          ? 'Keep CTA ≤ 5 words; keep sentences ultra-short.'
          : 'Aim for average sentence length 12–20 words.'); break;
      case 'punctuation':
        fixes.push('Avoid ellipses and repeated punctuation (!!, ???).'); break;
      case 'readability':
        fixes.push(type === 'microcopy'
          ? 'Target Flesch ≥ 70 (simpler wording).'
          : 'Target Flesch 45–65 (professional, not too dense).'); break;
      case 'pronouns':
        fixes.push('Prefer friendly “you”/“we” where appropriate.'); break;
      case 'type_specific':
        fixes.push(type === 'microcopy'
          ? 'Respect microcopy conventions (CTA focused, ≤ 5 words).'
          : 'No slang/emoji; follow press release structure and tone.'); break;
      case 'no_emoji':
      case 'no_slang':
        fixes.push('Remove slang and emoji.'); break;
      case 'scaffolding':
        fixes.push('Remove scaffolding like “Here’s the revised text:” and rubric notes.'); break;
      case 'relevance_missing':
        fixes.push('Include Title/Key Update/Topic keywords explicitly in the first sentence.'); break;
      default:
        fixes.push(`Fix: ${key}.`);
    }
  }
  return fixes;
}

// --- Param normalization + Synonym mapping ---
function baseNormalize(type, p = {}) {
  const out = { ...p };
  if (type !== 'microcopy' && !out.locale) out.locale = 'en-US';
  if (type === 'press_release') {
    if (!out.audience) out.audience = 'press';
    if (!out.section) out.section = 'body';
    if (!out.topic && out.headline) out.topic = out.headline;
  }
  return out;
}

function applySynonyms(type, params, push) {
  // Press Release mappings
  if (type === 'press_release') {
    if (!params.headline) {
      const k = ['headline','title','head','subject'];
      for (const key of k) { if (params[key]) { params.headline = params[key]; if (key !== 'headline') push(`🧩 Mapped PR field ${key} → headline`); break; } }
    }
    if (!params.key_message) {
      const k = ['key_message','keyMessage','key_update','keyUpdate','key','message','summary','lede'];
      for (const key of k) { if (params[key]) { params.key_message = params[key]; if (key !== 'key_message') push(`🧩 Mapped PR field ${key} → key_message`); break; } }
    }
    if (!params.region) {
      const k = ['region','geo','market','country'];
      for (const key of k) { if (params[key]) { params.region = params[key]; if (key !== 'region') push(`🧩 Mapped PR field ${key} → region`); break; } }
    }
    if (!params.audience) {
      params.audience = 'press';
      push('🧩 Defaulted PR audience → press');
    }
    return;
  }

  // Internal Comms mappings
  if (type === 'internal_comms') {
    // title
    if (!params.title) {
      const k = ['title','subject','headline'];
      for (const key of k) { if (params[key]) { params.title = params[key]; if (key !== 'title') push(`🧩 Mapped Internal field ${key} → title`); break; } }
    }
    // key_update
    if (!params.key_update) {
      const k = ['key_update','keyUpdate','update','summary','message'];
      for (const key of k) { if (params[key]) { params.key_update = params[key]; if (key !== 'key_update') push(`🧩 Mapped Internal field ${key} → key_update`); break; } }
    }
    // channel
    if (!params.channel) {
      const k = ['channel','medium','platform'];
      for (const key of k) { if (params[key]) { params.channel = params[key]; if (key !== 'channel') push(`🧩 Mapped Internal field ${key} → channel`); break; } }
    }
    return;
  }
}

const attemptMeta = (kind, s, latencyMs) => ({
  kind,
  trs: s.trs,
  verdict: s.verdict,
  latency: latencyMs
});

export async function runPipeline({ type, params, onLog }) {
  const log = [];
  const push = (line) => { log.push(line); try { onLog && onLog(line); } catch {} };
  const startedAt = Date.now();
  const VERBOSE = isVerbose();

  try {
    // 0) Normalize (locale/defaults)
    params = baseNormalize(type, params);

    // 1) Policy + synonym mapping + validation
    const policy = getPolicy(type);
    push(`📦 Policy loaded for ${labelFor(type)} — required=[${(policy.required || []).join(', ')}], thresholds pass≥${policy.thresholds.trs_pass}/border≥${policy.thresholds.trs_border}`);

    // Map common aliases BEFORE required check
    applySynonyms(type, params, push);

    const v = validateRequired(type, params);
    if (!v.ok) {
      const miss = v.missing.join(', ');
      push(`❌ Missing required: ${miss}`);
      return { ok: false, log, error: `Missing required: ${miss}` };
    }
    push('✔️ Required OK.');

    if (params?.draft && String(params.draft).trim().length > 0) {
      const d = String(params.draft).trim();
      push(`📝 Draft provided (${Math.min(120, d.length)}ch): "${d.slice(0, 120)}${d.length > 120 ? '…' : ''}"`);
    }

    // 2) Corpus + refs + merged lexicon
    const traits = getTraits(type, params);
    const { matchOn = [], refs: refsN = 3 } = policy.corpus || {};
    const corpus = await loadCorpusWithLexicon(policy);
    if (corpus?.error) push(`⚠️ Corpus load error: ${corpus.error}`);

    const refs = pickRefs(corpus, matchOn, params, refsN);
    const intentPack = getIntentLexicon(type, params.intent);
    const preferredAll = Array.from(new Set([...(corpus?.preferred_lexicon || []), ...(intentPack?.preferred || [])]));
    const bannedAll    = Array.from(new Set([...(corpus?.banned_lexicon || []),   ...(intentPack?.banned || [])]));

    push(`📚 Picked ${refs.length} on-voice refs (matchOn: ${matchOn.join(', ') || '—'}).`);
    push(`🔤 Lexicon merged — preferred ${preferredAll.length}, banned ${bannedAll.length}.`);
    push(`🧪 Traits: ${compactTraits(traits)}`);
    if (VERBOSE && Array.isArray(refs) && refs.length > 0) {
      try {
        const refLines = refs.map((r, i) => {
          const id = r?.id || r?.ref_id || `ref#${i + 1}`;
          const text = String(r?.text || r?.body || r?.headline || '')
            .replace(/\s+/g, ' ').trim();
          return `  • ${id} — ${snip(text, 160)}`;
        });
        push(`📎 Refs selected:\n${refLines.join('\n')}`);
      } catch {}
    }

    // 3) Generate initial
    const tpl1 = genTemplate_generate({
      type,
      traits,
      params,
      refs,
      preferred: preferredAll,
      banned: bannedAll
    });

    if (VERBOSE) {
      push(`🔎 Prompt #1 — SYSTEM\n${tpl1.system}`);
      push(`🔎 Prompt #1 — USER\n${tpl1.user}`);
    } else {
      push(`🔎 Prompt #1 — SYSTEM: ${snip(tpl1.system, 220)}`);
      push(`🔎 Prompt #1 — USER: ${snip(tpl1.user, 220)}`);
    }

    push(`🧠 Generating (attempt #1)…`);
    const g1 = await generateText({ system: tpl1.system, user: tpl1.user, max_tokens: type === 'microcopy' ? 120 : 700 });
    if (!g1.ok) {
      const msg = `LLM error: ${g1.error || 'unknown'}`;
      push(`❌ ${msg}`);
      return { ok: false, log, error: msg };
    }
    push(`✅ Model #1 replied in ~${g1.latency_ms ?? '?'}ms.`);
    push(`📝 Candidate #1 (raw): “${snip(g1.text)}”`);

    let tBest = enforceOutputShape(type, g1.text);
    if (tBest !== g1.text) push('🧱 Enforced output shape.');
    push(`📝 Candidate #1 (shaped): “${snip(tBest)}”`);

    let sBest = await scoreTRS({ type, text: tBest, policy, refs, preferred: preferredAll, banned: bannedAll, params });
    if (!sBest?.ok) {
      const msg = `TRS/critic error: ${sBest?.error || 'unknown'}`;
      push(`❌ ${msg}`);
      return { ok: false, log, error: msg };
    }
    push(`🧮 ${scoringLine('#1', sBest)}`);

    const attempts = [attemptMeta('initial', sBest, g1.latency_ms)];

    if (sBest.verdict !== 'fail') {
      const duration_ms = Date.now() - startedAt;
      push(`🏁 Finished in ${duration_ms}ms (${String(sBest.verdict).toUpperCase()}).`);
      return { ok: true, log, policy, result: tBest, scoring: sBest, attempts, duration_ms };
    }

    // 4) Iterative TRS-driven revise loop
    for (let i = 2; i <= MAX_TRIES && sBest.verdict === 'fail'; i++) {
      const fixes = makeRuleFixes(type, sBest.rules);

      const tplR = genTemplate_revise({
        type,
        traits,
        params,
        refs,
        preferred: preferredAll,
        banned: bannedAll,
        base: tBest,
        fixes
      });

      if (VERBOSE) {
        push(`🔎 Prompt #${i} — SYSTEM\n${tplR.system}`);
        push(`🔎 Prompt #${i} — USER\n${tplR.user}`);
      } else {
        push(`🔎 Prompt #${i} — SYSTEM: ${snip(tplR.system, 220)}`);
        push(`🔎 Prompt #${i} — USER: ${snip(tplR.user, 220)}`);
      }

      push(`🔁 Revise attempt #${i} — fixes: ${fixes.join(' | ')}`);

      const gR = await generateText({ system: tplR.system, user: tplR.user, max_tokens: type === 'microcopy' ? 120 : 700 });
      if (!gR.ok) {
        const msg = `Retry LLM error: ${gR.error || 'unknown'}`;
        push(`❌ ${msg}`);
        return { ok: false, log, error: msg };
      }

      push(`✅ Model #${i} replied in ~${gR.latency_ms ?? '?'}ms.`);
      push(`📝 Candidate #${i} (raw): “${snip(gR.text)}”`);

      const tR = enforceOutputShape(type, gR.text);
      if (tR !== gR.text) push('🧱 Enforced output shape (revise).');
      push(`📝 Candidate #${i} (shaped): “${snip(tR)}”`);

      const sR = await scoreTRS({ type, text: tR, policy, refs, preferred: preferredAll, banned: bannedAll, params });
      if (!sR?.ok) {
        const msg = `TRS/critic error (#${i}): ${sR?.error || 'unknown'}`;
        push(`❌ ${msg}`);
        return { ok: false, log, error: msg };
      }
      push(`🧮 ${scoringLine(`#${i}`, sR)}`);
      attempts.push(attemptMeta(`revise#${i - 1}`, sR, gR.latency_ms));

      if (sR.trs >= sBest.trs) { tBest = tR; sBest = sR; }
      if (sBest.verdict !== 'fail') break;
    }

    const duration_ms = Date.now() - startedAt;
    if (sBest.verdict !== 'fail') {
      push(`🏁 Using best (improved to ${String(sBest.verdict).toUpperCase()}).`);
    } else {
      push(`🏁 Stopped after ${attempts.length} attempts (still FAIL) in ${duration_ms}ms.`);
    }

    return { ok: true, log, policy, result: tBest, scoring: sBest, attempts, duration_ms };

  } catch (err) {
    const msg = err?.message || String(err);
    return { ok: false, log, error: msg };
  }
}
