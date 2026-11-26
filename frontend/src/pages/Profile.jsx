// Step 5: final decision and candidate profile. Port of legacy profile() and decisionUI() (app.js lines 1007-1017 and 1283-1286).
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState, setState } from '../store/state.js';
import { aiAnalysisFor, scoreCandidateLive } from '../store/actions.js';
import { candidateStatus, pendingCount } from '../store/candidates.js';
import { mm, valid } from '../lib/scoring.js';
import { displayName, pct } from '../lib/text.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { ChipList } from '../components/ui/Chip.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { PageHead, StatusChip, RankChip, ScoreRing, CandidateSelect } from '../components/CandParts.jsx';
import {
  makeCtx, scoreFor, adviceFor,
  decisionPatch, decisionLabel, decisionStatus, formatDecisionTime,
} from '../lib/review.js';

const TABS = ['Overview', 'Skills', 'Experience'];

// The four decision buttons. Label and hint are the legacy SDO texts.
const DECISIONS = [
  ['Shortlisted', 'Shortlist', 'Keep in the running'],
  ['Interview', 'Move to interview', 'Invite to the next stage'],
  ['Needs review', 'Flag for review', 'Hold while you verify evidence'],
  ['Rejected (by HR)', 'Reject', 'Close this application'],
  ['Hired', 'Mark as hired', 'Only after an interview'],
];

const DECISION_WARNING = {
  'Rejected (by HR)': 'This marks the application as rejected in NEXORA. No message is sent to the candidate.',
  Hired: 'This marks the candidate as hired and removes them from the active pool counts.',
};

