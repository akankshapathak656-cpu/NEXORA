// Upload flow: file checks, extraction, the five progress stages, the sample run, saving a draft and field edits.
// Port of legacy pick(), analyse(), readFile() (checks only), go()/run(), sample(), saveD(), fixP() and fixD()
// (app.js lines 715-730 and 733-765). Runs against the store; the page only renders and calls these.
import { getState, setState } from '../../store/state.js';
import { candidatesFromState } from '../../store/candidates.js';
import { allJobs, resumeContext, skillVocabulary } from '../../store/context.js';
import { addCandidate, saveCandidate, ensureJobSynced, saveAiAnalysis, savePoolOverview, resolvePoolLive } from '../../store/actions.js';
import { extractResume, createCandidate, analyzeResumes } from '../../lib/api.js';
import { rpStructure, rpSkills, rpDetails, resumeDraft, sampleFiles } from '../../lib/resume.js';
import { parseEx, vocabulary } from '../../lib/text.js';
import { NS } from '../../data/samples.js';
import { applyField } from './fields.js';

// Progress stage names (legacy ST).
export const STAGES = ['Reading resume', 'Extracting information', 'Identifying skills', 'Analysing experience', 'Generating candidate profile'];
export const MAX_FILES = 25;
export const MAX_BYTES = 10 * 1024 * 1024;
const MAX_TEXT = 120000;

// Run counter. A newer pick or sample run makes older analyses stop (legacy pkId).
let pkId = 0;
// Stage timer for the simulated sample run (legacy tmr).
let timer = 0;

const tick = () => new Promise(r => setTimeout(r, 0));

// ---------- stage timer ----------

export function isTicking() { return timer !== 0 }

export function stopTicker() {
  clearInterval(timer);
  timer = 0;
}

// Advances state.stage every 800 ms until every stage is done. Legacy go().
export function startTicker() {
  stopTicker();
  timer = setInterval(() => {
    const s = getState();
    const next = s.stage + 1;
    setState({ stage: next });
    if (next >= STAGES.length) stopTicker();
  }, 800);
}

// ---------- context helpers ----------

function currentJob(s) {
  const jobs = allJobs(s);
  return jobs[s.job] || jobs[0];
}

function currentCtx(s = getState()) {
  return resumeContext(currentJob(s), candidatesFromState(s), s);
}

function currentVocab(s = getState()) {
  const list = candidatesFromState(s);
  return skillVocabulary(currentCtx(s), vocabulary(list));
}

// ---------- file checks and text ----------

// Text cleanup and the plain-language refusals from legacy readFile(). Throws Error with the legacy message.
export function checkExtracted(extracted, ext) {
  const t = String(extracted.text || '').replace(/\r/g, '\n').replace(/ﬀ/g, 'ff').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ /g, ' ').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F­​-‍﻿]/g, '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim().slice(0, MAX_TEXT);
  const compact = t.replace(/\s/g, ''), letters = (t.match(/\p{L}/gu) || []).length, words = (t.match(/\p{L}{2,}/gu) || []).length;
  if (!words) throw new Error(ext == 'pdf' ? 'no selectable text found. This looks like a scanned or image-only PDF. OCR is not included, so it cannot be read here' : 'the document is empty: no readable text was found');
  if (words < 20) throw new Error('only ' + words + ' word(s) of text could be read, which is too little for a resume' + (ext == 'pdf' ? '. If this is a scanned PDF, OCR is not included' : ''));
  if (compact.length && letters / compact.length < .5) throw new Error('the text could not be decoded reliably (unusual font encoding). Export the resume as a standard PDF or DOCX and try again');
  return { text: t, words, pages: extracted.pages, read: extracted.read, cut: !!extracted.truncated };
}

// Reads one file through the backend, then checks the text. Legacy readFile(), without the browser fallback.
async function readFile(f, ext) {
  const extracted = await extractResume(f);
  return checkExtracted({ text: extracted.text || '', pages: extracted.pages || undefined, truncated: !!extracted.truncated }, ext);
}

// Publishes the upload list to state.up, without the File objects.
function publish(recs) {
  setState({ up: recs.map(({ n, sz, ok, e, st, note }) => ({ n, sz, ok, e, st, note })) });
}

// ---------- pick and analyse ----------

