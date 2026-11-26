// Small shared parts for the candidate pages (Cands, Profile, Comms, CompareModal).
// Legacy: hd() (page head), stc()/stl() (status chip), rkc() (rank chip), slChip(), ring() and cs() (candidate select).
import { setState, useAppState } from '../store/state.js';
import { displayName } from '../lib/text.js';

export function PageHead({ title, sub }) {
  const aiConfig = useAppState(s => s.aiConfig);
  const badgeText = aiConfig
    ? aiConfig.ai_enabled
      ? 'AI · ' + (aiConfig.model || 'LLM')
      : 'Backend heuristic'
    : 'Demo mode';
  const badgeClass = aiConfig && aiConfig.ai_enabled ? 'chip ok' : 'chip tr';
  return (
    <div className="top">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <span className={badgeClass}>{badgeText}</span>
    </div>
  );
}

// Legacy stc(c): the status class uses the stored name (Review, Shortlisted, ...). The label reads "Needs review".
export function StatusChip({ status }) {
  const label = status == 'Review' ? 'Needs review' : status;
  return <span className={`chip st st-${status}`}>{label}</span>;
}

// Legacy rkc(c): rank among all scored candidates for this job.
export function RankChip({ rank }) {
  if (rank == null) return <span className="chip no">Unranked</span>;
  return <span className="chip" title="Rank among all scored candidates for this job">Rank {rank}</span>;
}

// Legacy slChip(c): shortlist label from the shortlist map value.
export function ShortlistChip({ label }) {
  if (label == 'SHORTLISTED') {
    return <span className="chip ok" title="Inside the HR shortlist limit, by Overall Candidate Score">SHORTLISTED</span>;
  }
  if (label) {
    return <span className="chip tr" title="Outside the HR shortlist limit. The analysis stays available.">NOT SHORTLISTED</span>;
  }
  return <span className="chip no" title="No completed resume analysis, so not ranked">Not analysed</span>;
}

// Legacy ring(v, s): circular score gauge. value null shows "Not scored".
export function ScoreRing({ value, size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={value == null ? 'Not scored' : value + ' percent'}>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bd)" strokeWidth="3" />
      <circle className="rg" cx="18" cy="18" r="15.9" fill="none" stroke="url(#gd)" strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${value || 0} 100`} transform="rotate(-90 18 18)" />
      <text x="18" y="21" textAnchor="middle" fill="var(--tx)" fontSize="9" fontWeight="700">{value == null ? '—' : value + '%'}</text>
    </svg>
  );
}

// Legacy cs(): candidate picker. list is already ranked by the caller. Choosing one resets the mail draft state.
export function CandidateSelect({ list, value, set }) {
  return (
    <label>
      Candidate{' '}
      <select value={value} onChange={e => setState({ sel: +e.target.value, mail: 'draft' })}>
        {list.map(c => (
          <option key={c.id} value={c.id}>{displayName(c, set)} · {c.r}</option>
        ))}
      </select>
    </label>
  );
}
