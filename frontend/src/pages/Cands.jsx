// Step 4: compare candidates. Port of legacy cands(), tbl(), slCard() and the shortlist helpers (app.js lines 1050-1098).
import { useEffect, useMemo, useRef } from 'react';
import { useAppState, setState } from '../store/state.js';
import { aiAnalysisFor, resolvePoolLive } from '../store/actions.js';
import { candidateStatus } from '../store/candidates.js';
import { valid, hidden } from '../lib/scoring.js';
import { displayName, pct } from '../lib/text.js';
import { JOBS } from '../data/jobs.js';
import { Avatar } from '../components/ui/Avatar.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { PageHead, StatusChip, RankChip, ShortlistChip } from '../components/CandParts.jsx';
import {
  makeCtx, scoreFor,
  normShortlist, shortlistConfig, SHORTLIST_PRESETS,
} from '../lib/review.js';

const ROLE_OPTIONS = ['All', 'Frontend Developer', 'UI Developer', 'Full Stack Developer', 'Web Designer', 'Backend Developer', 'SDE'];
const PAGE_SIZE = 5;

// Shortlist explanation text (legacy slInfo).
function ShortlistInfo({ cfg, pool, tot, unanalysed }) {
  if (!cfg.N) return 'No successfully analysed candidates yet. Analyse resumes in Step 1 to build a shortlist.';
  const { n, N } = cfg;
  const tie = n > 0 && n < N && tot.get(pool[n - 1].id) == tot.get(pool[n].id);
  return (
    <>
      {cfg.err ? (
        <>
          <span style={{ color: 'var(--rd)' }} role="alert">{cfg.err}</span> Showing the last valid limit ({n}).{' '}
        </>
      ) : null}
      <b>{n}</b> of {N} analysed candidate{N == 1 ? '' : 's'} SHORTLISTED (highest Overall Candidate Score).
      {' '}The other {N - n} {N - n == 1 ? 'is' : 'are'} NOT SHORTLISTED and stay available below.
      {cfg.clamped ? ` ${cfg.label} was chosen but only ${N} ${N == 1 ? 'was' : 'were'} analysed, so ${N == 1 ? 'it is' : 'all are'} shortlisted.` : ''}
      {tie ? ' Candidates tied on score at the cut-off are ordered by required skills match, relevant experience, then record order.' : ''}
      {n > 0 ? ` Lowest shortlisted score: ${tot.get(pool[n - 1].id)}%.` : ''}
      {unanalysed > 0 ? ` ${unanalysed} record${unanalysed == 1 ? '' : 's'} without a completed analysis ${unanalysed == 1 ? 'is' : 'are'} not ranked or shortlisted.` : ''}
    </>
  );
}

