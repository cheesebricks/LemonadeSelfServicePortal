// policy.js — Phase-1 policies, traits, lexicon, and validation
// Exports expected by orchestrator.js:
//   getPolicy(type)
//   validateRequired(type, params)  -> { ok: boolean, missing: string[] }
//   getTraits(type, params)         -> tone weights; audience-aware for internal comms
//   getIntentLexicon(type, intent)  -> { preferred: string[], banned: string[] }

function basePolicy() {
  return {
    thresholds: { trs_pass: 80, trs_border: 72 },
    localeDefault: "en-US",
    corpus: { matchOn: [], refs: 3 },
  };
}

export function getPolicy(contentType) {
  const base = basePolicy();

  if (contentType === "microcopy") {
    return {
      ...base,
      typeName: "Microcopy",
      required: ["uiContext", "intent"],
      corpus: { file: 'corpus/microcopy_corpus.json', matchOn: ["uiContext", "intent"], refs: 3 },
      traits: { witty: 0.5, empathetic: 0.5, clear: 1 },
      // Marketing bleed → keep out of CTAs
      bannedWords: [
        "ai-native", "automation", "oncall", "giveback", "community",
        "lol", "btw", "pls", "u", "thx", "emoji"
      ],
      // Intent-specific verbs
      intentLexicon: {
        close:          { preferred: ["close", "dismiss", "cancel", "back", "done", "ok", "okay", "got it"], banned: [] },
        confirm_action: { preferred: ["confirm", "agree", "accept", "approve", "yes"], banned: [] },
        continue_flow:  { preferred: ["continue", "next", "proceed", "keep going"], banned: [] },
        contact_support:{ preferred: ["contact support", "get help", "chat", "message us"], banned: [] },
        upload_docs:    { preferred: ["upload", "add files", "attach", "submit docs"], banned: [] },
        pay:            { preferred: ["pay", "checkout", "complete payment", "pay now"], banned: [] },
        try_again:      { preferred: ["try again", "retry"], banned: [] },
        start:          { preferred: ["start", "get started", "begin"], banned: [] },
        start_claim:    { preferred: ["start claim", "file claim"], banned: [] },
        update_profile: { preferred: ["update profile", "edit profile"], banned: [] },
        cancel_action:  { preferred: ["cancel", "nevermind"], banned: [] },
        help:           { preferred: ["help", "learn more"], banned: [] },
      },
    };
  }

  if (contentType === "internal_comms") {
    return {
      ...base,
      typeName: "Internal Comms",
      required: ["channel", "title", "key_update", "locale"],
      corpus: { matchOn: ["locale", "title"], refs: 3 },
      traits: { witty: 0.3, empathetic: 0.7, clear: 1 },
      prefer: ["heads up", "join us", "please note", "details below", "see you there", "today", "tomorrow"],
      bannedWords: ["ai-native", "automation", "oncall", "giveback", "community", "emoji", "lol", "btw", "pls", "u", "thx"],
      intentLexicon: {}, // no intent dimension here
    };
  }

  if (contentType === "press_release" || contentType === "pr" || contentType === "external") {
    return {
      ...base,
      typeName: "PR / External",
      required: ["headline", "key_message", "audience", "locale"],
      corpus: { file: 'corpus/press_release_corpus.json', matchOn: ["audience", "locale"], refs: 3 },
      traits: { witty: 0.2, empathetic: 0.5, clear: 1 },
      prefer: ["transparent pricing", "customers", "community"],
      // PR: avoid consumer CTAs
      bannedWords: ["sign up", "join us", "try now", "buy now", "emoji", "lol", "btw", "pls", "u", "thx"],
      intentLexicon: {},
    };
  }

  // Fallback (shouldn’t be hit in normal operation)
  return {
    ...base,
    typeName: contentType,
    required: ["locale"],
    corpus: { matchOn: ["locale"], refs: 3 },
    traits: { witty: 0.5, empathetic: 0.5, clear: 1 },
    bannedWords: ["emoji", "lol", "btw", "pls", "u", "thx"],
    intentLexicon: {},
  };
}

export function validateRequired(type, params = {}) {
  const policy = getPolicy(type);
  const req = policy.required || [];
  const missing = req.filter((k) => {
    if (!(k in params)) return true;
    const v = params[k];
    if (v === null || v === undefined) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    return false;
  });
  return { ok: missing.length === 0, missing };
}

export function getTraits(type, params = {}) {
  const p = getPolicy(type);
  
  // Microcopy: Different traits based on UI context
  if (type === "microcopy") {
    const uiContext = String(params.uiContext || '').toLowerCase();
    
    if (uiContext === 'error') {
      return { witty: 0.1, empathetic: 0.9, clear: 1 }; // Empathetic, helpful, short
    }
    if (uiContext === 'button') {
      return { witty: 0.2, empathetic: 0.3, clear: 1 }; // Direct, simple, short
    }
    if (uiContext === 'tooltip') {
      return { witty: 0.3, empathetic: 0.6, clear: 1 }; // Helpful, contextual, longer
    }
    // Default for other contexts
    return { witty: 0.5, empathetic: 0.5, clear: 1 };
  }
  
  // Tailor PR / External tone by audience
  if (type === "press_release") {
    const aud = String(params.audience || '').toLowerCase();
    if (aud === 'press') return { witty: 0.2, empathetic: 0.5, clear: 1 };
    if (aud === 'customers') return { witty: 0.3, empathetic: 0.6, clear: 1 };
    if (aud === 'investors') return { witty: 0.1, empathetic: 0.3, clear: 1 };
  }
  
  return p.traits;
}

export function getIntentLexicon(type, intent) {
  const p = getPolicy(type);
  const pack = (p.intentLexicon && p.intentLexicon[intent]) || { preferred: [], banned: [] };
  // Always return an object with arrays; orchestrator expects {preferred,banned}
  return {
    preferred: Array.isArray(pack.preferred) ? pack.preferred : (Array.isArray(pack) ? pack : []),
    banned: Array.isArray(pack.banned) ? pack.banned : [],
  };
}
