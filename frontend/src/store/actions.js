// Store actions for the job and resume flow. Pure setState calls, plus the backend status sync
// that legacy commit() made. Each action reads the current state with getState() and writes with setState().
import { getState, setState, SEED_VERSION } from './state.js';
import { candidatesFromState } from './candidates.js';
import { anGet } from '../lib/resume.js';
import { persistRecord, persistTarget } from '../lib/resume.js';
import { clean } from '../lib/text.js';
import { NS } from '../data/samples.js';
import {
  createCandidate,
  createJob,
  getAiConfig,
  getJobAnalyses,
  getJobOverview,
  scoreCandidateApi,
  updateCandidateStatus,
} from '../lib/api.js';
import { allJobs, resumeContext } from './context.js';

// Legacy SN: status spellings that are stored under a shorter name.
const SN = { 'Needs review': 'Review', 'Rejected (by HR)': 'Rejected', Approved: 'Shortlisted' };

// Selects a job by index into allJobs(state). Port of legacy setJob(i) (app.js line 209).
// Also refreshes the stored analysis of every added candidate for the new job, as legacy did.
export function setJob(index) {
  const s = getState();
  const jobs = allJobs(s);
  const job = jobs[index];
  if (!job) return;
  setState({ job: index, ob: { ...s.ob, done: { ...s.ob.done, job: 1 } } });
  const list = candidatesFromState(getState());
  const ctx = resumeContext(job, list, getState());
  for (const c of list) {
    if (c.id < NS || !c.an) continue;
    const next = anGet(c, ctx);
    if (next && next !== c.an) saveCandidate({ ...c, an: next });
  }
}

// Writes one candidate record to the store: state.fix for samples (by id), state.add for added candidates
// (by id minus NS). Port of legacy persist(c). The record never holds scores.
export function saveCandidate(c) {
  const { bucket, key } = persistTarget(c, NS);
  const rec = persistRecord(c, NS);
  setState(s => {
    if (bucket === 'fix') return { fix: { ...s.fix, [key]: rec } };
    const add = s.add.slice();
    add[key] = rec;
    return { add };
  });
}

// Adds a new candidate from a saved draft. Port of the state part of legacy saveD(). Returns the new id.
export function addCandidate(draft) {
  const s = getState();
  const id = NS + s.add.length;
  const c = { ...draft, id, st: 'New' };
  setState({ add: [...s.add, persistRecord(c, NS)] });
  return id;
}

// Records a recruiter decision. Port of legacy commit() (app.js line 1000): status, time-stamped record,
// last-decision marker, then the backend sync. Resolves to true when the backend accepted the change,
// false when it failed, and null when the candidate has no backend id.
export async function commitStatus(c, value, note = '') {
  const s = SN[value] || value;
  setState(st => ({
    status: { ...st.status, [c.id]: s },
    rec: { ...st.rec, [c.id]: { s, t: Date.now(), n: clean(note || '').slice(0, 200) } },
    last: { id: c.id, s },
    pdc: null,
  }));
  if (!c.apiId) return null;
  try {
    await updateCandidateStatus(c.apiId, s == 'Review' ? 'Needs review' : s);
    return true;
  } catch (err) {
    console.error('NEXORA candidate status sync failed:', err);
    return false;
  }
}

// Adds or removes a candidate from the compare list (max 3). Port of legacy cmpAdd(i).
// name is the display name (blind review aware). Returns the message the caller shows as a toast.
export function toggleCompare(c, name) {
  const s = getState();
  if (s.cmp.includes(c.id)) {
    setState({ cmp: s.cmp.filter(x => x != c.id) });
    return 'Removed from compare';
  }
  if (s.cmp.length >= 3) return 'Compare up to 3';
  setState({ cmp: [...s.cmp, c.id] });
  return name + ' added to compare (' + (s.cmp.length + 1) + '/3)';
}

// Appends a custom job, then selects it. Port of the state part of legacy addJob(e) and jdSubmit().
export function addCustomJob(job) {
  const s = getState();
  const index = allJobs(s).length;
  setState({ jobs: [...s.jobs, job], nj: 0, jdd: {} });
  setJob(index);
  return index;
}

// Replaces a custom job that is being edited (index >= the built-in count), then selects it.
// Legacy jdSubmit() edit branch: title, required skills, description and JD record change; the rest is kept.
export function updateCustomJob(index, patch) {
  const s = getState();
  const base = allJobs(s).length - s.jobs.length;
  const k = index - base;
  setState({ jobs: s.jobs.map((j, i) => (i === k ? { ...j, ...patch } : j)), nj: 0, jdd: {} });
  setJob(index);
}

// Sets one field of the custom job description form (legacy jdIn). Value is capped as legacy did.
export function setJdField(key, value, max = 20000) {
  setState(s => ({ jdd: { ...s.jdd, [key]: String(value).slice(0, max) } }));
}

