import { WF } from '../../data/workflow.js';

// Legacy: stp(p). Renders nothing when `current` is not a workflow step.
// `onPickDecision` replaces the legacy pickDec() onclick on the "Final decision" link,
// which only applies when the current step is "cands".
export function Stepper({ current, jobTitle, steps = WF, onPickDecision }) {
  const k = steps.findIndex((w) => w[0] === current);
  if (k < 0) return null;

  const T = steps.length;
  const pc = Math.round((100 * (k + 1)) / T);
  const nx = steps[k + 1];

  return (
    <>
      <nav className="stp" aria-label={`Recruiter workflow, step ${k + 1} of ${T}`}>
        {steps.map((w, i) => {
          const sd = i < k ? 'dn' : i === k ? 'cur' : 'up';
          const lb = sd === 'dn' ? 'Completed' : sd === 'cur' ? 'Current' : 'Up next';
          const ti =
            sd === 'dn'
              ? 'Completed. Go back to ' + w[1]
              : sd === 'cur'
                ? 'You are here: ' + w[1]
                : 'Go to ' + w[1];
          const pick = w[0] === 'profile' && current === 'cands' && onPickDecision;
          return (
            <a
              key={w[0]}
              href={`/${w[0]}`}
              className={sd}
              aria-current={i === k ? 'step' : undefined}
              title={ti}
              onClick={pick ? () => onPickDecision() : undefined}
            >
              <i aria-hidden="true">{i < k ? '✓' : i + 1}</i>
              <span>
                <small>{lb}</small>
                {w[1]}
              </span>
            </a>
          );
        })}
        <span className="chip jb">Job: {jobTitle}</span>
      </nav>
      <div className="stp-m">
        <span>
          <b>
            Step {k + 1} of {T}
          </b>{' '}
          · {steps[k][1]}
          {nx ? ` · next: ${nx[1]}` : ' · last step'}
        </span>
        <div
          className="stp-pg"
          role="progressbar"
          aria-label="Workflow progress"
          aria-valuemin={1}
          aria-valuemax={T}
          aria-valuenow={k + 1}
        >
          <i style={{ width: `${pc}%` }} />
        </div>
      </div>
    </>
  );
}