// Checks a selection and starts the analysis. Legacy pick(fl). toast is the useToast() function.
export async function pickFiles(fileList, toast) {
  const id = ++pkId;
  const files = [...fileList];
  if (!files.length) return;
  const res = [], seen = new Set();
  for (const f of files) {
    const ext = ((f.name.match(/\.(pdf|docx)$/i) || [])[1] || '').toLowerCase();
    const r = { n: f.name, sz: f.size, ok: false, e: '', st: '', note: '', f, ext };
    if (res.filter(x => x.ok).length >= MAX_FILES) r.e = 'over the ' + MAX_FILES + ' file limit';
    else if (!ext) r.e = 'unsupported type (PDF or DOCX only)';
    else if (!f.size) r.e = 'empty file';
    else if (f.size > MAX_BYTES) r.e = 'over 10 MB';
    else if (seen.has(f.name + '|' + f.size)) r.e = 'duplicate in this selection';
    else {
      try {
        const b = new Uint8Array(await f.slice(0, 1024).arrayBuffer());
        const good = ext == 'pdf' ? new TextDecoder('latin1').decode(b).includes('%PDF-') : (b[0] == 0x50 && b[1] == 0x4B);
        if (good) { r.ok = true; seen.add(f.name + '|' + f.size) } else r.e = 'content is not a real ' + ext.toUpperCase() + ' file';
      } catch (x) { r.e = 'could not be read' }
    }
    res.push(r);
  }
  if (id !== pkId) return;
  setState({ upS: 0, up: res.map(({ n, sz, ok, e, st, note }) => ({ n, sz, ok, e, st, note })) });
  const valid = res.filter(f => f.ok);
  if (!valid.length) {
    stopTicker();
    setState({ busy: 0, stage: -1, pd: null });
    toast('No valid files. Use PDF or DOCX under 10 MB');
    return;
  }
  stopTicker();
  setState({ pd: null, pi: 0, busy: 1, stage: 0 });
  if (valid.length < res.length) toast((res.length - valid.length) + ' file(s) rejected. See the list below');
  analyse(res, id, toast);
}

function fixTruncationWarning(draft, cut) {
  if (!cut) return draft;
  draft.warn = draft.warn.map(w => (w.startsWith('Only the first ') ? 'Resume text was truncated to 120,000 characters.' : w));
  return draft;
}

