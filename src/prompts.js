// src/prompts.js
// Build OpenAI-format prompts for initial generate and targeted revise.
// Emphasizes "NO PREFACE" and "return only final text" to avoid scaffolding.

function lexiconLines(preferred = [], banned = []) {
  const p = preferred.filter(Boolean);
  const b = banned.filter(Boolean);
  const prefer = p.length ? `LEXICON PREFER: ${p.join(', ')}` : '';
  const avoid  = b.length ? `LEXICON AVOID: ${b.join(', ')}`   : '';
  return [prefer, avoid].filter(Boolean).join('\n');
}

function systemCommon(traits) {
  const tw = Number(traits?.witty) || 0;
  const te = Number(traits?.empathetic) || 0;
  const tc = Number(traits?.clear) || 1;
  return `You are a Lemonade copywriter. Voice: friendly, clear, compassionate; airy, concise.
Prefer contractions. Avoid emoji and filler. Avoid heavy insurance jargon; keep facts accurate.
TRAITS: witty(${tw}), empathetic(${te}), clear(${tc}).`;
}

function noPrefaceGuards(extra = '') {
  return [
    `GUARDS:`,
    `- Return ONLY the final text. No prefaces like "Here is...", "Here’s...", "Below is...", "Internal comms announcement:", "Press release:".`,
    `- No labels (Task:, Output:, Draft:).`,
    `- No code fences or markdown headings.`,
    extra || ''
  ].filter(Boolean).join(' ');
}

function refsBlock(refs = []) {
  if (!Array.isArray(refs) || refs.length === 0) return '';
  const lines = refs.slice(0, 3).map(r => {
    const id = r?.id || r?.ref_id || 'ref';
    const text = (r?.text || '').replace(/\s+/g, ' ').trim();
    return `• ${id} — ${text}`;
  });
  return `VOICE & EXAMPLES (for style, not content):\n${lines.join('\n')}`;
}

export function genTemplate_generate({ type, traits, params, refs, preferred, banned }) {
  const sys = [systemCommon(traits), lexiconLines(preferred, banned), noPrefaceGuards()].filter(Boolean).join('\n');

  if (type === 'microcopy') {
    const task =
`TASK: Generate Microcopy (CTA)
SURFACE: ${params?.surface || 'button'}
INTENT: ${params?.intent_canonical || params?.intent || 'generic'}
${refsBlock(refs)}
REQUIREMENTS:
- ≤ 5 words, action-first verb.
- No "and", no punctuation junk.
- No quotes around the whole CTA.
- Use only words essential to the INTENT; avoid adding adverbs like "instantly" or qualifiers unless present in INTENT.
OUTPUT: Only the final CTA.`;
    return { system: sys, user: task };
  }

  if (type === 'internal_comms') {
    const task =
`TASK: Internal Comms announcement.
CHANNEL: ${params?.channel || 'Slack'}
LOCALE: ${params?.locale || 'en-US'}
TITLE: ${params?.title || ''}
KEY UPDATE: ${params?.key_update || ''}
${lexiconLines([], params?.banned || [])}
${refsBlock(refs)}
REQUIREMENTS:
- If CHANNEL is Slack: Keep it to 1–2 short lines; crisp; no emoji or slang.
- If CHANNEL is Email: Start with the TITLE on its own line, then a blank line, then the body; professional, friendly.
- Include at least 2 of: ${keywordList(params?.title, params?.key_update)} in the first sentence/paragraph.
- Produce exactly ONE message for the specified CHANNEL only — do not include content for any other channel.
- Do NOT include channel prefixes or labels like "Slack:" or "Email:".
 - Do NOT mention the channel name in the output.
${noPrefaceGuards('')}
OUTPUT: Only the final text.`;
    return { system: sys, user: task };
  }

  if (type === 'press_release') {
    const task =
`TASK: Press Release paragraph (lede/body).
AUDIENCE: ${params?.audience || 'press'}
HEADLINE: ${params?.headline || ''}
KEY MESSAGE: ${params?.key_message || ''}
${refsBlock(refs)}
REQUIREMENTS:
- Factual tone; avoid consumer CTA language.
- Include at least 1 keyword from HEADLINE/KEY MESSAGE.
${noPrefaceGuards('')}
OUTPUT: Only the final text.`;
    return { system: sys, user: task };
  }

  // Fallback (shouldn't be used)
  return { system: sys, user: `TASK: ${type}\n${noPrefaceGuards('')}\nOUTPUT: Only the final text.` };
}

export function genTemplate_revise({ type, traits, params, refs, preferred, banned, base, fixes = [] }) {
  const sys = [systemCommon(traits), lexiconLines(preferred, banned), noPrefaceGuards()].filter(Boolean).join('\n');
  const fixLines = (fixes || []).map((f, i) => `  ${i + 1}. ${f}`).join('\n');
  const localeLine = (type === 'microcopy') ? '' : `\nLOCALE: ${params?.locale || 'en-US'}`;

  const internalFormat = (type === 'internal_comms')
    ? `\nCHANNEL: ${params?.channel || 'Slack'}\nFORMAT RULES:\n- If CHANNEL is Slack: Keep to 1–2 short lines; crisp; no emoji or slang.\n- If CHANNEL is Email: Start with the TITLE on its own line, then a blank line, then the body.\n- Produce only ONE message for that CHANNEL.\n- Do NOT include channel prefixes like "Slack:" or "Email:".\n- Do NOT mention the channel name in the output.`
    : '';

  const task =
`TASK: Revise the text to improve TRS.
TYPE: ${type}${internalFormat}
${localeLine}
INPUT TEXT:
"""
${base}
"""
FIXES TO APPLY:
${fixLines || '  - Keep voice and constraints; remove any scaffolding/preface.'}
${refsBlock(refs)}
OUTPUT: Only the final text (no preface, no labels, no fences).`;

  return { system: sys, user: task };
}

// ---------- helpers ----------

function keywordList(a = '', b = '') {
  const raw = `${a} ${b}`.toLowerCase();
  const tokens = raw.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && w.length >= 3);
  const uniq = [];
  for (const w of tokens) if (!uniq.includes(w)) uniq.push(w);
  return uniq.slice(0, 8).join(', ');
}
