// Step 2: candidate analysis. Explainable match for the selected job: score, skill evidence, JD checks,
// resume analysis and the recruiter's decision buttons. Port of legacy match() (app.js 958-993), jdCard() (366-374)
// and the decision buttons (commit, setS, cmpAdd). Scores are computed on demand, never stored.
import { useEffect, useState } from 'react';
import { useAppState, setState } from '../store/state.js';
import { allJobs, resumeContext } from '../store/context.js';
import { candidateStatus } from '../store/candidates.js';
import {
  aiAnalysisFor,
  commitStatus,
  loadAiConfig,
  saveCandidate,
  scoreCandidateLive,
  toggleCompare,
} from '../store/actions.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Bar } from '../components/ui/Bar.jsx';
import { PageHead, ScoreRing, RankChip } from '../components/CandParts.jsx';
import { JobSelect } from '../components/JobSelect.jsx';
import AnalysisView from '../components/AnalysisView.jsx';
import PoolOverviewCard from '../components/PoolOverviewCard.jsx';
import { mm, score, rankAll, rankMap, hidden, ev as evidenceOf, prTxt, yrs } from '../lib/scoring.js';
import { anGet, eduFit } from '../lib/resume.js';
import { adv } from '../lib/evidence.js';
import { displayName, d1 } from '../lib/text.js';

// Legacy SN, dlab() and stl(): stored status spellings and their labels.
const SN = { 'Needs review': 'Review', 'Rejected (by HR)': 'Rejected', Approved: 'Shortlisted' };
const label = v => (v == 'Review' ? 'Needs review' : v);
const dlab = k => label(SN[k] || k);

// Evidence strength labels. Legacy SXL and SXI.
const SXL = ['Not found', 'Transferable', 'Listed', 'Strong'];
const SXI = ['—', '≈', '✓', '✓✓'];

// Fact or suggestion tag. Legacy tag().
function Tag({ suggestion }) {
  return suggestion ? <span className="an-tag s">Suggestion</span> : <span className="an-tag f">Fact · from the record</span>;
}