// Reads, parses and drafts every valid file. Uses backend batch analysis first, falling back to per-file extraction.
async function analyse(initial, id, toast) {
  const alive = () => id === pkId;
  let recs = initial;
  const set = (i, patch) => {
    recs = recs.map((r, k) => (k === i ? { ...r, ...patch } : r));
    publish(recs);
  };
  const fail = (i, e) => set(i, { ok: false, st: '', e: (e && e.message) || 'could not be read' });
  const idx = recs.map((r, i) => (r.ok ? i : -1)).filter(i => i >= 0);
  const P = {};
  const job = currentJob(getState());
  const ctx = currentCtx();
  const steps = [rpStructure, rpSkills, rpDetails];

  try {
    // 1) Try backend batch analyze flow first.
    let batch = null;
    try {
      for (const i of idx) recs = recs.map((r, k) => (k === i ? { ...r, st: 'reading' } : r));
      publish(recs);
      await tick();
      if (!alive()) return;
      const jobId = await ensureJobSynced(job);
      if (!alive()) return;
      setState({ stage: 1 });
      const validFiles = idx.map(i => recs[i].f);
      batch = await analyzeResumes(jobId, validFiles, true);
      if (!alive()) return;
    } catch (err) {
      console.error('NEXORA batch analyze failed, falling back to per-file extraction:', err);
      batch = null;
    }

    if (batch) {
      const matched = new Set();
      const resultByIdx = new Map();

      for (const errItem of batch.errors || []) {
        const fname = errItem && errItem.filename;
        const hit = idx.find(i => !matched.has(i) && fname && (recs[i].n === fname || recs[i].n.toLowerCase() === fname.toLowerCase()));
        if (hit != null) {
          matched.add(hit);
          fail(hit, new Error(errItem.error || 'could not be read'));
        }
      }

      const results = batch.results || [];
      for (let rPos = 0; rPos < results.length; rPos++) {
        const res = results[rPos];
        const fname = (res && res.extraction && res.extraction.filename) || (res && res.candidate && res.candidate.filename) || '';
        let hit = idx.find(i => !matched.has(i) && fname && (recs[i].n === fname || recs[i].n.toLowerCase() === fname.toLowerCase()));
        if (hit == null && rPos < idx.length && !matched.has(idx[rPos])) hit = idx[rPos];
        if (hit == null) hit = idx.find(i => !matched.has(i));
        if (hit != null) {
          matched.add(hit);
          resultByIdx.set(hit, res);
        }
      }

      for (const i of idx) {
        if (!matched.has(i)) fail(i, new Error('no analysis result returned by backend'));
      }

      for (const i of idx) {
        if (!recs[i].ok || !resultByIdx.has(i)) continue;
        const res = resultByIdx.get(i);
        const cand = res.candidate || {};
        const extr = res.extraction || {};
        try {
          const t = checkExtracted({ text: cand.resume_text || '', pages: extr.pages, truncated: extr.truncated }, recs[i].ext);
          P[i] = { text: t.text, words: t.words, pages: t.pages, read: t.read, cut: t.cut };
          set(i, { st: 'read', note: t.words + ' words read' + (t.cut ? ' (truncated to 120,000 chars)' : '') });
        } catch (e) {
          fail(i, e);
        }
      }

      for (let k = 0; k < steps.length; k++) {
        setState({ stage: k + 1 });
        await tick();
        if (!alive()) return;
        for (const i of idx) {
          if (!recs[i].ok || !P[i]) continue;
          try { steps[k](P[i], ctx) } catch (e) { fail(i, new Error('the text could not be analysed')) }
        }
      }

      setState({ stage: 4 });
      await tick();
      if (!alive()) return;

      const okIdx = idx.filter(i => recs[i].ok && P[i] && resultByIdx.has(i));
      if (!okIdx.length) {
        setState({ busy: 0, stage: -1, pd: null });
        const why = idx.length == 1 && recs[idx[0]].e ? ': ' + recs[idx[0]].e : '. See the list below';
        toast('Could not read text' + (idx.length == 1 ? '' : ' from any file') + why);
        return;
      }

      const drafts = okIdx.map(i => {
        const res = resultByIdx.get(i);
        const cand = res.candidate || {};
        const analysis = res.analysis || null;
        const pc = (analysis && analysis.parsed_context) || {};
        const draft = fixTruncationWarning(resumeDraft(P[i], recs[i].n, ctx), P[i].cut);
        draft.apiId = cand.id != null ? cand.id : null;
        draft.resumeText = cand.resume_text || P[i].text;
        draft.aiAnalysis = analysis;
        if (pc.name) {
          draft.real = pc.name;
          draft.miss = draft.miss.filter(m => m !== 'Name');
        }
        if (pc.email) draft.em = pc.email;
        if (pc.phone) draft.ph = pc.phone;
        if (pc.education) {
          draft.ed = pc.education;
          draft.miss = draft.miss.filter(m => m !== 'Education');
        }
        if (draft.apiId != null && analysis) {
          saveAiAnalysis(job.t, draft.apiId, analysis);
        }
        return draft;
      });

      if (batch.pool_overview) {
        savePoolOverview(job.t, batch.pool_overview);
      }

      setState({ pd: drafts, pi: 0, stage: STAGES.length, busy: 0 });
      toast(okIdx.length + ' of ' + idx.length + ' resume(s) analysed' + (batch.mode === 'ai' ? ' with AI' : '') + (okIdx.length < idx.length ? '; see the list below for the rest' : ''));
      return;
    }

    // 2) Fallback: per-file extraction + browser parsing.
    setState({ stage: 0 });
    for (const i of idx) {
      set(i, { st: 'reading' });
      await tick();
      if (!alive()) return;
      try {
        const t = await readFile(recs[i].f, recs[i].ext);
        if (!alive()) return;
        P[i] = { text: t.text, words: t.words, pages: t.pages, read: t.read, cut: t.cut };
        set(i, { st: 'read', note: t.words + ' words read' + (t.cut ? ' (truncated to 120,000 chars)' : '') });
      } catch (e) { fail(i, e) }
    }
    for (let k = 0; k < steps.length; k++) {
      setState({ stage: k + 1 });
      await tick();
      if (!alive()) return;
      for (const i of idx) {
        if (!recs[i].ok) continue;
        try { steps[k](P[i], ctx) } catch (e) { fail(i, new Error('the text could not be analysed')) }
      }
    }
    setState({ stage: 4 });
    await tick();
    if (!alive()) return;
    const okIdx = idx.filter(i => recs[i].ok);
    if (!okIdx.length) {
      setState({ busy: 0, stage: -1, pd: null });
      const why = idx.length == 1 && recs[idx[0]].e ? ': ' + recs[idx[0]].e : '. See the list below';
      toast('Could not read text' + (idx.length == 1 ? '' : ' from any file') + why);
      return;
    }
    const drafts = okIdx.map(i => {
      const draft = fixTruncationWarning(resumeDraft(P[i], recs[i].n, ctx), P[i].cut);
      draft.resumeText = P[i].text;
      return draft;
    });
    setState({ pd: drafts, pi: 0, stage: STAGES.length, busy: 0 });
    toast(okIdx.length + ' of ' + idx.length + ' resume(s) read. Fields updated from the resume text' + (okIdx.length < idx.length ? '; see the list below for the rest' : ''));
  } catch (e) {
    if (alive()) {
      setState({ busy: 0, stage: -1, pd: null });
      toast('Could not read the selected files' + (e && e.message ? ': ' + e.message : ''));
    }
  }
}

