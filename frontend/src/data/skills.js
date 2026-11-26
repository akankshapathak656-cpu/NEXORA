import { JOBS } from './jobs.js';
import { XR } from './roles.js';
import { SAMPLE_CANDIDATES } from './samples.js';

// Related-skill map: skill the candidate lists -> [requirement it relates to, why].
// A related skill counts at half and is always shown as "confirm depth", never as proof.
export const TRX = { Vue: [['React', 'Vue and React both use component, props and state concepts'], ['JavaScript', 'Vue is written in JavaScript']], Flask: [['REST APIs', 'Flask is commonly used to build HTTP and REST endpoints']], Figma: [['CSS', 'Figma is a design tool, so the link to CSS is through UI design handoff']], 'Node.js': [['REST APIs', 'Node.js services commonly expose REST endpoints']], Python: [['Node.js', 'Server-side programming experience in another runtime']], TypeScript: [['JavaScript', 'TypeScript is a superset of JavaScript']], React: [['JavaScript', 'React is a JavaScript library']] };

// Project evidence: a skill counts as used in a project only when the project text names it
// (or a named stack that contains it, such as MERN).
export const AL = { TypeScript: /typescript|\bts\b/i, 'REST APIs': /\brest\b|\bapis?\b/i, Accessibility: /accessib|a11y/i, Testing: /\btests?\b|testing|jest|vitest/i, 'Node.js': /\bnode|\bmern\b/i, React: /react|\bmern\b/i, JavaScript: /javascript|\bjs\b/i };

// Skill-name normaliser: lower-case alias -> canonical skill name. Used by canon() in lib/text.js.
export const SKA = { js: 'JavaScript', ts: 'TypeScript', nodejs: 'Node.js', node: 'Node.js', 'rest api': 'REST APIs', 'rest apis': 'REST APIs', restapi: 'REST APIs', restapis: 'REST APIs', a11y: 'Accessibility', reactjs: 'React', 'react.js': 'React', vuejs: 'Vue' };

// Built-in vocabulary: skills from the built-in jobs, the related-role map and the sample candidates,
// de-duplicated in that order. The legacy VOC also held skills from added candidates; lib/text.js
// vocabulary(candidates) extends this list with them.
export const VOC = [...new Set([...JOBS.flatMap(j => j.req), ...Object.values(XR).flat(), ...SAMPLE_CANDIDATES.flatMap(c => c.sk)])];