// Opens or closes the custom job description panel. Legacy jdToggle() and jdCancel(): cancelling an edit clears it.
export function toggleJdPanel() {
  const s = getState();
  if (s.jdd.open) {
    setState({ jdd: s.jdd.edit != null ? {} : { ...s.jdd, open: 0 } });
    return;
  }
  setState({ jdd: { ...s.jdd, open: 1, edit: null }, nj: 0 });
}

// Clears the JD form fields but keeps the panel open on the same edit target. Legacy jdClear().
export function clearJdPanel() {
  const s = getState();
  setState({ jdd: { open: 1, edit: s.jdd.edit == null ? null : s.jdd.edit } });
}

// Fills the JD form from a saved custom job, for editing. Legacy jdEdit(i): only values the recruiter typed are kept.
export function openJdEditor(index, job) {
  const f = job && job.jd && job.jd.f;
  if (!f) return;
  const u = x => x.s == 'user';
  setState({
    jdd: {
      open: 1,
      edit: index,
      raw: job.jd.raw || '',
      title: u(f.title) ? f.title.v : '',
      req: u(f.req) ? f.req.v.join(', ') : '',
      pref: u(f.pref) ? f.pref.v.join(', ') : '',
      exp: u(f.exp) ? f.exp.v : '',
      edu: u(f.edu) ? f.edu.v : '',
      resp: u(f.resp) ? f.resp.v.join('\n') : '',
      oth: u(f.oth) ? f.oth.v.join('\n') : '',
    },
    nj: 0,
  });
}

// Shows or hides the quick "New job" form. Legacy S.nj = !S.nj.
export function toggleQuickJob() {
  setState(s => ({ nj: s.nj ? 0 : 1 }));
}

const jobSyncInFlight = new Map();
const candSyncInFlight = new Map();
const scoreInFlight = new Map();
const poolInFlight = new Map();

export function candidateApiId(c, s = getState()) {
  if (!c) return null;
  return c.apiId || (s.candApiIds && s.candApiIds[c.id]) || null;
}

export function aiAnalysisFor(job, c, s = getState()) {
  if (!job || !c) return null;
  const apiId = candidateApiId(c, s);
  if (!apiId || !s.aiAnalyses) return null;
  return s.aiAnalyses[`${job.t}|${apiId}`] || null;
}

