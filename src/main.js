// src/main.js — streams logs, wires UI, saves run + feedback, updates KPI drawer

import * as ui from "./ui.js";
import { runPipeline } from "./orchestrator.js";
import { saveRun, saveFeedback, exportCSV } from "./feedbackDb.js";
import { refreshKpiPanel } from "./kpis.js";

let currentRunId = null; // link feedback to the latest run

function labelFor(type){
  if (type === 'microcopy') return 'Microcopy';
  if (type === 'press_release') return 'PR / External';
  if (type === 'internal_comms') return 'Internal Comms';
  return type;
}

function setVerdictUI(scoring){
  const pill = document.getElementById('verdict-pill');
  const line = document.getElementById('trs-breakdown');

  // Reset UI if no scoring
  if (!scoring || typeof scoring !== 'object') {
    pill.textContent = '—';
    pill.className = 'pill pill--idle';
    line.textContent = '';
    return;
  }

  // Verdict pill
  const v = String(scoring.verdict || '').toLowerCase();
  pill.textContent = v ? v.toUpperCase() : '—';
  pill.classList.remove('pill--idle','pill--pass','pill--borderline','pill--fail');
  pill.classList.add(
    v === 'pass' ? 'pill--pass' :
    v === 'borderline' ? 'pill--borderline' :
    v === 'fail' ? 'pill--fail' : 'pill--idle'
  );

  // Read from breakdown with backward-compat fallbacks
  const br = scoring.breakdown || {};
  const rules = br.rules?.score ?? scoring.rules?.score ?? 0;
  const lex   = br.lexicon?.score ?? scoring.lexicon?.score ?? 0;
  const crit  = br.critic?.score ?? scoring.critic?.score ?? 0;

  const trs = typeof scoring.trs === 'number' ? scoring.trs : (rules + lex + crit);

  line.textContent = `TRS ${trs} — rules ${rules}/40, lexicon ${lex}/20, critic ${crit}/40`;
}

async function doGenerate(){
  // clear + show log
  const logCardEl = document.getElementById('log-card');
  const logPanel = document.getElementById('log-panel');
  logPanel.innerHTML = '';
  logCardEl.classList.remove('hide');

  const type = ui.currentType();
  const params = ui.getParams();

  const report = await runPipeline({
    type,
    params,
    onLog: (line) => ui.log(line) // stream logs live
  });

  // Show results
  const resultsCardEl = document.getElementById('result-card');
  const resultTextEl = document.getElementById('result-text');
  resultsCardEl.classList.remove('hide');

  if (report.ok) {
    resultTextEl.value = report.result || '';
    setVerdictUI(report.scoring);

    // persist run event for KPIs
    const event = {
      content_type: type,
      attempt_count: (report.attempts || []).length,
      verdict_final: report.scoring?.verdict ?? null,
      trs_final: report.scoring?.trs ?? null,
      trs_initial: report.attempts?.[0]?.trs ?? null,
      trs_retry: report.attempts?.[1]?.trs ?? null,
      duration_ms: report.duration_ms ?? null,
      createdAt: new Date().toISOString()
    };
    currentRunId = await saveRun(event);
    await refreshKpiPanel();
  } else {
    resultTextEl.value = report.error || 'Something went wrong.';
    setVerdictUI(null);
  }
}

function wireValidation(){
  const btn = document.getElementById('generate-btn');
  btn.disabled = !ui.validate(ui.currentType());
  ui.onFormInput(() => {
    btn.disabled = !ui.validate(ui.currentType());
  });
}

function setupKpiDrawer(){
  const drawer = document.getElementById('kpi-drawer');
  const handle = document.getElementById('kpi-toggle');
  const close  = document.getElementById('kpi-close');

  const open = () => {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    handle.setAttribute('aria-expanded','true');
    refreshKpiPanel();
  };
  const shut = () => {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    handle.setAttribute('aria-expanded','false');
  };

  handle?.addEventListener('click', () => {
    if (drawer.classList.contains('open')) shut(); else open();
  });
  close?.addEventListener('click', shut);

  // Esc to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) shut();
  });
}

function init() {
  // default: microcopy
  ui.setActiveType('microcopy');
  document.getElementById('form-title').textContent = labelFor('microcopy');
  ui.renderForm('microcopy');

  // hide panels on load
  document.getElementById('log-card')?.classList.add('hide');
  document.getElementById('result-card')?.classList.add('hide');

  wireValidation();
  setupKpiDrawer();
  refreshKpiPanel(); // pre-fill if any data exists

  // type picker
  const picker = document.getElementById('type-picker');
  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-type]');
    if (!btn) return;
    const type = btn.dataset.type;
    if (!['microcopy','press_release','internal_comms'].includes(type)) return;

    [...picker.querySelectorAll('.seg')].forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    ui.setActiveType(type);
    document.getElementById('form-title').textContent = labelFor(type);
    ui.renderForm(type);
    wireValidation();

    document.getElementById('result-card')?.classList.add('hide');
    document.getElementById('log-card')?.classList.add('hide');
    document.getElementById('log-panel').innerHTML = '';
  });

  // Generate
  document.getElementById('generate-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    await doGenerate();
  });

  // Copy → treat as approval
  document.getElementById('copy-result-btn')?.addEventListener('click', async () => {
    const el = document.getElementById('result-text');
    if (!el) return;
    el.select();
    const ok = document.execCommand?.('copy');
    ui.toast ? ui.toast(ok ? 'Copied — you’re golden ✨' : 'Copy failed') : console.log('copied');
    if (currentRunId) {
      await saveFeedback({ runId: currentRunId, copy: true, thumbsUp: true, createdAt: new Date().toISOString() });
      await refreshKpiPanel();
    }
  });

  // Regenerate → treat as "not good enough"
  document.getElementById('regenerate-btn')?.addEventListener('click', async () => {
    if (currentRunId) {
      await saveFeedback({ runId: currentRunId, redo: true, thumbsUp: false, createdAt: new Date().toISOString() });
      await refreshKpiPanel();
    }
    await doGenerate();
  });

  // KPI exports
  document.getElementById('export-events')?.addEventListener('click', () => exportCSV('events'));
  document.getElementById('export-feedback')?.addEventListener('click', () => exportCSV('feedback'));
}

document.addEventListener('DOMContentLoaded', init);
