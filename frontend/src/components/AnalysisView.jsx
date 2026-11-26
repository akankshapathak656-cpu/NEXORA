// Contextual resume analysis for one candidate or draft against a job. Port of legacy anView(), axRow(), tchip()
// and anSoftChips() (app.js lines 907-936 and 909). Shared by the Upload and Match pages.
import { useAppState } from '../store/state.js';
import { aiAnalysisFor } from '../store/actions.js';
import { anGet, jdSig } from '../lib/resume.js';
import { ym } from '../lib/scoring.js';
import { anEval, TL, TC } from '../lib/evidence.js';
import { NS } from '../data/samples.js';

const SEC_EXPLAIN = {
  dated: 'Calculated from dated work entries, with overlaps merged.',
  stated: 'Taken from the resume’s own “years of experience” statement.',
  fresher: 'The resume says fresher.',
  none: 'No dated work entries or experience statement were found.',
};

// Tier chip and confidence chip for one skill row. Legacy tchip().
function TierChips({ r }) {
  return (
    <>
      <span className={`chip ${TC[r.tier]}`} style={r.tier == 'E' ? { borderStyle: 'dashed' } : undefined}>{TL[r.tier]}</span>
      {r.conf && r.conf != '—' ? <span className="chip">Confidence: {r.conf}</span> : null}
    </>
  );
}

// One skill row. Legacy axRow().
function AxRow({ r }) {
  const others = r.also ? r.also.filter(x => x != r.sec) : [];
  return (
    <div className="nxa">
      <b>{r.n}</b> <TierChips r={r} />
      {r.ev ? <small>{r.sec}: “{r.ev}”{others.length ? ' · also in ' + others.join(', ') : ''}</small> : null}
      {r.via ? <small>Inferred from {r.via}.</small> : null}
      {r.note ? <small>{r.note}</small> : null}
      {r.rel ? <small>Related skill on the resume: {r.rel.s} ({r.rel.w}). A related skill is not counted as {r.n}.</small> : null}
    </div>
  );
}

// Collapsible block. Legacy sec().
function Sec({ title, children }) {
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ cursor: 'pointer' }}><b>{title}</b></summary>
      {children}
    </details>
  );
}

// Soft-skill chips for one record. Legacy anSoftChips().
export function SoftChips({ candidate, ctx }) {
  const a = anGet(candidate, ctx);
  if (!a) return <span className="chip">Not extracted for this record</span>;
  if (!a.soft.length) return <span className="chip">None detected in the text</span>;
  return a.soft.map((s, i) => (
    <span key={i} className={`chip ${TC[s.tier]}`} title={TL[s.tier]}>{s.n} · {TL[s.tier]}</span>
  ));
}

