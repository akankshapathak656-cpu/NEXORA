// Pure text helpers. No React, no DOM, no storage.
import { SKA, VOC } from '../data/skills.js';

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

// Strips characters that could break out of HTML and collapses whitespace.
export const clean = v => String(v == null ? '' : v).replace(/[<>"`\\]/g, '').replace(/\s+/g, ' ').trim();

// Parses an experience string such as "3 yrs · role" or "Fresher". Returns null when it is not understood.
export const parseEx = v => {
  const p = String(v).split('·').map(x => x.trim()), m = p[0].match(/^(fresher|(\d+)\s*(yrs?|years?))$/i);
  if (!m || (m[2] && +m[2] > 50)) return null;
  return { ex: m[2] ? (+m[2]) + (+m[2] == 1 ? ' yr' : ' yrs') : 'Fresher', r: clean(p.slice(1).join(' · ')) || null };
};

// Skill vocabulary for canon(): the built-in list plus the skills of the given candidates (added candidates included).
export const vocabulary = candidates => [...new Set([...VOC, ...(candidates || []).flatMap(c => c.sk || [])])];

// Canonical skill name for free text: alias table first, then a case-insensitive vocabulary match, else the trimmed input.
// Own-property lookups only, so inputs such as "constructor" are not resolved through Object.prototype.
export const canon = (x, vocab = VOC, aliases = SKA) => {
  const k = x.toLowerCase().replace(/\s+/g, ' ').trim();
  if (has(aliases, k)) return aliases[k];
  const v = vocab.find(s => s.toLowerCase() == k);
  return v !== undefined ? v : x.trim();
};

// Initials for avatars: first letter of up to two words.
export const ini = n => String(n).split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2);

// Display name. With blind review on (set.blind), candidates appear as "Candidate <id + 1>".
// set is the settings object from the store (S.set in legacy).
export const displayName = (c, set) => set && set.blind ? 'Candidate ' + (c.id + 1) : c.real;

// One decimal place, without trailing zeros.
export const d1 = v => String(+v.toFixed(1));

// Percentage label, or "Not scored" for null.
export const pct = v => v == null ? 'Not scored' : v + '%';
