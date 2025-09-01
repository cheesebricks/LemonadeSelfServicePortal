# Detailed Flow Example: Microcopy Generation

This document shows a complete example of how data flows through the system, from user input to LLM prompt generation, using a real microcopy tooltip case.

## User Request Example

**User wants to generate**: A tooltip explaining "why we need this info" for a phone number field

**Form Input**:
```json
{
  "type": "microcopy",
  "uiContext": "tooltip",
  "surface": "tooltip", 
  "intent": "why we need this info"
}
```

## Step 1: Policy Loading

**Policy.js loads content type policy**:
```json
{
  "microcopy": {
    "required": ["uiContext", "surface", "intent"],
    "corpus": {
      "matchOn": ["uiContext", "intent"],
      "file": "corpus/microcopy_corpus.json"
    },
    "getTraits": {
      "witty": 0.3,
      "empathetic": 0.7,
      "clear": 1.0
    }
  }
}
```

**Context-specific trait adjustments**:
```javascript
// For tooltip context
if (uiContext === 'tooltip') {
  return {
    witty: 0.2,      // Less witty for tooltips
    empathetic: 0.8, // More empathetic for explanations
    clear: 1.0       // Maximum clarity
  };
}
```

## Step 2: Corpus Reference Selection

**Corpus.js loads and matches references**:
```json
// From corpus/microcopy_corpus.json
{
  "tip_password_1": {
    "id": "tip_password_1",
    "text": "Use twelve characters with a number and symbol.",
    "uiContext": "tooltip",
    "intent": "password rules"
  },
  "tip_address_1": {
    "id": "tip_address_1", 
    "text": "Start typing your street—pick a match from the list.",
    "uiContext": "tooltip",
    "intent": "address input"
  },
  "tip_upload_1": {
    "id": "tip_upload_1",
    "text": "Drag a file here or choose one from your device.",
    "uiContext": "tooltip",
    "intent": "upload requirements"
  }
}
```

**Selected references** (top 3 matches):
```javascript
// References selected based on uiContext="tooltip"
[
  "tip_password_1 — Use twelve characters with a number and symbol.",
  "tip_address_1 — Start typing your street—pick a match from the list.", 
  "tip_upload_1 — Drag a file here or choose one from your device."
]
```

## Step 3: Lexicon Loading

**Policy.js loads intent-specific lexicon**:
```json
// From lexicon for "why we need this info"
{
  "preferred": ["verify", "secure", "account", "identity", "help", "protect"],
  "banned": ["spam", "sell", "third-party", "marketing", "ads"]
}
```

**Global lexicon preferences**:
```json
{
  "preferred": ["AI-native", "automation", "community", "Giveback", "instant", "transparent pricing"],
  "banned": ["ASAP", "actuarial", "adjuster", "btw", "claimant", "emoji", "lol", "pls", "policyholder", "thx", "u"]
}
```

## Step 4: Prompt Template Construction

**Prompts.js constructs the final prompt**:

### System Prompt Template:
```
You are a Lemonade copywriter. Voice: friendly, clear, compassionate; airy, concise.
Prefer contractions. Avoid emoji and filler. Avoid heavy insurance jargon; keep facts accurate.
TRAITS: witty(0.2), empathetic(0.8), clear(1).

LEXICON PREFER: AI-native, automation, community, Giveback, instant, transparent pricing, verify, secure, account, identity, help, protect
LEXICON AVOID: ASAP, actuarial, adjuster, btw, claimant, emoji, lol, pls, policyholder, thx, u, spam, sell, third-party, marketing, ads

GUARDS:
- Return ONLY the final text. No prefaces like "Here is...", "Here's...", "Below is...".
- No labels (Task:, Output:, Draft:).
- No code fences or markdown headings.
```

### User Prompt Template:
```
TASK: Generate Microcopy
UI CONTEXT: tooltip
SURFACE: tooltip
INTENT: why we need this info

VOICE & EXAMPLES (for style, not content):
• tip_password_1 — Use twelve characters with a number and symbol.
• tip_address_1 — Start typing your street—pick a match from the list.
• tip_upload_1 — Drag a file here or choose one from your device.

REQUIREMENTS:
- Concise (1 sentence max), helpful, contextual
- Focus on the specific INTENT/question - answer it directly
- Avoid marketing language or promotional content
- Be informative but brief - tooltips should be quick to read
- Use only words essential to the INTENT; avoid adding adverbs or qualifiers unless present in INTENT.
- No quotes around the text.

OUTPUT: Only the final text.
```

