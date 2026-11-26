// Upload results: progress, the completed-analysis card with its editable fields, the resume tracking list and the
// overview of several resumes. Port of legacy upload() progress and fin blocks (app.js 709-713), anTrack() (938-947),
// anOverview() (949-955) and grp() (548).
import { useEffect, useState } from 'react';
import { setState } from '../../store/state.js';
import { CandidateSelect } from '../../components/CandParts.jsx';
import { ChipList } from '../../components/ui/Chip.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { anGet, catOf, CATL } from '../../lib/resume.js';
import { valid, sco, cmpS, rankAll } from '../../lib/scoring.js';
import { pct } from '../../lib/text.js';
import { anEval } from '../../lib/evidence.js';
import { SoftChips } from '../../components/AnalysisView.jsx';
import { STAGES } from './pipeline.js';
import { fieldValue, nameOf } from './fields.js';

// Size label for a file. Legacy kb().
export const kb = b => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

// Text field that commits on blur, as the legacy onchange did. onCommit returns { error } or { ok: message }.
export function EditField({ label, value, placeholder, readOnly, maxLength = 200, onCommit }) {
  const toast = useToast();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    if (text === value) return;
    const r = onCommit(text);
    if (r && r.error) {
      toast(r.error);
      setText(value);
    } else if (r && r.ok) {
      toast(r.ok);
    }
  };
  return (
    <>
      <p style={{ margin: '10px 0 2px' }}>{label}</p>
      <input
        aria-label={label}
        value={text}
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ width: '100%' }}
        readOnly={readOnly}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </>
  );
}

// Progress card. Legacy upload() section 3.
export function ProgressCard({ up, upS, stage, aiConfig }) {
  const modeLabel = upS ? 'Simulated' : (aiConfig?.ai_enabled ? 'AI · ' + aiConfig.model : 'Backend heuristic');
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>3. Analysis progress <span className="chip">{modeLabel}</span></h3>
      {up ? (
        <p>
          {up.map((f, i) => (
            <span key={i}>
              {i ? <br /> : null}
              {f.n}{f.sz != null ? ' · ' + kb(f.sz) : ''}
              {f.ok ? (f.st == 'reading' ? ' · reading…' : f.note ? ' · ' + f.note : '') : ' ✗ ' + f.e}
            </span>
          ))}
        </p>
      ) : <p>No resumes yet. Add files or use the sample resumes to start.</p>}
      {stage >= 0 ? STAGES.map((x, i) => (
        <div className="li" key={i}>
          <span>{x}</span>
          <span className={`chip ${i < stage ? 'ok' : i == stage ? 'tr' : ''}`}>{i < stage ? 'Done' : i == stage ? 'Running…' : 'Waiting'}</span>
        </div>
      )) : null}
    </div>
  );
}

// Technical skills grouped by category. Legacy grp().
export function SkillGroups({ skills, ctx }) {
  if (!skills.length) return <ChipList items={[]} kind="ok" />;
  return CATL.map(([k, label]) => {
    const x = skills.filter(s => catOf(s, ctx) == k);
    return x.length ? (
      <span key={k}>
        <p>{label}</p>
        <ChipList items={x} kind="ok" />
      </span>
    ) : null;
  });
}

