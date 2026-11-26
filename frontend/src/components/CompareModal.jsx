// Compare-candidates modal. Port of legacy cmpModal() and kd() (app.js lines 1265-1281). Rendered by the shell.
// Reads state.cm and state.cmp from the store. Closes with setState({ cm: 0 }).
import { useEffect, useRef } from 'react';
import { useAppState, setState } from '../store/state.js';
import { useCandidates, candidateStatus } from '../store/candidates.js';
import { mm, ev, yrs, prRel, valid } from '../lib/scoring.js';
import { d1, pct, displayName } from '../lib/text.js';
import { allJobs } from '../store/context.js';
import { makeCtx, scoreFor, rankedFor, rankPositions, decisionPatch, decisionLabel } from '../lib/review.js';
import { useToast } from './ui/Toast.jsx';

const EVIDENCE_LABEL = ['Not found', '≈ Transferable', '✓ Evidenced', '✓ Evidenced · used in project'];

// Legacy kd(): the key differences sentence for the ranked compare list.
function keyDifferences(l, M, job, ctx, name) {
  const out = [];
  const o = rankedFor(l, job, ctx).filter(valid), A = o[0], B = o[1];
  if (B) {
    const sa = scoreFor(A, job, ctx), sb = scoreFor(B, job, ctx), d = sa.tot - sb.tot;
    const gap = sa.comps.map((p, i) => [p.l, p.pts - sb.comps[i].pts])
      .filter(x => Math.abs(x[1]) >= .5)
      .map(x => (x[1] > 0 ? '+' : '−') + d1(Math.abs(x[1])) + ' ' + x[0].toLowerCase())
      .join(', ');
    out.push((d == 0
      ? name(A) + ' and ' + name(B) + ' have the same score (' + sa.tot + '%). ' + name(A) + ' is placed first by ' +
        (sa.req != sb.req ? 'required skills match' : sa.exp != sb.exp ? 'relevant experience' : 'record order only') + '.'
      : name(A) + ' scores ' + d + ' point' + (d == 1 ? '' : 's') + ' higher than ' + name(B) + '.') +
      (gap ? ' Points difference: ' + gap + '.' : ''));
    if (d <= 5) out.push('The scores are close, so the evidence rows matter more than the ranking.');
  }
  l.forEach((c, i) => {
    const u = M[i].ok.filter(s => l.every((x, j) => j == i || !M[j].ok.includes(s)));
    if (u.length) out.push('Only ' + name(c) + ' evidences ' + u.join(', ') + '.');
  });
  const all = job.req.filter(s => M.every(m => m.no.includes(s)));
  if (all.length) out.push('Not found for any of them: ' + all.join(', ') + '. Ask everyone about it.');
  return out.join(' ');
}

export default function CompareModal() {
  const state = useAppState();
  const candidates = useCandidates();
  const toast = useToast();
  const closeRef = useRef(null);

  // Legacy renders focus on the Close button when the modal opens.
  useEffect(() => {
    if (state.cm && closeRef.current) closeRef.current.focus();
  }, [state.cm]);

  if (!state.cm) return null;

  const jobs = allJobs(state);
  const job = jobs[state.job] || jobs[0];
  const ctx = makeCtx(job, candidates);
  const name = c => displayName(c, state.set);
  const byId = new Map(candidates.map(c => [c.id, c]));
  const RK = rankPositions(candidates, job, ctx);
  const l = rankedFor(state.cmp.map(i => byId.get(i)).filter(Boolean), job, ctx);
  const M = l.map(c => mm(c, job.req));
  const sc = l.map(c => scoreFor(c, job, ctx));
  const cv = i => M[i].ok.length + M[i].tr.length * .5;
  const n = job.req.length;

  const rows = [
    { label: 'Rank', cell: c => (RK.has(c.id) ? String(RK.get(c.id)) : 'Unranked') },
    { label: 'Match score', cell: (c, i) => pct(sc[i].tot), key: (c, i) => sc[i].tot || 0 },
    { label: 'Required skills match', cell: (c, i) => (valid(c) ? sc[i].cov + '%' : '—'), key: (c, i) => sc[i].req },
    { label: 'Skills named', cell: (c, i) => M[i].ok.length + ' of ' + n + ' evidenced' + (M[i].tr.length ? ' (+' + M[i].tr.length + ' related)' : ''), key: (c, i) => cv(i) },
    { label: 'Experience', cell: c => c.ex, key: c => yrs(c) },
    { label: 'Education', cell: c => c.ed },
    { label: 'Best project', cell: c => c.pr },
    {
      label: 'Project relevance',
      cell: c => { const r = prRel(c, job.req); return r.l + ' (' + r.n + ' of ' + n + ' skills named)'; },
      key: c => prRel(c, job.req).n,
    },
    ...job.req.map(x => ({
      label: x,
      cell: c => EVIDENCE_LABEL[ev(c, x)[0]],
      key: c => ev(c, x)[0],
    })),
    { label: 'Still to verify', cell: (c, i) => (M[i].no.length ? M[i].no.join(', ') : 'None found') },
  ];

  const decide = (id, v) => {
    const c = byId.get(id);
    if (!c) return;
    setState(s => decisionPatch(s, id, v, ''));
    toast(name(c) + ': ' + decisionLabel(v));
  };

  return (
    <div className="mo" onClick={e => { if (e.target === e.currentTarget) setState({ cm: 0 }); }}>
      <div className="card" role="dialog" aria-modal="true" aria-label="Candidate comparison">
        <h3>Compare candidates for {job.t}</h3>
        {l.length < 2 ? (
          <p>Tick at least 2 candidates in the table, then press Compare.</p>
        ) : (
          <>
            <div className="sc">
              <table className="mx">
                <tbody>
                  <tr>
                    <th>Criterion</th>
                    {l.map(c => (
                      <th key={c.id}>{name(c)}<br /><small>{c.r}</small></th>
                    ))}
                  </tr>
                  {rows.map((r, ri) => {
                    const v = r.key ? l.map((c, i) => r.key(c, i)) : null;
                    const df = v && Math.max(...v) != Math.min(...v);
                    const mx = v ? Math.max(...v) : 0;
                    return (
                      <tr key={ri}>
                        <td>{df ? <b>{r.label}</b> : r.label}</td>
                        {l.map((c, i) => (
                          <td key={c.id} className={df && v[i] == mx ? 'best' : ''}>{r.cell(c, i)}</td>
                        ))}
                      </tr>
                    );
                  })}
                  <tr>
                    <td>Your decision</td>
                    {l.map(c => (
                      <td key={c.id}>
                        <b>{decisionLabel(candidateStatus(c, state.status))}</b>
                        <br />
                        <button className="btn p sm" onClick={() => decide(c.id, 'Shortlisted')}>Shortlist</button>{' '}
                        <button className="btn sm" onClick={() => decide(c.id, 'Rejected (by HR)')}>Reject</button>{' '}
                        <a className="btn sm" href="/profile" onClick={() => setState({ sel: c.id })}>Final decision</a>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ color: 'var(--tx)' }}>
              <b>Key differences: </b>{keyDifferences(l, M, job, ctx, name)}
            </p>
            <p>Bold rows are where the candidates differ, and the green cell is the strongest in that row. All figures use the same scoring as the analysis page. The highest score is not an automatic winner. Review the evidence rows and decide.</p>
          </>
        )}
        <button className="btn" id="cx" ref={closeRef} onClick={() => setState({ cm: 0 })}>Close</button>
      </div>
    </div>
  );
}
