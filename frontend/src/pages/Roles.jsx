// Other role matches (multi-role discovery). Port of legacy roles() (app.js lines 1027-1035) and sendHR (line 1264).
import { useEffect } from 'react';
import { useAppState, setState } from '../store/state.js';
import { candidateStatus } from '../store/candidates.js';
import { sco, mm, rolesFor, hidden, rankAll } from '../lib/scoring.js';
import { pct, displayName } from '../lib/text.js';
import { ChipList } from '../components/ui/Chip.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import {
  allJobs, currentJob, pageContext, byId, PageHead, ChartDefs, Ring, CandidateSelect,
} from './insights/shared.jsx';
import { syncOnboarding } from './insights/Onboarding.jsx';

export default function Roles({ route, candidates, job }) {
  const state = useAppState();
  const toast = useToast();
  const jobs = allJobs(state);
  const j = currentJob(job, state);
  const q = j.req;
  const ctx = pageContext(j, candidates, state);
  const status = c => candidateStatus(c, state.status);
  const set = state.set;

  // Legacy obSync(): visiting this page ticks the alternative-roles step.
  useEffect(() => {
    syncOnboarding(route);
  });

  const hf = hidden(candidates, j, status, jobs, ctx);
  // Legacy: when no candidate is picked yet, the first hidden fit is shown.
  const rcId = state.rc ?? (hf[0] ? hf[0].c.id : 0);
  const c = byId(candidates, rcId);
  const rs = rolesFor(c, jobs, ctx);
  const k = Math.min(state.role_, rs.length - 1);
  const r = rs[k];
  const m = mm(c, r.q);
  const mj = mm(c, q);
  const up = r.s - sco(c, q, j, ctx);
  const alt = state.alt[c.id];
  const only = m.ok.filter(s => !q.includes(s));
  const lost = mj.no.filter(s => !r.q.includes(s));
  const name = displayName(c, set);

  // Legacy onclick: S.alt[id] toggles between this role and none.
  const toggleAlt = () => {
    setState(s => ({ alt: { ...s.alt, [c.id]: s.alt[c.id] === r.r ? '' : r.r } }));
    toast('Alternative role updated. HR approval still required');
  };

  // Legacy sendHR(i, k).
  const sendHR = () => {
    setState(s => ({ hr: { ...s.hr, [c.id]: r.r } }));
    toast('Sent to HR review for ' + r.r + ' (simulated, consent pending)');
  };

  return (
    <>
      <ChartDefs />
      <PageHead
        title="Step 3 · Other role matches"
        sub="Multi-role discovery: candidates who miss one job may suit another. Consent and HR approval come before any outreach"
      />
      <div className="card ban">
        <h3>Hidden fits for {j.t}</h3>
        <p>Weak for the selected job, stronger for another role. Select one to see why.</p>
        <div className="row">
          {hf.length ? (
            hf.map(h => (
              <button
                key={h.c.id}
                className={`btn sm ${h.c.id === c.id ? 'p' : ''}`}
                onClick={() => setState({ rc: h.c.id, role_: 0 })}
              >
                {displayName(h.c, set)} · {h.ap}% → {h.b.s}%
              </button>
            ))
          ) : (
            <span className="chip">None for this job</span>
          )}
        </div>
      </div>
      <div className="two r">
        <div className="card">
          <label>
            Candidate{' '}
            <select value={c.id} onChange={e => setState({ rc: Number(e.target.value), role_: 0 })}>
              {rankAll(candidates, q, j, ctx).map(x => (
                <option key={x.id} value={x.id}>
                  {displayName(x, set)} · {x.r}
                </option>
              ))}
            </select>
          </label>
          <h3 style={{ marginTop: 14 }}>Roles ranked by fit</h3>
          {rs.map((x, i) => (
            <button key={x.r} className={`li pk ${i === k ? 'on' : ''}`} onClick={() => setState({ role_: i })}>
              <span>
                <b>{x.r}</b>
                {x.r === j.t ? (
                  <>
                    {' '}
                    <span className="chip">Selected job</span>
                  </>
                ) : null}
                <br />
                <small style={{ color: 'var(--mu)' }}>{x.q.length} requirements</small>
              </span>
              <Ring v={x.s} s={46} />
            </button>
          ))}
        </div>
        <div className="card">
          <h3>
            {name} for {r.r}
          </h3>
          <div className="vs">
            <div>
              <small>{j.t} (selected job)</small>
              <div className="big">{pct(sco(c, q, j, ctx))}</div>
              <p>
                {mj.ok.length} of {q.length} requirements evidenced
              </p>
            </div>
            <div className={up > 0 ? 'nw' : ''}>
              <small>{r.r}</small>
              <div className="big">{pct(r.s)}</div>
              <p>
                {m.ok.length} of {r.q.length} requirements evidenced
              </p>
            </div>
          </div>
          <p style={{ color: 'var(--tx)' }}>
            <b>{up > 0 ? 'Why this role may fit better: ' : 'How this role compares: '}</b>
            {name} evidences {m.ok.length} of {r.q.length} requirements for {r.r}
            {m.tr.length ? `, plus ${m.tr.length} transferable` : ''}, against {mj.ok.length} of {q.length} for {j.t}.{' '}
            {up > 0 ? `That is ${up} points higher. ` : up < 0 ? `This is ${-up} points lower than the selected job. ` : ''}
            {only.length ? `Skills that count for ${r.r} but not for ${j.t}: ${only.join(', ')}. ` : ''}
            {lost.length ? `${j.t} also requires ${lost.join(', ')}, which ${name} has not shown and ${r.r} does not ask for. ` : ''}
            {c.r === r.r ? `Their resume lists ${c.r} as their role. ` : ''}Relevant work: {c.pr}.
          </p>
          <p>Matching skills</p>
          <ChipList items={m.ok} kind="ok" />
          <p>Transferable skills</p>
          {m.tr.length ? <ChipList items={m.tr.map(x => x.s + ' → ' + x.t)} kind="tr" /> : <span className="chip">None</span>}
          <p>Missing requirements</p>
          <ChipList items={m.no} kind="no" />
          <p>
            Recruiter to verify: {m.no[0] || 'depth of experience'}, and project ownership. Scores are demo values.
          </p>
          <div className="row">
            <button className="btn p sm" onClick={toggleAlt}>
              {alt === r.r ? 'Remove alternative role' : 'Consider for this role'}
            </button>
            <button className="btn sm" onClick={sendHR}>Send to HR review</button>
            <a className="btn sm" href="/match" onClick={() => setState({ sel: c.id })}>
              Candidate analysis
            </a>
            {alt ? <span className="chip ok">Considered for {alt}</span> : null}
            {state.hr[c.id] === r.r ? <span className="chip tr">Sent to HR review (simulated)</span> : null}
          </div>
        </div>
      </div>
    </>
  );
}
