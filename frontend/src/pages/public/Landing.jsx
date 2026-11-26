import { useEffect, useState } from 'react';
import { PublicNav } from '../../components/ui/PublicNav.jsx';
import { PublicFooter } from '../../components/ui/Footer.jsx';
import HeroCore from '../../components/HeroCore.jsx';
import { useAppState, setState } from '../../store/state.js';
import { useCandidates, candidateStatus } from '../../store/candidates.js';
import { JOBS } from '../../data/jobs.js';
import { NS } from '../../data/samples.js';
import { WT, HF } from '../../data/weights.js';
import { score, ev, brk, hidden } from '../../lib/scoring.js';
import { displayName } from '../../lib/text.js';

// Legacy: landing() (app.js lines 117-131) with hpBody() and hpPick().
// The live example uses the scores stored on each record: no skill dictionary is passed, as in legacy.
export default function Landing() {
  const auth = useAppState((s) => s.auth);
  const jobIndex = useAppState((s) => s.job);
  const customJobs = useAppState((s) => s.jobs);
  const statusMap = useAppState((s) => s.status);
  const set = useAppState((s) => s.set);
  const candidates = useCandidates();
  const [pick, setPick] = useState(0);

  const signedIn = !!auth;
  const go = signedIn ? 'dashboard' : 'login';
  const allJobs = [...JOBS, ...(Array.isArray(customJobs) ? customJobs : [])];
  const job = allJobs[jobIndex] || allJobs[0];
  const status = (c) => candidateStatus(c, statusMap);

  const hf = hidden(candidates, job, status, allJobs).slice(0, 3);

  const sample = candidates.slice(0, 5);
  const c = candidates.find((x) => x.id === pick) || candidates[0];
  const s = c ? score(c, job.req, job) : null;

  useEffect(() => {
    document.title = 'NEXORA | Shortlists you can explain';
  }, []);

  const onRunDemo = () => setState({ dm: 1, autorun: 1 });

  return (
    <>
      <PublicNav signedIn={signedIn} />
      <main id="m" tabIndex={-1}>
        <div className="wrap">
          <section className="hero" aria-labelledby="h1">
            <div>
              <p className="eyebrow">Resume screening for recruiters</p>
              <h1 id="h1">Shortlists you can explain.</h1>
              <p className="lead">
                NEXORA compares each resume with the skills a job requires, shows which line of the resume backs each match, and points out other roles a candidate may fit. Your team makes every decision.
              </p>
              <div className="row" style={{ marginTop: 28 }}>
                <a className="btn p" href={`/${go}`}>Open the demo workspace</a>
                <a className="btn" href="/upload" onClick={onRunDemo}>Run the guided demo</a>
              </div>
              <p className="fine" style={{ marginTop: 16 }}>
                Sample data only. No backend is connected, and scores come from a simple formula described below.
              </p>
            </div>
            <div className="hcol">
              <div className="core" aria-hidden="true">
                <HeroCore />
              </div>
              <div className="hp" id="p" aria-label="Live example of a candidate analysis">
                <div className="hpt">
                  <label>
                    Candidate
                    <select value={String(pick)} onChange={(e) => setPick(Number(e.target.value))}>
                      {sample.map((x) => (
                        <option key={x.id} value={x.id}>{displayName(x, set)}</option>
                      ))}
                    </select>
                  </label>
                  <span className="chip tr">Sample candidate, calculated live</span>
                </div>
                <div aria-live="polite">
                  {c && s && (
                    <>
                      <div className="hph">
                        <div>
                          <p className="eyebrow" style={{ marginBottom: 6 }}>Match for {job.t}</p>
                          <h3>{displayName(c, set)}</h3>
                          <p>{c.r} · {c.ex} experience</p>
                        </div>
                        <div className="big">
                          <b aria-label={`Score ${s.tot} out of 100`}>{s.tot}</b>
                          <small>of 100</small>
                        </div>
                      </div>
                      <ul className="ers">
                        {job.req.map((q) => {
                          const e = ev(c, q);
                          const text = e[0] === 3 ? 'Named in the project text' : e[0] === 2 ? 'In the skills list, not named in a project' : e[2];
                          return (
                            <li key={q} className={`er l${e[0]}`}>
                              <b>{q}</b>
                              <span className="es">{e[1]}</span>
                              <span className="et">{text}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="hpf">
                        <span title={brk(s)}>Required skills <b>{s.cov}%</b> · {s.comps.length} weighted parts</span>
                        <a className="link" href="/match" onClick={() => setState({ sel: c.id })}>Open full analysis</a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="sec" id="s">
            <div className="split">
              <div>
                <h2>Every score shows its working.</h2>
                <p>A number alone cannot be checked. NEXORA lists each required skill with the evidence found, and says plainly when the resume is silent.</p>
              </div>
              <ul className="facts">
                <li><b>Seven weighted parts</b><span>Required skills {WT.req[1]}, relevant experience {WT.exp[1]}, preferred skills {WT.pref[1]}, education {WT.edu[1]}, projects {WT.proj[1]}, responsibilities {WT.resp[1]}, use in work experience {WT.ctx[1]}. Parts the job does not state are left out and the rest rescaled to 100.</span></li>
                <li><b>Evidence decides the credit</b><span>A skill stated or demonstrated counts in full and a skill only listed counts half. Related or inferred skills add nothing and are flagged for you to confirm.</span></li>
                <li><b>Ties are broken the same way</b><span>Equal scores are ordered by required skills match, then relevant experience.</span></li>
                <li><b>Not found is not lacking</b><span>It means the resume does not mention the skill. Each analysis includes a list of what to verify before deciding.</span></li>
              </ul>
            </div>
          </section>

          <section className="sec" id="o">
            <div className="split">
              <div>
                <h2>A weak match for one job can be a strong match for another.</h2>
                <p>NEXORA flags a candidate when they score under {HF.max} for the selected job, at least {HF.gap} points higher for another role, and the resume evidences at least half of that role's requirements. Consent and HR approval come before any outreach.</p>
              </div>
              <div>
                {hf.length ? (
                  <>
                    <ul className="fits">
                      {hf.map((h) => (
                        <li key={h.c.id}>
                          <span><b>{displayName(h.c, set)}</b><small>{h.c.r}</small></span>
                          <span className="cmp"><b>{h.ap}</b> for {job.t}, <b>{h.b.s}</b> for {h.b.r}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="fine">Calculated from the sample candidates for the selected job.</p>
                  </>
                ) : (
                  <p>No hidden fits for {job.t} in the sample data. Pick another job in the workspace to see some.</p>
                )}
                <p><a className="link" href="/roles">See multi-role discovery</a></p>
              </div>
            </div>
          </section>

          <section className="sec" id="w">
            <div className="split">
              <div>
                <h2>Five steps, one decision at the end.</h2>
                <p>The workspace follows the order recruiters work in. Each step links to the real screen.</p>
              </div>
              <ol className="steps">
                {[
                  ['upload', 'Job and resumes', 'Choose the job and add PDF or DOCX resumes. Each file is checked, then its text is read in your browser to fill in the candidate’s details.'],
                  ['match', 'Candidate analysis', 'Read the evidence for each required skill and tick what to verify.'],
                  ['roles', 'Other role matches', 'See who may fit a different job better.'],
                  ['cands', 'Compare candidates', 'Filter the pool and compare up to three candidates side by side.'],
                  ['profile', 'Final decision', 'Set a status. Nothing is sent or rejected automatically.'],
                ].map(([href, title, body]) => (
                  <li key={href}>
                    <a href={`/${href}`}>{title}</a>
                    <p>{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="sec">
            <div className="split">
              <div>
                <h2>People stay in control.</h2>
              </div>
              <ul className="facts">
                <li><b>No automatic outcomes</b><span>No hiring, rejection or emailing happens without a person. Outreach needs HR approval first.</span></li>
                <li><b>Blind review</b><span>A setting hides candidate names across the workspace.</span></li>
                <li><b>Duplicate flags</b><span>Similar resumes are flagged for review, never rejected.</span></li>
                <li><b>Fairness</b><span>Names and personal traits are excluded from scoring. No fairness guarantee is claimed.</span></li>
              </ul>
            </div>
          </section>

          <section className="sec" id="v">
            <div className="split">
              <div>
                <h2>What this version is.</h2>
              </div>
              <div>
                <p style={{ maxWidth: '62ch' }}>
                  This is a front-end prototype written in HTML, CSS and JavaScript. It runs in your browser and keeps your changes in that browser. Scores use the formula above on {NS} sample candidates. Resume files are read in your browser: PDF and DOCX text is extracted and matched to a skill dictionary. Sending email is simulated. Skill trend figures are illustrative, not market data.
                </p>
                <p style={{ maxWidth: '62ch' }}>
                  Planned and not built: a server, OCR for scanned resumes, and real sign-in. Any business impact figure would be a target until it is measured in a pilot.
                </p>
                <p><a className="link" href="/privacy">What the prototype stores</a></p>
              </div>
            </div>
          </section>

          <section className="close">
            <h2>Try it with the {NS} sample resumes.</h2>
            <div className="row">
              <a className="btn p" href={`/${go}`}>Open the demo workspace</a>
            </div>
          </section>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
