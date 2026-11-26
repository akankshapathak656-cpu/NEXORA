// Helpers shared by the analysis pages (Dashboard, Gap, Roles, Trends, Dups).
// Components here render legacy markup; the scoring itself stays in src/lib.
import { useAppState } from '../../store/state.js';
import { JOBS } from '../../data/jobs.js';
import { SKD } from '../../data/skillBase.js';
import { XR } from '../../data/roles.js';
import { NS } from '../../data/samples.js';
import { displayName } from '../../lib/text.js';

// Legacy JOBS: the built-in jobs followed by the custom jobs saved in state.jobs (legacy pushed them into JOBS at start).
export function allJobs(state) {
  return [...JOBS, ...(Array.isArray(state.jobs) ? state.jobs : [])];
}

// The selected job. The shell passes job = JOBS[state.job]; fall back to the full list for custom jobs.
export function currentJob(job, state) {
  const list = allJobs(state);
  return job || list[state.job] || list[0];
}

// Resume context for score(), sco(), cmpS(), rankAll(), rankMap(), rolesFor() and anGet().
export function pageContext(job, candidates, state) {
  return { job, skills: SKD, jobs: allJobs(state), xr: XR, candidates, ns: NS };
}

export function byId(list, id) {
  return list.find(c => c.id === id) || list[0];
}

// Legacy dn(s): a candidate index shows the candidate's display name; any other text shows the second-resume label in blind mode.
export function dupName(s, candidates, set) {
  const c = typeof s === 'number' ? candidates.find(x => x.id === s) : null;
  if (c) return displayName(c, set);
  return set && set.blind ? 'Second resume' : String(s);
}

// Legacy DP: duplicate pairs from the sample data. [first, second, similarity %, reason].
export const DUP_PAIRS = [
  [0, 'Rahul K. Sharma', 94, 'Same email domain; near-identical project text'],
  [2, 'Karan Mehta (v2)', 99, 'Identical file hash'],
  [3, 4, 41, 'Shared template wording only'],
];

// Legacy hd(t, s): page heading. The demo chip text follows API.live, which is false until a backend is connected.
export function PageHead({ title, sub }) {
  return (
    <div className="top">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      <span className="chip tr" title="No backend is connected. Scores come from a simple demo formula.">
        Simulated demo data
      </span>
    </div>
  );
}

// Legacy ring() and area() reference gradients gd and ga, which the legacy page never defines (dead url(#gd)/url(#ga) references).
// Defined here once per page so the progress arcs and trend fills draw.
export function ChartDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="gd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--a)' }} />
          <stop offset="1" style={{ stopColor: '#7c4dff' }} />
        </linearGradient>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--a)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--a)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Legacy ring(v, s).
export function Ring({ v, s = 64 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 36 36" role="img" aria-label={v == null ? 'Not scored' : v + ' percent'}>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bd)" strokeWidth="3" />
      <circle
        className="rg"
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="url(#gd)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${v || 0} 100`}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="21" textAnchor="middle" fill="var(--tx)" fontSize="9" fontWeight="700">
        {v == null ? '—' : v + '%'}
      </text>
    </svg>
  );
}

// Legacy area(d, lb, w, h, tip): line chart with fill, one labelled point per value.
export function AreaChart({ data, labels, w = 460, h = 190, tip = '' }) {
  const mx = Math.max(...data) * 1.15;
  const X = i => 26 + (i * (w - 40)) / (data.length - 1);
  const Y = v => h - 26 - (v / mx) * (h - 46);
  const pts = data.map((v, i) => X(i) + ',' + Y(v)).join(' ');
  const last = data.length - 1;
  return (
    <svg className="ch" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend chart">
      {[0, 0.5, 1].map(k => (
        <line key={k} x1="20" x2={w - 6} y1={Y(mx * k)} y2={Y(mx * k)} stroke="var(--bd)" />
      ))}
      <polygon points={`${X(0)},${h - 26} ${pts} ${X(last)},${h - 26}`} fill="url(#ga)" />
      <polyline points={pts} fill="none" stroke="url(#gd)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r="5" fill="var(--panel)" stroke="var(--c)" strokeWidth="2">
          <title>
            {labels[i]}: {v}
          </title>
        </circle>
      ))}
      {tip ? (
        <>
          <rect x={X(last) - 112} y={Y(data[last]) - 36} width="122" height="24" rx="12" fill="#7c4dff" />
          <text x={X(last) - 51} y={Y(data[last]) - 20} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
            {tip}
          </text>
        </>
      ) : null}
      {labels.map((l, i) => (
        <text key={i} x={X(i)} y={h - 7} textAnchor="middle" fill="var(--mu)" fontSize="10">
          {l}
        </text>
      ))}
    </svg>
  );
}

// Legacy cs(): candidate picker used by Gap. Selecting a candidate resets the outreach draft.
export function CandidateSelect({ options, value, onChange }) {
  const set = useAppState(s => s.set);
  return (
    <label>
      Candidate{' '}
      <select value={value} onChange={e => onChange(Number(e.target.value))}>
        {options.map(c => (
          <option key={c.id} value={c.id}>
            {displayName(c, set)} · {c.r}
          </option>
        ))}
      </select>
    </label>
  );
}