// Starts the simulated run on the built-in sample candidates. Legacy sample() and run().
export function runSample() {
  pkId++;
  const s = getState();
  const list = candidatesFromState(s);
  setState({ busy: 0, up: sampleFiles(list, NS), upS: 1, pd: null, stage: 0 });
  startTicker();
  resolvePoolLive(currentJob(s), list, { force: false }).catch(() => {});
}

// ---------- drafts and saved candidates ----------

// Saves the draft at index as a new candidate. Legacy saveD().
export async function saveDraft(index, toast) {
  const s = getState();
  const d = s.pd && s.pd[index];
  if (!d || d.saved != null) return;
  if (!d.real) return toast('Name is required');
  if (!d.ex) return toast('Enter experience first, for example “2 yrs · Role” or “Fresher”');
  if (!d.sk.length) return toast('Add at least one skill before saving');
  const c = { real: d.real, n: d.real, r: d.r, st: 'New', sk: d.sk.slice(), ex: d.ex, ed: d.ed || 'Not provided', pr: d.pr || 'Not provided', file: d.file, em: d.em || '', ph: d.ph || '', lo: d.lo || '', cert: d.cert || [], wk: d.wk || [], an: d.an || null, apiId: d.apiId || null };
  if (!c.apiId) {
    try {
      const parsed = parseEx(c.ex);
      const years = parsed && parsed.ex.toLowerCase() != 'fresher' ? (parseFloat(parsed.ex) || 0) : 0;
      const saved = await createCandidate({ name: c.n, email: c.em, experience_years: years, education: c.ed, skills: c.sk, resume_text: d.resumeText || [c.pr, 'Skills: ' + c.sk.join(', ')].join('\n'), status: 'New' });
      c.apiId = saved.id;
    } catch (err) { console.error('NEXORA candidate sync failed:', err) }
  }
  const id = addCandidate(c);
  setState(st => ({ pd: st.pd.map((x, i) => (i === index ? { ...x, saved: id } : x)), sel: id }));
  toast(c.apiId ? c.n + ' added and synced to the backend' : c.n + ' added locally; backend sync failed');
}

// Edits one field of a saved candidate. Returns { ok } or { error }. Legacy fixP() without the toasts.
export function commitCandidateField(c, field, raw, set) {
  if (field === 'Name' && set && set.blind) return { error: 'Names are hidden in blind review' };
  const r = applyField(c, field, raw, currentVocab());
  if (r.error) return { error: r.error };
  saveCandidate(r.value);
  return { ok: true };
}

// Edits one field of the draft at index. Returns { ok } or { error }. Legacy fixD() without the toasts.
export function commitDraftField(index, field, raw) {
  const s = getState();
  const d = s.pd && s.pd[index];
  if (!d || d.saved != null) return { ok: false };
  const r = applyField(d, field, raw, currentVocab(s));
  if (r.error) return { error: r.error };
  setState(st => ({ pd: st.pd.map((x, i) => (i === index ? r.value : x)) }));
  return { ok: true };
}
