// Step 1: choose the job, add resumes, watch the analysis, check and save each parsed profile.
// Port of legacy upload() (app.js 702-714) and the field edits of fixP/fixD/saveD (717-729).
import { useEffect, useRef, useState } from 'react';
import { useAppState } from '../store/state.js';
import { allJobs, resumeContext, skillVocabulary } from '../store/context.js';
import { toggleJdPanel, toggleQuickJob, loadAiConfig } from '../store/actions.js';
import { useToast } from '../components/ui/Toast.jsx';
import { ChipList } from '../components/ui/Chip.jsx';
import { PageHead } from '../components/CandParts.jsx';
import { JobSelect } from '../components/JobSelect.jsx';
import AnalysisView from '../components/AnalysisView.jsx';
import { NS } from '../data/samples.js';
import { vocabulary } from '../lib/text.js';
import { pickFiles, runSample, startTicker, stopTicker, isTicking, STAGES, commitCandidateField, commitDraftField, saveDraft } from './upload/pipeline.js';
import { JdPanel, JdSummary, QuickJobForm, JdBadge } from './upload/JdForm.jsx';
import { ProgressCard, CompleteCard, ResumeTracking, DraftOverview } from './upload/Results.jsx';

function uploadNote(aiConfig) {
  const scoring = aiConfig && aiConfig.ai_enabled
    ? 'analysed with AI (' + (aiConfig.model || 'LLM') + ')'
    : 'scored with backend heuristic analysis';
  return 'Resumes are sent to the backend for PDF/DOCX text extraction (up to 120,000 characters per file) and ' + scoring + ' alongside structured skill and evidence checks against the job description selected here. Scanned (image-only) PDFs cannot be read because OCR is not included. Check every extracted field against the resume before saving. The sample resumes button still loads stored sample data and has no resume text to analyse.';
}

export default function Upload({ candidates }) {
  const state = useAppState();
  const toast = useToast();
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const jobs = allJobs(state);
  const job = jobs[state.job] || jobs[0];
  const ctx = resumeContext(job, candidates, state);
  const vocab = skillVocabulary(ctx, vocabulary(candidates));

  // Load backend AI config and resume the sample stage timer on mount; stop timer on unmount.
  useEffect(() => {
    loadAiConfig();
    if (state.stage >= 0 && state.stage < STAGES.length && !isTicking() && !state.busy) startTicker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => stopTicker(), []);

  const drafts = state.pd || [];
  const pi = drafts.length ? Math.min(state.pi, drafts.length - 1) : 0;
  const fin = state.stage >= STAGES.length && !!state.up;
  const dr = !state.upS && drafts.length ? drafts[pi] : null;
  const c = candidates.find(x => x.id === state.sel) || candidates[0];
  const count = state.up ? state.up.filter(f => f.ok).length : 0;

  // Edits from the completed-analysis card. Return the message the card toasts.
  const commitCandidate = (cand, field, raw) => {
    const r = commitCandidateField(cand, field, raw, state.set);
    if (r.error) return { error: r.error };
    return { ok: 'Correction saved and score refreshed' };
  };
  const commitDraft = (field, raw) => {
    const r = commitDraftField(pi, field, raw);
    if (r.error) return { error: r.error };
    return r.ok ? { ok: 'Field updated. Save the profile to add it to the pool' } : null;
  };

  const onDrop = e => {
    e.preventDefault();
    setDragOver(false);
    pickFiles(e.dataTransfer.files, toast);
  };

  return (
    <>
      <PageHead title="Step 1 · Job & resumes" sub="Choose the role you are hiring for, then add candidate resumes" />
      <div className="note">{uploadNote(state.aiConfig)}</div>
      <div className="two">
        <div className="card">
          <h3>1. Choose the job</h3>
          <div className="row">
            <label>Job <JobSelect /></label>
            <button className="btn sm" onClick={() => toggleQuickJob()}>{state.nj ? 'Cancel' : '+ New job'}</button>
            <button className="btn sm" onClick={() => toggleJdPanel()} aria-expanded={state.jdd.open ? 'true' : 'false'}>
              {state.jdd.open ? 'Close JD panel' : 'Paste job description'}
            </button>
          </div>
          <p>{job.d || ''}</p>
          <p>Required skills{job.jd && job.jd.f ? <> <JdBadge source={job.jd.f.req.s} /></> : null}</p>
          <ChipList items={job.req} kind="ok" />
          <JdSummary job={job} index={state.job} />
          {state.nj ? <QuickJobForm vocab={vocab} /> : null}
        </div>
        <div className="card">
          <h3>2. Add resumes</h3>
          <label
            className={dragOver ? 'drop dg' : 'drop'}
            id="dz"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key == 'Enter' || e.key == ' ') {
                e.preventDefault();
                if (fileRef.current) fileRef.current.click();
              }
            }}
            onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <b>Drop PDF or DOCX files here</b>
            <p>or click to browse (max 10 MB each)</p>
            <input
              id="fi"
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.docx"
              tabIndex={-1}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              onChange={e => {
                pickFiles(e.target.files, toast);
                e.target.value = '';
              }}
            />
          </label>
          <div className="row">
            <button className="btn p sm" onClick={() => runSample()}>Use {NS} sample resumes</button>
          </div>
        </div>
      </div>
      <JdPanel ctx={ctx} vocab={vocab} />
      <ProgressCard up={state.up} upS={state.upS} stage={state.stage} aiConfig={state.aiConfig} />
      {fin && (dr || c) ? (
        <CompleteCard
          count={count}
          c={c}
          dr={dr}
          drafts={drafts}
          pi={pi}
          candidates={candidates}
          job={job}
          ctx={ctx}
          set={state.set}
          commitCandidate={commitCandidate}
          commitDraft={commitDraft}
          saveDraftAt={index => saveDraft(index, toast)}
        />
      ) : null}
      <ResumeTracking up={state.up} upS={state.upS} drafts={drafts} />
      {fin && dr ? <DraftOverview drafts={drafts} pi={pi} job={job} ctx={ctx} /> : null}
      {fin && dr ? <AnalysisView c={dr} j={job} ctx={ctx} name={dr.real || 'Name not found'} /> : null}
    </>
  );
}
