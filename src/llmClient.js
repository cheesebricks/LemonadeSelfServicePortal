// src/llmClient.js
// OpenAI-compatible client (Cloudflare Worker → Groq) with built-in throttling & 429 retry.
// Returns: { ok, text, latency_ms, error }

const DEFAULT_BASE = 'https://lemonade-portal-api.selfportal.workers.dev';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

// --- URL helpers ---
function getParam(name) {
  try {
    const usp = new URLSearchParams(location.search);
    const v = usp.get(name);
    return v && v.trim() ? v.trim() : null;
  } catch { return null; }
}
function resolveEndpoint() {
  const override = (getParam('endpoint') || DEFAULT_BASE || '').replace(/\/+$/,'');
  if (!override) return '';
  if (/\/v1(?:\/chat\/completions)?$/.test(override)) {
    return /\/chat\/completions$/.test(override) ? override : `${override}/chat/completions`;
  }
  return `${override}/v1/chat/completions`;
}
function resolveModel() { return getParam('model') || DEFAULT_MODEL; }
function nowMs() { return (typeof performance!=='undefined' && performance.now)? performance.now(): Date.now(); }

// --- Extract assistant text from OpenAI-ish JSON ---
function extractText(json) {
  try {
    const c = json?.choices?.[0];
    if (typeof c?.message?.content === 'string') return c.message.content;
    if (typeof c?.text === 'string') return c.text;
  } catch {}
  return '';
}

// --- Lightweight throttle: one request every MIN_INTERVAL_MS ---
const MIN_INTERVAL_MS = Number(getParam('min_interval_ms') || 900); // tune if needed
let _nextAvailableAt = 0;
async function throttle() {
  const wait = Math.max(0, _nextAvailableAt - nowMs());
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _nextAvailableAt = nowMs() + MIN_INTERVAL_MS;
}

// --- One retry on 429 with Retry-After support ---
async function postJSON(endpoint, body) {
  const t0 = nowMs();
  const doFetch = () => fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let res = await doFetch();
  if (res.status === 429) {
    // honor Retry-After if present, else back off 2s
    const ra = Number(res.headers.get('retry-after') || 0);
    const backoff = isFinite(ra) && ra > 0 ? ra * 1000 : 2000;
    await new Promise(r => setTimeout(r, backoff));
    res = await doFetch();
  }
  const latency_ms = Math.round(nowMs() - t0);
  return { res, latency_ms };
}

// Public API
export async function generateText({ system, user, max_tokens = 512, temperature = 0.3 }) {
  const endpoint = resolveEndpoint();
  const model = resolveModel();

  if (!endpoint) return { ok: false, error: 'No endpoint configured (?endpoint=...)' };
  if (!model) return { ok: false, error: 'No model configured (?model=...)' };

  // Helpful one-time console line
  try {
    if (!window.__LLM_LOGGED__) {
      console.log(`[llmClient] endpoint=${endpoint} model=${model} min_interval=${MIN_INTERVAL_MS}ms`);
      window.__LLM_LOGGED__ = true;
    }
  } catch {}

  const messages = [
    ...(system ? [{ role: 'system', content: String(system) }] : []),
    { role: 'user', content: String(user || '') },
  ];
  const body = { model, messages, max_tokens, temperature, stream: false };

  // throttle between calls
  await throttle();

  let res, latency_ms;
  try {
    const out = await postJSON(endpoint, body);
    res = out.res;
    latency_ms = out.latency_ms;
  } catch (e) {
    return { ok: false, error: `Network error: ${e?.message || e}` };
  }

  if (!res.ok) {
    let details = '';
    try { details = await res.text(); } catch {}
    const brief = details && details.length > 240 ? (details.slice(0, 240) + '…') : details;
    return { ok: false, latency_ms, error: `HTTP ${res.status} ${res.statusText}${brief ? ` — ${brief}` : ''}` };
  }

  let json;
  try { json = await res.json(); } catch (e) {
    return { ok: false, latency_ms, error: `Bad JSON from model: ${e?.message || e}` };
  }

  const text = extractText(json).trim();
  if (!text) return { ok: false, latency_ms, error: 'Empty response from model' };
  return { ok: true, text, latency_ms };
}

export function getLlmConfig() {
  return { endpoint: resolveEndpoint(), model: resolveModel(), min_interval_ms: MIN_INTERVAL_MS };
}
