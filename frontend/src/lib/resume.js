// Pure resume-analysis helpers, ported from public/legacy/app.js
// (lines 35, 358-364, 505-684 and 767-866). No React, no DOM, no storage, no network.
//
// Legacy read these globals. Here they come in through `ctx`:
//   ctx.skills     base skill dictionary (legacy SKD, an array of K() entries). Owner: src/data.
//   ctx.jobs       JOBS array (legacy).
//   ctx.xr         XR role-to-skills map (legacy).
//   ctx.job        the selected job, JOBS[S.job] (legacy).
//   ctx.candidates candidate list C (legacy), used only for duplicate lookup in resumeDraft.
//   ctx.ns         NS, the number of sample candidates (legacy), used by persistTarget/sampleFiles.

// ---------- text helpers ----------

const clean = v => String(v == null ? '' : v).replace(/[<>"`\\]/g, '').replace(/\s+/g, ' ').trim();

const rxEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rxAlt = a => a.map(x => rxEsc(x).replace(/\s+/g, '\\s+')).join('|');

// ---------- skill dictionary ----------

const dictCache = new WeakMap();

// Legacy skillDict(). Returns the base dictionary plus one entry per job/role skill the base does not know.
// Legacy also pushed each name into the global VOC list so typed skills get the same spelling. That side
// effect is not done here; the store owner should build its vocabulary from skillDict(ctx) instead.
export function skillDict(ctx) {
  const base = ctx.skills || [], jobs = ctx.jobs || [], xr = ctx.xr || {};
  const hit = dictCache.get(base);
  if (hit && hit.jobs === jobs && hit.xr === xr && hit.n === jobs.length) return hit.dk;
  const have = new Set(base.map(e => e.n.toLowerCase())), extra = [];
  [...jobs.flatMap(j => j.req), ...jobs.flatMap(j => j.jd && j.jd.f ? [...j.jd.f.pref.v, ...(j.jd.f.men ? j.jd.f.men.v : [])] : []), ...Object.values(xr).flat()].forEach(s => {
    const k = String(s).trim(); if (!k || have.has(k.toLowerCase())) return; have.add(k.toLowerCase()); extra.push(k.length <= 2 ? K(k, 'tool', [], [k], [], 1) : K(k, 'tool'))
  });
  const dk = [...base, ...extra].map(e => {
    const o = { ...e };
    if (o.a.length) o.re = new RegExp('(?:^|[^a-z0-9+#.])(?:' + rxAlt(o.a) + ')(?!' + (o.x ? o.x + '|' : '') + '[a-z0-9+#]|\\.[a-z0-9])');
    if (o.k.length) o.cs = new RegExp('(?:^|[^A-Za-z0-9+#.])(?:' + rxAlt(o.k) + ')(?![A-Za-z0-9+#]|\\.[A-Za-z0-9])');
    if (o.s.length) o.sx = new RegExp('(?:^|[^A-Za-z0-9+#.])(?:' + rxAlt(o.s) + ')(?![A-Za-z0-9+#&]|\\.[A-Za-z0-9])');
    return o
  });
  dictCache.set(base, { jobs, xr, n: jobs.length, dk });
  return dk;
}

export function findSkills(text, skillsText, ctx) {
  const low = String(text).toLowerCase();
  return skillDict(ctx).filter(e => (e.re && e.re.test(low)) || (e.cs && e.cs.test(text)) || (e.sx && skillsText && e.sx.test(skillsText)))
}

export const CATL = [['lang', 'Programming languages'], ['fw', 'Frameworks & libraries'], ['tool', 'Tools & technologies'], ['oth', 'Other skills']];
export const catOf = (s, ctx) => { const e = skillDict(ctx).find(x => x.n.toLowerCase() == String(s).toLowerCase()); return e ? e.c : 'oth' };

// ---------- sections and headings ----------

const HD = {
  skills: ['skills', 'technical skills', 'tech skills', 'key skills', 'core skills', 'core competencies', 'competencies', 'technologies', 'technical proficiency', 'technical expertise', 'tech stack', 'skills and tools', 'tools and technologies', 'technologies and tools', 'areas of expertise', 'skills summary', 'technical summary', 'it skills'],
  exp: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'professional background', 'career history', 'internships', 'internship experience', 'relevant experience', 'industry experience', 'experience summary'],
  edu: ['education', 'academic background', 'academic qualifications', 'educational qualifications', 'qualifications', 'academics', 'education and training', 'academic details'],
  proj: ['projects', 'academic projects', 'personal projects', 'key projects', 'selected projects', 'project experience', 'notable projects', 'technical projects', 'project work'],
  cert: ['certifications', 'certification', 'certificates', 'licenses and certifications', 'licences and certifications', 'certifications and courses', 'courses', 'training', 'courses and certifications', 'professional certifications'],
  oth: ['summary', 'professional summary', 'profile', 'professional profile', 'career objective', 'objective', 'career summary', 'about me', 'about', 'achievements', 'awards', 'awards and achievements', 'interests', 'hobbies', 'languages', 'references', 'publications', 'volunteering', 'volunteer experience', 'declaration', 'extracurricular activities', 'extracurriculars', 'personal details', 'personal information', 'contact', 'contact information', 'links', 'activities', 'strengths', 'soft skills']
};
const HDM = {}; for (const k in HD) HD[k].forEach(a => HDM[a] = k);
const hdKey = l => { const t = l.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); return t && t.split(' ').length <= 5 ? (HDM[t] || '') : '' };

