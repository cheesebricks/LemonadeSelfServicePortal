// src/kpis.js — KPI drawer + CSV + Reset KPIs + FAB-style feedback (hover-only, non-blocking)
// - Thumbs live in a small corner FAB, not a full overlay
// - Downvote shows a popover near the FAB
// - Auto-resize <textarea> results so the page scrolls, not the textarea

import { getRecentEvents, getRecentFeedback, exportCSV, resetAll, saveFeedback } from './feedbackDb.js';

const fmtPct = (n) => `${n}%`;
const avg = (arr) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const pct = (n,d) => d ? Math.round((n/d)*100) : 0;
const fmtS = (ms) => (ms/1000).toFixed(1)+'s';

// ---------- Schema normalizers ----------
function normEvent(e = {}) {
  const verdict = (e.verdict_final ?? e.verdict ?? '').toLowerCase();
  const type = e.content_type ?? e.type ?? 'unknown';
  const attempts = e.attempt_count ?? e.attempts ?? 1;
  const duration = e.duration_ms ?? e.durationMs ?? e.duration ?? 0;
  const id = e.id ?? e.runId ?? e.run_id ?? null;
  const createdAt = e.createdAt ?? e.timestamp ?? e.time ?? '';
  return { id, verdict, type, attempts, duration, createdAt };
}
function normFeedback(f = {}) {
  let action = f.action;
  if (!action) { if (f.copy) action = 'copy'; else if (f.redo) action = 'redo'; }
  const runId = f.runId ?? f.run_id ?? f.id ?? null;
  const createdAt = f.createdAt ?? f.timestamp ?? f.time ?? '';
  return { runId, action: String(action || '').toLowerCase(), createdAt };
}

// ---------- Metrics compute (first-action North Star) ----------
function compute(eventsRaw, feedbackRaw){
  const events = eventsRaw.map(normEvent);

  // first-action-per-run for NS
  const earliest = new Map();
  feedbackRaw.map(normFeedback).forEach((f, idx) => {
    if (!f.runId || !f.action) return;
    const prev = earliest.get(f.runId);
    const key = f.createdAt || '';
    if (!prev) earliest.set(f.runId, { action: f.action, createdAt: key, idx });
    else {
      const earlier = (key && (!prev.createdAt || key < prev.createdAt)) || (!key && idx < prev.idx);
      if (earlier) earliest.set(f.runId, { action: f.action, createdAt: key, idx });
    }
  });

  const runIdsWithFb = Array.from(earliest.keys());
  const nsNumerator = runIdsWithFb.filter(id => earliest.get(id).action === 'copy').length;
  const northStar = pct(nsNumerator, runIdsWithFb.length);

  const total = events.length;
  const pass = events.filter(e => e.verdict === 'pass').length;
  const border = events.filter(e => e.verdict === 'borderline').length;
  const fail = total - pass - border;
  const trsPassRate = pct(pass + border, total);

  const avgAll = avg(events.map(e => e.duration || 0));
  const usable = events.filter(e => e.verdict !== 'fail');
  const avgUsable = avg(usable.map(e => e.duration || 0));
  const borderRetry = pct(usable.filter(e => (e.attempts || 1) > 1).length, usable.length || 1);

  const byType = {};
  events.forEach(e => {
    const t = e.type || 'unknown';
    byType[t] ||= { total:0, pass:0, borderline:0, fail:0 };
    byType[t].total++;
    if (e.verdict === 'pass') byType[t].pass++;
    else if (e.verdict === 'borderline') byType[t].borderline++;
    else byType[t].fail++;
  });

  return { total, pass, border, fail, northStar, trsPassRate, avgAll, avgUsable, borderRetry, byType };
}

// ---------- Render helpers ----------
function setMulti(ids, text) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = text; }); }

