// Duplicate resume detection. Port of legacy dups() (app.js lines 1038-1040). Similarity only raises a review flag.
import { useAppState, setState } from '../store/state.js';
import { DUP_PAIRS, dupName, PageHead, ChartDefs, Ring } from './insights/shared.jsx';

export default function Dups({ candidates }) {
  const state = useAppState();
  const set = state.set;

  // Legacy onclick: S.dup[i] = label
  const mark = (i, label) => setState(s => ({ dup: { ...s.dup, [i]: label } }));

  return (
    <>
      <ChartDefs />
      <PageHead title="Duplicate resume detection" sub="Similarity creates a review flag only. No candidate is auto-rejected" />
      {DUP_PAIRS.map((d, i) => (
        <div key={i} className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3>
                {dupName(d[0], candidates, set)} ↔ {dupName(d[1], candidates, set)}
              </h3>
              <p>{d[3]}</p>
            </div>
            <Ring v={d[2]} s={64} />
          </div>
          <div className="row">
            {d[2] >= 80 ? <span className="chip no">Review flag</span> : <span className="chip ok">Low similarity</span>}
            <span className="chip">{state.dup[i] || 'Pending review'}</span>
            <button className="btn sm" onClick={() => mark(i, 'Legitimate separate application')}>
              Separate application
            </button>
            <button className="btn sm" onClick={() => mark(i, 'Confirmed duplicate')}>
              Confirm duplicate
            </button>
          </div>
        </div>
      ))}
    </>
  );
}
