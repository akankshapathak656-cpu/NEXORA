// Shared app state. Replaces the legacy global `S` object in public/legacy/app.js.
// Same localStorage key and persisted fields as the legacy app, so saved browser data still loads.
import { useSyncExternalStore } from 'react';

export const STORAGE_KEY = 'nexora.v2';
export const SEED_VERSION = 3;

// Fields written to localStorage. Must match the legacy save() list exactly.
export const PERSISTED_KEYS = [
  'status', 'dup', 'jd', 'set', 'logs', 'auth', 'job', 'jobs', 'thm',
  'alt', 'chk', 'hr', 'fix', 'add', 'ob', 'rec', 'jdd', 'sl',
  'seedVersion', 'jobApiIds', 'candApiIds', 'poolOverviews', 'aiAnalyses',
];

// Defaults copied from the legacy `const S = {...}` initializer.
// Transient UI fields (pg, sel, q, ...) are never persisted.
export function defaultState() {
  return {
    pg: '', sel: 0, q: '', role: 'All', min: 0, sort: 'sc', page: 0,
    cmp: [], cm: 0, up: null, stage: -1, tpl: 0, mail: 'draft', body: null,
    logs: [], jd: {}, dup: {}, status: {},
    set: { mfa: true, mail: true, blind: false, ret: '12 months', name: 'Niharika Mittal', org: 'Demo Organization' },
    auth: 0, role_: 0, rc: null, tab: 'Overview', next: '', job: 0, jobs: [], thm: '',
    alt: {}, chk: {}, sf: 'All', nj: 0, dm: 0, autorun: 0, hr: {}, fix: {}, dir: 1,
    upS: 0, add: [], pd: null, pi: 0, ob: null, rec: {}, pdc: null, last: null,
    sl: { m: '5', c: '', v: 5 }, jdd: {},
    seedVersion: SEED_VERSION, aiConfig: null, jobApiIds: {}, candApiIds: {}, poolOverviews: {}, aiAnalyses: {}, poolProgress: null,
  };
}

// Reads saved data. Returns { data, hadSaved } where hadSaved mirrors the legacy LSRAW !== null check.
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = JSON.parse(raw || '{}');
    return { data: saved && typeof saved === 'object' ? saved : {}, hadSaved: raw !== null };
  } catch {
    return { data: {}, hadSaved: false };
  }
}

function initialState() {
  const base = defaultState();
  const { data, hadSaved } = loadSaved();
  const state = { ...base, ...data };
  // Onboarding: a browser with saved data but no onboarding record is a returning user, so the guide starts dismissed.
  if (!state.ob || typeof state.ob !== 'object') state.ob = { dis: hadSaved ? 1 : 0, done: {} };
  if (!state.ob.done || typeof state.ob.done !== 'object') state.ob.done = {};
  state.ob.dis = state.ob.dis ? 1 : 0;
  if (!state.rec || typeof state.rec !== 'object' || Array.isArray(state.rec)) state.rec = {};
  if (!state.jdd || typeof state.jdd !== 'object' || Array.isArray(state.jdd)) state.jdd = {};
  if (state.seedVersion !== SEED_VERSION) {
    state.seedVersion = SEED_VERSION;
    state.jobApiIds = {};
    state.candApiIds = {};
    state.poolOverviews = {};
    state.aiAnalyses = {};
  }
  if (!state.jobApiIds || typeof state.jobApiIds !== 'object' || Array.isArray(state.jobApiIds)) state.jobApiIds = {};
  if (!state.candApiIds || typeof state.candApiIds !== 'object' || Array.isArray(state.candApiIds)) state.candApiIds = {};
  if (!state.poolOverviews || typeof state.poolOverviews !== 'object' || Array.isArray(state.poolOverviews)) state.poolOverviews = {};
  if (!state.aiAnalyses || typeof state.aiAnalyses !== 'object' || Array.isArray(state.aiAnalyses)) state.aiAnalyses = {};
  state.aiConfig = null;
  state.poolProgress = null;
  state.pdc = null;
  state.last = null;
  return state;
}

let state = initialState();
const listeners = new Set();

function persist(next) {
  const out = {};
  for (const k of PERSISTED_KEYS) out[k] = next[k];
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(out)); } catch { /* storage full or blocked: keep running */ }
}

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Apply a partial update or an updater function. Persists and notifies subscribers.
// Use this for every change, e.g. setState({ job: 2 }) or setState(s => ({ ...s, sel: 4 })).
export function setState(update) {
  const patch = typeof update === 'function' ? update(state) : update;
  state = { ...state, ...patch };
  persist(state);
  listeners.forEach(l => l());
}

// Wipes saved data and restores defaults. Used by the "Remove all data" action.
export function resetState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  state = { ...defaultState(), ob: { dis: 0, done: {} } };
  listeners.forEach(l => l());
}

// React hook: re-renders when the selected slice changes (by reference).
export function useAppState(selector = s => s) {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}
