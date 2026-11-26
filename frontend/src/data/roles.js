import { JOBS } from './jobs.js';

// Related-role requirements, keyed by role title. Merged with the built-in jobs by RD().
export const XR = { 'Web Designer': ['Figma', 'CSS', 'HTML', 'Accessibility'], 'Full Stack Developer': ['JavaScript', 'React', 'Node.js', 'REST APIs', 'Git', 'Testing'], 'SDE': ['JavaScript', 'React', 'TypeScript', 'REST APIs', 'Git', 'Testing'] };

// Role-requirement map used by rolesFor(): XR plus each job's requirement list.
// Takes the job list as an argument so custom jobs can be included.
export const RD = (jobs = JOBS) => ({ ...XR, ...Object.fromEntries(jobs.map(j => [j.t, j.req])) });
