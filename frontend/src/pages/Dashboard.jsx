// Dashboard: recruitment command center. Port of legacy dashboard() (app.js lines 404-442) and its onboarding guide.
import { useEffect } from 'react';
import { useAppState, setState } from '../store/state.js';
import { candidateStatus } from '../store/candidates.js';
import { aiAnalysisFor, loadAiConfig } from '../store/actions.js';
import { sco, valid, mm, rankAll, rankMap, hidden } from '../lib/scoring.js';
import { pct, displayName } from '../lib/text.js';
import { Bar } from '../components/ui/Bar.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import PoolOverviewCard from '../components/PoolOverviewCard.jsx';
import {
  allJobs, currentJob, pageContext, DUP_PAIRS, dupName, Ring, ChartDefs,
} from './insights/shared.jsx';
import { OBS, obCount, syncOnboarding, OnboardingPanel, reopenOnboarding } from './insights/Onboarding.jsx';
import { InsightRow, InsightCard } from './insights/InsightCard.jsx';

// Legacy PLS: pipeline stages, label, filter values, colour.
const PIPELINE = [
  ['New', ['New'], 'var(--a)'],
  ['Needs review', ['Review', 'Needs review'], 'var(--a)'],
  ['Shortlisted', ['Shortlisted', 'Approved'], 'var(--a)'],
  ['Interview', ['Interview'], 'var(--a)'],
  ['Hired', ['Hired'], 'var(--a)'],
];

// Legacy job selector. Until the upload agent's setJob action exists, this sets the job directly
// and ticks the job step of the guide, as legacy setJob() did.
function setJobIndex(i) {
  setState(s => ({ job: i, ob: { ...s.ob, done: { ...s.ob.done, job: 1 } } }));
}

