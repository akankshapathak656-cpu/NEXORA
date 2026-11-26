/* Job-description parsing, pure. Port of the "Custom job description" block of public/legacy/app.js
   (lines 211-287, with helpers from lines 571, 612 and 629-630).
   Skill lookups are not read from globals: parseJD(raw, skills) and jdLineSkills(t, list, skills)
   take { findSkills(text, skillsText), canon(name) }, which the caller builds from the skill dictionary
   and the vocabulary. */

export const JDMAX = 20000;
export const JDMIN = 40;
export const JDDESC = 'Built from a job description pasted by the recruiter.';

export const JDH = [
   ['oth', /\b(other requirements?|additional (?:requirements?|information|details|notes?)|other (?:details|information|notes?)|soft skills|work (?:mode|location|arrangement)|location|notice period|employment type|job type|shift|working hours|travel)\b/],
   ['ign', /\b(about (?:us|the company|our company|the team|company)|company (?:overview|profile)|who we are|benefits|perks|what we offer|why (?:join|work)|how to apply|equal opportunity|compensation|salary|disclaimer)\b/],
   ['pref', /\b(preferred|nice to haves?|good to haves?|bonus|desirable|added advantages?|optional|plus points?)\b/],
   ['resp', /\b(responsibilit\w*|duties|what youll do|what you will (?:do|be doing)|day to day|key tasks|your role|you will)\b/],
   ['exp', /^(?:(?:required |minimum |total |work |professional |relevant )?experience(?: required| needed| level)?|years of experience)$/],
   ['edu', /\b(education|educational|academic|degrees?)\b/],
   ['req', /\b(required|requirements?|must haves?|mandatory|minimum|key skills|technical skills|core skills|skills|qualifications?|what we are looking for|what were looking for|what youll need|what you need|what you bring|tech stack|eligibility|competenc\w+|proficienc\w+|expertise)\b/],
   ['sum', /^(?:about the (?:role|job|position)|job (?:description|summary|overview|details)|role (?:overview|summary|description)|position (?:overview|summary)|overview|summary|description|the role|the opportunity)$/]];

export const JSMALL = new Set(['to', 'and', 'of', 'for', 'the', 'in', 'you', 'will', 'we', 'are', 'do', 'a', 'an', 'with', 'what', 'your', 'our', 'is', 'be', 'on', 'at', 'or']);