export default function Cands({ candidates, job }) {
  const state = useAppState();
  const toast = useToast();
  const customRef = useRef(null);
  const focusCustom = useRef(false);

  const ctx = useMemo(() => makeCtx(job, candidates), [job, candidates]);
  const { tot, cov, RK, pool } = useMemo(() => {
    const totMap = new Map();
    const covMap = new Map();
    for (const c of candidates) {
      const ai = aiAnalysisFor(job, c, state);
      const sp = scoreFor(c, job, ctx);
      totMap.set(c.id, ai && typeof ai.score === 'number' ? ai.score : sp.tot);
      covMap.set(c.id, ai && typeof ai.required_coverage === 'number' ? ai.required_coverage : sp.cov);
    }
    const compareLive = (a, b) => {
      const sa = totMap.get(a.id) ?? -1;
      const sb = totMap.get(b.id) ?? -1;
      if (sb !== sa) return sb - sa;
      const ca = covMap.get(a.id) ?? -1;
      const cb = covMap.get(b.id) ?? -1;
      if (cb !== ca) return cb - ca;
      return a.id - b.id;
    };
    const rankedPool = candidates.filter(valid).slice().sort(compareLive);
    const rkMap = new Map(rankedPool.map((c, i) => [c.id, i + 1]));
    return { tot: totMap, cov: covMap, RK: rkMap, pool: rankedPool };
  }, [candidates, job, ctx, state.aiAnalyses, state.candApiIds]);

  // Ensure Step 4 has live AI scores when visited before the pool overview is resolved.
  useEffect(() => {
    if (!job || !candidates.length) return;
    if (!state.poolOverviews?.[job.t]) {
      resolvePoolLive(job, candidates, { force: false }).catch(() => {});
    }
  }, [job && job.t, candidates.length]);

  const name = c => displayName(c, state.set);
  const statusOf = c => candidateStatus(c, state.status);

  const sl = normShortlist(state.sl);
  const cfg = shortlistConfig(sl, pool.length);
  const custom = sl.m == 'custom';
  const bad = custom && !!cfg.err;
  const unanalysed = candidates.length - cfg.N;
  const SM = new Map(pool.map((c, i) => [c.id, i < cfg.n ? 'SHORTLISTED' : 'NOT SHORTLISTED']));
  const hiddenList = useMemo(() => hidden(candidates, job, statusOf, JOBS, ctx), [candidates, job, state.status, ctx]);

  // Keep the custom input focused after the user picks "Custom number".
  useEffect(() => {
    if (focusCustom.current && sl.m == 'custom') {
      focusCustom.current = false;
      if (customRef.current) customRef.current.focus();
    }
  }, [sl.m]);

  const sts = ['All', ...new Set(candidates.map(statusOf))];
  const sf = sts.includes(state.sf) ? state.sf : 'All';
  const slf = state.slf || 'All';
  const q = String(state.q || '').toLowerCase();
  const roles = [...new Set([...ROLE_OPTIONS, ...JOBS.map(j => j.t), ...candidates.map(c => c.r)])];

  const list = candidates.filter(c =>
    (state.role == 'All' || c.r == state.role) &&
    (!state.min || (valid(c) && tot.get(c.id) >= state.min)) &&
    (!state.stf || state.stf.includes(statusOf(c))) &&
    (sf == 'All' || statusOf(c) == sf) &&
    (slf == 'All' || (slf == 'S' ? SM.get(c.id) == 'SHORTLISTED' : SM.get(c.id) == 'NOT SHORTLISTED')) &&
    (name(c) + c.sk.join()).toLowerCase().includes(q));

  const dir = state.dir || 1;
  const compareScore = (a, b) => {
    const sa = tot.get(a.id) ?? -1;
    const sb = tot.get(b.id) ?? -1;
    if (sb !== sa) return sb - sa;
    const ca = cov.get(a.id) ?? -1;
    const cb = cov.get(b.id) ?? -1;
    if (cb !== ca) return cb - ca;
    return a.id - b.id;
  };
  const sorted = list.slice().sort((a, b) => state.sort == 'n'
    ? name(a).localeCompare(name(b)) * dir || a.id - b.id
    : (valid(b) - valid(a)) || compareScore(a, b) * dir);

  const N = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pg = Math.min(state.page || 0, N - 1);
  const rows = sorted.slice(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE);

  const sortBy = k => setState(s => ({ dir: s.sort == k ? -(s.dir || 1) : 1, sort: k, page: 0 }));
  const resetFilters = () => setState({ q: '', role: 'All', min: 0, sf: 'All', slf: 'All', stf: null, page: 0 });

  const toggleCompare = (id, checked) => {
    if (!checked) {
      setState(s => ({ cmp: s.cmp.filter(x => x != id) }));
      return;
    }
    if (state.cmp.length >= 3) {
      toast('Compare up to 3');
      return;
    }
    setState(s => ({ cmp: [...s.cmp, id] }));
  };

  const pickPreset = v => {
    if (!SHORTLIST_PRESETS.some(p => p[0] == v)) return;
    const next = { ...sl, m: v };
    next.v = shortlistConfig(next, pool.length).v;
    focusCustom.current = v == 'custom';
    setState({ sl: next, page: 0 });
  };

  const typeCustom = value => {
    const next = { ...sl, c: value };
    next.v = shortlistConfig(next, pool.length).v;
    setState({ sl: next, page: 0 });
  };

  // Legacy "Considered for" and "Also fits" note under the role.
  const altNote = c => {
    if (state.alt[c.id]) {
      return (<><br /><small style={{ color: 'var(--c)' }}>Considered for: {state.alt[c.id]} (HR approval pending)</small></>);
    }
    const h = hiddenList.find(x => x.c.id == c.id);
    return h ? (<><br /><small style={{ color: 'var(--c)' }}>Also fits: {h.b.r} {h.b.s}%</small></>) : null;
  };

  return (
    <>
      <PageHead title="Step 4 · Compare candidates" sub="Filter the pool, tick up to 3 candidates and compare them side by side" />

      <div className="card" id="slc" style={{ marginBottom: 16 }}>
        <div className="an-hd">
          <h3>HR shortlist</h3>
          <span className="chip tr">Ranked by Overall Candidate Score</span>
        </div>
        <p>Pick how many of the highest-ranked candidates to shortlist. Nobody is hidden or deleted: every candidate keeps a full analysis.</p>
        <div className="row" style={{ marginTop: 8 }}>
          <label>Shortlist size{' '}
            <select id="sl-m" aria-label="Shortlist size" value={sl.m} onChange={e => pickPreset(e.target.value)}>
              {SHORTLIST_PRESETS.map(p => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
            </select>
          </label>
          <input
            id="sl-c"
            ref={customRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            aria-label={`Custom shortlist number, 1 to ${cfg.N}`}
            placeholder={`1 to ${cfg.N}`}
            value={sl.c}
            onChange={e => typeCustom(e.target.value)}
            style={{ width: 130 }}
            hidden={!custom}
            className={bad ? 's3-bad' : undefined}
            aria-invalid={bad ? 'true' : undefined}
          />
        </div>
        <p id="sl-info" aria-live="polite" style={{ margin: '10px 0 0', color: 'var(--tx)' }}>
          <ShortlistInfo cfg={cfg} pool={pool} tot={tot} unanalysed={unanalysed} />
        </p>
      </div>

      <div className="card">
        <div className="row" style={{ margin: 0 }}>
          <input
            aria-label="Search name or skill"
            type="search"
            placeholder="Search name or skill"
            value={state.q}
            onChange={e => setState({ q: e.target.value, page: 0 })}
          />
          <select aria-label="Role" value={state.role} onChange={e => setState({ role: e.target.value, page: 0 })}>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label>Min score{' '}
            <input type="range" min="0" max="100" value={state.min} onChange={e => setState({ min: +e.target.value, page: 0 })} />
            <span>{state.min}</span>
          </label>
          <label>Status{' '}
            <select aria-label="Status" value={sf} onChange={e => setState({ sf: e.target.value, page: 0 })}>
              {sts.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label>Shortlist{' '}
            <select aria-label="Shortlist filter" value={slf} onChange={e => setState({ slf: e.target.value, page: 0 })}>
              <option value="All">All</option>
              <option value="S">Shortlisted</option>
              <option value="N">Not shortlisted</option>
            </select>
          </label>
          <button className="btn sm p" id="cmpb" onClick={() => setState({ cm: 1 })}>Compare ({state.cmp.length})</button>
          {state.stf ? (
            <span className="chip tr">
              Pipeline filter: {state.stf.join(' / ')}{' '}
              <button className="btn sm" onClick={() => setState({ stf: null })} aria-label="Clear filter">✕</button>
            </span>
          ) : null}
        </div>

        <div className="sc" id="tb">
          {rows.length ? (
            <>
              <table>
                <tbody>
                  <tr>
                    <th><span style={{ position: 'absolute', left: -9999 }}>Compare</span></th>
                    <th><button onClick={() => sortBy('n')}>Name ↕</button></th>
                    <th>Role</th>
                    <th><button onClick={() => sortBy('sc')}>Score ↕</button></th>
                    <th>Status</th>
                    <th>Shortlist</th>
                    <th></th>
                  </tr>
                  {rows.map(c => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Compare ${name(c)}`}
                          checked={state.cmp.includes(c.id)}
                          onChange={e => toggleCompare(c.id, e.target.checked)}
                        />
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <Avatar name={name(c)} size={32} />
                          {name(c)} <RankChip rank={RK.get(c.id)} />
                        </span>
                      </td>
                      <td>{c.r}{altNote(c)}</td>
                      <td>{pct(tot.get(c.id))}</td>
                      <td><StatusChip status={statusOf(c)} /></td>
                      <td><ShortlistChip label={SM.get(c.id)} /></td>
                      <td>
                        <a className="btn sm" href="/match" onClick={() => setState({ sel: c.id })}>Analysis</a>{' '}
                        <a className="btn sm" href="/profile" onClick={() => setState({ sel: c.id })}>Decision</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row">
                <button className="btn sm" onClick={() => setState({ page: Math.max(0, pg - 1) })}>Prev</button>
                <span>Page {pg + 1} of {N}</span>
                <button className="btn sm" onClick={() => setState({ page: Math.min(N - 1, pg + 1) })}>Next</button>
              </div>
            </>
          ) : (
            <>
              <p>No candidates match these filters.</p>
              <div className="row">
                <button className="btn sm" onClick={resetFilters}>Reset filters</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
