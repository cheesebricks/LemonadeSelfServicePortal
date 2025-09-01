# Detailed Flow Example: Press Release with Retry Mechanism

This document shows a complete end-to-end flow of a Press Release request that fails on the first attempt and goes through the retry mechanism to achieve a passing TRS score.

## User Request

**Content Type**: Press Release  
**Audience**: Customers  
**Headline**: "Lemonade Launches AI-Powered Pet Wellness Platform"  
**Key Message**: "New platform provides instant health assessments and personalized care recommendations for pets"

## Stage 1: Request Processing & Policy Loading

### 1.1 Policy Retrieval
```javascript
// From src/policy.js - getPolicy('press_release')
{
  typeName: "PR / External",
  required: ["headline", "key_message", "audience", "locale"],
  corpus: { 
    file: 'corpus/press_release_corpus.json', 
    matchOn: ["audience", "locale"], 
    refs: 3 
  },
  traits: { witty: 0.2, empathetic: 0.5, clear: 1 },
  prefer: ["transparent pricing", "customers", "community"],
  bannedWords: ["sign up", "join us", "try now", "buy now", "emoji", "lol", "btw", "pls", "u", "thx"],
  intentLexicon: {},
  thresholds: { trs_pass: 80, trs_border: 72 }
}
```

### 1.2 Corpus Reference Selection
```javascript
// From corpus/press_release_corpus.json - filtered by audience: "customer"
[
  {
    "id": "pr-update-customer-0001",
    "audience": "customer",
    "text": "We're rolling out faster claim decisions—powered by our AI—so more customers get paid in minutes, with zero paperwork.",
    "notes": "Customer-facing voice; short, benefit-led; no salesy hype."
  },
  {
    "id": "pr-update-customer-0002", 
    "audience": "customer",
    "text": "Pet Wellness is arriving in more EU countries, bringing simpler care and instant everything to your furry family.",
    "notes": "Friendly, plain-language customer announcement."
  },
  {
    "id": "pr-giveback-customer-0001",
    "audience": "customer", 
    "text": "Thanks to our community, we donated over $2M this year to nonprofits our customers care about—part of our annual Giveback.",
    "notes": "Customer‑friendly Giveback highlight."
  }
]
```

### 1.3 Lexicon Processing
```javascript
// Preferred words from corpus + policy
preferred: [
  "AI-native", "automation", "instant", "instant everything", 
  "transparent pricing", "Giveback", "community", "zero paperwork", 
  "digital insurer", "transparent pricing", "customers", "community"
]

// Banned words from policy
banned: ["sign up", "join us", "try now", "buy now", "emoji", "lol", "btw", "pls", "u", "thx"]
```

## Stage 2: Initial Generation

### 2.1 Prompt Construction
```javascript
// From src/prompts.js - genTemplate_generate()
{
  system: `You are a Lemonade copywriter. Voice: friendly, clear, compassionate; airy, concise.
Prefer contractions. Avoid emoji and filler. Avoid heavy insurance jargon; keep facts accurate.
TRAITS: witty(0.2), empathetic(0.5), clear(1).
LEXICON PREFER: AI-native, automation, instant, instant everything, transparent pricing, Giveback, community, zero paperwork, digital insurer, transparent pricing, customers, community
LEXICON AVOID: sign up, join us, try now, buy now, emoji, lol, btw, pls, u, thx
GUARDS:
- Return ONLY the final text. No prefaces like "Here is...", "Here's...", "Below is...", "Internal comms announcement:", "Press release:".
- No labels (Task:, Output:, Draft:).
- No code fences or markdown headings.`,

  user: `TASK: Press Release paragraph (lede/body).
AUDIENCE: customer
HEADLINE: Lemonade Launches AI-Powered Pet Wellness Platform
KEY MESSAGE: New platform provides instant health assessments and personalized care recommendations for pets
VOICE & EXAMPLES (for style, not content):
• pr-update-customer-0001 — We're rolling out faster claim decisions—powered by our AI—so more customers get paid in minutes, with zero paperwork.
• pr-update-customer-0002 — Pet Wellness is arriving in more EU countries, bringing simpler care and instant everything to your furry family.
• pr-giveback-customer-0001 — Thanks to our community, we donated over $2M this year to nonprofits our customers care about—part of our annual Giveback.
REQUIREMENTS:
- Factual tone; avoid consumer CTA language.
- CRITICAL: You MUST include the specific content from HEADLINE and KEY MESSAGE in your response.
- The response should directly address and incorporate the headline and key message details.
- Do NOT generate generic insurance content - focus on the specific announcement.
- Include at least 2-3 keywords from HEADLINE/KEY MESSAGE in the first sentence.
GUARDS:
- Return ONLY the final text. No prefaces like "Here is...", "Here's...", "Below is...", "Internal comms announcement:", "Press release:".
- No labels (Task:, Output:, Draft:).
- No code fences or markdown headings.
OUTPUT: Only the final text.`
}
```

