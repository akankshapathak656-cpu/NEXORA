// Outreach templates and preview text. Port of legacy TP, fill() and pvt() (app.js lines 1041-1043). Pure.
import { mm } from './scoring.js';

export const TEMPLATES = [
  ['Interview invitation', 'Dear {name},\n\nThank you for applying. We would like to invite you to an interview for the {role} role. Please share your availability.\n\nRegards,\nNEXORA Talent Team'],
  ['Skill feedback', 'Dear {name},\n\nThank you for applying for the {role} role. We could not find evidence of {gaps} in your resume. If you have it, feel free to share examples. Otherwise these are great areas to explore.\n\nRegards,\nNEXORA Talent Team'],
];

// Fills {name}, {role} and {gaps} for one candidate. Uses the real name, as legacy did.
export function fillTemplate(text, c, job) {
  const gaps = mm(c, job.req).no;
  return text
    .split('{name}').join(c.real)
    .split('{role}').join(job.t)
    .split('{gaps}').join(gaps.length ? gaps.join(', ') : 'further skills beyond the listed requirements');
}

// The full preview: a To line, then the filled body.
export function previewText(body, c, job) {
  return 'To: ' + c.real.toLowerCase().replace(/\s+/g, '.') + '@example.com\n\n' + fillTemplate(body, c, job);
}
