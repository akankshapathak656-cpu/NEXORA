// Pure evidence model for the candidate analysis. Port of legacy anEval (app.js lines 867-904) and adv (line 195).
// No React, no DOM, no storage.
import { mm, prRel, sco, yrs, ym } from './scoring.js';
import { eduFit, mergeMo, respMatch } from './resume.js';

// Evidence tier labels and chip kinds (legacy TL, TC).
export const TL = { E: 'Explicitly mentioned', D: 'Demonstrated through project/experience', I: 'Contextually inferred', M: 'Mentioned without sufficient evidence', N: 'Not found in the resume text', X: 'Added manually, no resume evidence' };
export const TC = { E: 'ok', D: 'ok', I: 'tr', M: 'no', N: '', X: 'tr' };

// Evaluates one analysis (an, from anGet) against the job j: required and preferred skills with their tiers,
// relevant experience, education, responsibilities, and the strengths and gaps sentences.
export function anEval(c, an, j) {
  const f = j.jd && j.jd.f, pref = f ? f.pref.v : [], look = n => an.sk.find(x => x.n.toLowerCase() == n.toLowerCase()),
    row = n => {
      const e = look(n);
      if (e) return { ...e, n };
      if (c.sk.some(s => s.toLowerCase() == n.toLowerCase())) return { n, tier: 'X', conf: '—', note: 'Entered by the recruiter. The resume text analysis did not detect it.' };
      return { n, tier: 'N', conf: '—', rel: mm(c, [n]).tr[0] || null, note: 'The resume text does not mention it. That is not proof the candidate lacks it.' };
    },
    R = j.req.map(row), Pf = pref.map(row), want = new Set([...j.req, ...pref].map(x => x.toLowerCase())),
    rw = an.work.filter(w => w.sk.some(s => want.has(s.toLowerCase()))), relMo = mergeMo(rw.map(w => [w.a, w.b])), y = yrs(c),
    pj = an.proj.map(p => ({ ...p, hit: p.sk.filter(s => want.has(s.toLowerCase())) })),
    resp = f ? respMatch(f.resp.v, an.src) : [],
    ef = f && f.edu.v ? eduFit(f.edu.v, c.ed + ' ' + an.edu.join(' ')) : null,
    xs = f && f.exp.v ? (f.exp.min == null ? 2 : y >= f.exp.min ? 1 : 0) : null,
    st = [], gp = [], nm = a => a.map(x => x.n).join(', '), ev = R.filter(x => x.tier == 'D' || x.tier == 'E').length;
  const dm = R.filter(x => x.tier == 'D'), ex = R.filter(x => x.tier == 'E'), inf = R.filter(x => x.tier == 'I'), mo = R.filter(x => x.tier == 'M'), no = R.filter(x => x.tier == 'N'), xm = R.filter(x => x.tier == 'X');
  if (dm.length) st.push('Required skills shown in project or work lines: ' + nm(dm) + (dm.some(x => x.conf == 'Low') ? ' (some at low confidence, see the evidence)' : '') + '.');
  if (ex.length) st.push('Required skills stated directly but not shown in a project: ' + nm(ex) + '.');
  const pe = Pf.filter(x => x.tier == 'D' || x.tier == 'E'); if (pe.length) st.push('Preferred skills with resume evidence: ' + nm(pe) + '.');
  if (relMo > 0) st.push(ym(relMo) + ' of dated work entries name at least one JD skill.');
  if (xs == 1) st.push('Listed experience (' + c.ex + ') meets the JD minimum (' + f.exp.v + ').');
  if (ef && ef[0] == 1) st.push('Education names a degree that the JD names.');
  const pr = pj.filter(p => p.hit.length); if (pr.length) st.push('Projects naming JD skills: ' + pr.map(p => p.t + ' (' + p.hit.join(', ') + ')').join('; ') + '.');
  const rk = resp.filter(x => x.ok).length; if (rk) st.push(rk + ' of ' + resp.length + ' JD responsibilities share wording with resume lines (keyword overlap only).');
  const sd = an.soft.filter(x => x.tier == 'D'); if (sd.length) st.push('Soft skills shown in work or project lines: ' + nm(sd) + '.');
  if (no.length) gp.push('Not found in the resume text: ' + nm(no) + '.');
  if (mo.length) gp.push('Named without supporting evidence (bare list item only): ' + nm(mo) + '. Ask for an example.');
  if (inf.length) gp.push('Only inferred from context, not stated: ' + nm(inf) + '.');
  if (xm.length) gp.push('Entered manually with no resume evidence: ' + nm(xm) + '.');
  const rl = no.concat(mo).filter(x => x.rel); if (rl.length) gp.push('Related skills only (not counted as the required skill): ' + rl.map(x => x.rel.s + ' for ' + x.n).join(', ') + '.');
  if (pref.length) { const pmis = Pf.filter(x => x.tier == 'N' || x.tier == 'M'); if (pmis.length) gp.push('Preferred skills without evidence: ' + nm(pmis) + '.'); }
  if (xs == 0) gp.push('Listed experience (' + c.ex + ') is below the JD minimum (' + f.exp.v + ').');
  if (xs == 2) gp.push('Experience requirement could not be compared automatically. Compare by hand.');
  if (ef && ef[0] == 0) gp.push('The degree named in the JD is not named in the candidate’s education.');
  if (ef && ef[0] == 2) gp.push('Education could not be compared automatically. Compare by hand.');
  if (resp.length && rk < resp.length) gp.push((resp.length - rk) + ' of ' + resp.length + ' JD responsibilities have no matching wording in the resume’s work or project lines.');
  if (!an.work.length) gp.push('No dated work entries were found, so relevant experience cannot be calculated.');
  if (!an.proj.length) gp.push('No project section was found in the resume text.');
  const sh = R.length ? ev / R.length : 0, lab = !R.length ? 'No required skills' : sh >= .7 ? 'High' : sh >= .4 ? 'Moderate' : 'Low';
  return { R, Pf, rw, relMo, pj, resp, ef, xs, st, gp, ev, lab, rk, f };
}

// Advisory read on the candidate record (legacy adv, line 195). name is the display name (blind review aware).
// Scores come from sco() with the job and ctx, so they match the rest of the app.
export function adv(c, job, name, ctx) {
  const q = job.req, m = mm(c, q), s = sco(c, q, job, ctx), pr = prRel(c, q);
  const l = s == null ? 'Not scored' : s >= 80 ? 'Worth a closer look' : s >= 60 ? 'Review in detail' : 'Limited resume evidence';
  return {
    l,
    t: name + ' evidences ' + m.ok.length + ' of ' + q.length + ' required skills for ' + job.t + (m.tr.length ? ', plus ' + m.tr.length + ' related skill' + (m.tr.length == 1 ? '' : 's') + ' to confirm' : '') + '. ' + (c.ex == 'Fresher' ? 'No professional experience is listed. ' : c.ex + ' of experience is listed. ') + (pr.n ? 'Project text names ' + pr.h.join(', ') + '. ' : 'Project text names none of the required skills. ') + (m.no.length ? 'Not found in the resume: ' + m.no.join(', ') + '.' : 'No required skill is missing from the resume.') + ' Advisory only (the 80 and 60 thresholds are demo values). Verify before you decide.',
  };
}
