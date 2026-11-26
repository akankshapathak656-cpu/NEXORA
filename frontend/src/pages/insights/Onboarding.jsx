// Getting-started guide shown on the dashboard. Port of legacy OBS, obSync, obOpen, obDismiss, obSample and obPanel (app.js lines 379-403).
import { useAppState, setState, getState } from '../../store/state.js';
import { sampleFiles } from '../../lib/resume.js';
import { NS } from '../../data/samples.js';
import { go } from '../../routes.js';
import { useToast } from '../../components/ui/Toast.jsx';

// [key, title, description, href]
export const OBS = [
  ['job', 'Select a job', 'Choose the role you are hiring for, or create a custom one.', '#upload'],
  ['res', 'Add resumes', 'Upload PDF or DOCX files, or load the sample resumes.', '#upload'],
  ['ana', 'Analyze candidates', 'Read the evidence behind each score and tick what to verify.', '#match'],
  ['alt', 'Explore alternative role matches', 'See which candidates may fit a different role better.', '#roles'],
  ['cmp', 'Compare candidates', 'Tick 2 or 3 candidates and review them side by side.', '#cands'],
  ['dec', 'Make a recruiter-controlled decision', 'Shortlist, interview or reject. Nothing happens automatically.', '#profile'],
];

// Number of upload analysis stages (legacy ST). The upload page owns the list.
const STAGE_COUNT = 5;

export function obCount(done) {
  return OBS.filter(s => done[s[0]]).length;
}

// Legacy obSync(): ticks onboarding steps from real app state. Runs on every render in legacy.
// Only writes when a step changed. route is the page being shown.
export function syncOnboarding(route) {
  const s = getState();
  const d = { ...s.ob.done };
  const before = JSON.stringify(d);
  if (Array.isArray(s.jobs) && s.jobs.length) d.job = 1;
  if ((Array.isArray(s.up) && s.up.some(f => f.ok)) || s.add.length) { d.res = 1; d.job = 1; }
  if (route === 'match' || s.stage >= STAGE_COUNT) d.ana = 1;
  if (route === 'roles' || Object.keys(s.alt).length || Object.keys(s.hr).length) d.alt = 1;
  if (s.cm && s.cmp.length >= 2) d.cmp = 1;
  if (Object.keys(s.status).length) d.dec = 1;
  if (JSON.stringify(d) !== before) setState(st => ({ ob: { ...st.ob, done: d } }));
}

// Legacy obPanel(): the guide card. Renders nothing once dismissed.
export function OnboardingPanel({ candidates }) {
  const ob = useAppState(s => s.ob);
  const name = useAppState(s => s.set.name);
  const toast = useToast();
  if (ob.dis) return null;

  const done = ob.done, n = obCount(done), all = n === OBS.length, next = OBS.find(s => !done[s[0]]);
  const first = String(name || '').split(' ')[0] || 'there';
  const pc = Math.round((100 * n) / OBS.length);
  const title = all
    ? 'You are all set'
    : n
      ? `Getting started: ${n} of ${OBS.length} steps complete`
      : `Welcome, ${first}. Let’s build your first shortlist.`;
  const sub = all
    ? 'You have been through the whole recruiter workflow. Dismiss this guide whenever you like. You can reopen it later.'
    : 'NEXORA compares each resume with the skills a job requires, shows the evidence behind every score, and points out other roles a candidate may fit. It advises. Your team makes every decision.';

  // Legacy obDismiss(): hide the guide and say how to bring it back.
  const dismiss = () => {
    setState(s => ({ ob: { ...s.ob, dis: 1 } }));
    toast('Guide hidden. Reopen it from the Getting started button on the dashboard.');
  };

  // Legacy obSample(): switch on the sample resumes and open the upload page. The upload page runs the analysis stages.
  const useSamples = () => {
    setState({ dm: 0, autorun: 0, up: sampleFiles(candidates, NS), upS: 1, pd: null, stage: 0 });
    go('upload');
  };

  return (
    <section className="card ob" aria-labelledby="obt">
      <div className="ob-h">
        <div>
          <p className="eyebrow">{n ? 'Getting started' : 'Welcome to NEXORA'}</p>
          <h2 id="obt">{title}</h2>
          <p>{sub}</p>
        </div>
        <button className="btn sm" onClick={dismiss} aria-label="Dismiss the getting started guide">
          Dismiss
        </button>
      </div>
      <div className="ob-b">
        <div className="ob-w">
          <div>
            <b>Explainable matching</b>
            <span>Every score lists the resume evidence behind each required skill.</span>
          </div>
          <div>
            <b>Multi-role discovery</b>
            <span>Finds candidates who miss one job but fit another.</span>
          </div>
          <div>
            <b>Recruiter control</b>
            <span>No hiring, rejection or email happens without a person.</span>
          </div>
        </div>
        <div>
          <div className="ob-pr">
            <span>
              <b>{n} of {OBS.length}</b> steps complete
            </span>
            <span>{pc}%</span>
          </div>
          <div
            className="ob-pg"
            role="progressbar"
            aria-label="Getting started progress"
            aria-valuemin={0}
            aria-valuemax={OBS.length}
            aria-valuenow={n}
          >
            <i style={{ width: `${pc}%` }} />
          </div>
          <ol className="ob-s">
            {OBS.map((s, k) => {
              const dn = !!done[s[0]];
              return (
                <li key={s[0]}>
                  <a className={`ob-st ${dn ? 'dn' : ''} ${s === next ? 'cur' : ''}`} href={s[3]}>
                    <i aria-hidden="true">{dn ? '✓' : k + 1}</i>
                    <span>
                      <b>
                        {s[1]}
                        {dn ? <span className="sr"> (completed)</span> : null}
                      </b>
                      <small>{s[2]}</small>
                    </span>
                    <em>{dn ? 'Done' : s === next ? 'Next →' : 'Open →'}</em>
                  </a>
                  {s[0] === 'res' && !dn ? (
                    <button className="btn sm" onClick={useSamples}>
                      Use sample resumes
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="fine" style={{ margin: '12px 0 0' }}>
            Progress is saved in this browser. Reopen this guide any time from the Getting started button on the dashboard or the profile menu.
          </p>
        </div>
      </div>
    </section>
  );
}

// Legacy obOpen(): show the guide again. Called from the dashboard hero button.
export function reopenOnboarding() {
  setState(s => ({ ob: { ...s.ob, dis: 0 } }));
  window.scrollTo(0, 0);
}