// ---------- Public API ----------
export async function refreshKpiPanel(){
  const [events, feedback] = await Promise.all([ getRecentEvents(200), getRecentFeedback(400) ]);
  const k = compute(events, feedback);

  setMulti(['kpi-north-star','kpi-northstar'], fmtPct(k.northStar));
  setMulti(['kpi-trs-pass','kpi-passrate'], fmtPct(k.trsPassRate));
  setMulti(['kpi-avg-all','kpi-avgall'], fmtS(k.avgAll));
  setMulti(['kpi-avg-usable','kpi-avgusable'], isFinite(k.avgUsable) ? fmtS(k.avgUsable) : '—');
  setMulti(['kpi-borderline-retry','kpi-border-retry'], isFinite(k.borderRetry) ? fmtPct(k.borderRetry) : '—');
  setMulti(['kpi-counts','kpi-runs'], `P${k.pass} / B${k.border} / F${k.fail}  (n=${k.total})`);

  const list = document.getElementById('kpi-type-breakdown');
  if (list) {
    list.innerHTML = '';
    const names = { microcopy:'Microcopy', internal_comms:'Internal', press_release:'PR' };
    Object.entries(k.byType).forEach(([type, d]) => {
      const usable = d.pass + d.borderline;
      const rate = d.total ? Math.round((usable/d.total)*100) : 0;
      const row = document.createElement('div');
      row.textContent = `${names[type] || type}: ${rate}% (P${d.pass}/B${d.borderline}/F${d.fail}, n=${d.total})`;
      list.appendChild(row);
    });
  }

  wireExportsAndReset();
  ensureThumbFab();        // non-blocking feedback UI
  autoResizeResultArea();  // expand textareas so page scrolls
}

function wireExportsAndReset() {
  const wireOnce = (id, handler) => {
    const btn = document.getElementById(id);
    if (btn && !btn.__WIRED__) { btn.addEventListener('click', handler); btn.__WIRED__ = true; }
  };

  // CSV exports
  wireOnce('export-events', () => exportCSV('events'));
  wireOnce('export-feedback', () => exportCSV('feedback'));

  // Reset button creation
  const exportBtn = document.getElementById('export-events');
  if (exportBtn && !document.getElementById('reset-kpis')) {
    const reset = document.createElement('button');
    reset.id = 'reset-kpis';
    reset.textContent = 'Reset KPIs';
    reset.style.marginLeft = '8px';
    reset.className = 'btn btn--ghost';
    exportBtn.parentElement?.insertBefore(reset, exportBtn.nextSibling);
  }

  // Reset handler with immediate UI clear
  const resetBtn = document.getElementById('reset-kpis');
  if (resetBtn && !resetBtn.__WIRED__) {
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset KPIs?\nThis clears Events and Feedback for this site.')) return;
      window.__KPI_RESETTING = true;
      setBoardCleared(true);
      disableButtonsDuringReset(true);
      try {
        const res = await resetAll();
        alert(`KPIs reset (${res.mode}).`);
      } catch (e) {
        alert('Reset failed: ' + (e?.message || e));
      } finally {
        window.__KPI_RESETTING = false;
        disableButtonsDuringReset(false);
        await refreshKpiPanel();
      }
    });
    resetBtn.__WIRED__ = true;
  }
}

function setBoardCleared(isResetting) {
  const loading = isResetting ? 'Resetting…' : '—';
  setMulti(['kpi-north-star','kpi-northstar'], loading);
  setMulti(['kpi-trs-pass','kpi-passrate'], loading);
  setMulti(['kpi-avg-all','kpi-avgall'], loading);
  setMulti(['kpi-avg-usable','kpi-avgusable'], loading);
  setMulti(['kpi-borderline-retry','kpi-border-retry'], loading);
  setMulti(['kpi-counts','kpi-runs'], 'P0 / B0 / F0  (n=0)');
  const list = document.getElementById('kpi-type-breakdown');
  if (list) list.innerHTML = '';
}

function disableButtonsDuringReset(disabled) {
  ['export-events','export-feedback','reset-kpis'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !!disabled;
  });
}

// ---------- Result auto-resize so the PAGE scrolls ----------
const RESULT_SELECTORS = [
  '#result-textarea', '#result-output', '#result', '#output', 'textarea.result', '.result-text'
];

function getResultEl() {
  for (const sel of RESULT_SELECTORS) {
    const n = document.querySelector(sel);
    if (n) return n;
  }
  return null;
}

