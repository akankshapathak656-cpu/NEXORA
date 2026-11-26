// Port of legacy work() (app.js line 1287): workforce intelligence. Sample data is inline, as in legacy.
import { useToast } from '../components/ui/Toast.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { PageHead } from './work/PageHead.jsx';
import { AreaChart, Ring } from './work/Charts.jsx';

const TREND = [60, 62, 66, 65, 70, 74, 78];
const TREND_LABELS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7'];

// Legacy E2: [name, current role, readiness score, target role].
const PROMOTION = [
  ['Aditi Rao', 'Frontend Engineer', 88, 'Senior Frontend'],
  ['Vikram Das', 'QA Analyst', 81, 'SDET'],
  ['Neha Kulkarni', 'Junior Backend', 77, 'Backend Engineer II'],
];

export default function Work() {
  const toast = useToast();
  return (
    <>
      <PageHead title="Workforce intelligence" sub="Advisory only. All recommendations require HR review" />
      <div className="two">
        <div className="card">
          <h3>Hires retained at 12 months</h3>
          <AreaChart data={TREND} labels={TREND_LABELS} />
          <p>Illustrative sample trend.</p>
        </div>
        <div className="card">
          <h3>Promotion-ready (advisory)</h3>
          {PROMOTION.map(([name, role, score, target]) => (
            <div className="li" key={name}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar name={name} size={36} />
                <span>
                  <b>{name}</b>
                  <br />
                  <small style={{ color: 'var(--mu)' }}>{role} → {target}</small>
                </span>
              </span>
              <Ring value={score} size={46} />
            </div>
          ))}
          <div className="row">
            <button className="btn sm" onClick={() => toast('Sent to HR for review')}>Send to HR review</button>
          </div>
        </div>
      </div>
    </>
  );
}
