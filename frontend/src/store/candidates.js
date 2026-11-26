import { useAppState } from './state.js';
// Builds the full candidate list from the built-in samples plus the user's saved edits (state.fix)
// and added candidates (state.add). Port of legacy app.js lines 37-41. Samples are copied, never mutated.
import { SAMPLE_CANDIDATES, NS } from '../data/samples.js';
import { JOBS } from '../data/jobs.js';
import { clean, parseEx } from '../lib/text.js';
import { anOk } from '../lib/resume.js';

export function buildCandidates(fix = {}, add = []) {
  const samples = SAMPLE_CANDIDATES.map(s => ({ ...s, sk: [...s.sk], an: null }));
  // Saved edits to sample records. The saved analysis is restored too: legacy saved it but never reloaded it (fix, see report).
  for (const k of Object.keys(fix || {})) {
    const c = samples[k], f = fix[k];
    if (!c || !f) continue;
    c.real = clean(f.n) || c.real;
    c.n = c.real;
    c.ed = clean(f.ed) || c.ed;
    const x = parseEx(f.ex);
    if (x) c.ex = x.ex;
    c.r = clean(f.r) || c.r;
    c.pr = clean(f.pr) || c.pr;
    if (Array.isArray(f.sk) && f.sk.length) c.sk = [...new Set(f.sk.map(clean).filter(Boolean))];
    c.an = anOk(f.an);
  }
  const added = (Array.isArray(add) ? add : [])
    .filter(f => f && typeof f.n === 'string')
    .map((f, i) => ({
      id: NS + i,
      real: clean(f.n) || 'Unnamed candidate',
      n: clean(f.n) || 'Unnamed candidate',
      r: clean(f.r) || JOBS[0].t,
      st: 'New',
      sk: [...new Set((Array.isArray(f.sk) ? f.sk : []).map(clean).filter(Boolean))],
      ex: (parseEx(f.ex) || { ex: 'Fresher' }).ex,
      ed: clean(f.ed) || 'Not provided',
      pr: clean(f.pr) || 'Not provided',
      file: clean(f.file),
      em: clean(f.em),
      ph: clean(f.ph),
      lo: clean(f.lo),
      cert: (Array.isArray(f.cert) ? f.cert : []).map(clean).filter(Boolean).slice(0, 8),
      wk: (Array.isArray(f.wk) ? f.wk : []).map(clean).filter(Boolean).slice(0, 6),
      an: anOk(f.an),
      apiId: Number(f.apiId) || null,
    }));
  return [...samples, ...added];
}

// Memoised by input identity, so components re-render only when the saved edits or additions change.
let cache = { fix: null, add: null, list: [] };
export function candidatesFromState(state) {
  if (state.fix !== cache.fix || state.add !== cache.add) {
    cache = { fix: state.fix, add: state.add, list: buildCandidates(state.fix, state.add) };
  }
  return cache.list;
}

// Port of legacy st()/pend() (app.js line 47). A saved status overrides the record's own status.
const STATUS_ALIASES = { 'Needs review': 'Review', 'Rejected (by HR)': 'Rejected', Approved: 'Shortlisted' };
export const candidateStatus = (c, statusMap = {}) => {
  const v = statusMap[c.id] || c.st;
  return STATUS_ALIASES[v] || v;
};
export const pendingCount = (candidates, statusMap = {}) =>
  candidates.filter(c => ['New', 'Review'].includes(candidateStatus(c, statusMap))).length;

// React hook: the full candidate list for the current saved state. Use this in pages instead of building the list yourself.
export function useCandidates() {
  const state = useAppState();
  return candidatesFromState(state);
}
