// ui.js (Step 2)
// Renders strong-typed forms per content type and exposes validation helpers.
// Also provides a small logger (we’ll show the log only after Generate is clicked).

export const TYPES = ['microcopy', 'press_release', 'internal_comms'];
let _currentType = 'microcopy';

export function getActiveType() { return _currentType; } 
export function currentType(){ return _currentType; }
export function setActiveType(t){ _currentType = t; }

export function renderForm(type){
  const form = document.getElementById('params-form');
  form.innerHTML = '';

  if (type === 'microcopy') {
  form.append(
    rowSelect('UI context', 'uiContext', [
      {v:'button', l:'button'},
      {v:'error', l:'error'},
      {v:'tooltip', l:'tooltip'}
    ], true),
    rowInput('Intent', 'intent', 'e.g., pay_now', true)
  );
}

  if (type === 'press_release') {
    form.append(
      rowInput('Headline', 'headline', 'Short headline', true),
      rowInput('Key message', 'keyMessage', 'What’s the gist?', true),
      rowSelect('Audience', 'audience', [
        {v:'press', l:'press'},
        {v:'customer', l:'customer'},
        {v:'investor', l:'investor'}
      ], true)
    );
  }

  if (type === 'internal_comms') {
    form.append(
      rowInput('Title', 'title', 'Short subject', true),
      rowTextarea('Key update', 'keyUpdate', 'What\'s changing?', true),
      rowSelect('Channel', 'channel', [
        {v:'Slack', l:'Slack'}, {v:'Email', l:'Email'}
      ], true)
    );
  }
}

export function getParams() {
  const form = document.getElementById('params-form');
  const fields = [...form.querySelectorAll('[name]')];
  return Object.fromEntries(fields.map(el => [el.name, el.value.trim()]));
}

export function validate(type){
  const p = getParams();
  if (type === 'microcopy') {
    return !!(p.uiContext && p.intent);
  }
  if (type === 'press_release') {
    return !!(p.headline && p.keyMessage && p.audience);
  }
  if (type === 'internal_comms') {
    return !!(p.channel && p.title && p.keyUpdate);
  }
  return false;
}

export function onFormInput(cb){
  const form = document.getElementById('params-form');
  form.addEventListener('input', () => cb());
  form.addEventListener('change', () => cb());
}

// Simple log helper (panel initially hidden; main.js will unhide when Generate is pressed)
export function log(message){
  const panel = document.getElementById('log-panel');
  const line = document.createElement('div');
  line.className = 'log-line';
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${message}`;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}

// ---- small field factories ----
function row(labelText, el){
  const div = document.createElement('div');
  div.className = 'row';
  const label = document.createElement('label');
  label.textContent = labelText;
  div.append(label, el);
  return div;
}
function rowInput(label, name, placeholder, required=false, value=''){
  const el = document.createElement('input');
  el.type = 'text'; el.name = name; el.placeholder = placeholder; if (value) el.value = value;
  if (required) el.required = true;
  return row(label, el);
}
function rowTextarea(label, name, placeholder, required=false){
  const el = document.createElement('textarea');
  el.name = name; el.placeholder = placeholder;
  if (required) el.required = true;
  return row(label, el);
}
function rowSelect(label, name, options, required=false, defaultValue=null){
  const el = document.createElement('select');
  el.name = name;
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.v; opt.textContent = o.l;
    if (defaultValue && o.v === defaultValue) opt.selected = true;
    el.appendChild(opt);
  });
  if (required) el.required = true;
  return row(label, el);
}