// The completed-analysis card. Shows a parsed draft (dr) or the selected sample candidate (c).
export function CompleteCard({ count, c, dr, drafts, pi, candidates, job, ctx, set, commitCandidate, commitDraft, saveDraftAt }) {
  const sub = dr || c;
  const toast = useToast();
  if (!sub) return null;
  const nm = dr ? dr.real : nameOf(c, set);
  const PH = { Name: '', Education: 'e.g. B.Tech CS', Experience: '3 yrs · Role, or Fresher', Projects: 'Main project named in the resume' };
  const rows = [['Name', nm], ['Education', sub.ed], ['Experience', fieldValue(sub, 'Experience', set)], ['Projects', sub.pr]];
  const dupName = dr && dr.dup != null ? candidates.find(x => x.id === dr.dup) : null;
  const edit = (field, label, value) => {
    if (dr) {
      return <EditField key={label} label={label} value={value} placeholder={PH[field]} readOnly={false} onCommit={raw => commitDraft(field, raw)} />;
    }
    return (
      <EditField
        key={label}
        label={label}
        value={value}
        placeholder={PH[field]}
        readOnly={set.blind && field == 'Name'}
        onCommit={raw => commitCandidate(c, field, raw)}
      />
    );
  };
  const skillsValue = sub.sk.join(', ');
  const preview = dr ? sco(dr, job.req, job, ctx) : null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Analysis complete for {count} resume(s)</h3>
      {dr ? (
        drafts.length > 1 ? (
          <p>
            <label>Resume{' '}
              <select value={pi} onChange={e => setState({ pi: +e.target.value })}>
                {drafts.map((d, i) => <option key={i} value={i}>{d.file}</option>)}
              </select>
            </label>
          </p>
        ) : null
      ) : (
        <p><CandidateSelect list={rankAll(candidates, job.req, job, ctx)} value={c.id} set={set} /></p>
      )}
      <p>
        {dr
          ? <>Filled from the text of {dr.file}{dr.aiAnalysis ? ', analysed on the backend' : ''}. Check each field against the resume and correct anything that is wrong, then save the profile to add the candidate to the pool, where the same scoring formula applies.{dr.miss.length ? ' Not found in the text: ' + dr.miss.join(', ') + '. Fill these in manually.' : ''}{dr.warn.length ? ' ' + dr.warn.join(' ') : ''}{dupName ? ' Possible duplicate: same name as ' + dupName.n + '.' : ''}</>
          : <>Sample profile for {nm}. This is stored sample data, not text read from a file. Fields are editable so recruiters can correct them. Corrections are kept in this browser and update this candidate’s score everywhere.</>}
      </p>
      {dr && dr.aiAnalysis ? (
        <div className="note" style={{ marginTop: 10 }}>
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="chip ok">
              {dr.aiAnalysis.mode === 'ai' ? 'AI score' : 'Backend score'}: {Math.round(dr.aiAnalysis.score)}%
            </span>
            {dr.aiAnalysis.overview?.recommendation ? (
              <span className="chip tr">{dr.aiAnalysis.overview.recommendation}</span>
            ) : null}
            {dr.aiAnalysis.model ? (
              <span className="chip">{dr.aiAnalysis.model}</span>
            ) : null}
          </div>
          {dr.aiAnalysis.overview?.headline ? (
            <p style={{ margin: '4px 0 2px' }}><b>{dr.aiAnalysis.overview.headline}</b></p>
          ) : null}
          {dr.aiAnalysis.overview?.summary ? (
            <p style={{ margin: 0 }}>{dr.aiAnalysis.overview.summary}</p>
          ) : null}
        </div>
      ) : null}
      <div className="two">
        <div>
          {rows.map(([label, value]) => edit(label, label, value))}
        </div>
        <div>
          <p>Technical skills</p>
          {dr && dr.parsed ? <SkillGroups skills={dr.sk} ctx={ctx} /> : <ChipList items={sub.sk} kind="ok" />}
          <p>Edit technical skills (comma separated)</p>
          <input
            aria-label="Skills"
            key={'sk-' + skillsValue}
            defaultValue={skillsValue}
            placeholder="React, Git, Testing"
            style={{ width: '100%' }}
            onBlur={e => {
              if (e.currentTarget.value === skillsValue) return;
              const r = dr ? commitDraft('Skills', e.currentTarget.value) : commitCandidate(c, 'Skills', e.currentTarget.value);
              if (r && r.error) { toast(r.error); e.currentTarget.value = skillsValue }
              else if (r && r.ok) toast(r.ok);
            }}
          />
          <p>Soft skills</p>
          <SoftChips candidate={sub} ctx={ctx} />
          {dr && dr.parsed ? (
            <>
              <p>Certifications</p>
              <ChipList items={dr.cert} kind="ok" />
              <p>Work experience found in the text</p>
              {dr.wk.length ? dr.wk.map((x, i) => <div className="li" key={i}><span>{x}</span></div>) : <span className="chip">None found</span>}
            </>
          ) : null}
        </div>
      </div>
      {dr ? (
        <p>Preview match for {job.t}: <b>{preview}%</b>, using the same formula as the analysis page. It updates as you fill in the fields.</p>
      ) : null}
      <div className="row">
        {dr ? (
          dr.saved != null && candidates.find(x => x.id === dr.saved) ? (
            <>
              <span className="chip ok">Saved to candidate pool</span>
              <a className="btn p" href="/match" onClick={() => setState({ sel: dr.saved })}>View candidate analysis →</a>
            </>
          ) : (
            <button className="btn p" onClick={() => saveDraftAt(pi)}>Save to candidate pool</button>
          )
        ) : (
          <a className="btn p" href="/match">View candidate analysis →</a>
        )}
      </div>
    </div>
  );
}