function sections(lines) {
  const out = { head: [], skills: [], exp: [], edu: [], proj: [], cert: [], oth: [] }; let key = 'head';
  for (const raw of lines) {
    const l = raw.trim(); if (!l) continue; const k = hdKey(l); if (k) { key = k; continue }
    const m = l.match(/^([A-Za-z&' ]{3,32}?)\s*[:\-–—]\s*(\S.*)$/), k2 = m && !/^languages$/i.test(m[1].trim()) && hdKey(m[1]);
    if (k2) { key = k2; out[key].push(m[2]); continue }
    out[key].push(l)
  }
  return out
}

const unb = l => String(l).replace(/^[\s•●▪◦○■□▶►➢➤✓✔·*\-–—>]+/, '').trim(), isBul = l => /^\s*[•●▪◦○■□▶►➢➤✓✔·*\-–—>]/.test(l);

// ---------- name, dates, role, education, projects, contact ----------

const NOTNAME = /resume|curriculum|vitae|\bcv\b|profile|summary|objective|contact|e-?mail|phone|mobile|address|linkedin|github|portfolio|developer|engineer|designer|analyst|manager|intern\b|student|fresher|experience|education|skills|projects|page|www|http|university|college|institute|school/i, PART = new Set(['de', 'da', 'di', 'van', 'von', 'bin', 'al', 'del', 'la', 'le', 'ibn']);
const tcase = s => s.toLowerCase().replace(/(^|[\s'’\-.])([a-z])/g, (m, a, b) => a + b.toUpperCase());

function nameOk(s) {
  if (s.length < 3 || s.length > 40 || /[\d@_:()]/.test(s) || NOTNAME.test(s) || hdKey(s)) return ''; const w = s.split(/\s+/); if (w.length < 2 || w.length > 4) return '';
  if (!w.every(x => PART.has(x.toLowerCase()) || /^[A-Z][A-Za-z'’\-]*\.?$/.test(x))) return ''; if (w.filter(x => !PART.has(x.toLowerCase())).length < 2) return '';
  return clean(s === s.toUpperCase() ? tcase(s) : s).slice(0, 60)
}

function findName(lines) {
  const top = lines.slice(0, 14);
  for (const l of top) { const m = l.match(/^(?:full\s+)?name\s*[:\-]\s*(.{3,40})$/i); if (m) { const c = nameOk(m[1].trim()); if (c) return c } }
  for (const l of top.slice(0, 10)) { for (const seg of l.split(/\s*[|•·●▪◦,;\/]\s*|\s[-–—]\s/)) { const c = nameOk(seg.trim()); if (c) return c } }
  return ''
}

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DTX = "(?:[A-Za-z]{3,9}\\.?,?\\s*['’]?\\d{2,4}|\\d{1,2}\\s*[\\/.\\-]\\s*\\d{4}|\\d{4})";
const RANGE = new RegExp('(' + DTX + ')\\s*(?:[-–—‒]|to|until|till)\\s*(' + DTX + '|present|current|now|till\\s+date|to\\s+date|ongoing|today)', 'gi');

function pDate(s, end) {
  s = s.toLowerCase().trim(); const now = new Date();
  if (/^(present|current|now|till\s+date|to\s+date|ongoing|today)$/.test(s)) return end ? now.getFullYear() * 12 + now.getMonth() : null;
  let m = s.match(/^([a-z]{3,9})\.?,?\s*['’]?(\d{4}|\d{2})$/); if (m) { const mo = MON[m[1].slice(0, 3)]; if (!mo) return null; let y = +m[2]; if (y < 100) y += 2000; return y * 12 + mo - 1 }
  m = s.match(/^(\d{1,2})\s*[\/.\-]\s*(\d{4})$/); if (m && +m[1] >= 1 && +m[1] <= 12) return +m[2] * 12 + +m[1] - 1;
  m = s.match(/^(\d{4})$/); if (m) return +m[1] * 12; return null
}

// Returns [startMonth, endMonth, matchedText] for each dated range on the line.
function ranges(line) {
  const out = [], ny = new Date().getFullYear(); RANGE.lastIndex = 0; let m;
  while ((m = RANGE.exec(line))) {
    const a = pDate(m[1], 0), b = pDate(m[2], 1); if (a == null || b == null) continue; const sy = Math.floor(a / 12), ey = Math.floor(b / 12);
    if (sy < 1970 || sy > ny + 1 || ey > ny + 1 || b < a || b - a > 600) continue; out.push([a, b, m[0]])
  }
  return out
}

function datedMonths(lines) {
  const all = []; lines.forEach(l => ranges(l).forEach(r => all.push([r[0], r[1]]))); all.sort((x, y) => x[0] - y[0]); let tot = 0, cs = null, ce = null;
  for (const [a, b] of all) { if (cs == null) { cs = a; ce = b } else if (a <= ce) { ce = Math.max(ce, b) } else { tot += ce - cs; cs = a; ce = b } }
  if (cs != null) tot += ce - cs; return { months: tot, n: all.length }
}

const STATED = /\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+[A-Za-z\-]+){0,3}\s+experience\b/i, TITLE = /\b((?:[A-Z][A-Za-z0-9+#.\/&\-]*\s+){0,3}(?:Developer|Engineer|Designer|Analyst|Programmer|Consultant|Architect|Administrator|Scientist|Tester|Specialist|Manager|Intern|Trainee|Lead|Associate))\b/;

function findRole(P) {
  const pools = [P.sec.exp.filter(l => !isBul(l)), P.lines.slice(0, 10).filter(l => !P.name || l.indexOf(P.name) < 0 || l.length > P.name.length + 3)];
  for (const pool of pools) for (const l of pool) { if (l.length > 100 || /[.]$/.test(l)) continue; const m = l.match(TITLE); if (m) return clean(m[1]).slice(0, 60) }
  return ''
}

function workLines(P) {
  const L = P.sec.exp, out = [];
  for (let i = 0; i < L.length && out.length < 6; i++) {
    const r = ranges(L[i]); if (!r.length) continue; const rest = L[i].replace(r[0][2], '').replace(/[\W_]/g, '');
    let t = L[i]; if (rest.length < 4) { const p = L[i - 1]; if (p && !isBul(p)) t = unb(p) + ' (' + r[0][2] + ')' }
    t = clean(unb(t)); if (t && !out.includes(t)) out.push(t.slice(0, 120))
  }
  return out
}

const DG1 = /(?:^|[\s,(])(?:B\.?\s?Tech|B\.?\s?Sc\.?|BCA|MCA|MBA|BBA|M\.?\s?Tech|M\.?\s?Sc\.?|Ph\.?\s?D|B\.?\s?Com|B\.?\s?Des)(?=[\s,.)\-–:\/]|$)/i,
  DGX = /(?:^|[\s,(])(?:B\.E\.|M\.E\.|B\.A\.|M\.A\.|B\.S\.|M\.S\.|(?:BE|ME|BA|MA|BS|MS)\s+(?:in|of))(?=[\s,.)\-–:\/]|$)/, DGI = /\b(?:bachelors?|masters?|diploma|associate degree|doctorate|postgraduate|undergraduate)\b/i;

function findEdu(P) {
  const inSec = P.sec.edu.length > 0, pool = inSec ? P.sec.edu : P.lines;
  for (const raw of pool) {
    const l = unb(raw); if (l.length > 160) continue; if (DG1.test(l) || DGI.test(l) || (inSec && DGX.test(l))) {
      const c = clean(l.replace(/\(?\b(?:19|20)\d{2}\b(?:\s*(?:[-–—]|to)\s*(?:(?:19|20)\d{2}|present|current|ongoing))?\)?/gi, '').replace(/\b(?:cgpa|gpa|percentage|score)\s*[:\-]?\s*[\d.\/]+/gi, '').replace(/\b\d{2,3}(?:\.\d+)?\s*%/g, '').replace(/[\s,|\-–—:]+$/, '').replace(/\s{2,}/g, ' '));
      if (c.length >= 3) return c.slice(0, 120)
    }
  }
  return ''
}

function findProj(P) { let o = ''; for (const l of P.sec.proj.map(unb).filter(x => x.length > 2)) { const n = o ? o + ' – ' + l : l; if (n.length > 200) { if (!o) o = l; break } o = n } return clean(o).slice(0, 200) }
const findCert = P => [...new Set(P.sec.cert.map(unb).map(clean).filter(x => x.length >= 4 && x.length <= 120))].slice(0, 8);

const EMRE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g, PHRE = /(?:\+\d{1,3}[ .\-]?)?(?:\(\d{2,4}\)[ .\-]?)?\d[\d .\-]{5,16}\d/g,
  LOCLAB = /^(?:current\s+|present\s+|home\s+)?(?:location|address|city|based\s+in)\s*[:\-–]\s*(.{2,80})$/i,
  LOCPAT = /^[A-Z][A-Za-z.'\- ]{2,25},\s*[A-Z][A-Za-z.'\- ]{1,25}(?:,\s*[A-Z][A-Za-z.'\- ]{1,25})?$/;

function findContact(P) {
  const r = { em: '', ph: '', lo: '' }, top = P.lines.slice(0, 20), head = top.join('\n');
  let m = head.match(EMRE);
  if (!m) { const all = P.text.match(EMRE) || []; if (new Set(all.map(x => x.toLowerCase())).size == 1) m = [all[0]] }
  if (m) r.em = m[0].slice(0, 80);
  const body = head.replace(EMRE, ' ').replace(/\bhttps?:\/\/\S+|\b(?:www\.|linkedin\.com|github\.com)\S*/gi, ' ');
  for (const x of body.match(PHRE) || []) {
    const t = x.trim(), dg = t.replace(/\D/g, '');
    if (/^(?:(?:19|20)\d{2}[ .\-]*){2,}$/.test(t)) continue;
    if (dg.length < 10 || dg.length > (t[0] == '+' ? 15 : 13)) continue; r.ph = t.slice(0, 25); break
  }
  L1: for (const l of top.slice(0, 20)) for (const seg of l.split(/\s*[|•·●▪◦]\s*/)) {
    const mm = seg.trim().match(LOCLAB);
    if (mm) { const v = clean(mm[1]); if (v && !/@|\d{8,}/.test(v)) { r.lo = v.slice(0, 80); break L1 } }
  }
  if (!r.lo) L2: for (const l of top.slice(0, 10)) {
    if (!(/@/.test(l) || /\d[\d ().\-]{8,}\d/.test(l))) continue;
    for (const seg of l.split(/\s*[|•·●▪◦]\s*/)) { const s = seg.trim(); if (LOCPAT.test(s) && !NOTNAME.test(s) && !/@|http|www/i.test(s)) { r.lo = clean(s).slice(0, 80); break L2 } }
  }
  return r
}

// ---------- parser steps (legacy rpStructure, rpSkills, rpDetails) ----------

// Splits the extracted text into lines. Accepts \r\n, \r and \n. The backend now returns real newlines
// (commit e4befa5); legacy split on \n only, so a lone \r would have merged the whole resume into one line.
const splitLines = text => String(text == null ? '' : text).split(/\r\n|\r|\n/).map(x => x.trim()).filter(Boolean);

export function rpStructure(P) { P.lines = splitLines(P.text); P.sec = sections(P.lines); P.name = findName(P.lines); Object.assign(P, findContact(P)); return P }
export function rpSkills(P, ctx) { P.sk = [...new Set(findSkills(P.text, P.sec.skills.join('\n'), ctx).map(e => e.n))].slice(0, 40); return P }
export function rpDetails(P) {
  const d = datedMonths(P.sec.exp), st = P.text.match(STATED), yrs = Math.floor(d.months / 12); let ex = ''; P.warn = [];
  if (yrs >= 1 && yrs <= 50) ex = yrs + (yrs == 1 ? ' yr' : ' yrs');
  else if (st && +st[1] >= 1 && +st[1] <= 50) ex = (+st[1]) + (+st[1] == 1 ? ' yr' : ' yrs');
  else if (/\bfresher\b/i.test(P.text)) ex = 'Fresher';
  else if (d.months > 0) P.warn.push('Only ' + d.months + ' month(s) of dated experience were found, so Experience was left empty. Enter “Fresher” or “1 yr” as appropriate.');
  P.ex = ex; P.role = findRole(P); P.ed = findEdu(P); P.pr = findProj(P); P.cert = findCert(P); P.wk = workLines(P);
  return P
}

// Runs all three parser steps on the text. `meta` holds what the file reader reported: { words, pages, read, cut }.
// Throws if a step fails; the caller decides how to report it.
export function parseResume(text, ctx, meta = {}) {
  const P = { text: String(text == null ? '' : text), words: meta.words, pages: meta.pages, read: meta.read, cut: meta.cut };
  rpStructure(P); rpSkills(P, ctx); rpDetails(P);
  return P
}

// ---------- drafts, persistence, sample files ----------

// Legacy rpDraft() + mkDraft(): the draft the recruiter reviews before saving. Empty fields stay empty.
export function resumeDraft(P, fileName, ctx) {
  const miss = []; if (!P.name) miss.push('Name'); if (!P.ex) miss.push('Experience'); if (!P.ed) miss.push('Education'); if (!P.pr) miss.push('Projects'); if (!P.sk.length) miss.push('Technical skills');
  const warn = P.warn.slice(); if (P.cut) warn.push('Only the first ' + P.read + ' of ' + P.pages + ' pages were read.');
  let an = null; try { an = anBuild(P, ctx) } catch (e) { warn.push('Contextual skill analysis could not be completed for this resume, so no skill evidence is shown for it.') }
  const g = P.name || '', d = g && (ctx.candidates || []).find(c => c.real.toLowerCase() == g.toLowerCase());
  return { real: g, em: P.em || '', ph: P.ph || '', lo: P.lo || '', r: P.role || (ctx.job && ctx.job.t) || '', ex: P.ex || '', ed: P.ed || '', pr: P.pr || '', sk: P.sk.slice(), cert: P.cert.slice(), wk: P.wk.slice(), miss, warn, words: P.words, an, parsed: true, file: fileName, saved: null, dup: d ? d.id : null };
}

// Which store bucket a candidate's record lives in (legacy persist() wrote S.fix[id] or S.add[id - NS]).
export function persistTarget(c, ns) {
  return c.id < ns ? { bucket: 'fix', key: c.id } : { bucket: 'add', key: c.id - ns }
}

// Legacy persist(c), without the write. Returns the value the store should keep for this candidate.
export function persistRecord(c, ns) {
  const r = { n: c.real, ed: c.ed, ex: c.ex, r: c.r, pr: c.pr, sk: c.sk, em: c.em || '', ph: c.ph || '', lo: c.lo || '', cert: c.cert || [], wk: c.wk || [], an: c.an || null, apiId: c.apiId || null };
  return c.id < ns ? r : { ...r, file: c.file }
}

export function sampleFiles(candidates, ns) {
  return (candidates || []).slice(0, ns).map(c => ({ n: c.n.replace(/\s+/g, '_') + '_Resume.pdf', ok: true }));
}

// ---------- contextual analysis (legacy lines 767-866) ----------

const ANP = new WeakMap();

export function anOk(a) { return a && typeof a == 'object' && Array.isArray(a.sk) && Array.isArray(a.soft) && Array.isArray(a.work) && Array.isArray(a.proj) && Array.isArray(a.src) && Array.isArray(a.edu) && a.ex && typeof a.ex == 'object' ? a : null }

const SECL = { skills: 'Skills', exp: 'Experience', proj: 'Projects', cert: 'Certifications', oth: 'Summary / other', head: 'Header / summary', edu: 'Education', soft: 'Soft skills' };
const ACT = /\b(?:built|build|building|developed|develop|developing|implemented|implementing|designed|designing|created|creating|deployed|deploying|migrated|optimi[sz]ed|integrated|integrating|led|architected|engineered|refactored|wrote|authored|maintained|automated|configured|used|using|utili[sz]ed|leveraged|delivered|launched|shipped|tested|debugged|reduced|improved|increased|managed|collaborated|contributed|crafted|produced|enhanced|resolved|fixed|set up|worked on|powered)\b/i,
  QUAL = /\b(?:proficient|proficiency|experienced?|expert(?:ise)?|strong|advanced|hands[- ]on|skilled|fluent|familiar(?:ity)?|working knowledge|knowledge of|basic|exposure|\d+\+?\s*(?:years?|yrs?))\b/i,
  WEAKQ = /\b(?:familiar(?:ity)?|working knowledge|knowledge of|basic|exposure)\b/i,
  METRIC = /\b\d+(?:\.\d+)?\s*(?:%|x\b|k\b|ms\b|users?|requests?|customers?|clients?|pages?|components?|endpoints?|tests?|services?|members?|developers?|engineers?|people)|\b(?:by|to|of)\s+\d+/i;

function anTag(lines) {
  let key = 'head'; const out = [];
  for (const raw of lines) {
    const l = raw.trim(); if (!l) continue; const kk = hdKey(l);
    if (kk) { key = kk == 'oth' && /soft skills|strengths/i.test(l) ? 'soft' : kk; continue }
    const m = l.match(/^([A-Za-z&' ]{3,32}?)\s*[:\-–—]\s*(\S.*)$/), k2 = m && !/^languages$/i.test(m[1].trim()) && hdKey(m[1]);
    if (k2) { key = k2 == 'oth' && /soft skills|strengths/i.test(m[1]) ? 'soft' : k2; out.push({ l: m[2], k: key }); continue }
    out.push({ l, k: key })
  }
  return out
}

const listy = l => { const p = l.split(/\s*[,|\/•·;]\s*/).filter(Boolean); return p.length >= 3 && !ACT.test(l) && p.every(x => x.length < 30) },
  unbl = o => unb(o.l), bare = o => { const t = unbl(o); return listy(t) || ((o.k == 'skills' || o.k == 'soft') && t.split(/\s+/).length <= 5 && !QUAL.test(t)) };

// Rates every occurrence of one skill: D = a project/experience line says what was done with it; E = a direct claim outside a bare list; M = only a bare list item.
function anRate(occs, soft) {
  if (!occs.length) return null;
  const W = o => o.k == 'exp' || o.k == 'proj', w = occs.filter(W), act = soft ? w : w.filter(o => ACT.test(o.l) && !listy(unbl(o))),
    also = [...new Set(occs.map(o => SECL[o.k] || 'Other'))],
    best = a => a.slice().sort((x, y) => (+METRIC.test(y.l) - +METRIC.test(x.l)) || (+ACT.test(y.l) - +ACT.test(x.l)))[0],
    R = (tier, conf, o, note) => ({ tier, conf, ev: clean(unbl(o)).slice(0, 200), sec: SECL[o.k] || 'Other', also, k: occs.length, note: note || '' });
  if (act.length) { const b = best(act); return R('D', METRIC.test(b.l) || act.length > 1 || new Set(act.map(o => o.k)).size > 1 ? 'High' : 'Medium', b) }
  if (w.length) return R('D', 'Low', w[0], 'Named in a project or experience line (such as a stack or title) without saying what was done with it.');
  const ex = occs.filter(o => QUAL.test(o.l) || (o.k != 'skills' && o.k != 'soft' && !bare(o)));
  if (ex.length) { const b = ex.find(o => QUAL.test(o.l)) || ex[0]; return R('E', WEAKQ.test(b.l) ? 'Low' : 'Medium', b) }
  return R('M', 'Low', occs[0], 'Appears only as a bare item in a list, with no qualifier and no project or job context.')
}

function anSkills(T, ctx) {
  const out = [];
  for (const e of skillDict(ctx)) { const occ = T.filter(t => (e.re && e.re.test(t.l.toLowerCase())) || (e.cs && e.cs.test(t.l)) || (e.sx && t.k == 'skills' && e.sx.test(t.l))), r = anRate(occ, false); if (r) out.push({ n: e.n, c: e.c, ...r }) }
  return out
}

const SOFTD = [['Communication', /communicat\w*|\bpresent(?:ed|ations?|ing)\b|public speaking|client (?:calls?|meetings?)/i], ['Teamwork / collaboration', /team ?work|collaborat\w*|cross[- ]functional|team player|pair programming|worked (?:closely )?with (?:the |a )?(?:team|designers?|developers?|engineers?|product|stakeholders?)/i], ['Leadership', /\bled\b|\bleading\b|leadership|team lead|spearhead\w*|\bheaded\b/i], ['Mentoring', /mentor\w*|\bcoach(?:ed|ing)?\b|trained (?:junior|new|interns?)|onboard\w*/i], ['Problem solving', /problem[- ]solving|troubleshoot\w*|root cause|\bsolved\b|\bresolved\b|\bdiagnos\w*/i], ['Time management / ownership', /time management|deadlines?|prioriti[sz]\w*|ownership|self[- ]motivated|self[- ]starter|took initiative/i], ['Adaptability / learning', /adaptab\w*|quick(?:ly)? learn\w*|fast learner|self[- ]taught|upskill\w*|learn(?:ed|ing) new/i], ['Analytical thinking', /analytical|critical thinking|data[- ]driven/i], ['Stakeholder / client handling', /stakeholders?|client[- ]facing|customer[- ]facing|requirements? gathering/i]];

// Contextual inference: only for a skill the resume does not name. Related-but-different skills (Vue for React) are never inferred.
const INF = [['JavaScript', [['React', 'React is a JavaScript library'], ['Next.js', 'Next.js is a JavaScript framework'], ['Node.js', 'Node.js runs JavaScript'], ['Vue', 'Vue is a JavaScript framework'], ['Angular', 'Angular is a JavaScript/TypeScript framework'], ['jQuery', 'jQuery is a JavaScript library'], ['TypeScript', 'TypeScript compiles to JavaScript'], ['Redux', 'Redux is a JavaScript library']]],
  ['React', [['Next.js', 'Next.js is built on React'], ['React Testing Library', 'React Testing Library tests React components']]],
  ['Python', [['Django', 'Django is a Python framework'], ['Flask', 'Flask is a Python framework'], ['FastAPI', 'FastAPI is a Python framework'], ['Pandas', 'Pandas is a Python library'], ['NumPy', 'NumPy is a Python library'], ['scikit-learn', 'scikit-learn is a Python library']]],
  ['Java', [['Spring Boot', 'Spring Boot is a Java framework'], ['Hibernate', 'Hibernate is a Java library']]],
  ['CSS', [['Sass', 'Sass compiles to CSS'], ['Tailwind CSS', 'Tailwind CSS is applied through CSS classes'], ['Bootstrap', 'Bootstrap is a CSS framework']]],
  ['SQL', [['MySQL', 'MySQL is queried with SQL'], ['PostgreSQL', 'PostgreSQL is queried with SQL'], ['SQLite', 'SQLite is queried with SQL']]],
  ['Node.js', [['Express', 'Express runs on Node.js']]],
  ['Testing', [[/\btest cases?\b|test coverage|code coverage/i, 'Test cases or coverage are described']]],
  ['Git', [[/pull requests?|merge conflicts?|feature branch(?:es)?|branching strategy/i, 'Pull requests or branching are described']]],
  ['Accessibility', [[/\baria\b|keyboard navigation|semantic html|colou?r contrast|focus management/i, 'Accessibility practices are described by name']]],
  ['Responsive Design', [[/media quer(?:y|ies)/i, 'Media queries are described']]],
  ['REST APIs', [[/\b(?:built|developed|designed|created|exposed|consumed|integrated)\b[^.]{0,50}\b(?:api|apis|endpoints?)\b/i, 'API endpoints are described, which suggests but does not confirm REST']]],
  ['Agile', [[/\bsprints?\b|stand-?ups?|retrospectives?/i, 'Sprint ceremonies are described']]]];

function anInfer(T, sk, ctx) {
  const have = n => sk.find(x => x.n == n), out = [];
  for (const [tg, rules] of INF) {
    const cur = have(tg); if (cur && cur.tier != 'M') continue;
    for (const [s, why] of rules) {
      if (typeof s == 'string') { const x = have(s); if (x && (x.tier == 'D' || x.tier == 'E')) { out.push({ n: tg, c: catOf(tg, ctx), tier: 'I', conf: 'Medium', ev: x.ev, sec: x.sec, also: cur ? cur.also : [], via: s, note: why + '. ' + (cur ? 'It is also listed by name in ' + cur.sec + ', but the list gives no usage detail.' : 'Inferred, not stated in the resume.'), drop: cur ? 1 : 0 }); break } }
      else { const o = T.find(t => t.k != 'skills' && t.k != 'soft' && s.test(t.l)); if (o) { out.push({ n: tg, c: catOf(tg, ctx), tier: 'I', conf: 'Low', ev: clean(unb(o.l)).slice(0, 200), sec: SECL[o.k] || 'Other', also: [], via: 'wording in the resume', note: why + '. Suggests the skill but does not confirm it.' }); break } }
    }
  }
  return out
}

function anWork(L, ctx) {
  const ix = []; L.forEach((l, i) => { if (ranges(l).length) ix.push(i) });
  const donly = i => !isBul(L[i]) && L[i].replace(ranges(L[i])[0][2], '').replace(/[\W_]/g, '').length < 4 && i > 0 && !isBul(L[i - 1]);
  return ix.slice(0, 8).map((i, k) => {
    const nx = ix[k + 1], end = nx == null ? L.length : (donly(nx) ? nx - 1 : nx), r = ranges(L[i])[0], d = donly(i), body = L.slice(i + 1, end).map(unb).map(clean).filter(Boolean), txt = [d ? L[i - 1] : '', L[i], ...body].join('\n');
    return { t: clean(unb(d ? L[i - 1] : L[i])).slice(0, 120), rg: r[2].slice(0, 40), a: r[0], b: r[1], sk: [...new Set(findSkills(txt, '', ctx).map(e => e.n))], l: body.slice(0, 4).map(x => x.slice(0, 160)) }
  })
}

function anProj(P, ctx) {
  const raw = P.sec.proj.filter(x => unb(x).length > 2), hb = raw.some(isBul), out = []; let cur = null;
  raw.forEach(r => {
    const l = clean(unb(r)), b = isBul(r), title = !b && l.length <= 100 && !/[.;]$/.test(l);
    if (title && (!cur || !hb || cur.nb > 0)) { cur = { t: l, d: [], nb: 0 }; out.push(cur) } else if (cur) { cur.d.push(l); if (b) cur.nb++ } else { cur = { t: l.slice(0, 100), d: [], nb: 0 }; out.push(cur) }
  });
  return out.slice(0, 8).map(p => { const txt = [p.t, ...p.d].join('\n'); return { t: p.t.slice(0, 100), d: p.d.join(' ').slice(0, 260), sk: [...new Set(findSkills(txt, '', ctx).map(e => e.n))] } })
}

// The job signature a resume analysis was built under. Legacy jdSig() read JOBS[S.job]; here the job is an argument.
export function jdSig(job) {
  const f = job.jd && job.jd.f;
  return job.t + '|' + job.req.join(',') + '|' + (f ? f.pref.v.join(',') : '')
}

// Builds the normalized analysis (legacy anBuild). Remembers the parsed resume so anGet can re-run it after a job change.
export function anBuild(P, ctx) {
  const T = anTag(P.lines), sk = anSkills(T, ctx); const inf = anInfer(T, sk, ctx); inf.forEach(x => { if (x.drop) { const i = sk.findIndex(y => y.n == x.n); if (i >= 0) sk.splice(i, 1) } delete x.drop }); sk.push(...inf);
  const soft = SOFTD.map(([n, rx]) => { const r = anRate(T.filter(t => t.k != 'head' && rx.test(t.l)), true); return r && { n, c: 'soft', ...r } }).filter(Boolean),
    d = datedMonths(P.sec.exp), yr = Math.floor(d.months / 12), stt = P.text.match(STATED),
    an = {
      v: 1, sig: jdSig(ctx.job), sk, soft, edu: P.sec.edu.map(unb).map(clean).filter(x => x.length > 2).slice(0, 5).map(x => x.slice(0, 140)),
      ex: { mo: d.months, src: yr >= 1 ? 'dated' : stt ? 'stated' : /\bfresher\b/i.test(P.text) ? 'fresher' : 'none' },
      work: anWork(P.sec.exp, ctx), proj: anProj(P, ctx), src: [...P.sec.exp, ...P.sec.proj].map(unb).map(clean).filter(x => x.length > 12).slice(0, 60).map(x => x.slice(0, 200)), words: P.words
    };
  ANP.set(an, P); return an
}

// Legacy anGet(c). Returns the analysis to use for candidate c under ctx.job. If the job changed and the parsed resume is
// still known in this session, the analysis is rebuilt and the new object is returned; the caller stores it.
// Otherwise the stored analysis is returned unchanged, as legacy did after a reload.
export function anGet(c, ctx) {
  const a = c && c.an; if (!a) return null;
  if (a.sig != jdSig(ctx.job)) {
    const P = ANP.get(a);
    if (P) { try { const n = anBuild(P, ctx); if (a.rm) n.rm = a.rm; if (a.eduFix) { n.edu = a.edu; n.eduFix = 1 } ANP.set(n, P); return n } catch (e) { } }
  }
  return a
}

// ---------- degrees, education fit, merging ----------

const DGS = [['btech', /\bb\.?\s?tech\b|\bb\.e\.|bachelor of (?:technology|engineering)/i], ['mtech', /\bm\.?\s?tech\b|master of technology/i], ['bca', /\bbca\b|bachelor of computer applications?/i], ['mca', /\bmca\b|master of computer applications?/i], ['bsc', /\bb\.?\s?sc\b|bachelor of science/i], ['msc', /\bm\.?\s?sc\b|master of science/i], ['bcom', /\bb\.?\s?com\b/i], ['bba', /\bbba\b/i], ['mba', /\bmba\b/i], ['bdes', /\bb\.?\s?des\b/i], ['phd', /\bph\.?\s?d\b|doctorate/i], ['bachelor', /\bbachelor'?s?\b|\bundergraduate\b/i], ['master', /\bmaster'?s?\b|\bpostgraduate\b/i]];
const BSET = ['btech', 'bca', 'bsc', 'bcom', 'bba', 'bdes', 'bachelor'], MSET = ['mtech', 'mca', 'msc', 'mba', 'master'];

export const degs = t => DGS.filter(d => d[1].test(String(t))).map(d => d[0]);

// Compares the degree a JD names with the candidate's education text. Returns [1 | 0 | 2, message].
// Documented fix: a higher degree satisfies a lower requirement. A bachelor-level requirement is met by a master's or PhD,
// and a master-level requirement is met by a PhD. Legacy only matched the same level or the generic word, so a candidate
// with an MSc did not meet a "Bachelor's degree" requirement. See the report for the legacy line.
export function eduFit(a0, b0) {
  const a = degs(a0), b = degs(b0);
  if (!a.length) return [2, 'No degree name was recognised in the JD text, so compare this by hand.'];
  if (!b.length) return [2, 'No degree name was recognised in the candidate’s education field. Check the resume.'];
  return a.some(x => b.includes(x)
    || (x == 'bachelor' && b.some(y => BSET.includes(y) || MSET.includes(y) || y == 'phd'))
    || (x == 'master' && b.some(y => MSET.includes(y) || y == 'phd')))
    ? [1, 'The candidate’s education names a degree that the JD names.']
    : [0, 'The degree named in the JD is not named in the candidate’s education. Check the resume.']
}

const STOP = new Set('a an and the of to in for with on at by or as is are be will you your our we this that from using use ability strong good excellent experience knowledge working work responsible build building develop developing team teams new existing high quality ensure including etc must have has more than years year can able well'.split(' '));
export const toks = t => [...new Set(String(t).toLowerCase().match(/[a-z][a-z0-9+#.]{2,}/g) || [])].filter(w => !STOP.has(w)).map(w => w.length > 4 ? w.replace(/(?:ing|ed|s)$/, '') : w);

// Total covered months of [start, end] intervals, overlaps counted once.
export const mergeMo = a => {
  const s = a.slice().sort((x, y) => x[0] - y[0]); let t = 0, cs = null, ce = null;
  for (const [x, y] of s) { if (cs == null) { cs = x; ce = y } else if (x <= ce) ce = Math.max(ce, y); else { t += ce - cs; cs = x; ce = y } }
  return cs == null ? 0 : t + ce - cs
};

// Months as "2 yrs 3 mo" (legacy ym).
export const ym = m => { const y = Math.floor(m / 12), r = m % 12; return ((y ? y + ' yr' + (y == 1 ? '' : 's') : '') + (y && r ? ' ' : '') + (r ? r + ' mo' : '')) || '0 mo' };

// For each required item, finds the resume line sharing the most tokens with it. `ok` needs 2+ shared tokens and 30% of the item's tokens.
export function respMatch(list, src) {
  return list.map(r => {
    const tr = toks(r); let best = '', bn = 0;
    src.forEach(l => { const lt = new Set(toks(l)), n = tr.filter(x => lt.has(x)).length; if (n > bn) { bn = n; best = l } });
    const ok = tr.length && bn >= 2 && bn / tr.length >= .3;
    return { r, ok: !!ok, l: ok ? best : '' }
  })
}
