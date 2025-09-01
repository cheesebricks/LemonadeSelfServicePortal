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
    `- Return ONLY the final text. No prefaces like "Here is...", "Here's...", "Below is...", "Internal comms announcement:", "Press release:".`,
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
    const uiContext = params?.uiContext || 'button';
    let contextRequirements = '';
    
    if (uiContext === 'error') {
      contextRequirements = `
ERROR MESSAGE REQUIREMENTS:
- Short (1 sentence max), empathetic, helpful, suggestive
- Be understanding and offer a solution or next step
- Avoid technical jargon, keep it user-friendly`;
    } else if (uiContext === 'button') {
      contextRequirements = `
BUTTON REQUIREMENTS:
- Short (≤ 5 words), direct, simple, action-first
- Prefer "Next" over "Next step", "Continue" over "Continue to next page"
- No unnecessary words or qualifiers`;
    } else if (uiContext === 'tooltip') {
      contextRequirements = `
TOOLTIP REQUIREMENTS:
- Concise (1 sentence max), helpful, contextual
- Focus on the specific INTENT/question - answer it directly
- Avoid marketing language or promotional content
- Be informative but brief - tooltips should be quick to read`;
    }
    
    const task =
`TASK: Generate Microcopy
UI CONTEXT: ${uiContext}
SURFACE: ${params?.surface || uiContext}
INTENT: ${params?.intent_canonical || params?.intent || 'generic'}
${refsBlock(refs)}
REQUIREMENTS:${contextRequirements}
- CRITICAL: The generated content MUST directly address and match the specific INTENT.
- Use only words essential to the INTENT; avoid adding adverbs or qualifiers unless present in INTENT.
- Do NOT generate generic content that could apply to any intent.
- The output should be immediately recognizable as addressing the requested INTENT.
- No quotes around the text.
OUTPUT: Only the final text.`;
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
- If CHANNEL is Slack: Keep it to 1–2 short lines; crisp; no emoji or slang. DO NOT include the title as a header - start directly with the message content.
- If CHANNEL is Email: Start with the TITLE on its own line, then a blank line, then the body; professional, friendly.
- CRITICAL: Focus on the specific update details, not general company information.
- The message should directly address and incorporate the title and key update content.
- Include at least 2 of: ${keywordList(params?.title, params?.key_update)} in the first sentence/paragraph.
- Do NOT generate generic corporate messaging or company boilerplate.
- CRITICAL: Generate EXACTLY ONE message for the specified CHANNEL only.
- Do NOT include content for any other channel.
- Do NOT include channel prefixes or labels like "Slack:" or "Email:".
- Do NOT mention the channel name in the output.
- Do NOT generate multiple formats or multiple messages.
- Do NOT create a combined Slack+Email response.
${noPrefaceGuards('')}
OUTPUT: Only the final text for the specified channel.`;
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
- CRITICAL: You MUST include the specific content from HEADLINE and KEY MESSAGE in your response.
- The response should directly address and incorporate the headline and key message details.
- Do NOT generate generic insurance content - focus on the specific announcement.
- Include at least 2-3 keywords from HEADLINE/KEY MESSAGE in the first sentence.
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

  // CRITICAL: Include original user request context to prevent content drift
  let originalContext = '';
  if (type === 'internal_comms') {
    originalContext = `\nORIGINAL REQUEST:\nTITLE: ${params?.title || ''}\nKEY UPDATE: ${params?.key_update || ''}\nCHANNEL: ${params?.channel || 'Slack'}`;
  } else if (type === 'press_release') {
    originalContext = `\nORIGINAL REQUEST:\nHEADLINE: ${params?.headline || ''}\nKEY MESSAGE: ${params?.key_message || ''}\nAUDIENCE: ${params?.audience || 'press'}`;
  } else if (type === 'microcopy') {
    originalContext = `\nORIGINAL REQUEST:\nINTENT: ${params?.intent_canonical || params?.intent || 'generic'}\nUI CONTEXT: ${params?.uiContext || 'button'}`;
  }

  let contextFormat = '';
  if (type === 'internal_comms') {
    contextFormat = `\nCHANNEL: ${params?.channel || 'Slack'}\nFORMAT RULES:\n- If CHANNEL is Slack: Keep to 1–2 short lines; crisp; no emoji or slang. DO NOT include the title as a header - start directly with the message content.\n- If CHANNEL is Email: Start with the TITLE on its own line, then a blank line, then the body.\n- CRITICAL: Maintain focus on the specific update details from title and key update\n- Do NOT drift into generic corporate messaging or company boilerplate\n- Produce only ONE message for that CHANNEL.\n- Do NOT include channel prefixes like "Slack:" or "Email:".\n- Do NOT mention the channel name in the output.`;
  } else if (type === 'press_release') {
    contextFormat = `\nTYPE: Press Release\nFORMAT RULES:\n- CRITICAL: Maintain the specific content from HEADLINE and KEY MESSAGE\n- Do NOT drift away from the original announcement details\n- Keep factual tone, avoid generic insurance marketing language\n- Ensure the response directly addresses the specific news being announced`;
  } else if (type === 'microcopy') {
    const uiContext = params?.uiContext || 'button';
    if (uiContext === 'error') {
      contextFormat = `\nUI CONTEXT: Error message\nFORMAT RULES:\n- Short (1 sentence max), empathetic, helpful, suggestive\n- Be understanding and offer a solution or next step\n- Avoid technical jargon, keep it user-friendly\n- CRITICAL: Address the specific error context - do not provide generic error messages`;
    } else if (uiContext === 'button') {
      contextFormat = `\nUI CONTEXT: Button\nFORMAT RULES:\n- Short (≤ 5 words), direct, simple, action-first\n- Prefer "Next" over "Next step", "Continue" over "Continue to next page"\n- No unnecessary words or qualifiers\n- CRITICAL: The button text must clearly indicate the specific action for the INTENT`;
    } else if (uiContext === 'tooltip') {
      contextFormat = `\nUI CONTEXT: Tooltip\nFORMAT RULES:\n- Concise (1 sentence max), helpful, contextual\n- Focus on the specific INTENT/question - answer it directly\n- Avoid marketing language or promotional content\n- Be informative but brief - tooltips should be quick to read\n- CRITICAL: Maintain focus on the specific INTENT - do not drift into generic advice`;
    }
  }

  const task =
`TASK: Revise the text to improve TRS while maintaining relevance to the original request.
TYPE: ${type}${contextFormat}${originalContext}
${localeLine}

CURRENT TEXT TO IMPROVE:
"""
${base}
"""

FIXES TO APPLY:
${fixLines || '  - Keep voice and constraints; remove any scaffolding/preface.'}

CRITICAL INSTRUCTIONS:
- IMPROVE the existing text based on the TRS feedback
- Do NOT change the topic or subject matter
- Maintain relevance to the original request (see above)
- Keep the same core message but fix the specific issues identified
- Do NOT generate completely new content
- Do NOT generate content for multiple channels

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
