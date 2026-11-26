// Editing of one candidate or draft field, and the display values behind it.
// Pure: returns a new object, never mutates. Port of legacy setField, parseSk, fv and nameOf (app.js 690-699, 692).
import { clean, parseEx, canon, displayName } from '../../lib/text.js';

// Display name. Candidates carry n (blind review applies); drafts only carry real. Legacy nameOf().
export const nameOf = (c, set) => ('n' in c ? displayName(c, set) : c.real);

// Field value shown in the editor. Legacy fv().
export const fieldValue = (c, f, set) => ({
  Name: nameOf(c, set),
  Education: c.ed,
  Experience: c.ex ? c.ex + ' · ' + c.r : '',
  Projects: c.pr,
  Skills: c.sk.join(', '),
})[f];

// Comma-separated skill list: canonical names, unique, at most 30. Legacy parseSk().
export function parseSkills(raw, vocab) {
  const seen = new Set();
  return String(raw).split(/[,;\n]/)
    .map(x => canon(clean(x), vocab))
    .filter(x => x && x.length <= 40 && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
    .slice(0, 30);
}

// Applies one edit. Returns { value } with the updated object, or { error } with the legacy message.
// Field names: 'Name', 'Education', 'Experience', 'Projects', 'Skills'. vocab is the skill vocabulary for canon().
export function applyField(c, field, raw, vocab) {
  if (field === 'Skills') {
    const k = parseSkills(raw, vocab);
    if (!k.length) return { error: 'Enter at least one skill, separated by commas' };
    const next = { ...c, sk: k };
    if (c.an) {
      const had = new Set(k.map(x => x.toLowerCase()));
      next.an = { ...c.an, rm: [...new Set([...(c.an.rm || []), ...c.sk])].filter(x => !had.has(x.toLowerCase())) };
    }
    return { value: next };
  }
  const v = clean(raw);
  if (!v) return { error: field + ' cannot be empty' };
  if (field === 'Experience') {
    const x = parseEx(v);
    if (!x) return { error: 'Use a format like “3 yrs · Role” or “Fresher” (0 to 50 years)' };
    const next = { ...c, ex: x.ex };
    if (x.r) next.r = x.r.slice(0, 60);
    return { value: next };
  }
  if (field === 'Name') {
    const real = v.slice(0, 60);
    return { value: { ...c, real, ...('n' in c ? { n: real } : {}) } };
  }
  if (field === 'Education') {
    const next = { ...c, ed: v.slice(0, 120) };
    if (c.an) next.an = { ...c.an, edu: [], eduFix: 1 };
    return { value: next };
  }
  return { value: { ...c, pr: v.slice(0, 200) } };
}
