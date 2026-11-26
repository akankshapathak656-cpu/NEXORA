// Skill gap analysis. Port of legacy gap() (app.js lines 1023-1026).
import { useAppState, setState } from '../store/state.js';
import { mm, fit, rankAll } from '../lib/scoring.js';
import { Bar } from '../components/ui/Bar.jsx';
import { displayName } from '../lib/text.js';
import { currentJob, pageContext, byId, PageHead, ChartDefs, Ring, CandidateSelect } from './insights/shared.jsx';

export default function Gap({ candidates, job }) {
  const state = useAppState();
  const j = currentJob(job, state);
  const q = j.req;
  const ctx = pageContext(j, candidates, state);
  const c = byId(candidates, state.sel);
  const m = mm(c, q);
  const pct = fit(c, q, j, ctx);
  const options = rankAll(candidates, q, j, ctx);
  const name = displayName(c, state.set);

  return (
    <>
      <ChartDefs />
      <PageHead title="Skill gap analysis" sub="Missing means unverified in the resume, not absent in the person" />
      <div className="card">
        <CandidateSelect
          options={options}
          value={c.id}
          onChange={id => setState({ sel: id, mail: 'draft' })}
        />
      </div>
      <div className="two">
        <div className="card">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Ring v={pct} s={80} />
            <div>
              <h3>Required skills match</h3>
              <p>
                {m.ok.length} of {q.length} requirements named. Listed-only skills count half.
              </p>
            </div>
          </div>
          {q.map(s => {
            const named = c.sk.includes(s), unverified = m.no.includes(s);
            return (
              <Bar
                key={s}
                value={named ? 100 : unverified ? 3 : 50}
                label={s + (named ? ' · named' : unverified ? ' · unverified' : ' · related, not scored')}
              />
            );
          })}
        </div>
        <div className="card">
          <h3>Improvement roadmap</h3>
          {m.no.length || m.tr.length ? (
            <>
              {m.no.map((s, i) => (
                <div key={'no-' + s} className="li">
                  <span>
                    <b>Step {i + 1}: {s}</b>
                    <br />
                    <small style={{ color: 'var(--mu)' }}>
                      {s} is required for {j.t} and is not in {name}’s resume. Verify in an interview first, then suggest documentation and a small project that demonstrates it.
                    </small>
                  </span>
                  <span className="chip no">Priority {i + 1}</span>
                </div>
              ))}
              {m.tr.map(x => (
                <div key={'tr-' + x.t} className="li">
                  <span>
                    <b>Confirm: {x.t}</b>
                    <br />
                    <small style={{ color: 'var(--mu)' }}>
                      Resume lists {x.s}. {x.w}. Ask for a concrete example before counting it as evidence.
                    </small>
                  </span>
                  <span className="chip tr">Confirm</span>
                </div>
              ))}
            </>
          ) : (
            <p>No gaps found against this job description.</p>
          )}
        </div>
      </div>
    </>
  );
}