/* Legacy line 35. */
const clean = v => String(v == null ? '' : v).replace(/[<>"`\\]/g, '').replace(/\s+/g, ' ').trim();

/* Legacy line 571. */
const unb = l => String(l).replace(/^[\s•●▪◦○■□▶►➢➤✓✔·*\-–—>]+/, '').trim();
export const isBul = l => /^\s*[•●▪◦○■□▶►➢➤✓✔·*\-–—>]/.test(l);

/* Legacy line 612 (TITLE) and 629 (DG1), 630 (DGI). */
const TITLE = /\b((?:[A-Z][A-Za-z0-9+#.\/&\-]*\s+){0,3}(?:Developer|Engineer|Designer|Analyst|Programmer|Consultant|Architect|Administrator|Scientist|Tester|Specialist|Manager|Intern|Trainee|Lead|Associate))\b/;
const DG1 = /(?:^|[\s,(])(?:B\.?\s?Tech|B\.?\s?Sc\.?|BCA|MCA|MBA|BBA|M\.?\s?Tech|M\.?\s?Sc\.?|Ph\.?\s?D|B\.?\s?Com|B\.?\s?Des)(?=[\s,.)\-–:\/]|$)/i;
const DGI = /\b(?:bachelors?|masters?|diploma|associate degree|doctorate|postgraduate|undergraduate)\b/i;

export const jdCat = l => {
   const n = String(l).toLowerCase().replace(/['’]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9+\/ ]/g, ' ').replace(/\s+/g, ' ').trim();
   if (!n || n.split(' ').length > 7) return '';
   for (const [k, r] of JDH) if (r.test(n)) return k;
   return '';
};

/* A heading is a short line that names a section ("Requirements", "Nice to have:", "**Responsibilities**") or a "Label: text" line whose label does. Bullet lines are never headings. */
export function jdHead(l) {
   const s = l.replace(/^#+\s*/, '').replace(/\*\*|__/g, '').trim(), bul = isBul(l) && !/^\s*(\*\*|__)/.test(l), col = /:\s*$/.test(s),
      inl = s.match(/^([A-Za-z][A-Za-z0-9 &\/'’\-]{1,44}?)\s*:\s*(\S.*)$/);
   if (bul && !(col && !inl)) return null;
   const lab = inl ? inl[1] : s.replace(/\s*:\s*$/, ''), w = lab.split(/\s+/);
   /* Bug fix (legacy line 233): a markdown heading ("## Nice to have") skips the capitalisation test, so lower-case section names are headings too. */
   const hashed = /^#+\s/.test(l);
   if (!inl && !col && (w.length > 5 || /[.,;!?]$/.test(lab) || (!hashed && !w.every(x => JSMALL.has(x.toLowerCase()) || /^[A-Z0-9&]/.test(x))))) return null;
   if (w.length > 6) return null;
   const k = jdCat(lab);
   if (!k) return null;
   return { k, rest: inl ? inl[2].trim() : '', sk: /\b(skills?|must haves?|nice to haves?|good to haves?|tech stack|technolog\w+|tools|preferred|programming|frameworks?)\b/i.test(lab) };
}

const JDGEN = /\b(experience|knowledge|ability|skills?|years?|degree|understanding|proficiency|familiarity|communication|etc|plus|preferred|required|strong|good|excellent|working|hands|basic|advanced|solid|deep|using|with|of|in)\b/i;

/* Skills on one line: dictionary matches always; in a skills-list section, short list items that are not in the dictionary are kept too, spelled as the JD writes them. */
export function jdLineSkills(t, list, skills) {
   if (!skills || typeof skills.findSkills !== 'function' || typeof skills.canon !== 'function') throw new TypeError('jdLineSkills needs { findSkills, canon }');
   const out = new Map(), add = n => { n = clean(n); if (n && !out.has(n.toLowerCase())) out.set(n.toLowerCase(), n) };
   const known = skills.findSkills(t, list ? t : '').map(e => e.n);
   known.forEach(n => add(n));
   /* a list item that merely extends a dictionary skill found on the same line ("Redux Toolkit") is not counted as a second skill */
   if (list) t.replace(/\([^)]*\)/g, ' ').split(/\s*[,;|•·]\s*|\s+(?:and|&)\s+/).forEach(x => {
      x = unb(x).replace(/[.:]+$/, '').trim();
      if (!x || x.length > 28 || x.split(/\s+/).length > 3 || !/^[A-Za-z][A-Za-z0-9+#.\- ]*$/.test(x) || JDGEN.test(x)) return;
      const lx = x.toLowerCase();
      if (known.some(n => lx.includes(n.toLowerCase()))) return;
      add(skills.canon(x));
   });
   return [...out.values()];
}

export const EXPRE = /(\d{1,2})\s*(\+|plus)?\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*\+?\s*)?(?:years?|yrs?)\b/i;
const jdClip = (t, n) => clean(unb(t)).slice(0, n);
const jdSents = t => String(t).replace(/([.!?])\s+(?=[A-Z])/g, '$1\u0001').split('\u0001');

export function jdExp(sec) {
   for (const k of ['exp', 'req', 'sum', 'resp', 'edu', 'oth'])
      for (const it of sec[k]) for (const t of jdSents(it.t)) {
         const m = t.match(EXPRE);
         if (m && +m[1] <= 50 && (k == 'exp' || /experience|\bexp\b/i.test(t))) return { v: jdClip(t, 140), min: +m[1], max: m[3] ? +m[3] : null };
      }
   for (const k of ['exp', 'req', 'sum', 'resp', 'edu', 'oth'])
      for (const it of sec[k]) for (const t of jdSents(it.t))
         if (/\bfreshers?\b|entry[- ]level|no (?:prior |previous )?experience (?:is )?(?:required|needed|necessary)/i.test(t)) return { v: jdClip(t, 140), min: 0, max: null };
   if (sec.exp.length) return { v: jdClip(sec.exp[0].t, 140), min: null, max: null };
   return null;
}

export function jdEdu(sec) {
   const o = [], add = t => { t = jdClip(t, 160); if (t.length > 2 && !o.includes(t)) o.push(t) };
   sec.edu.forEach(it => add(it.t));
   if (!o.length) ['req', 'sum', 'resp', 'exp', 'oth'].forEach(k => sec[k].forEach(it => { if (o.length < 2 && (DG1.test(it.t) || DGI.test(it.t))) add(it.t) }));
   return o.slice(0, 3);
}

const jdList = (a, n) => a.map(x => jdClip(x.t, 200)).filter(x => x.length > 2).slice(0, n);

export function jdTitle(lines, lab) {
   if (lab) return clean(lab).slice(0, 80);
   let n = 0;
   for (const raw of lines.slice(0, 6)) {
      n++;
      const l = unb(raw.replace(/^#+\s*/, '').replace(/\*\*|__/g, '')).replace(/^(?:we\s*(?:are|'re|’re)\s+(?:hiring|looking\s+for)(?:\s+an?)?|hiring|job\s+description|jd|job\s+opening|job\s+posting|opening|vacancy)\s*[:\-–—]?\s*/i, '').replace(/\s*[:\-–—]\s*$/, '').trim();
      if (!l || l.length > 80 || /[.;!?]$/.test(l) || l.split(/\s+/).length > 8) continue;
      const t = l.match(TITLE);
      if (t) return clean(t[1]).slice(0, 80);
      if (n == 1 && !jdCat(l) && l.split(/\s+/).length <= 6 && /^[A-Z]/.test(l)) return clean(l).slice(0, 80);
   }
   return '';
}

/* parseJD(raw, skills): skills = { findSkills, canon } (see jdLineSkills). Returns the ParsedJD shape used by the legacy code. */
export function parseJD(raw, skills) {
   if (!skills || typeof skills.findSkills !== 'function' || typeof skills.canon !== 'function') throw new TypeError('parseJD needs { findSkills, canon }');
   const lines = String(raw).split('\n').map(x => x.trim()).filter(Boolean),
      sec = { sum: [], req: [], pref: [], resp: [], exp: [], edu: [], oth: [], ign: [] };
   let key = 'sum', sk = false, lab = '';
   for (const l of lines) {
      const m = l.match(/^(?:#+\s*)?(?:\*\*|__)?\s*(?:job\s*title|position(?:\s*title)?|role|designation|job\s*role|opening|vacancy)\s*(?:\*\*|__)?\s*[:\-–—]\s*(?:\*\*|__)?\s*(.{2,80}?)\s*(?:\*\*|__)?$/i);
      if (m && !lab) { lab = m[1]; continue }
      const h = jdHead(l);
      if (h) { key = h.k; sk = h.sk; if (h.rest) sec[key].push({ t: h.rest, sk }); continue }
      sec[key].push({ t: l, sk });
   }
   const R = new Map(), P = new Map(), M = new Map(),
      add = (m, n) => { if (!m.has(n.toLowerCase())) m.set(n.toLowerCase(), n) },
      PC = /\b(nice to haves?|good to haves?|(?:is|are|would be)\s+an?\s+(?:plus|advantage|bonus|asset)|a plus|bonus|preferred|desirable|added advantage|an advantage)\b/i;
   for (const k of ['sum', 'req', 'pref', 'resp', 'exp', 'edu', 'oth'])
      for (const it of sec[k])
         for (const t of jdSents(it.t))
            jdLineSkills(t, it.sk && (k == 'req' || k == 'pref'), skills).forEach(n => add(k == 'pref' || PC.test(t) ? P : k == 'req' ? R : M, n));
   let reqNote = 'Taken from the requirements section of the JD.';
   if (!R.size) {
      M.forEach((n, k) => { if (!P.has(k)) add(R, n) });
      M.clear();
      reqNote = 'The JD has no requirements section that names skills, so every skill named outside the preferred list is treated as required.';
   }
   P.forEach((n, k) => { if (R.has(k)) P.delete(k) });
   M.forEach((n, k) => { if (R.has(k) || P.has(k)) M.delete(k) });
   return {
      title: jdTitle(lines, lab),
      req: [...R.values()].slice(0, 40),
      pref: [...P.values()].slice(0, 40),
      men: [...M.values()].slice(0, 40),
      reqNote,
      exp: jdExp(sec),
      edu: jdEdu(sec),
      resp: jdList(sec.resp, 15),
      oth: jdList(sec.oth, 10),
   };
}

/* View model for the "From your job description" panel (legacy jdSummary, lines 342-352), without the HTML.
   j is a job ({ t, jd: { f } }). The page renders it. Returns null where the legacy returned ''. */
export function jdSummary(j) {
   const f = j && j.jd && j.jd.f;
   if (!f) return null;
   return {
      name: j.t,
      title: { s: f.title.s, v: f.title.v || '' },
      reqNote: f.req.n || '',
      pref: { s: f.pref.s, v: f.pref.v },
      men: f.men && f.men.v.length ? { v: f.men.v } : null,
      exp: { s: f.exp.s, v: f.exp.v || '' },
      edu: { s: f.edu.s, v: f.edu.v || '' },
      resp: { s: f.resp.s, v: f.resp.v },
      oth: { s: f.oth.s, v: f.oth.v },
   };
}
