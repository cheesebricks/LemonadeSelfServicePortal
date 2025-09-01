// src/util.js
// Small helpers used across the app: labels, trait formatting, output shaping & sanitizers.

const TITLE_MAP = {
  microcopy: 'Microcopy',
  press_release: 'PR / External',
  internal_comms: 'Internal Comms'
};

export function labelFor(type) {
  return TITLE_MAP[type] || type || '';
}

export function compactTraits(traits = {}) {
  const order = ['witty', 'empathetic', 'clear'];
  const parts = [];
  for (const k of order) {
    const v = Number(traits[k]);
    if (Number.isFinite(v)) parts.push(`${k}=${round(v, 1)}`);
  }
  return parts.join(', ');
}

function round(n, p = 1) {
  const f = Math.pow(10, p);
  return Math.round(n * f) / f;
}

// ---------- Output shaping ----------

/**
 * Remove scaffolding/prefaces and normalize to the final text.
 * - Always strips code fences, markdown headings, leading labels ("Here is ...:")
 * - For microcopy:
 *    - Prefer quoted span, else text after last colon, else the whole text
 *    - Trim to ≤5 words, strip trailing punctuation/quotes
 * - For internal/PR:
 *    - Remove "Here is/Here's/Below is/Internal comms announcement:" etc.
 *    - Return clean prose (no fences, no labels)
 */
