// Full-viewport progress overlay displayed while a candidate pool is being scored and collated.
import { useAppState } from '../store/state.js';

const BACKDROP_BG =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('background', 'color-mix(in srgb, #000 82%, transparent)')
    ? 'color-mix(in srgb, var(--bg) 82%, transparent)'
    : 'rgba(246, 244, 239, 0.78)';

export function AnalysisOverlay() {
  const poolProgress = useAppState(s => s.poolProgress);
  const aiConfig = useAppState(s => s.aiConfig);

  if (!poolProgress) return null;

  const { jobTitle, phase, done = 0, total = 0 } = poolProgress;
  const rawPct = phase === 'collating' ? 100 : Math.round((done / Math.max(1, total)) * 100);
  const pct = Math.min(100, Math.max(0, rawPct));
  const aiLive = Boolean(aiConfig && aiConfig.ai_enabled);
  const chipLabel = aiLive ? `AI · ${aiConfig.model || 'LLM'}` : 'Backend heuristic';
  const statusText =
    phase === 'collating'
      ? `All ${total} candidates scored — collating executive pool overview…`
      : `Scoring candidates in parallel… (${done} of ${total} complete)`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Analysing candidate pool"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: BACKDROP_BG,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: 460,
          width: '92%',
          padding: '24px 26px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.14)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h3 style={{ margin: 0 }}>Analysing candidate pool</h3>
          <span className={aiLive ? 'chip ok' : 'chip tr'}>{chipLabel}</span>
        </div>

        <p style={{ margin: '8px 0 16px', fontWeight: 600, color: 'var(--tx)' }}>{jobTitle}</p>

        <div className="bar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} role="progressbar">
          <i style={{ width: `${pct}%`, transition: 'width 240ms ease' }} />
        </div>

        <p role="status" aria-live="polite" style={{ margin: '12px 0 6px', fontSize: 14, color: 'var(--tx)' }}>
          {statusText}
        </p>

        <p className="fine" style={{ margin: 0 }}>
          Scores and briefs are cached automatically once complete.
        </p>
      </div>
    </div>
  );
}

export default AnalysisOverlay;
