// Skill trends and JD updater. Port of legacy trends() (app.js line 1037). Figures are illustrative demo values.
import { useAppState, setState } from '../store/state.js';
import { currentJob, PageHead, ChartDefs, AreaChart } from './insights/shared.jsx';
import { Bar } from '../components/ui/Bar.jsx';

// Legacy TRN: [skill, demand (0-100), change].
const TRENDS = [
  ['React', 88, '+18%'],
  ['TypeScript', 81, '+24%'],
  ['Next.js', 64, '+31%'],
  ['AI/LLM tooling', 52, '+46%'],
  ['jQuery', 22, '−15%'],
];

// Legacy SUG: suggested JD changes. Accepted state is kept in state.jd by index.
const SUGGESTIONS = [
  'Add TypeScript as required skill',
  'Add Testing (Jest/Vitest) as preferred skill',
  'Replace jQuery with modern framework experience',
  'Add AI-assisted development as a plus',
];

const GROWTH_Q = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];
const GROWTH = [20, 26, 31, 40, 47, 58, 66, 81];

export default function Trends({ job }) {
  const state = useAppState();
  const j = currentJob(job, state);
  const accepted = SUGGESTIONS.filter((s, i) => state.jd[i]).length;

  const trendLabel = t => {
    let tag = '';
    if (t[2][0] === '−') tag = ' · outdated';
    else if (t[1] < 66) tag = ' · emerging';
    return t[0] + ' · ' + t[2] + tag;
  };

  // Legacy onclick: S.jd[i] = !S.jd[i]
  const toggle = i => setState(s => ({ jd: { ...s.jd, [i]: !s.jd[i] } }));

  return (
    <>
      <ChartDefs />
      <PageHead title="Skill trends & JD updater" sub="Illustrative figures, not real market data" />
      <div className="two">
        <div className="card">
          <h3>Trending skills</h3>
          {TRENDS.map(t => (
            <Bar key={t[0]} value={t[1]} label={trendLabel(t)} />
          ))}
        </div>
        <div className="card">
          <h3>Skill growth</h3>
          <AreaChart data={GROWTH} labels={GROWTH_Q} />
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>AI-generated JD suggestions</h3>
        {SUGGESTIONS.map((s, i) => (
          <div key={s} className="li">
            <span>{s}</span>
            <button
              className={`btn sm ${state.jd[i] ? 'p' : ''}`}
              aria-pressed={!!state.jd[i]}
              onClick={() => toggle(i)}
            >
              {state.jd[i] ? 'Accepted ✓' : 'Accept'}
            </button>
          </div>
        ))}
        <p>
          Current: {j.req.join(', ')}
          <br />
          Proposed: {accepted || 'no'} change{accepted === 1 ? '' : 's'} accepted
        </p>
      </div>
    </>
  );
}