### 2.2 LLM Response
```javascript
// Generated content (FAILS TRS)
"Lemonade is excited to announce the launch of our new AI-powered pet wellness platform. This innovative solution brings instant health assessments and personalized care recommendations to pet owners everywhere."
```

### 2.3 TRS Scoring (Attempt #1)
```javascript
// From src/guardrail.js - rulesScore()
{
  rules: 25, // -15 for insufficient keywords (only 1 match: "pet")
  lexicon: 20, // +20 for using preferred words like "AI-powered", "instant"
  critic: 28, // -12 for generic content and insufficient specificity
  total: 73, // BORDERLINE (below 80 threshold)
  verdict: "borderline"
}
```

**Detailed TRS Breakdown:**
- **Rules (40 max)**: 25/40
  - Base: 40
  - Keyword penalty: -15 (only 1 keyword match, need 2-3)
  - Generic content penalty: 0 (no generic phrases detected)
- **Lexicon (20 max)**: 20/20
  - Preferred words: +20 (AI-powered, instant, personalized)
  - Banned words: 0 (no banned words used)
- **Critic (40 max)**: 28/40
  - Professional tone: +8
  - Content relevance: +8 (somewhat relevant but generic)
  - Specificity: +12 (lacks specific details from headline/key message)

## Stage 3: Retry Mechanism Activation

### 3.1 Smart Feedback Generation
```javascript
// From src/orchestrator.js - makeSmartFixes()
{
  fixes: [
    "Include more specific keywords from headline: 'AI-Powered Pet Wellness Platform'",
    "Incorporate key message details: 'instant health assessments' and 'personalized care recommendations'",
    "Make content more specific to the actual announcement rather than generic company messaging",
    "Focus on the concrete benefits and features mentioned in the request"
  ],
  critical: "Content must directly address the specific pet wellness platform launch, not generic company updates"
}
```

### 3.2 Revision Prompt Construction
```javascript
// From src/prompts.js - genTemplate_revise()
{
  system: `You are a Lemonade copywriter. Voice: friendly, clear, compassionate; airy, concise.
Prefer contractions. Avoid emoji and filler. Avoid heavy insurance jargon; keep facts accurate.
TRAITS: witty(0.2), empathetic(0.5), clear(1).
LEXICON PREFER: AI-native, automation, instant, instant everything, transparent pricing, Giveback, community, zero paperwork, digital insurer, transparent pricing, customers, community
LEXICON AVOID: sign up, join us, try now, buy now, emoji, lol, btw, pls, u, thx
GUARDS:
- Return ONLY the final text. No prefaces like "Here is...", "Here's...", "Below is...", "Internal comms announcement:", "Press release:".
- No labels (Task:, Output:, Draft:).
- No code fences or markdown headings.`,

  user: `TASK: Revise the text to improve TRS while maintaining relevance to the original request.
TYPE: Press Release
TYPE: Press Release
FORMAT RULES:
- CRITICAL: Maintain the specific content from HEADLINE and KEY MESSAGE
- Do NOT drift away from the original announcement details
- Keep factual tone, avoid generic insurance marketing language
- Ensure the response directly addresses the specific news being announced

ORIGINAL REQUEST:
HEADLINE: Lemonade Launches AI-Powered Pet Wellness Platform
KEY MESSAGE: New platform provides instant health assessments and personalized care recommendations for pets
AUDIENCE: customer

CURRENT TEXT TO IMPROVE:
"""
Lemonade is excited to announce the launch of our new AI-powered pet wellness platform. This innovative solution brings instant health assessments and personalized care recommendations to pet owners everywhere.
"""

FIXES TO APPLY:
  1. Include more specific keywords from headline: 'AI-Powered Pet Wellness Platform'
  2. Incorporate key message details: 'instant health assessments' and 'personalized care recommendations'
  3. Make content more specific to the actual announcement rather than generic company messaging
  4. Focus on the concrete benefits and features mentioned in the request