// JD checks for the candidate against the job's JD. Legacy jdCard(). Renders nothing for a job without a JD.
function JdCard({ c, job, name }) {
  const f = job.jd && job.jd.f;
  if (!f) return null;
  const m = mm(c, f.pref.v), y = yrs(c), cl = ['no', 'ok', 'tr'];
  const xs = f.exp.min == null ? 2 : y >= f.exp.min ? 1 : 0;
  const xl = ['Below the stated minimum', 'Meets the stated minimum', 'Compare by hand'][xs];
  const ef = f.edu.v ? eduFit(f.edu.v, c.ed) : null;
  return (
    <div className="card">
      <div className="an-hd">
        <h3>Job description checks for {job.t}</h3>
        <span className="an-tag f">Fact · from the record</span>
      </div>
      <p>These come from the job description you supplied. The score breakdown above shows how each stated item counts.</p>
      <div className="ev">
        <b>Preferred skills</b>
        {f.pref.v.length ? (
          <div>
            {m.ok.map((x, i) => <span key={'o' + i} className="chip ok">{x} · in resume</span>)}
            {m.tr.map((x, i) => <span key={'t' + i} className="chip tr">{x.t} · related: {x.s}</span>)}
            {m.no.map((x, i) => <span key={'n' + i} className="chip no">{x} · not found</span>)}
          </div>
        ) : <span className="chip">None found in the JD</span>}
      </div>
      <div className="ev">
        <b>Required experience</b>
        {f.exp.v ? (
          <>
            {f.exp.v} <span className={`chip ${cl[xs]}`}>{xl}</span>
            <br />
            <small style={{ color: 'var(--mu)' }}>{c.ex == 'Fresher' ? 'Fresher, no professional experience listed' : c.ex + ' listed'}. Years come from the resume field and are not verified.</small>
          </>
        ) : <span className="chip">Not stated in the JD</span>}
      </div>
      <div className="ev">
        <b>Education</b>
        {f.edu.v ? (
          <>
            {f.edu.v} <span className={`chip ${cl[ef[0]]}`}>{ef[0] == 1 ? 'Degree named in both' : ef[0] == 0 ? 'Degree not matched' : 'Compare by hand'}</span>
            <br />
            <small style={{ color: 'var(--mu)' }}>Candidate: {c.ed}. {ef[1]}</small>
          </>
        ) : <span className="chip">Not stated in the JD</span>}
      </div>
      {f.resp.v.length ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer' }}><b>Responsibilities from the JD</b> · {f.resp.v.length} listed</summary>
          <ul style={{ margin: '6px 0 0 18px' }}>{f.resp.v.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}

export default function Match({ candidates }) {
  const state = useAppState();
  const toast = useToast();
  const [filter, setFilter] = useState('All');
  const [scoring, setScoring] = useState(false);
  const jobs = allJobs(state);
  const job = jobs[state.job] || jobs[0];
  const ctx = resumeContext(job, candidates, state);
  const q = job.req;
  const c = candidates.find(x => x.id === state.sel) || candidates[0];
  const aiAnalysis = aiAnalysisFor(job, c, state);

  useEffect(() => {
    loadAiConfig();
  }, []);

  // Auto-resolve the selected candidate on the spot if not yet scored for this job.
  useEffect(() => {
    if (!c || !job || aiAnalysis) return;
    let active = true;
    setScoring(true);
    scoreCandidateLive(job, c, false)
      .catch(() => { /* keep seed heuristic fallback visible if backend offline */ })
      .finally(() => { if (active) setScoring(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c && c.id, job && job.t]);

  // Keep a stale analysis rebuilt for the current job, as legacy anGet() did when the job changed.
  useEffect(() => {
    if (!c || !c.an) return;
    const next = anGet(c, ctx);
    if (next && next !== c.an) saveCandidate({ ...c, an: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, job]);

  const name = displayName(c, state.set);
  const statusOf = x => candidateStatus(x, state.status);
  const stl = x => label(statusOf(x));
  const liveScoreOf = x => {
    const ai = aiAnalysisFor(job, x, state);
    return ai && ai.score != null ? ai.score : score(x, q, job, ctx).tot;
  };
  const rk = candidates
    .slice()
    .sort((a1, b1) => ((liveScoreOf(b1) ?? -1) - (liveScoreOf(a1) ?? -1)) || (a1.id - b1.id));
  const RK = new Map(rk.filter(x => liveScoreOf(x) != null).map((x, idx) => [x.id, idx + 1]));
  const sp = score(c, q, job, ctx);
  const displayScore = aiAnalysis && aiAnalysis.score != null ? aiAnalysis.score : sp.tot;
  const m = mm(c, q);
  const n = q.length || 1;
  const a = adv(c, job, name, ctx);
  const aiOv = aiAnalysis && aiAnalysis.overview ? aiAnalysis.overview : null;
  const aiParsed = aiAnalysis && aiAnalysis.parsed_context ? aiAnalysis.parsed_context : null;
  const aiExp = aiAnalysis && aiAnalysis.experience ? aiAnalysis.experience : null;
  const aiExpComp = aiAnalysis && Array.isArray(aiAnalysis.components) ? aiAnalysis.components.find(p => p.key === 'exp') : null;
  const aiProjComp = aiAnalysis && Array.isArray(aiAnalysis.components) ? aiAnalysis.components.find(p => p.key === 'proj') : null;
  const aiWork = aiParsed && Array.isArray(aiParsed.work) ? aiParsed.work : [];
  const aiProjects = aiParsed && Array.isArray(aiParsed.projects) ? aiParsed.projects : [];
  const hasAiSkills = !!(aiAnalysis && Array.isArray(aiAnalysis.skill_evidence) && aiAnalysis.skill_evidence.length);
  const aiInferred = hasAiSkills ? aiAnalysis.skill_evidence.filter(e => e.tier === 'I') : [];
  const tierLevel = tier => (tier === 'D' || tier === 'E' ? 3 : tier === 'M' ? 2 : tier === 'I' ? 1 : 0);
  const tierWhere = (tier, sec) => {
    const loc = sec && sec !== 'Not recorded' ? sec : null;
    if (tier === 'D') return loc ? `${loc} · Direct hands-on evidence` : 'Direct hands-on evidence in resume';
    if (tier === 'E') return loc ? `${loc} · Strong evidenced use` : 'Strong evidenced use in resume';
    if (tier === 'M') return loc ? `${loc} · Listed in resume` : 'Listed in resume without project detail';
    if (tier === 'I') return loc ? `${loc} · Inferred / transferable` : 'Inferred from related experience';
    return 'Not mentioned in the resume text';
  };
  const rows = hasAiSkills
    ? (() => {
        const bySkill = new Map();
        for (const item of aiAnalysis.skill_evidence) {
          const k = String(item.skill || '').trim().toLowerCase();
          if (!k) continue;
          if (!bySkill.has(k) || item.required_by_jd === 'Required') bySkill.set(k, item);
        }
        const requiredItems = q.length
          ? q.map(x => ({ x, ev: bySkill.get(String(x).trim().toLowerCase()) || null }))
          : aiAnalysis.skill_evidence
              .filter(e => e.required_by_jd === 'Required')
              .map(ev => ({ x: ev.skill, ev }));
        return requiredItems.map(({ x, ev }) => {
          const tier = (ev && ev.tier) || 'N';
          const l = tierLevel(tier);
          const sec = (ev && ev.section) || 'Not recorded';
          const rawEv = ev && typeof ev.evidence === 'string' ? ev.evidence.trim() : '';
          const evText = rawEv
            ? (sec && sec !== 'Not recorded' && l > 0 ? `${sec}: “${rawEv}”` : l > 0 ? `“${rawEv}”` : rawEv)
            : l === 0
              ? 'Not mentioned in the resume text. Silence on the resume does not mean the candidate lacks it.'
              : sec && sec !== 'Not recorded'
                ? `${x} evidenced in ${sec}.`
                : `${x} evidenced in resume.`;
          const verText =
            l === 3
              ? `Ask what they personally built or owned with ${x} and how they verified the outcome.`
              : l === 2
                ? `Ask for one specific project or task where they used ${x}, and how deep that use went.`
                : l === 1
                  ? `Inferred from related experience; ask for a concrete example showing hands-on ${x} depth.`
                  : `Check the full resume, then ask directly whether they have used ${x}.`;
          return { x, l, evText, verText, sec, tier };
        });
      })()
    : q.map(x => { const e = evidenceOf(c, x); return { x, l: e[0], t: m.tr.find(y => y.t == x) }; });
  const cnt = [0, 1, 2, 3].map(l => rows.filter(r => r.l == l).length);
  const f = filter;
  const vis = rows.filter(r => f == 'All' || String(r.l) == f);
  const hasPr = !!c.pr && c.pr != 'Not provided';
  const hh = hidden(candidates, job, statusOf, jobs).find(h => h.c.id == c.id);
  const where = [
    'Not mentioned in the skills list or project text',
    'Related skill in the skills list, counted at half',
    'In the skills list only',
    'In the skills list and named in the project text',
  ];
  const evid = r => (
    r.l == 3 ? 'Project description on record: “' + c.pr + '”. It names ' + r.x + ' (keyword match on that text, not a read of the full resume).'
      : r.l == 2 ? r.x + ' is in the skills list. The project description on record does not name it.'
      : r.l == 1 ? (r.t ? r.t.s + ' is in the skills list. ' + r.t.w + '. It is a related skill, not ' + r.x + ' itself.' : r.x + ' is inferred from related experience.')
      : 'Not in the skills list or the project description on record. The resume is silent on it, which does not mean the candidate lacks it.'
  );
  const ver = r => (
    r.l == 3 ? 'Ask what they personally built with ' + r.x + ' and how they checked it worked.'
      : r.l == 2 ? 'Ask for one specific task where they used ' + r.x + ', and how deep that use went.'
      : r.l == 1 ? (r.t ? 'Ask for a concrete example, and how they would apply ' + r.t.s + ' experience to ' + r.x + '.' : 'Ask for a concrete example showing hands-on ' + r.x + ' depth.')
      : 'Check the full resume, then ask directly whether they have used ' + r.x + '.'
  );
  const ck = aiAnalysis
    ? (() => {
        const seen = new Set();
        const items = [];
        const addCk = (key, text) => {
          const norm = String(key).toLowerCase();
          if (seen.has(norm)) return;
          seen.add(norm);
          items.push([key, text]);
        };
        if (aiOv && Array.isArray(aiOv.gaps)) {
          for (const g of aiOv.gaps) {
            if (g && String(g).trim()) addCk('Gap: ' + g, String(g).trim());
          }
        }
        for (const r of rows) {
          if (r.l === 0) addCk(r.x, 'Ask about ' + r.x + ' (not found in resume)');
          else if (r.l === 1) addCk(r.x, 'Confirm transferable skill: ' + r.x);
          else if (r.l === 2) addCk('Depth: ' + r.x, 'Ask about depth of ' + r.x + ' (listed only)');
        }
        addCk('Project ownership and depth', 'Ask about project ownership and depth');
        return items;
      })()
    : [
        ...m.no.map(x => [x, 'Ask about ' + x]),
        ...m.tr.map(x => [x.t, 'Ask about ' + x.t]),
        ...rows.filter(r => r.l == 2).map(r => ['Depth: ' + r.x, 'Ask about depth of ' + r.x + ' (listed only)']),
        ['Project ownership and depth', 'Ask about project ownership and depth'],
      ];
  const kk = x => c.id + '|' + job.t + '|' + x;
  const done = ck.filter(x => state.chk[kk(x[0])]).length;
  const st3 = rows.filter(r => r.l == 3).map(r => r.x);
  const xn = (sp.comps.find(p => p.k == 'exp') || {}).note;
  const expObservations = aiAnalysis
    ? [
        aiParsed && aiParsed.experience_years != null
          ? (aiParsed.experience_years > 0
              ? `${aiParsed.experience_years} ${aiParsed.experience_years === 1 ? 'year' : 'years'} of experience parsed from resume.`
              : 'No prior professional experience years parsed from resume (Fresher / entry-level).')
          : (c.ex == 'Fresher' ? 'No professional experience is listed (Fresher).' : c.ex + ' of experience is listed.'),
        aiExp && (aiExp.target_years != null || aiExp.coverage != null)
          ? `Target experience: ${aiExp.target_years != null ? aiExp.target_years + ' yrs' : 'not specified'}${aiExp.coverage != null ? ' (' + aiExp.coverage + '% coverage)' : ''}.`
          : null,
        aiExpComp && aiExpComp.note ? `Score basis: ${aiExpComp.note}.` : null,
        aiWork.length
          ? `${aiWork.length} work history ${aiWork.length === 1 ? 'entry' : 'entries'} extracted from resume.`
          : 'No structured work history entries extracted from resume.',
        'Years and work history come from the resume text and should be verified in interview.',
      ].filter(Boolean)
    : [
        c.ex == 'Fresher' ? 'No professional experience is listed (Fresher).' : c.ex + ' of experience is listed.',
        xn ? `Score basis: ${xn}.` : null,
        c.r == job.t ? 'Listed role (' + c.r + ') matches this job title.' : 'Listed role (' + c.r + ') differs from ' + job.t + ', so rely on the skill evidence.',
        'Years come from the resume field and are not verified.',
      ].filter(Boolean);
  const strengths = [
    st3.length ? 'Named in the project description: ' + st3.join(', ') + '.' : null,
    m.ok.length ? m.ok.length + ' of ' + n + ' required skills are evidenced (in a project or the skills list).' : null,
    c.ex == 'Fresher' ? null : c.ex + ' of experience is listed on the record.',
    hh ? (
      <>The skills evidence also fits {hh.b.r} ({hh.b.s}% against {hh.ap}% for this job).{' '}
        <a className="link" href="/roles" onClick={() => setState({ rc: c.id, role_: 0 })}>See other roles</a>
      </>
    ) : null,
  ].filter(Boolean);
  const gaps = [
    cnt[0] ? 'Not found in the resume: ' + rows.filter(r => r.l == 0).map(r => r.x).join(', ') + '.' : null,
    cnt[1] ? 'Related only, to be confirmed: ' + m.tr.map(x => x.s + ' → ' + x.t).join(', ') + '.' : null,
    cnt[2] ? 'Listed without project evidence: ' + rows.filter(r => r.l == 2).map(r => r.x).join(', ') + '.' : null,
  ].filter(Boolean);
  const qs = [
    ...rows.filter(r => r.l == 0).slice(0, 2).map(r => `Have you used ${r.x}? If so, where, and how deeply?`),
    ...rows.filter(r => r.l == 1).slice(0, 2).map(r => (r.t ? `Your resume lists ${r.t.s}. How would you apply it to ${r.x} work, and what have you built that shows it?` : `How does your related experience transfer to ${r.x} work, and what have you built that shows it?`)),
    ...rows.filter(r => r.l == 2).slice(0, 2).map(r => `Describe a task where you used ${r.x}. Which part did you do yourself?`),
    hasPr ? `In “${c.pr}”, which parts were your own work, and what would you change?` : 'Which project best shows your skills for this role, and what was your own part in it?',
    ...(c.ex == 'Fresher' ? ['Which coursework or personal projects best show these skills, since no professional experience is listed?'] : []),
  ].slice(0, 6);

  const panelStrengths = aiOv && Array.isArray(aiOv.strengths) && aiOv.strengths.length ? aiOv.strengths : strengths;
  const panelGaps = aiOv && Array.isArray(aiOv.gaps) && aiOv.gaps.length ? aiOv.gaps : gaps;
  const panelQs = aiOv && Array.isArray(aiOv.interview_questions) && aiOv.interview_questions.length ? aiOv.interview_questions : qs;

  const decide = (cand, value) => {
    const p = commitStatus(cand, value, '');
    toast(displayName(cand, state.set) + ': ' + dlab(value));
    p.then(ok => { if (ok === false) toast('Status saved in this browser, but backend sync failed') });
  };
  const runAiScore = async (force = false) => {
    if (!c) return;
    setScoring(true);
    try {
      const result = await scoreCandidateLive(job, c, force);
      toast(
        (result && result.mode === 'ai' ? 'AI analysis' : 'Backend analysis') +
          ' ready for ' +
          name +
          (result && result.score != null ? ' (' + result.score + '%)' : ''),
      );
    } catch (err) {
      toast((err && err.message) || 'Could not run AI analysis');
    } finally {
      setScoring(false);
    }
  };
  const compare = () => toast(toggleCompare(c, name));
  const setChecked = (key, checked) => setState(s => ({ chk: { ...s.chk, [key]: checked } }));
  const decisionButtons = (
    <>
      <button className="btn p sm" onClick={() => decide(c, 'Shortlisted')}>Shortlist</button>
      <button className="btn sm" onClick={() => decide(c, 'Needs review')}>Flag for review</button>
      <button className="btn sm" onClick={() => decide(c, 'Rejected (by HR)')}>Reject</button>
    </>
  );

  return (
    <>
      <PageHead title="Step 2 · Candidate analysis" sub={'Explainable match for ' + job.t + '. The score supports your judgement. It never replaces it'} />
      <PoolOverviewCard job={job} candidates={candidates} compact />
      <div className="two l">
        <div className="card rk">
          <label>Job <JobSelect /></label>
          <h3 style={{ marginTop: 14 }}>Ranked candidates</h3>
          {rk.map(x => (
            <button key={x.id} className={`li pk ${x.id == c.id ? 'on' : ''}`} onClick={() => setState({ sel: x.id })}>
              <span>
                <b>{displayName(x, state.set)}</b><br />
                <small style={{ color: 'var(--mu)' }}>{RK.has(x.id) ? 'Rank ' + RK.get(x.id) : 'Unranked'} · {stl(x)}</small>
              </span>
              <ScoreRing value={liveScoreOf(x)} size={46} />
            </button>
          ))}
        </div>
        <div key={c.id} className="stk nx-cand-enter">
          <div className="card ban">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <Avatar name={name} size={56} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <h2>{name}</h2>
                <p>{c.r} · {stl(c)}</p>
                <span className="chip tr">Advisory score · you decide</span>
                <RankChip rank={RK.get(c.id)} />
              </div>
              <ScoreRing value={displayScore} size={92} />
            </div>
            <div className="row">{decisionButtons}</div>
            <p className="fine" style={{ margin: '10px 0 0' }}>Nothing is approved or rejected automatically. The status changes only when you press one of these buttons.</p>
          </div>

          {aiAnalysis ? (
            <div className="card">
              <div className="an-hd">
                <h3>AI Recruiter Brief</h3>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {aiAnalysis.overview && aiAnalysis.overview.recommendation ? (
                    <span className="chip ok">{aiAnalysis.overview.recommendation}</span>
                  ) : null}
                  <span className={aiAnalysis.mode === 'ai' ? 'chip ok' : 'chip tr'}>
                    {aiAnalysis.mode === 'ai' ? 'AI · ' + (aiAnalysis.model || 'LLM') : 'Backend heuristic'}
                  </span>
                  <span className="chip">{aiAnalysis.score + '%'}</span>
                  <button className="btn sm" disabled={scoring} onClick={() => runAiScore(true)}>
                    {scoring ? 'Scoring…' : 'Re-score'}
                  </button>
                </div>
              </div>
              {aiAnalysis.overview && aiAnalysis.overview.headline ? (
                <p style={{ color: 'var(--tx)', fontWeight: 600, marginTop: 10 }}>{aiAnalysis.overview.headline}</p>
              ) : null}
              {aiAnalysis.overview && aiAnalysis.overview.summary ? (
                <p style={{ color: 'var(--tx)' }}>{aiAnalysis.overview.summary}</p>
              ) : null}
              <div className="two">
                <div>
                  <h4 style={{ margin: '0 0 6px' }}>Strengths</h4>
                  {aiAnalysis.overview && Array.isArray(aiAnalysis.overview.strengths) && aiAnalysis.overview.strengths.length ? (
                    <ul style={{ margin: '4px 0 0 18px' }}>
                      {aiAnalysis.overview.strengths.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No strengths listed.</p>
                  )}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px' }}>Gaps</h4>
                  {aiAnalysis.overview && Array.isArray(aiAnalysis.overview.gaps) && aiAnalysis.overview.gaps.length ? (
                    <ul style={{ margin: '4px 0 0 18px' }}>
                      {aiAnalysis.overview.gaps.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No gaps listed.</p>
                  )}
                </div>
              </div>
              {aiAnalysis.overview && Array.isArray(aiAnalysis.overview.interview_questions) && aiAnalysis.overview.interview_questions.length ? (
                <div style={{ marginTop: 14 }}>
                  <h4 style={{ margin: '0 0 6px' }}>Targeted interview questions</h4>
                  <ol style={{ margin: '4px 0 0 18px' }}>
                    {aiAnalysis.overview.interview_questions.map((qItem, idx) => (
                      <li key={idx}>{qItem}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
              {aiAnalysis.disclaimer ? (
                <p className="fine" style={{ marginTop: 12 }}>{aiAnalysis.disclaimer}</p>
              ) : null}
            </div>
          ) : (
            <div className="card">
              <div className="an-hd">
                <h3>AI Recruiter Brief</h3>
                <span className={state.aiConfig && state.aiConfig.ai_enabled ? 'chip ok' : 'chip tr'}>
                  {state.aiConfig && state.aiConfig.ai_enabled ? 'AI · ' + (state.aiConfig.model || 'LLM') : 'Backend analysis'}
                </span>
              </div>
              <p>
                {scoring
                  ? `Analysing ${name} against ${job.t} on the server…`
                  : `Generate a structured recruiter brief, strengths, gaps, and targeted interview questions for ${name} against ${job.t}.`}
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn p sm" disabled={scoring} onClick={() => runAiScore(false)}>
                  {scoring ? 'Analysing…' : 'Run AI analysis for ' + job.t}
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="an-hd">
              <h3>Why this score</h3>
              {aiAnalysis ? (
                <span className={aiAnalysis.mode === 'ai' ? 'chip ok' : 'chip tr'}>
                  {aiAnalysis.mode === 'ai' ? 'AI · ' + (aiAnalysis.model || 'LLM') : 'Backend heuristic'}
                </span>
              ) : (
                <Tag />
              )}
            </div>
            {aiAnalysis && Array.isArray(aiAnalysis.components) && aiAnalysis.components.length ? (
              <>
                <div className="an-t">
                  <div className="main"><small>Overall match</small><b>{aiAnalysis.score}%</b><span>{RK.has(c.id) ? 'Rank ' + RK.get(c.id) + ' of ' + RK.size : 'Unranked'}</span></div>
                  <div><small>Required skills match</small><b>{aiAnalysis.required_coverage}%</b><span>{aiAnalysis.components[0]?.note || ''}</span></div>
                </div>
                {aiAnalysis.components.map((p, i) => (
                  <div key={p.key || i}>
                    <Bar value={Math.round((p.fraction || 0) * 100)} label={p.label + ' · ' + d1(p.points) + ' of ' + d1(p.max_points) + ' points'} />
                    {p.note ? <p className="fine" style={{ margin: '-6px 0 8px' }}>{p.note}</p> : null}
                  </div>
                ))}
                <p className="an-eq">{aiAnalysis.components.map(p => d1(p.points)).join(' + ')} = {d1(aiAnalysis.raw_score ?? aiAnalysis.score)} points. Shown as {aiAnalysis.score}%.</p>
              </>
            ) : sp.ok ? (
              <>
                <div className="an-t">
                  <div className="main"><small>Overall match</small><b>{sp.tot}%</b><span>{RK.has(c.id) ? 'Rank ' + RK.get(c.id) + ' of ' + RK.size : 'Unranked'}</span></div>
                  <div><small>Required skills match</small><b>{sp.cov}%</b><span>{sp.comps[0].note}</span></div>
                </div>
                {sp.comps.map((p, i) => (
                  <div key={i}>
                    <Bar value={Math.round(p.f * 100)} label={p.l + ' · ' + d1(p.pts) + ' of ' + d1(p.max) + ' points'} />
                    <p className="fine" style={{ margin: '-6px 0 8px' }}>{p.note}</p>
                  </div>
                ))}
                <p className="an-eq">{sp.comps.map(p => d1(p.pts)).join(' + ')} = {d1(sp.raw)} points (parts shown to one decimal). Shown as {sp.tot}%.</p>
              </>
            ) : <p>Not scored. This record has no completed resume analysis, so no score or rank is given. Upload the resume again in Step 1.</p>}
            {aiOv ? (
              <>
                <p style={{ color: 'var(--tx)', marginTop: 14 }}>
                  <b>{aiOv.recommendation || 'Advisory read'}.</b> {aiOv.headline}
                  {aiOv.summary ? ' ' + aiOv.summary : ''}
                </p>
                <p className="fine">
                  {aiAnalysis.disclaimer || 'Advisory screening aid only. A human must review the resume and make every hiring decision.'}
                </p>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--tx)', marginTop: 14 }}><b>{a.l}.</b> {a.t}</p>
                <p className="fine">Advisory read written from a template, not by an AI model. Weights are demo values, not a validated model.</p>
              </>
            )}
          </div>

          <div className="card">
            <div className="an-hd">
              <h3>Skill evidence for {job.t}</h3>
              {hasAiSkills ? (
                <span className={aiAnalysis.mode === 'ai' ? 'chip ok' : 'chip tr'}>
                  {aiAnalysis.mode === 'ai' ? 'AI · ' + (aiAnalysis.model || 'LLM') : 'Backend heuristic'}
                </span>
              ) : (
                <Tag />
              )}
            </div>
            <p>One row per required skill. “Not found” means the resume is silent, not that the candidate lacks the skill. Verification prompts are suggestions.</p>
            <div className="an-f" role="group" aria-label="Filter skills by status">
              <button className="sx" aria-pressed={f == 'All'} onClick={() => setFilter('All')}>All {rows.length}</button>
              {[3, 2, 1, 0].map(l => (
                <button key={l} className={`sx v${l}`} aria-pressed={f == String(l)} disabled={!cnt[l]} onClick={() => setFilter(String(l))}>
                  {SXI[l]} {SXL[l]} {cnt[l]}
                </button>
              ))}
            </div>
            <ul className="ev-l">
              {vis.length ? vis.map((r, i) => (
                <li key={i} className={`ev-r v${r.l}`}>
                  <div className="ev-h">
                    <b>{r.x}</b>
                    <span className={`sx v${r.l}`}>{SXI[r.l]} {SXL[r.l]}</span>
                    <span className="dots" role="img" aria-label={`Evidence strength ${r.l} of 3`}>
                      {[1, 2, 3].map(k => <i key={k} className={k <= r.l ? 'on' : ''} />)}
                    </span>
                  </div>
                  <p className="ev-w">{r.tier ? tierWhere(r.tier, r.sec) : where[r.l]}</p>
                  <div className="ev-g">
                    <div><small className="ev-k">Resume evidence</small><p>{r.evText || evid(r)}</p></div>
                    <div><small className="ev-k">Suggested verification</small><p className="sgt">{r.verText || ver(r)}</p></div>
                  </div>
                </li>
              )) : <li><p>No required skills have this status.</p></li>}
            </ul>
          </div>

          <JdCard c={c} job={job} name={name} />
          <AnalysisView c={c} j={job} ctx={ctx} name={name} />

          <div className="card">
            <div className="an-hd">
              <h3>Recruiter review panel</h3>
              {aiOv ? <span className={aiAnalysis.mode === 'ai' ? 'chip ok' : 'chip tr'}>{aiAnalysis.mode === 'ai' ? 'AI-generated' : 'Backend heuristic'}</span> : null}
            </div>
            <p>{aiOv ? 'Strengths, gaps, and interview questions generated from the candidate resume against this JD. None of this is a decision.' : 'Facts come from the candidate record. Suggestions are templates filled from that record. None of this is a decision.'}</p>
            <div className="rp">
              <div className="rv">
                <h4>Key strengths <Tag /></h4>
                {panelStrengths.length ? <ul>{panelStrengths.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>No strong evidence on this record. Check the resume itself.</p>}
              </div>
              <div className="rv">
                <h4>Potential skill gaps <Tag /></h4>
                {panelGaps.length ? <ul>{panelGaps.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p>Every required skill is evidenced against this job.</p>}
              </div>
              <div className="rv">
                <h4>Experience observations <Tag /></h4>
                <ul>
                  {expObservations.map((obs, i) => <li key={i}>{obs}</li>)}
                </ul>
              </div>
              <div className="rv sg">
                <h4>Suggested interview questions <Tag suggestion /></h4>
                <ol>{panelQs.map((x, i) => <li key={i}>{x}</li>)}</ol>
              </div>
            </div>
            <h4 className="an-h4">Areas requiring verification <span className="an-tag">Your checks · {done} of {ck.length}</span></h4>
            <p>Tick each item once you have checked it. Ticks are your own record and do not change the score.</p>
            {ck.map((x, i) => (
              <label className="chk" key={i}>
                <input type="checkbox" checked={!!state.chk[kk(x[0])]} onChange={e => setChecked(kk(x[0]), e.target.checked)} />
                <span>{x[1]}</span>
              </label>
            ))}
          </div>

          <div className="two" style={{ margin: 0 }}>
            <div className="card">
              <h3>
                Resume evidence{' '}
                {aiAnalysis ? (
                  <span className={aiAnalysis.mode === 'ai' ? 'chip ok' : 'chip tr'}>
                    {aiAnalysis.mode === 'ai' ? 'AI extracted' : 'Extracted'}
                  </span>
                ) : (
                  <span className="chip">Sample</span>
                )}
              </h3>
              <div className="ev">
                <b>Project</b>
                {aiAnalysis && aiProjects.length ? (
                  aiProjects.map((pr, i) => (
                    <div key={i} style={{ marginTop: i ? 4 : 0 }}>
                      {pr.title ? <strong>{pr.title}</strong> : null}
                      {pr.title && pr.description ? ' — ' : ''}
                      {pr.description || (!pr.title ? 'Project listed' : '')}
                    </div>
                  ))
                ) : (
                  c.pr
                )}
              </div>
              <div className="ev">
                <b>Project relevance</b>
                {(aiAnalysis && aiProjComp && aiProjComp.note) || prTxt(c, q)}
              </div>
              <div className="ev">
                <b>Experience</b>
                {aiAnalysis && aiWork.length ? (
                  aiWork.map((w, i) => (
                    <div key={i} style={{ marginTop: i ? 4 : 0 }}>
                      {[w.title, w.company].filter(Boolean).join(' @ ') || 'Role listed'}
                      {w.date_range ? ` (${w.date_range})` : ''}
                    </div>
                  ))
                ) : aiAnalysis && aiParsed && aiParsed.experience_years != null ? (
                  aiParsed.experience_years > 0
                    ? `${aiParsed.experience_years} ${aiParsed.experience_years === 1 ? 'yr' : 'yrs'} parsed from resume (${c.r})`
                    : 'Fresher, no professional experience parsed'
                ) : (
                  c.ex == 'Fresher' ? 'Fresher, no professional experience listed' : c.ex + ' as ' + c.r + (c.r == job.t ? '. Same title as this job.' : '. Title differs from this job, so rely on the skill evidence.')
                )}
              </div>
              <div className="ev">
                <b>Education</b>
                {(aiAnalysis && aiParsed && aiParsed.education) || c.ed}
              </div>
            </div>
            <div className="card">
              <h3>Transferable skills</h3>
              {aiAnalysis ? (
                <>
                  {aiInferred.length ? (
                    aiInferred.map((x, i) => (
                      <p key={i} style={{ color: 'var(--tx)' }}>
                        <b>{x.skill}</b>
                        {x.section && x.section !== 'Not recorded' ? ` (${x.section})` : ''}:{' '}
                        {x.evidence || 'Inferred from related resume experience.'} Confirm depth.
                      </p>
                    ))
                  ) : m.tr.length ? (
                    m.tr.map((x, i) => <p key={i} style={{ color: 'var(--tx)' }}><b>{x.s}</b> → {x.t}. {x.w}. Confirm depth.</p>)
                  ) : (
                    <p>No transferable skills found for this job.</p>
                  )}
                  <p>Advisory evidence extracted from resume text; confirm depth in interview.</p>
                </>
              ) : (
                <>
                  {m.tr.length ? m.tr.map((x, i) => <p key={i} style={{ color: 'var(--tx)' }}><b>{x.s}</b> → {x.t}. {x.w}. Confirm depth.</p>) : <p>No transferable skills found for this job.</p>}
                  <p>Template explanation from sample data. No AI model is running.</p>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="an-hd"><h3>Your decision</h3><span className="chip">Current status: {stl(c)}</span></div>
            <p>Recommendations above are advisory. Only you can change this candidate’s status.</p>
            <div className="row" style={{ marginTop: 8 }}>{decisionButtons}</div>
            <div className="row">
              <button className="btn sm" onClick={compare}>{state.cmp.includes(c.id) ? 'Remove from compare' : 'Add to compare'} ({state.cmp.length}/3)</button>
              <a className="btn sm" href="/roles" onClick={() => setState({ rc: c.id, role_: 0 })}>See other roles</a>
              <a className="btn sm" href="/profile" onClick={() => setState({ sel: c.id })}>Final decision</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