export function enforceOutputShape(type, text, params = {}) {
  let t = String(text || '').trim();

  // 1) Strip code fences, markdown headings, extra whitespace
  t = stripCodeFences(t);
  t = stripHeadings(t);
  t = t.replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // 2) Kill scaffolding/prefaces anywhere (especially at the start)
  t = stripScaffolding(t);

  if (type === 'microcopy') {
    // Prefer quoted CTA
    const quoted = firstQuotedSpan(t);
    if (quoted) t = quoted;

    // Prefer tail after the last colon
    if (!quoted && t.includes(':')) {
      t = t.split(':').pop().trim();
    }

    // Remove lingering scaffolding again
    t = stripScaffolding(t);

    // Remove quotes and clean up
    t = t.replace(/^["'"'']+|["'"'']+$/g, '').trim();
    
    // Apply context-specific shaping
    const uiContext = params?.uiContext || 'button';
    
    if (uiContext === 'button') {
      // Button: Short (≤5 words), direct, simple
      const words = t.split(/\s+/).filter(Boolean);
      t = words.slice(0, 5).join(' ');
      // Clean end punctuation and connectors
      t = t.replace(/[.!?…,:;]+$/g, '').replace(/\s+and\s*$/i, '').trim();
      // Normalize case for single-word OK/Okay etc.
      t = t.replace(/^okay$/i, 'OK');
    } else if (uiContext === 'error') {
      // Error: Short (1 sentence max), empathetic, helpful
      const sentences = t.split(/[.!?]+/).filter(s => s.trim().length > 0);
      t = sentences[0]?.trim() || t;
      // Clean up but keep helpful punctuation
      t = t.replace(/[,…;]+$/g, '').trim();
    } else if (uiContext === 'tooltip') {
      // Tooltip: Concise (1 sentence max), helpful, contextual
      const sentences = t.split(/[.!?]+/).filter(s => s.trim().length > 0);
      t = sentences[0]?.trim() || t;
      // Clean up but keep helpful punctuation
      t = t.replace(/[,…;]+$/g, '').trim();
      // Ensure it's not too long - cap at reasonable tooltip length
      if (t.length > 120) {
        const words = t.split(/\s+/).filter(Boolean);
        t = words.slice(0, 15).join(' ').replace(/[,…;]+$/g, '').trim();
      }
    }
    
    return t;
  }

  if (type === 'internal_comms') {
    // Remove leading labels again (aggressive)
    t = t.replace(/^(?:here\s+is|here's|here is|below is|internal comms announcement|press release|final text|updated copy|answer|response)\b[^:\n]*:\s*/i, '').trim();

    // Remove meta "Output:" / "Task:" / "Draft:" lines if present
    t = t.replace(/^(?:output|task|draft|final)\s*:\s*/i, '').trim();

    // If model wrapped the whole text in quotes, unwrap
    t = t.replace(/^["'""'']+|["'""'']+$/g, '').trim();

    // Channel-specific formatting cleanup
    const channel = params?.channel || 'Slack';
    if (channel.toLowerCase() === 'slack') {
      // For Slack: Remove any title/header that appears at the beginning
      const title = params?.title || '';
      if (title) {
        // Remove title if it appears at the start (case-insensitive, allow some variation)
        const titlePattern = new RegExp('^\\s*' + escapeRegex(title) + '\\s*\\n\\s*', 'i');
        t = t.replace(titlePattern, '');
        
        // Also handle cases where LLM added formatting like "Subject: title" or "Title: title"
        t = t.replace(/^(?:subject|title|topic|re):\s*[^\n]*\n\s*/i, '');
      }
      
      // Remove any standalone title lines that match the title parameter
      if (title) {
        const lines = t.split('\n');
        const filteredLines = lines.filter(line => {
          const cleanLine = line.trim().toLowerCase();
          const cleanTitle = title.toLowerCase();
          return !(cleanLine === cleanTitle || cleanLine === cleanTitle + ':' || cleanLine === cleanTitle + '.');
        });
        t = filteredLines.join('\n').trim();
      }
    }
    // For Email: Keep the title format as intended

    // Never return empty
    return t || text || '';
  }

  if (type === 'press_release') {
    // Remove leading labels again (aggressive)
    t = t.replace(/^(?:here\s+is|here's|here is|below is|internal comms announcement|press release|final text|updated copy|answer|response)\b[^:\n]*:\s*/i, '').trim();

    // Remove meta "Output:" / "Task:" / "Draft:" lines if present
    t = t.replace(/^(?:output|task|draft|final)\s*:\s*/i, '').trim();

    // If model wrapped the whole text in quotes, unwrap
    t = t.replace(/^["'""'']+|["'""'']+$/g, '').trim();

    // Never return empty
    return t || text || '';
  }

  // Default: generic cleanup
  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  return t || text || '';
}

// ---------- Sanitizers & helpers ----------

function stripCodeFences(s) {
  // Remove triple backticks blocks and optional language
  return String(s || '').replace(/```[a-z]*\n?([\s\S]*?)```/gi, '$1').trim();
}

function stripHeadings(s) {
  // Remove leading markdown headings like "## Title"
  return String(s || '').replace(/^\s{0,3}#{1,6}\s+[^\n]+\n+/g, '').trim();
}

export function stripScaffolding(s) {
  let t = String(s || '');

  // Common scaffolding prefixes
  const PREFIXES = [
    'here is the revised text',
    'here is the internal comms announcement',
    'here is the press release',
    'here is the announcement',
    'here is the update',
    'here is the text',
    "here's the revised text",
    "here's the announcement",
    "here's the update",
    'below is the',
    'final text',
    'updated copy',
    'answer',
    'response',
    'output',
    'result',
    'draft'
  ];

  // Strip single-line prefixes ending with ":" at the start
  t = t.replace(
    new RegExp(
      '^\\s*(?:' +
        PREFIXES.map(escapeRegex).join('|') +
        ')\\b[^:\\n]*:\\s*',
      'i'
    ),
    ''
  );

  // Remove inline scaffolding labels that sometimes sneak in
  t = t.replace(/(?:^|\n)\s*(?:task|output|final|draft)\s*:\s*/gi, '\n');

  // Remove leading "– " or "- " bullets that appear alone
  t = t.replace(/^\s*[-–]\s*/g, '');

  return t.trim();
}

function firstQuotedSpan(s) {
  const m =
    /["“”](.+?)["“”]/.exec(s) ||
    /['‘’](.+?)['‘’]/.exec(s);
  return m ? m[1].trim() : '';
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