CRITICAL INSTRUCTIONS:
- IMPROVE the existing text based on the TRS feedback
- Do NOT change the topic or subject matter
- Maintain relevance to the original request (see above)
- Keep the same core message but fix the specific issues identified
- Do NOT generate completely new content
- Do NOT generate content for multiple channels

VOICE & EXAMPLES (for style, not content):
• pr-update-customer-0001 — We're rolling out faster claim decisions—powered by our AI—so more customers get paid in minutes, with zero paperwork.
• pr-update-customer-0002 — Pet Wellness is arriving in more EU countries, bringing simpler care and instant everything to your furry family.
• pr-giveback-customer-0001 — Thanks to our community, we donated over $2M this year to nonprofits our customers care about—part of our annual Giveback.
OUTPUT: Only the final text (no preface, no labels, no fences).`
}
```

### 3.3 LLM Revision Response
```javascript
// Revised content (IMPROVED)
"Lemonade launches its AI-Powered Pet Wellness Platform, delivering instant health assessments and personalized care recommendations for pets. The platform uses advanced AI to provide immediate insights into pet health and wellness needs."
```

### 3.4 TRS Scoring (Attempt #2)
```javascript
{
  rules: 40, // +15 improvement: now has 3+ keyword matches
  lexicon: 20, // +0: maintained preferred word usage
  critic: 36, // +8 improvement: more specific and relevant
  total: 96, // PASS (above 80 threshold)
  verdict: "pass"
}
```

**Detailed TRS Breakdown:**
- **Rules (40 max)**: 40/40 ✅
  - Base: 40
  - Keyword penalty: 0 (now has 3+ matches: "AI-Powered", "Pet", "Wellness", "Platform", "instant", "health", "assessments", "personalized", "care", "recommendations")
  - Generic content penalty: 0 (no generic phrases)
- **Lexicon (20 max)**: 20/20 ✅
  - Preferred words: +20 (AI-Powered, instant, personalized, platform)
  - Banned words: 0 (no banned words)
- **Critic (40 max)**: 36/40 ✅
  - Professional tone: +10
  - Content relevance: +14 (highly relevant to specific announcement)
  - Specificity: +12 (includes concrete details and features)

## Stage 4: Final Result

### 4.1 Best Result Selection
```javascript
// From src/orchestrator.js - tracks best TRS across attempts
{
  attempt: 2,
  trs: 96,
  verdict: "pass",
  text: "Lemonade launches its AI-Powered Pet Wellness Platform, delivering instant health assessments and personalized care recommendations for pets. The platform uses advanced AI to provide immediate insights into pet health and wellness needs.",
  latency_ms: 2847,
  total_attempts: 2
}
```

### 4.2 Performance Metrics
```javascript
{
  total_duration_ms: 2847,
  attempts_made: 2,
  improvement: "+23 points",
  final_verdict: "PASS",
  success_rate: "100% (2/2 attempts successful)"
}
```

## Key Insights from This Flow

### 1. **Policy-Driven Reference Selection**
The system automatically selected 3 customer-focused examples from the corpus based on the audience parameter, ensuring the generated content matches the expected tone and style.

### 2. **Structured Prompt Engineering**
The prompt template systematically combines:
- System instructions (voice, traits, lexicon)
- Task-specific requirements
- Corpus examples for style guidance
- Explicit guards against unwanted output formats

### 3. **TRS Scoring Precision**
The scoring system identified specific issues:
- **Rules**: Keyword matching requirements (need 2-3 from headline/key message)
- **Lexicon**: Preferred/banned word usage
- **Critic**: Content relevance and specificity evaluation

### 4. **Smart Retry Logic**
The retry mechanism:
- Generated specific, actionable feedback
- Maintained context from the original request
- Prevented content drift through explicit instructions
- Achieved significant improvement (+23 points) in just one revision

### 5. **Content Quality Improvement**
The revision successfully:
- Increased keyword inclusion from 1 to 8+ matches
- Enhanced specificity by focusing on concrete platform features
- Maintained professional tone while improving relevance
- Achieved passing TRS score through targeted improvements

This flow demonstrates how the system's structured approach to content generation, combined with intelligent feedback and retry mechanisms, can transform a borderline result into a high-quality, passing output.