function autoResizeResultArea() {
  const el = getResultEl();
  if (!el) return;

  if (el.tagName === 'TEXTAREA') {
    const ta = /** @type {HTMLTextAreaElement} */ (el);
    const resize = () => {
      ta.style.height = 'auto';
      ta.style.overflowY = 'hidden';
      ta.style.height = (ta.scrollHeight + 2) + 'px';
    };
    if (!ta.__AUTOSIZE__) {
      ta.__AUTOSIZE__ = true;
      ta.addEventListener('input', resize);
      // when fonts load or content injected
      window.addEventListener('load', resize);
      setTimeout(resize, 30);
    }
    // also resize if content changed programmatically
    resize();
  } else {
    // Non-textarea: ensure it wraps and grows
    el.style.whiteSpace = 'pre-wrap';
  }
}

// ---------- Feedback FAB (hover-only, non-blocking) ----------
const ISSUE_OPTIONS = [
  ['irrelevant', 'Irrelevant to inputs'],
  ['wrong_tone', 'Wrong tone / voice'],
  ['too_long', 'Too long'],
  ['too_short', 'Too short'],
  ['grammar', 'Grammar / clarity'],
  ['lexicon', 'Lexicon mismatch'],
  ['ignored_inputs', 'Ignored Title/Key Update/Intent'],
  ['hallucination', 'Made-up product/claim'],
  ['other', 'Other…']
];

function textOf(el) { return ('value' in el) ? String(el.value || '') : String(el.textContent || ''); }
function hash(str) { let h = 5381; for (let i=0;i<str.length;i++) { h = ((h<<5)+h) ^ str.charCodeAt(i); } return (h>>>0).toString(16); }
function getActiveRunId() { if (typeof window !== 'undefined' && window.__LAST_RUN_ID != null) return window.__LAST_RUN_ID; return null; }

