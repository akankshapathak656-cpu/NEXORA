// Scoring engine. Pure: every input (candidate, requirement list, job, status lookup, job list) is an argument.
// Port of the legacy score() and helpers in public/legacy/app.js. Scores are never stored; compute them on demand.
import { TRX, AL } from '../data/skills.js';
import { WT, CRED, XCAP, UNVER, HF } from '../data/weights.js';
import { NS } from '../data/samples.js';
import { JOBS } from '../data/jobs.js';
import { RD } from '../data/roles.js';
import { anGet, anOk, mergeMo, eduFit, degs, respMatch } from './resume.js';
import { d1, pct } from './text.js';

export { d1, pct };

// Own-property lookup, so names such as "constructor" never resolve through Object.prototype.
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

// Months as "2 yrs 3 mo".
export const ym = m => {
  const y = Math.floor(m / 12), r = m % 12;
  return ((y ? y + ' yr' + (y == 1 ? '' : 's') : '') + (y && r ? ' ' : '') + (r ? r + ' mo' : '')) || '0 mo';
};

// Years from the experience text. "Fresher" and unparseable text give 0.
export const yrs = c => { const m = String(c.ex).match(/\d+/); return m ? +m[0] : 0; };

// A candidate can be scored when it is a sample record, or when its resume analysis is complete.
export const valid = c => (c.id != null && c.id < NS) || !!anOk(c.an);

