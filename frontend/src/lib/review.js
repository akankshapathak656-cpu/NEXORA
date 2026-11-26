// Pure helpers for the candidate pages: ranking context, shortlist settings, advice text and decision records.
// Port of legacy app.js helpers used by cands(), cmpModal(), profile() and decisionUI(). No React, DOM or storage.
import { JOBS } from '../data/jobs.js';
import { XR } from '../data/roles.js';
import { NS } from '../data/samples.js';
import { score, cmpS, rankAll, rankMap, mm, prRel } from './scoring.js';
import { clean } from './text.js';
import { SKD } from '../data/skillBase.js';

// The ctx that score(), cmpS(), rankMap() and anGet() take. Build it per render from the selected job and candidate list.
export function makeCtx(job, candidates) {
  return { job, skills: SKD, jobs: JOBS, xr: XR, candidates, ns: NS };
}

// Full score object (tot, cov, req, exp, comps, m) for the job's requirements.
export const scoreFor = (c, job, ctx) => score(c, job.req, job, ctx);

// Candidates best first, using the scoring tie-break order. Unscored records sort last.
export const rankedFor = (list, job, ctx) => rankAll(list, job.req, job, ctx);

// Comparator for two candidates (negative when a ranks first).
export const comparePair = (a, b, job, ctx) => cmpS(a, b, job.req, job, ctx);

// Map of candidate id to 1-based rank, scored candidates only.
export const rankPositions = (list, job, ctx) => rankMap(list, job.req, job, ctx);

// ---------- HR shortlist (legacy slSan, slCfg) ----------

export const SHORTLIST_PRESETS = [['3', 'Top 3'], ['5', 'Top 5'], ['10', 'Top 10'], ['20', 'Top 20'], ['50', 'Top 50'], ['custom', 'Custom number']];

// Clean copy of the saved shortlist setting. Does not write it back.
export function normShortlist(sl) {
  const o = sl && typeof sl == 'object' && !Array.isArray(sl) ? sl : {};
  return {
    m: SHORTLIST_PRESETS.some(p => p[0] == o.m) ? String(o.m) : '5',
    c: String(o.c == null ? '' : o.c).slice(0, 6),
    v: Number.isInteger(o.v) && o.v > 0 ? o.v : 5,
  };
}

// The one place the shortlist limit is decided (legacy slCfg). A preset larger than the pool shortlists everyone.
// A custom number must be a whole number from 1 to the analysed count; otherwise the last valid limit (sl.v) stays
// applied and err says why. Returns v, the limit to store for next time, instead of writing it.
export function shortlistConfig(sl, analysed) {
  const N = analysed, m = sl.m;
  let want = null, err = '';
  if (m == 'custom') {
    const t = String(sl.c).trim();
    if (N == 0) err = 'There are no successfully analysed candidates yet.';
    else if (!t) err = 'Enter a whole number from 1 to ' + N + '.';
    else if (!/^\d+$/.test(t)) err = '“' + t.slice(0, 12) + '” is not a valid number. Use a whole number from 1 to ' + N + '.';
    else {
      const v = parseInt(t, 10);
      if (v < 1) err = 'The number must be at least 1.';
      else if (v > N) err = 'The number cannot exceed the ' + N + ' successfully analysed candidate' + (N == 1 ? '' : 's') + '.';
      else want = v;
    }
  } else want = +m;
  return {
    m, N, want, err,
    n: want != null ? Math.min(want, N) : Math.min(sl.v, N),
    clamped: m != 'custom' && want > N,
    label: m == 'custom' ? 'Custom (' + (want != null ? want : sl.c || 'none') + ')' : 'Top ' + m,
    v: want != null ? Math.max(1, want) : sl.v,
  };
}

// ---------- advice text (legacy adv) ----------

// Advisory sentence block for one candidate. name is the display name (blind review aware).
export function adviceFor(c, job, ctx, name) {
  const q = job.req, m = mm(c, q), s = scoreFor(c, job, ctx).tot, pr = prRel(c, q);
  const l = s == null ? 'Not scored' : s >= 80 ? 'Worth a closer look' : s >= 60 ? 'Review in detail' : 'Limited resume evidence';
  const t = name + ' evidences ' + m.ok.length + ' of ' + q.length + ' required skills for ' + job.t +
    (m.tr.length ? ', plus ' + m.tr.length + ' related skill' + (m.tr.length == 1 ? '' : 's') + ' to confirm' : '') + '. ' +
    (c.ex == 'Fresher' ? 'No professional experience is listed. ' : c.ex + ' of experience is listed. ') +
    (pr.n ? 'Project text names ' + pr.h.join(', ') + '. ' : 'Project text names none of the required skills. ') +
    (m.no.length ? 'Not found in the resume: ' + m.no.join(', ') + '.' : 'No required skill is missing from the resume.') +
    ' Advisory only (the 80 and 60 thresholds are demo values). Verify before you decide.';
  return { l, t };
}

// ---------- decisions (legacy SN, dlab, commit, dfmt) ----------

const STATUS_ALIAS = { 'Needs review': 'Review', 'Rejected (by HR)': 'Rejected', Approved: 'Shortlisted' };

// Maps a status choice to the stored status name.
export const decisionStatus = v => STATUS_ALIAS[v] || v;

// Label shown to people. "Review" reads as "Needs review".
export const decisionLabel = k => {
  const v = decisionStatus(k);
  return v == 'Review' ? 'Needs review' : v;
};

// State patch that records a decision (legacy commit). The caller applies it with setState and shows the toast.
export function decisionPatch(state, id, v, note) {
  const s = decisionStatus(v);
  return {
    status: { ...state.status, [id]: s },
    rec: { ...state.rec, [id]: { s, t: Date.now(), n: clean(note || '').slice(0, 200) } },
    last: { id, s },
    pdc: null,
  };
}

// Local date and time for a recorded decision.
export function formatDecisionTime(t) {
  try {
    return new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}