function AiAnalysisCard({ ai, c, j, name }) {
  const parsed = ai.parsed_context || {};
  const evList = Array.isArray(ai.skill_evidence) ? ai.skill_evidence : [];
  const toRow = e => ({
    n: e.skill,
    tier: e.tier || 'N',
    conf: e.confidence || 'Low',
    ev: e.evidence || '',
    sec: e.section || 'Resume',
  });
  const reqRows = evList.filter(e => e.required_by_jd === 'Required').map(toRow);
  const prefRows = evList.filter(e => e.required_by_jd === 'Preferred').map(toRow);
  const otherRows = evList.filter(e => e.required_by_jd === 'Additional').map(toRow);
  const cnt = t => evList.filter(x => x.tier === t).length;
  const softSkills = Array.isArray(parsed.soft_skills) ? parsed.soft_skills : [];
  const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
  const work = Array.isArray(parsed.work) ? parsed.work : [];
  const ov = ai.overview || {};
  const isAi = ai.mode === 'ai';

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="an-hd">
        <h3>Contextual resume analysis against {j.t}</h3>
        <span className={isAi ? 'chip ok' : 'chip tr'}>
          {isAi ? 'AI · ' + (ai.model || 'LLM') : 'Backend heuristic'}
        </span>
      </div>
      <p>
        <b>JD relevance (advisory): {ov.recommendation || 'Evaluated'}</b> · {ai.required_coverage ?? 0}% required skills coverage · overall score <b>{ai.score}%</b>.
      </p>
      <div className="two">
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Key strengths</b></p>
          {Array.isArray(ov.strengths) && ov.strengths.length ? (
            <ul style={{ margin: '0 0 0 18px' }}>{ov.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
          ) : <p>No strengths noted.</p>}
        </div>
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Skill gaps and checks</b></p>
          {Array.isArray(ov.gaps) && ov.gaps.length ? (
            <ul style={{ margin: '0 0 0 18px' }}>{ov.gaps.map((x, i) => <li key={i}>{x}</li>)}</ul>
          ) : <p>No gaps noted against this JD.</p>}
        </div>
      </div>
      <div className="two" style={{ marginTop: 12 }}>
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Details extracted</b></p>
          <div className="li"><span>Name</span><b>{name || parsed.name || 'Not found'}</b></div>
          <div className="li"><span>Email</span><b>{parsed.email || c.em || 'Not found'}</b></div>
          <div className="li"><span>Phone</span><b>{parsed.phone || c.ph || 'Not found'}</b></div>
          <div className="li"><span>Education</span><b style={{ textAlign: 'right' }}>{parsed.education || c.ed || 'Not found'}</b></div>
        </div>
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Experience</b></p>
          <div className="li">
            <span>Total experience</span>
            <b>{parsed.experience_years ? `${parsed.experience_years} yrs` : c.ex || 'Not found'}</b>
          </div>
          {ai.experience && ai.experience.target_years ? (
            <div className="li">
              <span>JD target coverage</span>
              <b>{ai.experience.coverage}% (target {ai.experience.target_years} yrs)</b>
            </div>
          ) : null}
        </div>
      </div>
      <p style={{ margin: '14px 0 2px' }}>
        <b>Required skills</b>{' '}
        <span className="chip ok">
          {reqRows.filter(r => r.tier === 'D' || r.tier === 'E').length} stated or shown
        </span>
      </p>
      {reqRows.length ? reqRows.map((r, i) => <AxRow key={i} r={r} />) : <p>None</p>}
      {prefRows.length ? (
        <>
          <p style={{ margin: '14px 0 2px' }}><b>Preferred skills</b></p>
          {prefRows.map((r, i) => <AxRow key={i} r={r} />)}
        </>
      ) : null}
      <Sec title={'Other technical skills detected (' + otherRows.length + ')'}>
        {otherRows.length ? otherRows.map((r, i) => <AxRow key={i} r={r} />) : <p>None.</p>}
      </Sec>
      <Sec title={'Soft skills (' + softSkills.length + ')'}>
        {softSkills.length ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {softSkills.map((s, i) => <span key={i} className="chip ok">{s}</span>)}
          </div>
        ) : <p>None detected.</p>}
      </Sec>
      <Sec title={'Project experience (' + projects.length + ')'}>
        {projects.length ? projects.map((p, i) => (
          <div className="nxa" key={i}>
            <b>{p.title || 'Project'}</b>
            {p.description ? <small>{p.description}</small> : null}
            {Array.isArray(p.skills) && p.skills.length ? <small>Skills: {p.skills.join(', ')}</small> : null}
          </div>
        )) : <p>No project entries extracted.</p>}
      </Sec>
      <Sec title={'Work experience (' + work.length + ' entries)'}>
        {work.length ? work.map((w, i) => (
          <div className="nxa" key={i}>
            <b>{[w.title, w.company].filter(Boolean).join(' · ') || 'Role'}</b>
            {w.date_range ? <> <span className="chip">{w.date_range}</span></> : null}
            {Array.isArray(w.highlights) ? w.highlights.map((h, k) => <small key={k}>{h}</small>) : null}
            {Array.isArray(w.skills) && w.skills.length ? <small>Skills: {w.skills.join(', ')}</small> : null}
          </div>
        )) : <p>No dated work entries extracted.</p>}
      </Sec>
      <p className="fine" style={{ marginTop: 12 }}>
        {evList.length} skills evaluated: {cnt('D')} demonstrated, {cnt('E')} explicit, {cnt('M')} listed only, {cnt('I')} inferred, {cnt('N')} not found. {ai.disclaimer || ''}
      </p>
    </div>
  );
}

