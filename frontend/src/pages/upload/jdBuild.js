// Builds a job from the custom job description form, and validates the quick "New job" form.
// Pure: the caller passes the skill helpers, the job list and the form values. Port of legacy jdSubmit()
// (app.js lines 300-330, without the backend call and state writes) and addJob() (line 210).
import { parseJD, EXPRE, JDMAX, JDMIN, JDDESC } from '../../lib/jd.js';
import { findSkills } from '../../lib/resume.js';
import { clean, canon } from '../../lib/text.js';

// Optional form fields, in legacy order (JDF). Single-line fields first.
export const JD_FIELDS = ['title', 'req', 'pref', 'exp', 'edu', 'resp', 'oth'];

const unb = l => String(l).replace(/^[\s•●▪◦○■□▶►➢➤✓✔·*\-–—>]+/, '').trim();
const jdClip = (t, n) => clean(unb(t)).slice(0, n);

// Skill list typed by the recruiter: canonical, unique, at most 40 (legacy jdSk).
function jdSk(v, vocab) {
  const seen = new Set();
  return String(v || '').split(/[,;\n|]/)
    .map(x => canon(clean(x), vocab))
    .filter(x => x && x.length <= 40 && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
    .slice(0, 40);
}

// One item per line, cleaned, at most 20 (legacy jdLines).
const jdLines = v => String(v || '').split('\n').map(x => jdClip(x, 200)).filter(x => x.length > 1).slice(0, 20);

// Validates and builds the job from the pasted text (raw0) and the optional fields (U, keyed by JD_FIELDS).
// opts: { jobs: allJobs list, editIndex: index of a custom job being edited, or null, ctx: resume ctx, vocab: skill names }.
// Returns { error, field } or { job, note }. job is { t, req, d, jd }; the caller adds apiId and stores it.
export function buildJobDescription(raw0, U, { jobs, editIndex, ctx, vocab }) {
  const raw = String(raw0 || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  const anyU = JD_FIELDS.some(f => U[f]);
  if (!raw && !anyU) return { error: 'Paste a job description first, or fill in at least a job title and the required skills.', field: 'jx-raw' };
  if (raw.length > JDMAX) return { error: 'This job description has ' + raw.length.toLocaleString() + ' characters and the limit is ' + JDMAX.toLocaleString() + '. Remove boilerplate such as the company history or benefits and try again.', field: 'jx-raw' };
  if (raw && raw.length < JDMIN && !anyU) return { error: 'This text is too short to be a job description (' + raw.length + ' characters). Paste the full description, or fill in the title and required skills.', field: 'jx-raw' };
  const P = raw
    ? parseJD(raw, { findSkills: (t, s) => findSkills(t, s, ctx), canon: x => canon(x, vocab) })
    : { title: '', req: [], pref: [], men: [], reqNote: '', exp: null, edu: [], resp: [], oth: [] };
  const req = U.req ? jdSk(U.req, vocab) : P.req;
  if (!req.length) {
    return raw
      ? { error: 'No required skills could be identified in this text. NEXORA finds skills by matching the text against its built-in skill dictionary, so skills outside it are not detected automatically. Type them into “Required skills” (comma separated) under Optional details and submit again.', field: 'jx-req' }
      : { error: 'Add at least one required skill, or paste the job description.', field: 'jx-req' };
  }
  const has = (a, x) => a.some(r => r.toLowerCase() == x.toLowerCase());
  const pref = U.pref ? jdSk(U.pref, vocab) : P.pref.filter(x => !req.some(r => r.toLowerCase() == x.toLowerCase()));
  const f = {};
  f.title = { v: U.title ? clean(U.title).slice(0, 80) : P.title, s: U.title ? 'user' : P.title ? 'jd' : 'none' };
  f.req = { v: req, s: U.req ? 'user' : 'jd', n: U.req ? '' : P.reqNote };
  f.pref = { v: pref, s: U.pref ? 'user' : pref.length ? 'jd' : 'none' };
  f.men = { v: P.men.filter(x => !has(req, x) && !has(pref, x)), s: 'jd' };
  if (U.exp) {
    const m = U.exp.match(EXPRE);
    f.exp = { v: clean(U.exp).slice(0, 140), min: m && +m[1] <= 50 ? +m[1] : /fresher/i.test(U.exp) ? 0 : null, max: m && m[3] ? +m[3] : null, s: 'user' };
  } else f.exp = P.exp ? { ...P.exp, s: 'jd' } : { v: '', min: null, max: null, s: 'none' };
  f.edu = U.edu ? { v: clean(U.edu).slice(0, 160), s: 'user' } : P.edu.length ? { v: P.edu.join('; '), s: 'jd' } : { v: '', s: 'none' };
  f.resp = U.resp ? { v: jdLines(U.resp), s: 'user' } : { v: P.resp, s: P.resp.length ? 'jd' : 'none' };
  f.oth = U.oth ? { v: jdLines(U.oth), s: 'user' } : { v: P.oth, s: P.oth.length ? 'jd' : 'none' };

  const editing = editIndex != null;
  const taken = x => jobs.some((j, i) => j.t.toLowerCase() == x.toLowerCase() && !(editing && i == editIndex));
  let t = f.title.v, note = '', n = 1;
  if (!t) {
    do { t = 'Custom job description' + (n > 1 ? ' ' + n : ''); n++ } while (taken(t));
  } else if (taken(t)) {
    const b = t;
    do { t = b + ' (Custom JD' + (n > 1 ? ' ' + n : '') + ')'; n++ } while (taken(t));
    note = ' A job called “' + b + '” already exists, so this one is named “' + t + '”.';
  }
  return { job: { t, req, d: JDDESC, jd: { raw, at: Date.now(), f } }, note };
}

// Validates the quick "New job" form (legacy addJob). Returns { error } or { job }.
export function buildQuickJob(titleRaw, skillsRaw, { jobs, vocab }) {
  const t = String(titleRaw || '').trim();
  const seen = new Set();
  const q = String(skillsRaw || '').split(',')
    .map(x => canon(x, vocab))
    .filter(x => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
  if (t.length < 3) return { error: 'Enter a job title of at least 3 characters.' };
  if (q.length < 3) return { error: 'Add at least 3 required skills, separated by commas.' };
  if (jobs.some(j => j.t.toLowerCase() == t.toLowerCase())) return { error: 'A job with this title already exists.' };
  return { job: { t, req: q, d: 'Custom job created in this session' } };
}
