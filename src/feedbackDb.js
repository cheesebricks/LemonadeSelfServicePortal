// src/feedbackDb.js — IndexedDB (events, feedback) + CSV + robust reset + "recent" helpers
// Adds: saveRun sets window.__LAST_RUN_ID so thumbs can attach feedback to the correct run.

const DB_NAME = 'lemonade_demo_v1'; // keep stable across versions
const DB_VERSION = 1;
const STORE_EVENTS = 'events';
const STORE_FEEDBACK = 'feedback';

let dbConn = null;

// ---------- Core IDB helpers ----------
function openDb() {
  if (dbConn) return Promise.resolve(dbConn);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const s = db.createObjectStore(STORE_EVENTS, { keyPath: 'id', autoIncrement: true });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FEEDBACK)) {
        const s = db.createObjectStore(STORE_FEEDBACK, { keyPath: 'id', autoIncrement: true });
        s.createIndex('runId', 'runId', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => { dbConn = req.result; resolve(dbConn); };
    req.onerror = () => reject(req.error);
  });
}

function txPromise(storeName, mode, op) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    Promise.resolve(op(store)).then(resolve, reject);
    tx.onerror = () => reject(tx.error);
  }));
}

// Wraps
function storeGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
function storeAdd(store, value) {
  return new Promise((resolve, reject) => {
    const req = store.add(value);
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = () => reject(req.error);
  });
}
function storeClear(store) {
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------- Public API ----------
export async function saveRun(event) {
  const now = new Date().toISOString();
  const e = { createdAt: now, ...event };
  const id = await txPromise(STORE_EVENTS, 'readwrite', (s) => storeAdd(s, e));
  // expose the last run id for UI/overlay to attach feedback reliably
  try { window.__LAST_RUN_ID = id; } catch {}
  return id;
}

export async function saveFeedback(feedback) {
  const now = new Date().toISOString();
  const f = { createdAt: now, ...feedback };
  return txPromise(STORE_FEEDBACK, 'readwrite', (s) => storeAdd(s, f));
}

export async function getRecentEvents(n = 50) {
  const rows = await txPromise(STORE_EVENTS, 'readonly', (s) => storeGetAll(s));
  return (Array.isArray(rows) ? rows : []).sort(
    (a, b) => (b?.createdAt || '').localeCompare(a?.createdAt || '')
  ).slice(0, n);
}

export async function getRecentFeedback(n = 200) {
  const rows = await txPromise(STORE_FEEDBACK, 'readonly', (s) => storeGetAll(s));
  return (Array.isArray(rows) ? rows : []).sort(
    (a, b) => (b?.createdAt || '').localeCompare(a?.createdAt || '')
  ).slice(0, n);
}

// Robust reset: try deleteDatabase; if blocked/timeout, fall back to clearing stores
export async function resetAll() {
  try { if (dbConn) { dbConn.close(); dbConn = null; } } catch {}

  const outcome = await new Promise((resolve) => {
    let done = false;
    const finish = (payload) => { if (!done) { done = true; resolve(payload); } };
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => finish({ mode: 'deleted', ok: true });
    req.onerror = () => finish({ mode: 'deleted', ok: false, error: req.error });
    req.onblocked = () => finish({ mode: 'blocked' });
    setTimeout(() => finish({ mode: 'timeout' }), 600);
  });

  if (outcome.ok) return outcome;

  const db = await openDb();
  await Promise.allSettled([
    new Promise((res, rej) => {
      const tx = db.transaction(STORE_EVENTS, 'readwrite');
      storeClear(tx.objectStore(STORE_EVENTS)).then(res, rej);
    }),
    new Promise((res, rej) => {
      const tx = db.transaction(STORE_FEEDBACK, 'readwrite');
      storeClear(tx.objectStore(STORE_FEEDBACK)).then(res, rej);
    })
  ]);
  return { ok: true, mode: 'cleared' };
}

// CSV export: 'events' | 'feedback'
export async function exportCSV(which = 'events') {
  const storeName = which === 'feedback' ? STORE_FEEDBACK : STORE_EVENTS;
  const rows = await txPromise(storeName, 'readonly', (s) => storeGetAll(s));
  if (!rows.length) {
    alert(`No data in ${which}.`);
    return;
  }
  const headers = Array.from(rows.reduce((set, r) => {
    Object.keys(r).forEach(k => set.add(k));
    return set;
  }, new Set()));

  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => esc(r[h])).join(','))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `${which}-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