function ensureThumbFab() {
  // inject CSS once
  if (!document.getElementById('thumbs-style')) {
    const css = `
      .thumbs-wrap { position: relative; }
      /* FAB anchored bottom-right; hover to show */
      .thumbs-fab {
        position: absolute; right: 10px; bottom: 10px; display: none;
        align-items: center; gap: 6px; background: #fff; border: 1px solid #eee;
        border-radius: 999px; padding: 6px 8px; box-shadow: 0 4px 16px rgba(0,0,0,.08);
        z-index: 30; pointer-events: none;  /* let page scroll through */
      }
      .thumbs-wrap:hover .thumbs-fab,
      .thumbs-wrap:focus-within .thumbs-fab { display: inline-flex; }
      .thumbs-wrap[data-feedback-locked="1"] .thumbs-fab { display: none !important; }

      .thumb-btn {
        display: inline-flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; border-radius: 999px; border: 1px solid #eee;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; user-select: none;
        background: #fff; font-size: 18px; transition: transform .08s ease;
        pointer-events: auto;   /* clickable even though container ignores events */
      }
      .thumb-btn:active { transform: scale(0.96); }
      .thumb-btn:focus { outline: 2px solid #FF0083; outline-offset: 2px; }

      /* Downvote popover near FAB */
      .thumb-pop {
        position: absolute; right: 10px; bottom: 56px; z-index: 40;
        background: #fff; border: 1px solid #eee; border-radius: 12px;
        box-shadow: 0 10px 24px rgba(0,0,0,0.10);
        width: min(440px, 92vw); max-height: 50vh; overflow: auto; padding: 10px;
      }
      .thumb-issues {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 8px;
      }
      .thumb-issue {
        padding: 8px 10px; background: #fff; border: 1px solid #eee; border-radius: 10px;
        cursor: pointer; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      }

      @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); } 100% { box-shadow: 0 0 0 16px rgba(16,185,129,0); } }
      @keyframes pulse-red   { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.6); }  100% { box-shadow: 0 0 0 16px rgba(239,68,68,0); } }
      .pulse-green { animation: pulse-green 600ms ease-out; }
      .pulse-red { animation: pulse-red 600ms ease-out; }
    `.trim();
    const style = document.createElement('style');
    style.id = 'thumbs-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // find result element and wrap once
  let el = getResultEl();
  if (!el) return;
  if (el.closest('.thumbs-wrap')) return;

  // auto-resize immediately in case it's a <textarea>
  autoResizeResultArea();

  const wrap = document.createElement('div');
  wrap.className = 'thumbs-wrap';
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);

  // FAB container
  const fab = document.createElement('div');
  fab.className = 'thumbs-fab';
  wrap.appendChild(fab);

  // Buttons
  const up = document.createElement('button');
  up.className = 'thumb-btn'; up.title = 'Thumb up'; up.setAttribute('aria-label', 'Thumb up'); up.textContent = '👍';

  const down = document.createElement('button');
  down.className = 'thumb-btn'; down.title = 'Thumb down'; down.setAttribute('aria-label', 'Thumb down'); down.textContent = '👎';

  fab.appendChild(up); fab.appendChild(down);

  // State + helpers
  const state = { lastHash: hash(textOf(el)) };
  const lockForThisResult = () => { wrap.dataset.feedbackLocked = '1'; wrap.dataset.lockHash = state.lastHash; };
  const unlockForNewResult = () => { delete wrap.dataset.feedbackLocked; delete wrap.dataset.lockHash; };

  const pulse = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  // Popover builder
  let pop = null;
  const closePop = () => { if (pop && pop.parentNode) pop.parentNode.removeChild(pop); pop = null; };

  function openDownvotePopover() {
    closePop();
    pop = document.createElement('div');
    pop.className = 'thumb-pop';
    const grid = document.createElement('div');
    grid.className = 'thumb-issues';

    ISSUE_OPTIONS.forEach(([key, label]) => {
      const b = document.createElement('button');
      b.className = 'thumb-issue';
      b.textContent = label;
      b.addEventListener('click', async () => {
        let note = '';
        if (key === 'other') note = prompt('Tell us briefly what went wrong (optional):') || '';
        const runId = getActiveRunId();
        await saveFeedback({ runId, action: 'redo', source: 'thumbs', reason: key, note, createdAt: new Date().toISOString() }).catch(()=>{});
        pulse(down, 'pulse-red');
        lockForThisResult();
        closePop();
        setTimeout(refreshKpiPanel, 80);
      });
      grid.appendChild(b);
    });

    pop.appendChild(grid);
    wrap.appendChild(pop);

    // Close on outside click
    setTimeout(() => {
      const onDocClick = (e) => {
        if (!pop) return document.removeEventListener('mousedown', onDocClick);
        if (!pop.contains(e.target) && !fab.contains(e.target)) {
          closePop();
          document.removeEventListener('mousedown', onDocClick);
        }
      };
      document.addEventListener('mousedown', onDocClick);
    }, 0);
  }

  // Wire buttons (note: FAB container has pointer-events:none; buttons override to auto)
  up.addEventListener('click', async (e) => {
    e.stopPropagation();
    pulse(up, 'pulse-green');
    const runId = getActiveRunId();
    await saveFeedback({ runId, action: 'copy', source: 'thumbs', createdAt: new Date().toISOString() }).catch(()=>{});
    try { await navigator.clipboard.writeText(textOf(el)); } catch {}
    lockForThisResult();
    closePop();
    setTimeout(refreshKpiPanel, 80);
  });

  down.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wrap.dataset.feedbackLocked === '1') return;
    openDownvotePopover();
  });

  // Poll for content change to unlock for next result + keep textarea sized
  setInterval(() => {
    const val = textOf(el);
    const h = hash(val);
    if (h !== state.lastHash) {
      state.lastHash = h;
      unlockForNewResult();
      closePop();
      // resize if textarea
      if (el.tagName === 'TEXTAREA') {
        const ta = el;
        ta.style.height = 'auto';
        ta.style.overflowY = 'hidden';
        ta.style.height = (ta.scrollHeight + 2) + 'px';
      }
    }
  }, 400);
}

// Populate once on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { refreshKpiPanel().catch(()=>{}); }, 300);
});