export default function Profile({ candidates, job }) {
  const state = useAppState();
  const toast = useToast();
  const noteRef = useRef(null);
  const [note, setNote] = useState('');

  const ctx = useMemo(() => makeCtx(job, candidates), [job, candidates]);
  const byId = useMemo(() => new Map(candidates.map(x => [x.id, x])), [candidates]);

  const liveScore = x => {
    const ai = aiAnalysisFor(job, x, state);
    return ai && typeof ai.score === 'number' ? ai.score : scoreFor(x, job, ctx).tot;
  };
  const liveCov = x => {
    const ai = aiAnalysisFor(job, x, state);
    return ai && typeof ai.required_coverage === 'number' ? ai.required_coverage : scoreFor(x, job, ctx).cov;
  };
  const compareLive = (a, b) => {
    const v = valid(b) - valid(a);
    if (v) return v;
    const sa = liveScore(a) ?? -1;
    const sb = liveScore(b) ?? -1;
    if (sb !== sa) return sb - sa;
    const ca = liveCov(a) ?? -1;
    const cb = liveCov(b) ?? -1;
    if (cb !== ca) return cb - ca;
    return a.id - b.id;
  };

  const { RK, rankedAll } = useMemo(() => {
    const ordered = candidates.slice().sort(compareLive);
    const rkMap = new Map(ordered.filter(valid).map((x, i) => [x.id, i + 1]));
    return { RK: rkMap, rankedAll: ordered };
  }, [candidates, job, ctx, state.aiAnalyses, state.candApiIds]);

  const c = byId.get(state.sel) || candidates[0];
  const aiAnalysis = c ? aiAnalysisFor(job, c, state) : null;

  // Score the selected candidate live if Step 5 is visited directly before AI scoring ran.
  useEffect(() => {
    if (!c || !job) return;
    if (!aiAnalysisFor(job, c, state)) {
      scoreCandidateLive(job, c, false).catch(() => {});
    }
  }, [c && c.id, job && job.t]);

  // Legacy decPick() focuses the note box once the confirm step opens.
  useEffect(() => {
    if (state.pdc && noteRef.current) noteRef.current.focus();
  }, [state.pdc]);

  if (!c) return null;

  const name = x => displayName(x, state.set);
  const statusOf = x => candidateStatus(x, state.status);
  const cur = statusOf(c);
  const sp = scoreFor(c, job, ctx);
  const m = sp.m;
  const n = job.req.length;
  const rec = state.rec[c.id];
  const pdc = state.pdc && state.pdc.id == c.id ? state.pdc : null;
  const la = state.last && state.last.id == c.id && rec ? state.last : null;
  const cnt = k => candidates.filter(x => statusOf(x) == k).length;

  const overallScore = liveScore(c);
  const hasScore = overallScore != null;
  const reqCov = aiAnalysis && typeof aiAnalysis.required_coverage === 'number'
    ? Math.round(aiAnalysis.required_coverage)
    : (sp.ok ? sp.cov : null);
  const expCov = aiAnalysis?.experience && typeof aiAnalysis.experience.coverage === 'number'
    ? Math.round(aiAnalysis.experience.coverage)
    : (sp.ok ? Math.round(sp.exp * 100) : null);
  const parsed = aiAnalysis?.parsed_context || null;
  const expYearsLabel = parsed && parsed.experience_years != null
    ? `${parsed.experience_years} yrs`
    : `${c.ex} listed`;

  const adv = adviceFor(c, job, ctx, name(c));
  const mo = mm(c, job.req);

  const aiMatched = Array.isArray(aiAnalysis?.required?.matched) ? aiAnalysis.required.matched : null;
  const aiMissing = Array.isArray(aiAnalysis?.required?.missing) ? aiAnalysis.required.missing : null;
  const aiTransferable = Array.isArray(aiAnalysis?.skill_evidence)
    ? aiAnalysis.skill_evidence.filter(e => e && e.tier === 'I').map(e => e.skill).filter(Boolean)
    : null;

  const matchedSkills = aiMatched ?? m.ok;
  const missingSkills = aiMissing ?? m.no;
  const transferableSkills = aiTransferable && aiTransferable.length
    ? aiTransferable
    : m.tr.map(x => x.s + ' → ' + x.t);
  const tabTransferable = aiTransferable && aiTransferable.length
    ? aiTransferable
    : mo.tr.map(x => x.s + ' → ' + x.t);

  // Shortlisted, interviewing, hired and compared candidates, best first, plus the one being viewed.
  const idList = [...new Set([c.id, ...state.cmp, ...candidates.filter(x => ['Shortlisted', 'Interview', 'Hired'].includes(statusOf(x))).map(x => x.id)])];
  const ids = idList.map(i => byId.get(i)).filter(Boolean).sort(compareLive);

  const src = rec
    ? 'Recorded by you on ' + formatDecisionTime(rec.t) + (rec.n ? '. Your note: ' + rec.n : '') + '.'
    : state.status[c.id] != null
      ? 'Set earlier by you (no time was saved).'
      : 'This status comes from the sample data. You have not recorded a decision yet.';
  const aiHeadline = aiAnalysis?.overview?.headline;
  const sum = 'Status for ' + job.t + ': ' + decisionLabel(cur) + '. ' + name(c) +
    (hasScore
      ? ' matches ' + overallScore + '% (rank ' + RK.get(c.id) + ' of ' + RK.size + ', required skills match ' + reqCov + '%). '
      : ' is not scored. ') +
    (aiHeadline ? aiHeadline + ' ' : '') +
    matchedSkills.length + ' of ' + n + ' required skills are evidenced' +
    (transferableSkills.length ? ', plus ' + transferableSkills.length + ' related to confirm' : '') +
    (missingSkills.length ? '. Not found in the resume: ' + missingSkills.join(', ') : '') + '. ' + src;

  const decPick = k => {
    if (k == 'Hired' && !['Interview', 'Hired'].includes(cur)) {
      toast('Move the candidate to Interview before marking as hired');
      return;
    }
    setNote('');
    setState({ pdc: { id: c.id, k }, last: null });
  };

  const decCancel = () => setState({ pdc: null });

  const decSave = () => {
    if (!pdc) return;
    const target = byId.get(pdc.id);
    if (!target) return;
    setState(s => decisionPatch(s, pdc.id, pdc.k, note));
    toast(name(target) + ': ' + decisionLabel(pdc.k));
  };

  const overviewSkills = Array.isArray(parsed?.skills) && parsed.skills.length ? parsed.skills : c.sk;
  const parsedWork = Array.isArray(parsed?.work) ? parsed.work.filter(Boolean) : [];
  const parsedProjects = Array.isArray(parsed?.projects) ? parsed.projects.filter(Boolean) : [];

  const panels = {
    Overview: (
      <>
        <h3>Summary</h3>
        {aiAnalysis?.overview?.headline || aiAnalysis?.overview?.summary ? (
          <>
            {aiAnalysis.overview.headline ? (
              <p style={{ color: 'var(--tx)' }}><b>{aiAnalysis.overview.headline}</b></p>
            ) : null}
            {aiAnalysis.overview.summary ? <p>{aiAnalysis.overview.summary}</p> : null}
          </>
        ) : (
          <>
            <p>{c.r} with {c.ex} of experience and a {c.ed} background. Notable project: {c.pr}.</p>
            <p style={{ color: 'var(--tx)' }}><b>{adv.l}.</b> {adv.t}</p>
          </>
        )}
        {state.alt[c.id] ? <p>Considered for {state.alt[c.id]}. HR approval is still required.</p> : null}
        <p>Skills</p>
        <ChipList items={overviewSkills} kind="ok" />
        <div className="card" style={{ marginTop: 14, fontSize: 13 }}>
          {parsed ? (
            <>
              <b>Extracted resume preview</b><br />
              {name(c)} · {c.r}{parsed.education ? ` · ${parsed.education}` : ''}<br />
              {parsedWork.length ? (
                <div style={{ marginTop: 6 }}>
                  {parsedWork.map((w, i) => (
                    <div key={i}>
                      <b>{w.title || 'Role'}</b>{w.company ? ` at ${w.company}` : ''}{w.date_range ? ` (${w.date_range})` : ''}
                    </div>
                  ))}
                </div>
              ) : null}
              {parsedProjects.length ? (
                <div style={{ marginTop: 6 }}>
                  {parsedProjects.map((p, i) => (
                    <div key={i}>
                      <b>{p.title || 'Project'}</b>{p.description ? `: ${p.description}` : ''}
                    </div>
                  ))}
                </div>
              ) : null}
              {!parsedWork.length && !parsedProjects.length && c.pr ? <div style={{ marginTop: 4 }}>{c.pr}</div> : null}
            </>
          ) : (
            <>
              <b>Resume preview (sample)</b><br />
              {name(c)} · {c.r}<br />
              {c.pr}
            </>
          )}
        </div>
      </>
    ),
    Skills: (
      <>
        <p>Matching</p>
        <ChipList items={aiMatched ?? mo.ok} kind="ok" />
        <p>Transferable</p>
        <ChipList items={tabTransferable} kind="tr" />
        <p>Not found (needs review)</p>
        <ChipList items={aiMissing ?? mo.no} kind="no" />
      </>
    ),
    Experience: (
      <>
        <div className="li">
          <span>Experience</span>
          <b>{parsed && parsed.experience_years != null ? `${parsed.experience_years} yrs` : c.ex}</b>
        </div>
        <div className="li">
          <span>Education</span>
          <b>{parsed?.education || c.ed}</b>
        </div>
        {parsedWork.length ? (
          parsedWork.map((w, i) => (
            <div className="li" key={`wk-${i}`} style={{ alignItems: 'flex-start' }}>
              <span>{w.date_range || 'Work'}</span>
              <div style={{ textAlign: 'right', maxWidth: '72%' }}>
                <b>{w.title || 'Role'}{w.company ? ` · ${w.company}` : ''}</b>
                {Array.isArray(w.highlights) && w.highlights.length ? (
                  <div className="fine" style={{ marginTop: 4 }}>{w.highlights.join(' · ')}</div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          c.wk && c.wk.length ? (
            <div className="li"><span>Work history</span><b style={{ textAlign: 'right' }}>{c.wk.join(' · ')}</b></div>
          ) : null
        )}
        {parsedProjects.length ? (
          parsedProjects.map((p, i) => (
            <div className="li" key={`pr-${i}`} style={{ alignItems: 'flex-start' }}>
              <span>Project</span>
              <div style={{ textAlign: 'right', maxWidth: '72%' }}>
                <b>{p.title || 'Project'}</b>
                {p.description ? <div className="fine" style={{ marginTop: 4 }}>{p.description}</div> : null}
                {Array.isArray(p.skills) && p.skills.length ? (
                  <div className="fine" style={{ marginTop: 4 }}>{p.skills.join(', ')}</div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="li"><span>Project</span><b style={{ textAlign: 'right' }}>{c.pr}</b></div>
        )}
        {c.cert && c.cert.length ? (
          <div className="li"><span>Certifications</span><b style={{ textAlign: 'right' }}>{c.cert.join(', ')}</b></div>
        ) : null}
      </>
    ),
  };

  return (
    <>
      <PageHead title="Step 5 · Final decision" sub="Review the evidence, then record your decision. NEXORA advises, you decide" />
      <div className="dpr">
        <b>You make the final hiring decision.</b> NEXORA only advises. It never hires, rejects or contacts anyone on its own, and every decision below is recorded as yours.
      </div>

      <section className="card" aria-labelledby="dbt">
        <div className="an-hd">
          <h3 id="dbt">Candidates in your decision</h3>
          <span className="chip tr">{ids.length} shown</span>
        </div>
        <p>Shortlisted, interviewing, hired and compared candidates appear here. Select one to decide.</p>
        <div className="dsb">
          {ids.map(x => {
            const xAi = aiAnalysisFor(job, x, state);
            const xScore = liveScore(x);
            const xMatched = Array.isArray(xAi?.required?.matched)
              ? xAi.required.matched.length
              : scoreFor(x, job, ctx).m.ok.length;
            return (
              <button
                key={x.id}
                className={`dcd ${x.id == c.id ? 'on' : ''}`}
                aria-pressed={x.id == c.id}
                onClick={() => setState({ sel: x.id, pdc: null, last: null })}
              >
                <span className="dcd-t">
                  <b>{name(x)}</b>
                  <small>{RK.has(x.id) ? 'Rank ' + RK.get(x.id) : 'Unranked'} · {x.r}</small>
                </span>
                <ScoreRing value={xScore} size={44} />
                <span className="dcd-m">{xMatched} of {n} skills <StatusChip status={statusOf(x)} /></span>
              </button>
            );
          })}
        </div>
        <div className="row">
          <CandidateSelect list={rankedAll} value={c.id} set={state.set} />
        </div>
        <p className="fine" style={{ margin: '10px 0 0' }}>
          Pool: {cnt('Shortlisted')} shortlisted · {cnt('Interview')} in interview · {cnt('Hired')} hired · {cnt('Rejected')} rejected · {pendingCount(candidates, state.status)} awaiting review
        </p>
      </section>

      <section className="card dpanel" style={{ marginTop: 16 }} aria-labelledby="dpt">
        <div className="dph">
          <Avatar name={name(c)} size={56} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <h2 id="dpt">{name(c)}</h2>
            <p>{c.r} · {parsed?.education || c.ed}</p>
            <div><StatusChip status={cur} /> <span className="fine">{src}</span></div>
          </div>
          <ScoreRing value={overallScore} size={84} />
        </div>

        {la ? (
          <div className="dok" role="status">
            <svg className="s3-ok" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M7 12.5l3.2 3.2L17 8.8" />
            </svg>
            <div>
              <b>Decision saved: {decisionLabel(la.s)}</b>
              <span>{name(c)} · recorded by you at {formatDecisionTime(rec.t)}. The dashboard, candidate list and analysis now show this status.</span>
            </div>
          </div>
        ) : null}

        <div className="dgrid">
          <div>
            <h3>Match for {job.t}</h3>
            <div className="an-t">
              <div className="main">
                <small>Overall match</small>
                <b>{pct(overallScore)}</b>
                <span>{RK.has(c.id) ? 'Rank ' + RK.get(c.id) + ' of ' + RK.size : 'Unranked'}</span>
              </div>
              <div>
                <small>Required skills match</small>
                <b>{reqCov != null ? reqCov + '%' : '—'}</b>
                <span>{matchedSkills.length} of {n} named{transferableSkills.length ? ', ' + transferableSkills.length + ' related (not scored)' : ''}</span>
              </div>
              <div>
                <small>Relevant experience</small>
                <b>{expCov != null ? expCov + '%' : '—'}</b>
                <span>{expYearsLabel}</span>
              </div>
            </div>
            <p>Matching</p>
            <ChipList items={matchedSkills} kind="ok" />
            <p>Transferable (confirm depth)</p>
            {transferableSkills.length ? <ChipList items={transferableSkills} kind="tr" /> : <span className="chip">None</span>}
            <p>Not found in the resume</p>
            <ChipList items={missingSkills} kind="no" />
            <div className="row">
              <a className="btn sm" href="/match" onClick={() => setState({ sel: c.id })}>Open the evidence</a>
              <a className="btn sm" href="/roles" onClick={() => setState({ rc: c.id, role_: 0 })}>Other role matches</a>
            </div>
          </div>

          <div>
            <h3>Your decision</h3>
            <p>Choose a status, then confirm. Nothing is sent to the candidate.</p>
            <div className="dopts" role="group" aria-label="Decision status">
              {DECISIONS.map(o => {
                const isCur = decisionStatus(o[0]) == cur;
                const dis = o[0] == 'Hired' && !['Interview', 'Hired'].includes(cur);
                return (
                  <button
                    key={o[0]}
                    className={`dopt ${isCur ? 'cur' : ''} ${pdc && pdc.k == o[0] ? 'sel' : ''}`}
                    aria-pressed={isCur}
                    disabled={dis}
                    title={dis ? 'Move the candidate to Interview first' : undefined}
                    onClick={() => decPick(o[0])}
                  >
                    <b>{o[1]}</b>
                    <small>{isCur ? 'Current status' : dis ? 'Available after Interview' : o[2]}</small>
                  </button>
                );
              })}
            </div>
            {pdc ? (
              <div className="dcf" role="group" aria-labelledby="dcft">
                <b id="dcft">Confirm: {decisionLabel(pdc.k)} for {name(c)}</b>
                <p>{DECISION_WARNING[pdc.k] || 'This changes the status shown across NEXORA. No message is sent to the candidate.'}</p>
                <label htmlFor="dnote" className="fine">Optional note, kept in this browser</label>
                <input
                  id="dnote"
                  ref={noteRef}
                  maxLength={200}
                  placeholder="Why this decision?"
                  style={{ width: '100%' }}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key == 'Enter') { e.preventDefault(); decSave(); } }}
                />
                <div className="row">
                  <button className="btn p sm" onClick={decSave}>Confirm decision</button>
                  <button className="btn sm" onClick={decCancel}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="dsm">
          <h3>Decision summary</h3>
          <p style={{ color: 'var(--tx)' }}>{sum}</p>
          <p className="fine">
            {aiAnalysis
              ? `Generated from the live ${aiAnalysis.mode === 'ai' ? 'AI' : 'structured'} analysis${aiAnalysis.model ? ` (${aiAnalysis.model})` : ''}. It is a record of your decision, not an automated hiring action.`
              : 'Written from the candidate record by a template. It is a record of your decision, not a recommendation.'}
          </p>
          <div className="row">
            <a className="btn sm" href="/comms" onClick={() => setState({ body: null, mail: 'draft' })}>Outreach (needs HR approval)</a>
            <a className="btn sm" href="/cands">Back to compare</a>
            <a className="btn sm" href="/dashboard">Dashboard</a>
          </div>
        </div>
      </section>

      <div className="dsec">
        <h3>Candidate profile</h3>
        <span>Reference details for the selected candidate</span>
      </div>
      <div className="card ban">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar name={name(c)} size={72} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2>{name(c)}</h2>
            <p>{c.r} · {parsed?.education || c.ed}</p>
            <StatusChip status={cur} />
          </div>
          <ScoreRing value={overallScore} size={84} />
        </div>
        <div className="row">
          <RankChip rank={RK.get(c.id)} />
          <a className="btn sm" href="/match" onClick={() => setState({ sel: c.id })}>Analysis</a>
          <a className="btn sm" href="/roles" onClick={() => setState({ rc: c.id, role_: 0 })}>Other roles</a>
          <a className="btn sm" href="/gap">Skill gap</a>
          <a className="btn sm" href="/comms" onClick={() => setState({ body: null, mail: 'draft' })}>Message</a>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t} role="tab" aria-selected={t == state.tab} onClick={() => setState({ tab: t })}>{t}</button>
        ))}
      </div>
      <div key={c.id + '-' + state.tab} className="card nx-cand-enter" role="tabpanel">{panels[state.tab] || panels.Overview}</div>
    </>
  );
}