// Project mention of one skill: the project text names it (AL pattern, or a whole-word match).
export const pm = (c, s) => {
  const re = own(AL, s) || new RegExp('\\b' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return re.test(c.pr);
};

// Required skills named in the project text.
export const prRel = (c, q) => { const h = q.filter(s => pm(c, s)), n = h.length; return { h, n, l: n >= 3 ? 'Strong' : n ? 'Partial' : 'Not shown' }; };

// Requirement coverage: which requirements the candidate lists, and which are only related (transferable) or missing.
export const mm = (c, q) => {
  const tr = [], no = [], sk = [...new Set(c.sk)];
  q.forEach(t => {
    if (sk.includes(t)) return;
    const s = sk.find(x => (own(TRX, x) || []).some(p => p[0] == t));
    if (s) tr.push({ s, t, w: TRX[s].find(p => p[0] == t)[1] }); else no.push(t);
  });
  return { ok: sk.filter(s => q.includes(s)), tr, no };
};

// THE scoring function. Every score and rank in the app comes from score() and cmpS().
// Seven components with fixed weights (WT). A component is used only when the selected job states what it needs,
// so every candidate for the same job is measured on the same components, and the weights of the used ones are rescaled to 100.
// Credit per skill: stated or demonstrated 1, listed only 0.5, inferred, related or not found 0.
// q is the requirement list; job is the job object ({ t, req, d, jd? }) that q belongs to. job may be omitted for
// a plain requirement list, in which case no JD-specific rules apply.
// ctx is the resume context ({ job, skills, jobs, xr, candidates, ns }, see lib/resume.js anGet). Pass it so a stale
// analysis is rebuilt for the job being scored. Without ctx, the stored candidate.an is used as is.
export function score(c, q, job, ctx) {
  const m = mm(c, q);
  if (!valid(c)) return { ok: false, tot: null, raw: 0, req: 0, exp: 0, cov: 0, comps: [], m };
  const f = job && job.jd && job.jd.f, a = ctx ? anGet(c, ctx) : c.an, lc = s => String(s).toLowerCase(),
    gone = new Set(((a && a.rm) || []).map(lc)), has = n => c.sk.some(s => lc(s) == lc(n)), entry = n => a && a.sk.find(x => lc(x.n) == lc(n)),
    tier = n => { if (gone.has(lc(n)) && !has(n)) return 'N'; if (!a) return has(n) ? (pm(c, n) ? 'D' : 'M') : 'N'; const e = entry(n); if (e && 'DEM'.includes(e.tier)) return e.tier; return has(n) ? 'X' : e && e.tier == 'I' ? 'I' : 'N' },
    names = (list, n) => list.some(s => lc(s) == lc(n)),
    inProj = n => tier(n) != 'N' && (a ? a.proj.some(p => names(p.sk, n)) : has(n) && pm(c, n)),
    inWork = n => { const e = entry(n); return tier(n) == 'D' && e && (e.sec == 'Experience' || (e.also || []).includes('Experience')) ? (e.conf == 'Low' ? .5 : 1) : 0 },
    sum = (l, fn) => l.reduce((s, x) => s + fn(x), 0), num = v => +v.toFixed(1),
    part = l => { const full = l.filter(n => CRED[tier(n)] == 1).length, half = l.filter(n => CRED[tier(n)] == .5).length; return { f: (full + half * .5) / l.length, note: full + ' stated or shown, ' + half + ' listed only, ' + (l.length - full - half) + ' not supported (of ' + l.length + ')' } },
    parts = [], add = (k, o) => parts.push({ k, l: WT[k][0], wt: WT[k][1], f: Math.max(0, Math.min(1, o.f)), note: o.note });
  add('req', q.length ? part(q) : { f: 0, note: 'No required skills' });
  const pref = f ? f.pref.v : []; if (pref.length) add('pref', part(pref));
  if (!(f && f.exp.min === 0)) {
    const want = [...q, ...pref], need = (f && f.exp.min) || XCAP; let mo, note;
    if (a && a.work.length) { mo = mergeMo(a.work.filter(w => want.some(n => names(w.sk, n) && tier(n) != 'N')).map(w => [w.a, w.b])); if (c.ex) mo = Math.min(mo, yrs(c) * 12 + 11); note = ym(mo) + ' of dated work naming JD skills' }
    else { const any = q.some(n => CRED[tier(n)] > 0); mo = any ? yrs(c) * 12 * UNVER : 0; note = !yrs(c) ? 'No years of experience listed' : any ? c.ex + ' listed with no dated work entries to confirm relevance, so counted at half' : c.ex + ' listed, but no required skill is supported' }
    parts.rel = { mo, dated: !!(a && a.work.length) }; add('exp', { f: mo / (need * 12), note: note + '. Full marks at ' + need + ' yr' + (need == 1 ? '' : 's') + (f && f.exp.min ? ' (JD minimum)' : ' (default)') });
  }
  if (f && f.edu.v && degs(f.edu.v).length) { const e = eduFit(f.edu.v, c.ed + ' ' + ((a && a.edu) || []).join(' ')); add('edu', { f: e[0] == 1 ? 1 : 0, note: e[0] == 1 ? 'A degree named in the JD is on the record (field of study not checked)' : 'No degree named in the JD could be confirmed' }) }
  const np = q.filter(inProj).length; add('proj', { f: q.length ? np / q.length : 0, note: np + ' of ' + q.length + ' required skills named in a project' });
  if (f && f.resp.v.length) { const r = respMatch(f.resp.v, a ? a.src : c.pr && c.pr != 'Not provided' ? [c.pr] : []), n = r.filter(x => x.ok).length; add('resp', { f: n / r.length, note: n + ' of ' + r.length + ' share wording with resume lines (keyword overlap only)' }) }
  const nw = sum(q, inWork); add('ctx', { f: q.length ? nw / q.length : 0, note: a ? num(nw) + ' of ' + q.length + ' required skills shown in job lines' : 'No job description lines on this record' });
  const W = sum(parts, p => p.wt); parts.forEach(p => { p.max = p.wt * 100 / W; p.pts = p.max * p.f });
  const raw = sum(parts, p => p.pts), req = parts[0].f, ex = parts.find(p => p.k == 'exp');
  return { ok: true, tot: Math.round(raw), raw, req, exp: ex ? ex.f : 0, cov: Math.round(req * 100), comps: parts, m, tier, rel: parts.rel };
}

// Overall score (0-100, rounded) or null when the candidate is not scored.
export const sco = (c, q, job, ctx) => score(c, q, job, ctx).tot;

// Required-skill coverage (0-100) or null.
export const fit = (c, q, job, ctx) => score(c, q, job, ctx).cov;

// Component breakdown as "Label pts/max + ...".
export const brk = s => s.comps.map(p => p.l + ' ' + d1(p.pts) + '/' + d1(p.max)).join(' + ');

// Project relevance sentence.
export const prTxt = (c, q) => {
  const r = prRel(c, q);
  return r.n ? 'Project relevance ' + r.l.toLowerCase() + ': the project text names ' + r.h.join(', ') + ' (' + r.n + ' of ' + q.length + ' required skills).' : 'Project relevance not shown: the project text names none of the ' + q.length + ' required skills. This reflects the short sample description, so ask for detail.';
};

// Ranking comparator: overall score, then required-skill match, then relevant-experience match, then creation order.
// Unscored records sort last. q and job are the selected job's requirement list and job object.
export const cmpS = (a, b, q, job, ctx) => {
  const x = score(a, q, job, ctx), y = score(b, q, job, ctx);
  return (y.ok - x.ok) || (y.tot - x.tot) || (y.req - x.req) || (y.exp - x.exp) || ((a.id || 0) - (b.id || 0));
};

// Sorted copy of the list (best first). Does not filter unscored records; use rankMap for ranks.
export const rankAll = (list, q, job, ctx) => list.slice().sort((a, b) => cmpS(a, b, q, job, ctx));

// Map of candidate id -> rank (1-based) among scored candidates only.
export const rankMap = (list, q, job, ctx) => new Map(rankAll(list.filter(valid), q, job, ctx).map((c, i) => [c.id, i + 1]));

// Role fits for one candidate across every role in RD(jobs), best first.
// jobs is the full job list (built-in plus custom). Each entry: { r, q, s (score), ev (share of q evidenced) }.
// ctx: the resume context for the selected job (see score()). Its job must be the selected job, as legacy anGet used S.job.
export const rolesFor = (c, jobs = JOBS, ctx) => Object.entries(RD(jobs)).map(([r, q]) => {
  const job = jobs.find(j => j.req === q) || { req: q };
  return { r, q, s: sco(c, q, job, ctx), ev: mm(c, q).ok.length / q.length };
}).sort((a, b) => b.s - a.s || b.ev - a.ev || a.q.length - b.q.length || a.r.localeCompare(b.r));

// Hidden fits: candidates weak for the selected job but clearly stronger for another role.
// candidates: all candidate records. job: the selected job object. status(c): the candidate's current status string.
// jobs: full job list for rolesFor (defaults to the built-in JOBS).
export const hidden = (candidates, job, status, jobs = JOBS, ctx) => candidates
  .filter(c => status(c) != 'Hired' && valid(c))
  .map(c => ({ c, ap: sco(c, job.req, job, ctx), b: rolesFor(c, jobs, ctx).find(x => x.r != job.t && x.ev >= HF.cov) }))
  .filter(h => h.b && h.ap < HF.max && h.b.s - h.ap >= HF.gap)
  .sort((a, b) => (b.b.s - b.ap) - (a.b.s - a.ap) || a.c.id - b.c.id);

// Evidence for one required skill: [tier 3..0, label, sentence].
export const ev = (c, s) => {
  if (c.sk.includes(s)) return pm(c, s) ? [3, 'Strong', 'Used in project: ' + c.pr] : [2, 'Listed', 'Listed in skills. No project mention found'];
  const t = c.sk.map(x => [x, (own(TRX, x) || []).find(p => p[0] == s)]).find(p => p[1]);
  return t ? [1, 'Transferable', t[0] + ' is related: ' + t[1][1] + '. Confirm depth'] : [0, 'Not found', 'Not in resume. Ask in interview'];
};