// Full analysis card. c: candidate or draft, j: job, ctx: resume ctx, name: display name (blind review aware).
export default function AnalysisView({ c, j, ctx, name }) {
  const state = useAppState();
  const ai = (c && c.aiAnalysis) || aiAnalysisFor(j, c, state);
  if (ai) {
    return <AiAnalysisCard ai={ai} c={c} j={j} name={name} />;
  }
  const an = anGet(c, ctx);
  if (!an) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Contextual resume analysis</h3>
        <p>Analysing {name} against {j.t}… If the backend is offline, upload a resume in Step 1 to run local text analysis.</p>
      </div>
    );
  }
  const e = anEval(c, an, j), f = e.f;
  const cnt = t => an.sk.filter(x => x.tier == t).length;
  const OT = an.sk.filter(x => !j.req.some(r => r.toLowerCase() == x.n.toLowerCase()) && !(f && f.pref.v.some(r => r.toLowerCase() == x.n.toLowerCase())));
  const exs = SEC_EXPLAIN[an.ex.src];
  const stale = an.sig != jdSig(j);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="an-hd">
        <h3>Resume analysis against {j.t}</h3>
        <span className="chip tr">{f ? 'JD pasted in Step 1' : 'Built-in job'}</span>
      </div>
      <div className="note">Rule-based reading of the resume text in your browser. No AI model runs, so it cannot judge quality or catch wording that its dictionary and rules do not cover. Evidence lines are quoted from the resume. A skill is never counted from a related keyword. {f ? '' : 'This job has no pasted JD, so only its required skills are evaluated; preferred skills, experience, education and responsibilities were not provided.'}</div>
      {stale ? <div className="note">This resume was analysed under a different job description and cannot be re-read after a reload. Skills outside the built-in dictionary may be missing. Upload the resume again to analyse it against {j.t}.</div> : null}
      <p><b>JD relevance (advisory): {e.lab}</b> · {e.ev} of {e.R.length} required skills are explicitly stated or shown. Thresholds (70% and 40%) are demo values and are only a label.</p>
      <div className="two">
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Key strengths</b></p>
          {e.st.length ? <ul style={{ margin: '0 0 0 18px' }}>{e.st.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>No JD-relevant evidence was found in the resume text.</p>}
        </div>
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Skill gaps and checks</b></p>
          {e.gp.length ? <ul style={{ margin: '0 0 0 18px' }}>{e.gp.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>No gaps found against this JD.</p>}
        </div>
      </div>
      <div className="two" style={{ marginTop: 12 }}>
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Details read from the resume</b></p>
          <div className="li"><span>Name</span><b>{name || 'Not found'}</b></div>
          <div className="li"><span>Email</span><b>{c.em || 'Not found'}</b></div>
          <div className="li"><span>Phone</span><b>{c.ph || 'Not found'}</b></div>
          <div className="li"><span>Education</span><b style={{ textAlign: 'right' }}>{an.edu.length ? an.edu.join(' · ') : c.ed || 'Not found'}</b></div>
        </div>
        <div>
          <p style={{ margin: '6px 0 2px' }}><b>Experience</b></p>
          <div className="li"><span>Total experience</span><b>{c.ex || 'Not found'}</b></div>
          <p className="fine" style={{ margin: '2px 0 8px' }}>{exs} Not verified.</p>
          <div className="li"><span>Relevant experience</span><b>{an.work.length ? (e.relMo ? ym(e.relMo) : 'None naming JD skills') : 'Cannot be calculated'}</b></div>
          <p className="fine" style={{ margin: '2px 0' }}>Dated entries that name a required or preferred skill ({e.rw.length} of {an.work.length}).</p>
        </div>
      </div>
      <p style={{ margin: '14px 0 2px' }}><b>Required skills</b> <span className="chip ok">{cnt('D') + cnt('E')} stated or shown</span></p>
      {e.R.length ? e.R.map((r, i) => <AxRow key={i} r={r} />) : <p>None</p>}
      {f ? (
        <>
          <p style={{ margin: '14px 0 2px' }}><b>Preferred skills</b></p>
          {e.Pf.length ? e.Pf.map((r, i) => <AxRow key={i} r={r} />) : <p>None named in the JD.</p>}
        </>
      ) : null}
      <Sec title={'Other technical skills detected (' + OT.length + ')'}>
        {OT.length ? OT.map((r, i) => <AxRow key={i} r={r} />) : <p>None.</p>}
      </Sec>
      <Sec title={'Soft skills (' + an.soft.length + ')'}>
        {an.soft.length ? an.soft.map((r, i) => <AxRow key={i} r={r} />) : <p>None detected in the text.</p>}
      </Sec>
      <Sec title={'Project experience (' + an.proj.length + ')'}>
        {an.proj.length ? e.pj.map((p, i) => (
          <div className="nxa" key={i}>
            <b>{p.t}</b>
            {p.d ? <small>{p.d}</small> : null}
            <small>Skills named: {p.sk.join(', ') || 'none from the dictionary'}{p.hit.length ? ' · JD skills: ' + p.hit.join(', ') : ''}</small>
          </div>
        )) : <p>No project section was found in the resume text.</p>}
      </Sec>
      <Sec title={'Work experience (' + an.work.length + ' dated entries)'}>
        {an.work.length ? an.work.map((w, i) => (
          <div className="nxa" key={i}>
            <b>{w.t}</b> <span className="chip">{w.rg}</span>
            {e.rw.includes(w) ? <span className="chip ok">Names JD skills</span> : null}
            {w.l.map((x, k) => <small key={k}>{x}</small>)}
            <small>Skills named: {w.sk.join(', ') || 'none from the dictionary'}</small>
          </div>
        )) : <p>No dated work entries were found.</p>}
      </Sec>
      {f && e.resp.length ? (
        <Sec title={'JD responsibilities against the resume (' + e.rk + ' of ' + e.resp.length + ' have matching wording)'}>
          {e.resp.map((r, i) => (
            <div className="nxa" key={i}>
              <b>{r.r}</b> <span className={`chip ${r.ok ? 'tr' : 'no'}`}>{r.ok ? 'Wording overlap found' : 'No matching wording'}</span>
              {r.l ? <small>Resume: “{r.l}”</small> : null}
            </div>
          ))}
          <p className="fine">Overlap means shared words, not proof of ability.</p>
        </Sec>
      ) : null}
      {f && f.exp.v ? (
        <p style={{ margin: '12px 0 2px' }}><b>JD experience:</b> {f.exp.v} <span className={`chip ${['no', 'ok', 'tr'][e.xs]}`}>{['Below the stated minimum', 'Meets the stated minimum', 'Compare by hand'][e.xs]}</span></p>
      ) : null}
      {f && f.edu.v ? (
        <p style={{ margin: '6px 0 2px' }}><b>JD education:</b> {f.edu.v} <span className={`chip ${['no', 'ok', 'tr'][e.ef[0]]}`}>{e.ef[0] == 1 ? 'Degree named in both' : e.ef[0] == 0 ? 'Degree not matched' : 'Compare by hand'}</span></p>
      ) : null}
      <p className="fine" style={{ marginTop: 12 }}>{an.sk.length} technical skills detected: {cnt('D')} demonstrated, {cnt('E')} explicit, {cnt('I')} inferred, {cnt('M')} without sufficient evidence. The match score uses these tiers: stated or demonstrated count in full, listed only counts half, inferred counts nothing.</p>
    </div>
  );
}