// Per-file status list. Legacy anTrack().
export function ResumeTracking({ up, upS, drafts }) {
  if (!up || upS) return null;
  let k = 0, n = 0, bad = 0;
  const rows = up.map((f, i) => {
    let st, cl, nm = '', more = '';
    if (!f.ok) { st = 'Not analysed'; cl = 'no'; more = f.e; bad++ }
    else if (f.st == 'reading') { st = 'Reading…'; cl = 'tr' }
    else {
      const d = drafts[k++];
      if (d) {
        st = 'Analysed'; cl = 'ok'; n++;
        nm = d.real || 'Name not found in the text';
        if (!d.an) more = 'Fields were read, but the contextual evidence step failed for this resume.';
      } else st = 'Pending';
      if (!d) cl = 'tr';
    }
    return (
      <div className="nxa" key={i}>
        <b>{f.n}</b> {f.sz != null ? <span className="chip">{kb(f.sz)}</span> : null}
        <span className={`chip ${cl}`}>{st}</span>
        {nm ? <small>Candidate: {nm}</small> : null}
        {more ? <small>{more}</small> : null}
      </div>
    );
  });
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>Resume tracking</h3>
      <p>{up.length} uploaded · {n} analysed · {bad} not analysed. A file that could not be read gets no analysis and no profile; nothing is filled in for it.</p>
      {rows}
    </div>
  );
}

// Ranked list of several parsed resumes against the same job. Legacy anOverview().
export function DraftOverview({ drafts, pi, job, ctx }) {
  if (drafts.length < 2) return null;
  const sorted = drafts.map((d, i) => ({ d, i })).sort((x, y) => cmpS(x.d, y.d, job.req, job, ctx) || x.i - y.i);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>All analysed resumes against the same JD</h3>
      <p>Ordered by preview score, highest first. Every resume below was evaluated against <b>{job.t}</b>{job.jd && job.jd.f ? ' (the JD from Step 1)' : ''}. Select one to read its evidence.</p>
      {sorted.map(({ d, i }, k) => {
        const a = anGet(d, ctx);
        const e = a ? anEval(d, a, job) : null;
        return (
          <div className="li" key={i}>
            <span>
              <b>{valid(d) ? (k + 1) + '. ' : ''}{d.real || d.file}</b><br />
              <small style={{ color: 'var(--mu)' }}>
                {d.file} · {e ? e.ev + ' of ' + e.R.length + ' required skills stated or shown · relevance ' + e.lab : 'No contextual analysis'} · preview match {pct(sco(d, job.req, job, ctx))}
              </small>
            </span>
            <button className={`btn sm ${i == pi ? 'p' : ''}`} onClick={() => setState({ pi: i })}>{i == pi ? 'Open' : 'View'}</button>
          </div>
        );
      })}
    </div>
  );
}