export default function Dashboard({ route, candidates, job }) {
  const state = useAppState();
  const set = state.set;
  const jobs = allJobs(state);
  const j = currentJob(job, state);
  const q = j.req;
  const ctx = pageContext(j, candidates, state);
  const status = c => candidateStatus(c, state.status);
  const live = c => !['Rejected', 'Hired'].includes(status(c));
  const sc = c => {
    const ai = aiAnalysisFor(j, c, state);
    return ai && ai.score != null ? ai.score : sco(c, q, j, ctx);
  };
  const nameOf = c => displayName(c, set);

  useEffect(() => {
    loadAiConfig();
  }, []);

  // Legacy obSync(), run on render.
  useEffect(() => {
    syncOnboarding(route);
  });

  const aiConfig = state.aiConfig;
  const statusLine = aiConfig
    ? aiConfig.ai_enabled
      ? `Backend connected · AI mode (${aiConfig.model || 'LLM'}) active. Candidate scores and pool overviews resolve live on the server.`
      : 'Backend connected · Heuristic mode (no AI key configured). Candidate scores and pool overviews resolve on the server.'
    : `Browser demo mode · Backend offline or unreachable. Metrics are computed locally from the ${candidates.length} seed candidates.`;

  const AC = candidates.filter(live), N = AC.length, SC = AC.filter(c => valid(c));
  const top = rankAll(SC, q, j, ctx).slice(0, 3);
  const RK = rankMap(candidates, q, j, ctx);
  const hf = hidden(candidates, j, status, jobs, ctx), hf3 = hf.slice(0, 3);
  const pe = candidates.filter(c => ['New', 'Review'].includes(status(c)));
  const nNew = candidates.filter(c => status(c) === 'New').length, nRev = pe.length - nNew;
  const avg = SC.length ? Math.round(SC.reduce((s, c) => s + sc(c), 0) / SC.length) : null;
  const strong = AC.filter(c => sc(c) >= 80).length;
  const dupO = DUP_PAIRS.map((d, i) => ({ d, i })).filter(x => x.d[2] >= 80 && !state.dup[x.i]);
  const miss = q
    .map(s => {
      const w = AC.filter(c => mm(c, q).no.includes(s));
      return { s, n: w.length, w: w[0] };
    })
    .filter(x => x.n)
    .sort((a, b) => b.n - a.n || a.s.localeCompare(b.s))
    .slice(0, 4);
  const nSh = candidates.filter(c => status(c) === 'Shortlisted').length;
  const hu = hf.filter(h => !state.alt[h.c.id] && state.hr[h.c.id] == null).length;

  // Legacy flt(): set the candidate-list filter, then open the list.
  const applyFilter = stf => setState({ stf, q: '', sf: 'All', page: 0, role: 'All', min: 0 });

  const att = [];
  if (nNew) att.push({ href: '/cands', pick: () => applyFilter(['New']), t: `${nNew} candidate${nNew === 1 ? '' : 's'} still marked New`, d: `No recruiter has reviewed ${nNew === 1 ? 'this candidate' : 'them'} yet.`, w: 1 });
  if (nSh) att.push({ href: '/cands', pick: () => applyFilter(['Shortlisted', 'Approved']), t: `${nSh} shortlisted candidate${nSh === 1 ? '' : 's'} waiting for the next step`, d: `Move ${nSh === 1 ? 'this candidate' : 'them'} to Interview or record a decision.`, w: 1 });
  if (hu) att.push({ href: '/roles', pick: null, t: `${hu} hidden fit${hu === 1 ? '' : 's'} not yet considered for another role`, d: `Open multi-role discovery to review ${hu === 1 ? 'it' : 'them'}.`, w: 1 });
  PIPELINE.filter(p => !candidates.some(c => p[1].includes(status(c)))).forEach(p =>
    att.push({ href: '/cands', pick: () => applyFilter(null), t: 'No candidates at ' + p[0], d: 'This pipeline stage is currently empty.', w: 0 }),
  );
  const at = att.slice(0, 4);

  const reviewFilter = () => applyFilter(['New', 'Review', 'Needs review']);
  const kpis = [
    { label: 'Active candidates', value: N, sub: `${candidates.length} in pool · ${candidates.length - N} hired or rejected`, href: '/cands', pick: () => applyFilter(null), cls: '', action: 'View candidates →' },
    { label: 'Awaiting review', value: pe.length, sub: `${nNew} New · ${nRev} Needs review`, href: '/cands', pick: reviewFilter, cls: pe.length ? 'w' : 'm', action: 'Review now →' },
    { label: 'Average match', value: avg == null ? '—' : avg + '%', sub: N ? 'Active candidates for ' + j.t : 'No active candidates', href: '/match', cls: '', action: 'Open analysis →' },
    { label: 'Strong matches', value: strong, sub: 'Score 80+ for ' + j.t + ' (demo threshold)', href: '/match', cls: '', action: 'See ranking →' },
    { label: 'Hidden fits', value: hf.length, sub: 'Weak here, stronger for another role', href: '/roles', cls: hf.length ? '' : 'm', action: 'Explore roles →' },
    { label: 'Duplicate flags', value: dupO.length, sub: 'Unreviewed pairs at 80%+ similarity (sample data)', href: '/dups', cls: dupO.length ? 'w' : 'm', action: 'Review pairs →' },
  ];

  const doneCount = obCount(state.ob.done);

  return (
    <>
      <ChartDefs />
      <section className="hero2 cc">
        <div>
          <p className="eyebrow">Recruitment command center</p>
          <h2>
            Hire with evidence.
            <br />
            Decide with confidence.
          </h2>
          <p>NEXORA shows why a candidate matches, where evidence is missing, and which other roles they may fit. You make every decision.</p>
          <div className="row" style={{ margin: 0 }}>
            <a className="btn dk" href="/upload" onClick={() => setState({ dm: 1, autorun: 1 })}>
              Start guided demo →
            </a>
            <a className="btn dk" href="/upload">
              Choose a job
            </a>
            {state.ob.dis ? (
              <button className="btn" onClick={reopenOnboarding}>
                Getting started · {doneCount}/{OBS.length}
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <OnboardingPanel candidates={candidates} />
      <div className="dsec">
        <h3>Overview</h3>
        <span>
          {N} active of {candidates.length} candidates · {j.t}
        </span>
      </div>
      <div className="kpis">
        {kpis.map(k => (
          <a key={k.label} className={`kp ${k.cls}`} href={k.href} onClick={k.pick}>
            <span className="kl">{k.label}</span>
            <b className="kv">{k.value}</b>
            <span className="kd">{k.sub}</span>
            <span className="ka">{k.action}</span>
          </a>
        ))}
      </div>
      <p style={{ margin: '10px 2px 0', fontSize: 12 }}>
        {statusLine}
      </p>
      <PoolOverviewCard job={j} candidates={candidates} />
      <div className="dsec">
        <h3>Actionable insights</h3>
        <span>Select an item to open the related screen</span>
      </div>
      <div className="ig-g">
        <InsightCard
          title="Needs recruiter review"
          sub="New and flagged candidates, highest score first."
          cnt={pe.length}
          w={1}
          rows={rankAll(pe, q, j, ctx).slice(0, 3).map(c => (
            <InsightRow key={c.id} href="/match" onPick={() => setState({ sel: c.id })} w={0} title={nameOf(c)} detail={`${status(c)} · ${c.r}`} right={<span className="tg">{pct(sc(c))}</span>} />
          ))}
          empty="No candidates are waiting for review."
          more={pe.length ? <a className="ig-m" href="/cands" onClick={reviewFilter}>Open all {pe.length} in the candidate list →</a> : null}
        />
        <InsightCard
          title="Frequently missing skills"
          sub={`Required skills not found in active resumes for ${j.t}.`}
          cnt={miss.length}
          w={1}
          rows={miss.map(x => (
            <InsightRow
              key={x.s}
              href="/gap"
              onPick={() => setState({ sel: x.w.id })}
              w={1}
              title={x.s}
              detail={`Not found in ${x.n} of ${N} active resume${N === 1 ? '' : 's'}`}
              right={
                <span className="ig-b" role="img" aria-label={`${Math.round((100 * x.n) / N)} percent of resumes`}>
                  <i style={{ width: `${Math.round((100 * x.n) / N)}%` }} />
                </span>
              }
            />
          ))}
          empty="Every required skill appears in the active resumes."
          more={
            <>
              <a className="ig-m" href="/gap">Open skill gap analysis →</a>
              <p className="ig-f">Not found means not in the resume. It does not mean the candidate lacks the skill.</p>
            </>
          }
        />
        <InsightCard
          title="Potential duplicate profiles"
          sub="Similarity flags from the sample duplicate data. Nothing is auto-rejected."
          cnt={dupO.length}
          w={1}
          rows={dupO.map(x => (
            <InsightRow
              key={x.i}
              href="/dups"
              w={1}
              title={`${dupName(x.d[0], candidates, set)} ↔ ${dupName(x.d[1], candidates, set)}`}
              detail={x.d[3]}
              right={<span className="tg">{x.d[2]}%</span>}
            />
          ))}
          empty="No unreviewed pairs at 80% similarity or higher."
          more={<a className="ig-m" href="/dups">{DUP_PAIRS.filter((d, i) => state.dup[i]).length} of {DUP_PAIRS.length} pairs reviewed · Open duplicate detection →</a>}
        />
        <InsightCard
          title="Hiring pipeline attention"
          sub="Points worth a look, based on current candidate statuses."
          cnt={at.length}
          w={1}
          rows={at.map((x, i) => (
            <InsightRow key={i} href={x.href} onPick={x.pick || undefined} w={x.w} title={x.t} detail={x.d} />
          ))}
          empty="No attention points. Every stage has candidates and none are waiting."
          more={<a className="ig-m" href="/cands" onClick={() => applyFilter(null)}>Open the candidate pipeline →</a>}
        />
      </div>
      <div className="dsec">
        <h3>Pipeline &amp; matching</h3>
        <span>Current job and where candidates stand</span>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3>Current job: {j.t}</h3>
            <p>{q.join(', ')}</p>
          </div>
          <select aria-label="Job" value={state.job} onChange={e => setJobIndex(Number(e.target.value))}>
            {jobs.map((x, i) => (
              <option key={i} value={i}>
                {x.t}
              </option>
            ))}
          </select>
        </div>
        <div className="pp">
          {PIPELINE.map(p => (
            <a
              key={p[0]}
              className="ps"
              style={{ '--k': p[2] }}
              href="/cands"
              onClick={() => setState({ stf: p[1], q: '', sf: 'All', page: 0 })}
            >
              <small>{p[0]}</small>
              <b>{candidates.filter(c => p[1].includes(status(c))).length}</b>
            </a>
          ))}
        </div>
        <p>Candidates per stage. Select a stage to filter the list.</p>
      </div>
      <div className="two">
        <div className="card">
          <h3>Best matches for this job</h3>
          {top.map(c => (
            <a key={c.id} className="ar" href="/match" onClick={() => setState({ sel: c.id })}>
              <Avatar name={nameOf(c)} size={38} />
              <span>
                <b>{nameOf(c)}</b>
                <br />
                <small>
                  Rank {RK.get(c.id)} · {c.r}
                </small>
              </span>
              <Ring v={sc(c)} s={44} />
            </a>
          ))}
          <div className="row">
            <a className="btn sm" href="/match">Open candidate analysis</a>
          </div>
        </div>
        <div className="card">
          <h3>
            Hidden fits <span className="chip tr">Multi-role</span>
          </h3>
          <p>Weak for {j.t}, strong for another role.</p>
          {hf3.length ? (
            hf3.map(h => (
              <a key={h.c.id} className="ar" href="/roles" onClick={() => setState({ rc: h.c.id, role_: 0 })}>
                <Avatar name={nameOf(h.c)} size={38} />
                <span>
                  <b>{nameOf(h.c)}</b>
                  <br />
                  <small>
                    {h.ap}% for {j.t} → {h.b.s}% for {h.b.r}
                  </small>
                </span>
                <span className="tg th">+{h.b.s - h.ap}</span>
              </a>
            ))
          ) : (
            <p>No hidden fits for this job.</p>
          )}
          <div className="row">
            <a className="btn sm" href="/roles">Explore multi-role discovery</a>
          </div>
        </div>
      </div>
      <div className="card">
        <h3>
          Required-skill coverage <span className="chip tr">{j.t}</span>
        </h3>
        <p>Share of the {N} active candidates whose resume lists each required skill.</p>
        <div className="cvg">
          {N ? (
            q.map(s => {
              const n = AC.filter(c => c.sk.includes(s)).length;
              return <Bar key={s} value={Math.round((100 * n) / N)} label={`${s} · ${n} of ${N}`} />;
            })
          ) : (
            <p>No active candidates.</p>
          )}
        </div>
      </div>
    </>
  );
}
