// Job list and resume-analysis context shared by the Upload and Match pages.
// Legacy pushed every custom job into JOBS at load (app.js line 96), so the combined list is
// the built-in JOBS followed by state.jobs, in the same order. Index into this list is state.job.
import { JOBS } from '../data/jobs.js';
import { XR } from '../data/roles.js';
import { NS } from '../data/samples.js';
import { SKD as SKILL_BASE } from '../data/skillBase.js';

// Memoised on the identity of state.jobs, so skillDict() in lib/resume.js stays cached.
let jobsCache = { src: null, out: JOBS };
export function allJobs(state) {
  const custom = state && Array.isArray(state.jobs) ? state.jobs : [];
  if (custom !== jobsCache.src) {
    jobsCache = { src: custom, out: custom.length ? [...JOBS, ...custom] : JOBS };
  }
  return jobsCache.out;
}

// The ctx object lib/resume.js and lib/scoring.js expect: { job, skills, jobs, xr, candidates, ns }.
export function resumeContext(job, candidates, state) {
  return { job, skills: SKILL_BASE, jobs: allJobs(state), xr: XR, candidates, ns: NS };
}

// Skill vocabulary for canon(): built-in names, the base dictionary and every job or candidate skill.
// Legacy got the same list because skillDict() pushed its names into VOC.
export function skillVocabulary(ctx, vocab) {
  const names = [...vocab, ...SKILL_BASE.map(e => e.n), ...ctx.jobs.flatMap(j => j.req)];
  return [...new Set(names)];
}