## Step 5: LLM API Call

**LLM Client sends to OpenAI**:
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "system",
      "content": "You are a Lemonade copywriter. Voice: friendly, clear, compassionate; airy, concise. Prefer contractions. Avoid emoji and filler. Avoid heavy insurance jargon; keep facts accurate. TRAITS: witty(0.2), empathetic(0.8), clear(1). LEXICON PREFER: AI-native, automation, community, Giveback, instant, transparent pricing, verify, secure, account, identity, help, protect LEXICON AVOID: ASAP, actuarial, adjuster, btw, claimant, emoji, lol, pls, policyholder, thx, u, spam, sell, third-party, marketing, ads GUARDS: - Return ONLY the final text. No prefaces like \"Here is...\", \"Here's...\", \"Below is...\". - No labels (Task:, Output:, Draft:). - No code fences or markdown headings."
    },
    {
      "role": "user", 
      "content": "TASK: Generate Microcopy UI CONTEXT: tooltip SURFACE: tooltip INTENT: why we need this info VOICE & EXAMPLES (for style, not content): • tip_password_1 — Use twelve characters with a number and symbol. • tip_address_1 — Start typing your street—pick a match from the list. • tip_upload_1 — Drag a file here or choose one from your device. REQUIREMENTS: - Concise (1 sentence max), helpful, contextual - Focus on the specific INTENT/question - answer it directly - Avoid marketing language or promotional content - Be informative but brief - tooltips should be quick to read - Use only words essential to the INTENT; avoid adding adverbs or qualifiers unless present in INTENT. - No quotes around the text. OUTPUT: Only the final text."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 100
}
```

## Step 6: LLM Response Processing

**Raw LLM Response**:
```
"We'll use it to verify your identity and keep your account secure"
```

**Util.js Output Shaping**:
```javascript
// Context-specific shaping for tooltip
if (uiContext === 'tooltip') {
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

// Final output: "We'll use it to verify your identity and keep your account secure"
```

## Step 7: TRS Scoring

**Guardrail.js performs quality assessment**:

### Rules Score (40 points):
```javascript
// Word count check for tooltip
if (uiContext === 'tooltip') {
  if (n > 15) s -= 10; // Tooltips: ≤15 words
}
// Result: 12 words ✓, Score: 40/40
```

### Lexicon Score (20 points):
```javascript
// Check for preferred words
const preferred = ["verify", "secure", "account", "identity", "help", "protect"];
// Found: "verify", "secure", "account", "identity" ✓
// Score: 20/20
```

### Critic Score (40 points):
```javascript
// AI-powered assessment
const rubric = `Evaluate helpfulness and informativeness. Tooltips should be 1-2 sentences that explain the purpose or benefit. Score 30-40 if the text is helpful and informative, even if it could be slightly more concise. Be very lenient.`;

// Result: 38/40 (helpful, direct answer, appropriate length)
```

**Final TRS Score**: 40 + 20 + 38 = **98 (PASS)**

## Step 8: Enhanced Retry & Improvement System

If the TRS score were below 80 (FAIL or BORDERLINE), the system would automatically attempt to improve the content. Here's how the retry mechanism works:

### Retry Logic Flow
```javascript
// From src/orchestrator.js
if (sBest.verdict === 'pass') {
  return { result: tBest, scoring: sBest }; // Success!
}

// Retry loop for FAIL/BORDERLINE cases
for (let i = 2; i <= MAX_TRIES && (sBest.verdict === 'fail' || sBest.verdict === 'borderline'); i++) {
  // Check time limit (5 seconds max)
  const elapsed = Date.now() - startedAt;
  if (elapsed > MAX_DURATION_MS) {
    push(`⏰ Time limit reached (${elapsed}ms), stopping after attempt #${i-1}.`);
    break;
  }
  
  // Generate smart feedback based on TRS breakdown
  const fixes = makeSmartFixes(type, sBest, params);
  
  // Create revision prompt with specific improvements
  const tplR = genTemplate_revise({
    type, traits, params,
    previous: tBest,
    fixes: fixes.join(' | '),
    scoring: sBest
  });
  
  // Generate improved content
  const gR = await generateText(tplR);
  const tR = enforceOutputShape(gR.text, type, params);
  const sR = score(tR, { type, ...params });
  
  // Always keep the best result (highest TRS)
  if (sR.trs > sBest.trs) {
    const improvement = sR.trs - sBest.trs;
    tBest = tR;
    sBest = sR;
    push(`📈 New best: TRS ${sR.trs} (improved by +${improvement} points)`);
  }
  
  if (sBest.verdict === 'pass') break; // Stop if we achieve PASS
}
```

### Smart Feedback Generation
```javascript
// From src/orchestrator.js - makeSmartFixes()
function makeSmartFixes(type, scoring, params) {
  const fixes = [];
  const { breakdown } = scoring;
  
  // Rules Score Issues (< 30/40)
  if (breakdown?.rules?.score < 30) {
    if (type === 'microcopy') {
      const uiContext = params?.uiContext || 'button';
      if (uiContext === 'tooltip') {
        fixes.push('Keep tooltip to 1 sentence max, ≤15 words, directly answer the user question.');
      }
      // ... other context-specific guidance
    }
  }
  
  // Lexicon Score Issues (< 15/20)
  if (breakdown?.lexicon?.score < 15) {
    fixes.push('Use more preferred brand words (instant, transparent pricing, automation).');
    fixes.push('Avoid banned words (ASAP, btw, lol, emoji, jargon).');
  }
  
  // Critic Score Issues (< 25/40)
  if (breakdown?.critic?.score < 25) {
    if (type === 'microcopy' && params?.uiContext === 'tooltip') {
      fixes.push('Make tooltip more helpful and informative. Focus on answering "why" or "what" directly.');
    }
  }
  
  return fixes;
}
```

### Example Retry Session
```
🧮 #1 TRS = 74 — rules 30/40, lexicon 20/20, critic 24/40 → BORDERLINE
🔁 Revise attempt #2 — fixes: Keep tooltip to 1 sentence max, ≤15 words, directly answer the user question. | Make tooltip more helpful and informative. Focus on answering "why" or "what" directly.
🧠 Generating (attempt #2)…
✅ Model #2 replied in ~320ms
🧮 #2 TRS = 82 — rules 35/40, lexicon 20/20, critic 27/40 → PASS
📈 New best: TRS 82 (improved by +8 points)
🏁 SUCCESS: Achieved PASS with TRS 82 (+8 from initial) in 2847ms.
```

## Step 9: Result Delivery

**Final Output Displayed**:
```
Generated Output: "We'll use it to verify your identity and keep your account secure"
TRS Score: 98 (pass)
Verdict: PASS
```

## Data Flow Summary

```
User Input → Policy Loading → Corpus Selection → Lexicon Loading → Prompt Construction → LLM API → Response Processing → Output Shaping → TRS Scoring → [Retry Loop if Needed] → Result Display
```

## Key Data Transformations

1. **Raw Parameters** → **Structured Request**
2. **Policy Rules** → **Content Requirements** 
3. **Corpus Examples** → **Style Guidance**
4. **Lexicon Preferences** → **Word Constraints**
5. **Template + Data** → **Final Prompt**
6. **LLM Response** → **Shaped Output**
7. **Quality Metrics** → **TRS Score**
8. **TRS Breakdown** → **Smart Feedback** (if retry needed)
9. **Feedback + Previous** → **Revision Prompt**
10. **Improved Content** → **Best Result Selection**

## Template Injection Points

The system uses several template injection points:

- **TRAITS**: `witty(${tw}), empathetic(${te}), clear(${tc})`
- **LEXICON**: `LEXICON PREFER: ${preferred.join(', ')}`
- **EXAMPLES**: `${refsBlock(refs)}`
- **REQUIREMENTS**: `${contextRequirements}`
- **INTENT**: `${params?.intent_canonical || params?.intent || 'generic'}`

This modular approach allows the system to dynamically generate contextually appropriate prompts while maintaining consistent structure and quality standards.
