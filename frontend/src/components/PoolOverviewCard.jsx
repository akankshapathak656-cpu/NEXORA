// Shared AI Pool Executive Overview card used on both Step 2 (/match) and Dashboard (/dashboard).
// Silently hydrates cached backend analyses on mount and runs AI pool analysis on explicit user action.
import { useEffect, useState } from 'react';
import { useAppState, setState } from '../store/state.js';
import { candidateApiId, resolvePoolLive } from '../store/actions.js';
import { getJobAnalyses } from '../lib/api.js';
import { useToast } from './ui/Toast.jsx';
import { go } from '../routes.js';

export default function PoolOverviewCard({ job, candidates, compact = false }) {
  const state = useAppState();
  const toast = useToast();
  const [err, setErr] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  const aiConfig = state.aiConfig;
  const overview = job && state.poolOverviews ? state.poolOverviews[job.t] : null;
  const jobApiId = job && state.jobApiIds ? state.jobApiIds[job.t] : null;
  const progress =
    state.poolProgress && job && state.poolProgress.jobTitle === job.t ? state.poolProgress : null;
  const hasOverview = !!(overview && overview.candidate_count > 0);
  const busy = manualBusy || !!progress;

  // Silently hydrate cached backend analyses/overview when this job is already synced, without triggering overlays or LLM calls.
  useEffect(() => {
    if (!job) return;
    setErr('');
    if (!jobApiId || state.poolOverviews?.[job.t]) return;
    let cancelled = false;
    getJobAnalyses(jobApiId)
      .then(existing => {
        if (cancelled || !existing) return;
        const hasAnalyses = Array.isArray(existing.analyses) && existing.analyses.length > 0;
        const hasPoolOverview = !!existing.pool_overview;
        if (!hasAnalyses && !hasPoolOverview) return;
        setState(s => {
          const nextAnalyses = hasAnalyses ? { ...s.aiAnalyses } : s.aiAnalyses;
          if (hasAnalyses) {
            for (const a of existing.analyses) {
              nextAnalyses[`${job.t}|${a.candidate_id}`] = a;
            }
          }
          const nextOverviews = hasPoolOverview
            ? { ...s.poolOverviews, [job.t]: existing.pool_overview }
            : s.poolOverviews;
          return { aiAnalyses: nextAnalyses, poolOverviews: nextOverviews };
        });
      })
      .catch(() => { /* silent hydration */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job && job.t, jobApiId]);

  if (!job) return null;

  const modeLabel = overview
    ? overview.mode === 'ai'
      ? `AI · ${overview.model || 'LLM'}`
      : 'Backend heuristic'
    : aiConfig
      ? aiConfig.ai_enabled
        ? `AI · ${aiConfig.model || 'LLM'}`
        : 'Backend heuristic'
      : 'Connecting…';
  const modeChipClass =
    (overview && overview.mode === 'ai') || (!overview && aiConfig && aiConfig.ai_enabled) ? 'chip ok' : 'chip tr';

  const handleRefresh = async () => {
    setManualBusy(true);
    setErr('');
    try {
      const res = await resolvePoolLive(job, candidates, { force: hasOverview });
      if (res && res.candidate_count > 0) {
        toast(hasOverview ? `Pool overview refreshed for ${job.t}` : `Pool analysed for ${job.t}`);
      }
    } catch (e) {
      const msg = (e && e.message) || 'Could not refresh pool overview';
      setErr(msg);
      toast(msg);
    } finally {
      setManualBusy(false);
    }
  };

  const openPick = pick => {
    const match =
      candidates.find(x => candidateApiId(x, state) === pick.candidate_id) ||
      candidates.find(x => (x.real || x.n) === pick.name);
    if (match) {
      setState({ sel: match.id });
      go('match');
    }
  };

  return (
    <div className="card" style={{ marginTop: compact ? 0 : 16, marginBottom: compact ? 16 : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3>Pool executive overview</h3>
          <span className={modeChipClass}>{modeLabel}</span>
          <span className="chip tr">{job.t}</span>
        </div>
        <button className="btn sm" disabled={busy} onClick={handleRefresh}>
          {progress
            ? progress.phase === 'collating'
              ? 'Collating overview…'
              : `Analysing ${progress.done}/${progress.total}…`
            : manualBusy
              ? 'Refreshing…'
              : hasOverview
                ? 'Re-analyse pool'
                : 'Analyse pool'}
        </button>
      </div>

      {err ? <p style={{ color: 'var(--rd)', marginTop: 10 }}>{err}</p> : null}

      {hasOverview ? (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="chip">{overview.candidate_count} analysed candidate{overview.candidate_count === 1 ? '' : 's'}</span>
            {overview.average_score != null ? <span className="chip">Avg {Math.round(overview.average_score)}%</span> : null}
            {overview.highest_score != null ? <span className="chip ok">Top {Math.round(overview.highest_score)}%</span> : null}
            {overview.lowest_score != null ? <span className="chip tr">Low {Math.round(overview.lowest_score)}%</span> : null}
          </div>
          {overview.executive_summary ? (
            <p style={{ color: 'var(--tx)', marginTop: 12 }}>{overview.executive_summary}</p>
          ) : null}
          {overview.sourcing_signal ? (
            <p style={{ marginTop: 8 }}>
              <b>Sourcing signal:</b> {overview.sourcing_signal}
            </p>
          ) : null}
          {Array.isArray(overview.top_picks) && overview.top_picks.length ? (
            <div style={{ marginTop: 14 }}>
              <h4 style={{ margin: '0 0 8px' }}>Top picks</h4>
              {overview.top_picks.map((p, idx) => (
                <button
                  key={p.candidate_id || idx}
                  type="button"
                  className="li pk"
                  style={{ alignItems: 'flex-start', gap: 12 }}
                  onClick={() => openPick(p)}
                >
                  <span>
                    <b>{p.name}</b>
                    {p.reason ? (
                      <>
                        <br />
                        <small style={{ color: 'var(--mu)' }}>{p.reason}</small>
                      </>
                    ) : null}
                  </span>
                  {p.score != null ? <span className="chip ok">{Math.round(p.score)}%</span> : null}
                </button>
              ))}
            </div>
          ) : null}
          <div className="two">
            <div>
              <h4 style={{ margin: '0 0 6px' }}>Common strengths</h4>
              {Array.isArray(overview.common_strengths) && overview.common_strengths.length ? (
                <ul style={{ margin: '4px 0 0 18px' }}>
                  {overview.common_strengths.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No recurring strengths noted yet.</p>
              )}
            </div>
            <div>
              <h4 style={{ margin: '0 0 6px' }}>Common gaps</h4>
              {Array.isArray(overview.common_gaps) && overview.common_gaps.length ? (
                <ul style={{ margin: '4px 0 0 18px' }}>
                  {overview.common_gaps.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>No recurring gaps noted yet.</p>
              )}
            </div>
          </div>
          {overview.disclaimer ? (
            <p className="fine" style={{ marginTop: 12 }}>{overview.disclaimer}</p>
          ) : null}
        </>
      ) : (
        <p style={{ marginTop: 10 }}>
          No AI pool overview yet for <b>{job.t}</b>. Click <b>Analyse pool</b> to score all {candidates.length} candidate{candidates.length === 1 ? '' : 's'} with AI, or upload resumes in{' '}
          <a className="link" href="/upload">Step 1</a>.
        </p>
      )}
    </div>
  );
}