function seedResumeText(c) {
  if (c && typeof c.resumeText === 'string' && c.resumeText.trim()) {
    return c.resumeText.trim();
  }
  const lines = [
    c.real || c.n || 'Candidate',
    c.r ? `Target / Current Role: ${c.r}` : '',
    c.ex ? `Experience: ${c.ex}` : '',
    c.ed && c.ed !== 'Not provided' ? `Education: ${c.ed}` : '',
    c.sk && c.sk.length ? `Skills: ${c.sk.join(', ')}` : '',
    c.pr && c.pr !== 'Not provided' ? `Projects: ${c.pr}` : '',
    c.wk && c.wk.length ? `Work History:\n${c.wk.join('\n')}` : '',
    c.cert && c.cert.length ? `Certifications: ${c.cert.join(', ')}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function seedYears(ex) {
  const m = String(ex || '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

export async function ensureJobSynced(job) {
  if (!job) return null;
  if (job.apiId) return job.apiId;
  const cached = getState().jobApiIds?.[job.t];
  if (cached) return cached;
  if (jobSyncInFlight.has(job.t)) return jobSyncInFlight.get(job.t);
  const p = (async () => {
    const saved = await createJob(
      {
        title: job.t,
        description: (job.jd && job.jd.raw) || job.d || '',
        required_skills: job.req || [],
        preferred_skills: (job.jd && job.jd.f && job.jd.f.pref.v) || job.pref || [],
        experience_min:
          job.jd && job.jd.f && job.jd.f.exp.min != null
            ? job.jd.f.exp.min
            : job.expMin != null
              ? job.expMin
              : null,
        education: (job.jd && job.jd.f && job.jd.f.edu.v) || job.edu || '',
        responsibilities: (job.jd && job.jd.f && job.jd.f.resp.v) || job.resp || [],
      },
      true,
    );
    setState(s => ({ jobApiIds: { ...s.jobApiIds, [job.t]: saved.id } }));
    return saved.id;
  })().finally(() => jobSyncInFlight.delete(job.t));
  jobSyncInFlight.set(job.t, p);
  return p;
}

export async function ensureCandidateSynced(c) {
  if (!c) return null;
  const existing = candidateApiId(c);
  if (existing) return existing;
  if (candSyncInFlight.has(c.id)) return candSyncInFlight.get(c.id);
  const p = (async () => {
    const saved = await createCandidate(
      {
        name: c.real || c.n || 'Candidate',
        email: c.em || '',
        phone: c.ph || '',
        experience_years: seedYears(c.ex),
        education: c.ed && c.ed !== 'Not provided' ? c.ed : '',
        skills: Array.isArray(c.sk) ? c.sk : [],
        resume_text: seedResumeText(c),
        filename: c.file || '',
        status: 'New',
      },
      true,
    );
    setState(s => ({ candApiIds: { ...s.candApiIds, [c.id]: saved.id } }));
    return saved.id;
  })().finally(() => candSyncInFlight.delete(c.id));
  candSyncInFlight.set(c.id, p);
  return p;
}

export async function loadAiConfig() {
  try {
    const aiConfig = await getAiConfig();
    setState({ aiConfig });
    return aiConfig;
  } catch {
    return null;
  }
}

function ensureSeedVersion() {
  if (getState().seedVersion !== SEED_VERSION) {
    setState({
      seedVersion: SEED_VERSION,
      jobApiIds: {},
      candApiIds: {},
      poolOverviews: {},
      aiAnalyses: {},
    });
  }
}

export async function scoreCandidateLive(job, c, force = false) {
  if (!job || !c) return null;
  ensureSeedVersion();
  const key = `${job.t}|${c.id}`;
  if (!force) {
    const cached = aiAnalysisFor(job, c);
    if (cached) return cached;
  }
  if (scoreInFlight.has(key)) return scoreInFlight.get(key);
  const p = (async () => {
    const [jobId, candId] = await Promise.all([ensureJobSynced(job), ensureCandidateSynced(c)]);
    const result = await scoreCandidateApi(jobId, candId, force);
    saveAiAnalysis(job.t, candId, result);
    return result;
  })().finally(() => scoreInFlight.delete(key));
  scoreInFlight.set(key, p);
  return p;
}

export async function resolvePoolLive(job, candidates, { force = false } = {}) {
  if (!job || !Array.isArray(candidates) || !candidates.length) return null;
  ensureSeedVersion();
  if (!force && poolInFlight.has(job.t)) return poolInFlight.get(job.t);
  const p = (async () => {
    const jobId = await ensureJobSynced(job);
    // Hydrate any cached backend analyses/overview first
    if (!force) {
      try {
        const existing = await getJobAnalyses(jobId);
        if (existing && Array.isArray(existing.analyses) && existing.analyses.length) {
          setState(s => {
            const nextAnalyses = { ...s.aiAnalyses };
            for (const a of existing.analyses) {
              nextAnalyses[`${job.t}|${a.candidate_id}`] = a;
            }
            const nextOverviews = existing.pool_overview
              ? { ...s.poolOverviews, [job.t]: existing.pool_overview }
              : s.poolOverviews;
            return { aiAnalyses: nextAnalyses, poolOverviews: nextOverviews };
          });
        }
      } catch { /* proceed to score */ }
    }

    const total = candidates.length;
    let done = 0;
    let newlyScored = 0;
    setState({ poolProgress: { jobTitle: job.t, phase: 'scoring', done: 0, total } });

    // Pre-sync all unsynced candidates in parallel (fast SQLite inserts) before parallel LLM scoring.
    await Promise.all(
      candidates.map(c => ensureCandidateSynced(c).catch(() => null)),
    );

    const queue = candidates.slice();
    const concurrency = Math.max(1, Math.min(getState().aiConfig?.max_concurrency || 8, 12));
    async function worker() {
      while (queue.length) {
        const c = queue.shift();
        try {
          const hadCached = !force && !!aiAnalysisFor(job, c);
          if (!hadCached) {
            await scoreCandidateLive(job, c, force);
            newlyScored++;
          }
        } catch (err) {
          console.error('NEXORA pool score failed for candidate:', c && c.id, err);
        } finally {
          done++;
          setState({ poolProgress: { jobTitle: job.t, phase: 'scoring', done, total } });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, total) }, () => worker()));

    const needOverview = force || newlyScored > 0 || !getState().poolOverviews?.[job.t];
    let overview = getState().poolOverviews?.[job.t] || null;
    if (needOverview) {
      setState({ poolProgress: { jobTitle: job.t, phase: 'collating', done: total, total } });
      overview = await getJobOverview(jobId, true);
      setState(s => ({ poolOverviews: { ...s.poolOverviews, [job.t]: overview } }));
    }
    setState({ poolProgress: null });
    return overview;
  })().finally(() => {
    poolInFlight.delete(job.t);
    if (getState().poolProgress?.jobTitle === job.t) {
      setState({ poolProgress: null });
    }
  });
  poolInFlight.set(job.t, p);
  return p;
}

export async function refreshJobOverview(job, force = true, candidates = null) {
  if (Array.isArray(candidates) && candidates.length) {
    return resolvePoolLive(job, candidates, { force });
  }
  const jobId = await ensureJobSynced(job);
  const overview = await getJobOverview(jobId, force);
  setState(s => ({ poolOverviews: { ...s.poolOverviews, [job.t]: overview } }));
  return overview;
}

export function saveAiAnalysis(jobTitle, candidateApiId, analysis) {
  setState(s => ({ aiAnalyses: { ...s.aiAnalyses, [`${jobTitle}|${candidateApiId}`]: analysis } }));
}

export function savePoolOverview(jobTitle, overview) {
  setState(s => ({ poolOverviews: { ...s.poolOverviews, [jobTitle]: overview } }));
}
