import { useEffect, useRef, useState } from 'react';
import { PublicNav } from '../../components/ui/PublicNav.jsx';
import { PublicFooter } from '../../components/ui/Footer.jsx';
import HeroCore from '../../components/HeroCore.jsx';
import ScrollMorphShowcase from '../../components/ScrollMorphShowcase.jsx';
import { useAppState, setState } from '../../store/state.js';
import { useCandidates, candidateStatus } from '../../store/candidates.js';
import { JOBS } from '../../data/jobs.js';
import { NS } from '../../data/samples.js';
import { WT, HF } from '../../data/weights.js';
import { score, ev, brk, hidden } from '../../lib/scoring.js';
import { displayName } from '../../lib/text.js';

const HERO_WORDS = ['Shortlists', 'you', 'can', 'explain.'];

const FLOATING_CARDS = [
  {
    cls: 'f1',
    label: 'Candidate Match Score',
    value: '92%',
    large: true,
    bar: true,
    vars: { t: '7.5s', o: '-1s', e: '0.70s', fx: '5px', fy: '-10px', fz: '14px', rx: '3deg', ry: '-4deg', z: 10, s: 1, ix: '-28px', iy: '14px' },
  },
  {
    cls: 'f2',
    label: 'AI Skills Analysis',
    value: 'React, TypeScript, CSS',
    vars: { t: '9s', o: '-4s', e: '0.84s', fx: '-6px', fy: '9px', fz: '8px', rx: '-3deg', ry: '4deg', z: 16, s: 1.02, ix: '28px', iy: '-10px' },
  },
  {
    cls: 'f3',
    label: 'Alternative Role',
    value: 'UI Developer',
    vars: { t: '8s', o: '-2.5s', e: '0.98s', fx: '8px', fy: '7px', fz: '-6px', rx: '2deg', ry: '5deg', z: 7, s: 0.97, ix: '-30px', iy: '0px' },
  },
  {
    cls: 'f4',
    label: 'Resume Intelligence',
    value: 'Skills Detected',
    vars: { t: '10s', o: '-6s', e: '1.12s', fx: '-8px', fy: '-8px', fz: '12px', rx: '-2deg', ry: '-5deg', z: 13, s: 1, ix: '30px', iy: '12px' },
  },
  {
    cls: 'f5',
    label: 'Hiring Insights',
    value: 'Candidate Compatibility',
    vars: { t: '8.6s', o: '-5s', e: '1.26s', fx: '6px', fy: '-7px', fz: '10px', rx: '3deg', ry: '3deg', z: 9, s: 0.98, ix: '-26px', iy: '-12px' },
  },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function animateCount(el, target, duration, reducedMotion, rafSet) {
  if (!el) return;
  if (reducedMotion || target === 0) {
    el.textContent = String(target);
    return;
  }
  const t0 = performance.now();
  el.textContent = '0';
  let id = 0;
  const step = (now) => {
    rafSet.delete(id);
    const p = Math.min(1, (now - t0) / duration);
    el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) {
      id = requestAnimationFrame(step);
      rafSet.add(id);
    }
  };
  id = requestAnimationFrame(step);
  rafSet.add(id);
}

// Legacy: landing() (app.js lines 117-131) + Stage 1B motion (lines 1458-1521).
export default function Landing() {
  const auth = useAppState((s) => s.auth);
  const jobIndex = useAppState((s) => s.job);
  const customJobs = useAppState((s) => s.jobs);
  const statusMap = useAppState((s) => s.status);
  const set = useAppState((s) => s.set);
  const candidates = useCandidates();
  const [pick, setPick] = useState(0);

  const bgRef = useRef(null);
  const canvasRef = useRef(null);
  const heroRef = useRef(null);
  const mainRef = useRef(null);
  const heroScoreRef = useRef(null);

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
    document.body.classList.add('lp');
    return () => {
      document.body.classList.remove('lp');
    };
  }, []);

  // Ambient background particles, pointer parallax, and scroll parallax
  useEffect(() => {
    const bg = bgRef.current;
    const cv = canvasRef.current;
    const hero = heroRef.current;
    if (!bg || !cv || !hero) return undefined;

    const ctx = cv.getContext('2d');
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = mq.matches;

    let particles = [];
    let W = 0;
    let H = 0;
    let pRaf = 0;
    let pRunning = false;
    let col = '#0f5c49';

    function readAccent() {
      const next = getComputedStyle(document.documentElement).getPropertyValue('--a').trim();
      if (next) col = next;
    }

    function psize() {
      if (!ctx) return;
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = W * d;
      cv.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const n = W < 700 ? 16 : 32;
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.8 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.04 - Math.random() * 0.16,
        a: 0.1 + Math.random() * 0.25,
        p: Math.random() * 6.28,
      }));
    }

    function pframe(t) {
      if (!pRunning || !ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = col;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -8) {
          p.y = H + 8;
          p.x = Math.random() * W;
        }
        if (p.x < -8) p.x = W + 8;
        if (p.x > W + 8) p.x = -8;
        ctx.globalAlpha = p.a * (0.65 + 0.35 * Math.sin(t / 1800 + p.p));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.283);
        ctx.fill();
      }
      pRaf = requestAnimationFrame(pframe);
    }

    function pstop() {
      pRunning = false;
      if (pRaf) {
        cancelAnimationFrame(pRaf);
        pRaf = 0;
      }
    }

    function pstart() {
      pstop();
      if (reduced || document.hidden || !ctx) return;
      readAccent();
      if (!particles.length) psize();
      pRunning = true;
      pRaf = requestAnimationFrame(pframe);
    }

    // Pointer parallax (smoothed lerp loop that sleeps when still)
    let tx = 0;
    let ty = 0;
    let cxp = 0;
    let cyp = 0;
    let plRaf = 0;

    function plTick() {
      cxp += (tx - cxp) * 0.08;
      cyp += (ty - cyp) * 0.08;
      hero.style.setProperty('--px', cxp.toFixed(3));
      hero.style.setProperty('--py', cyp.toFixed(3));
      bg.style.setProperty('--ax', `${50 + cxp * 40}%`);
      bg.style.setProperty('--ay', `${35 + cyp * 30}%`);
      plRaf = Math.abs(tx - cxp) + Math.abs(ty - cyp) > 0.002 ? requestAnimationFrame(plTick) : 0;
    }

    const onPointerMove = (e) => {
      if (reduced || e.pointerType === 'touch') return;
      tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      ty = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
      if (!plRaf) plRaf = requestAnimationFrame(plTick);
    };

    // Scroll parallax for blobs and hero
    const blobs = Array.from(bg.querySelectorAll('.bl'));
    let spRaf = 0;
    function onScrollFrame() {
      spRaf = 0;
      if (reduced) return;
      const y = window.scrollY;
      blobs.forEach((b, i) => {
        b.style.translate = `0 ${(-y * (0.03 + i * 0.02)).toFixed(1)}px`;
      });
      if (y < 1000) hero.style.setProperty('--sy', String(y));
    }
    const onScroll = () => {
      if (!spRaf) spRaf = requestAnimationFrame(onScrollFrame);
    };

    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        particles = [];
        psize();
      }, 150);
    };

    const onVis = () => pstart();
    const onMotionChange = (e) => {
      reduced = e.matches;
      if (reduced) {
        pstop();
        blobs.forEach((b) => {
          b.style.translate = '';
        });
        hero.style.removeProperty('--px');
        hero.style.removeProperty('--py');
        hero.style.removeProperty('--sy');
      } else {
        pstart();
        onScrollFrame();
      }
    };

    const themeObs = new MutationObserver(readAccent);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    if (mq.addEventListener) mq.addEventListener('change', onMotionChange);
    else mq.addListener(onMotionChange);

    pstart();
    onScrollFrame();

    return () => {
      pstop();
      if (plRaf) cancelAnimationFrame(plRaf);
      if (spRaf) cancelAnimationFrame(spRaf);
      clearTimeout(resizeTimer);
      themeObs.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      else mq.removeListener(onMotionChange);
    };
  }, []);

  // Scroll-reveals (.rv -> .in, .sec -> .rl + .in) and .stats [data-n] count-ups
  useEffect(() => {
    const root = mainRef.current;
    if (!root) return undefined;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches || typeof IntersectionObserver === 'undefined') return undefined;

    const rafSet = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          io.unobserve(el);
          el.classList.add('in');
          if (el.dataset.n != null) {
            animateCount(el, Number(el.dataset.n), 1100, mq.matches, rafSet);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    root.querySelectorAll('.sec, .close').forEach((secEl) => {
      if (secEl.classList.contains('sec')) secEl.classList.add('rl');
      io.observe(secEl);
    });

    const revealSelector = '.stats li, .sec .split > *, .facts li, .steps li, .close h2, .close .row';
    root.querySelectorAll(revealSelector).forEach((el) => {
      const sib = el.parentNode ? Array.from(el.parentNode.children).indexOf(el) : 0;
      el.style.setProperty('--i', String(Math.min(Math.max(sib, 0), 6)));
      el.classList.add('rv');
      io.observe(el);
    });

    root.querySelectorAll('[data-n]').forEach((el) => {
      el.textContent = '0';
      io.observe(el);
    });

    return () => {
      io.disconnect();
      rafSet.forEach((id) => cancelAnimationFrame(id));
      rafSet.clear();
    };
  }, []);

  // Animated hero score count-up (0 -> s.tot, cubic ease-out 800ms) on candidate change
  const scoreTotal = s?.tot;
  useEffect(() => {
    const el = heroScoreRef.current;
    if (!el || typeof scoreTotal !== 'number' || Number.isNaN(scoreTotal)) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rafSet = new Set();
    animateCount(el, scoreTotal, 800, reduced, rafSet);
    return () => {
      rafSet.forEach((id) => cancelAnimationFrame(id));
      rafSet.clear();
    };
  }, [scoreTotal, pick]);

  const onRunDemo = () => setState({ dm: 1, autorun: 1 });

  return (
    <>
      <div className="bgfx" aria-hidden="true" ref={bgRef}>
        <div className="bl b1" />
        <div className="bl b2" />
        <div className="bl b3" />
        <div className="amb" />
        <canvas ref={canvasRef} />
      </div>
      <PublicNav signedIn={signedIn} />
      <main id="m" tabIndex={-1} ref={mainRef} style={{ position: 'relative', zIndex: 1 }}>
        <div className="wrap">
          <section className="hero" aria-labelledby="h1" ref={heroRef}>
            <div>
              <p className="eyebrow">Resume screening for recruiters</p>
              <h1 id="h1">
                {HERO_WORDS.map((word, i) => (
                  <span key={word} className="w">
                    <span style={{ '--i': i }}>{word}</span>
                  </span>
                )).reduce((acc, el, i) => (i === 0 ? [el] : [...acc, ' ', el]), [])}
              </h1>
              <p className="lead">
                NEXORA compares each resume with the skills a job requires, shows which line of the resume backs each match, and points out other roles a candidate may fit. Your team makes every decision.
              </p>
              <div className="row" style={{ marginTop: 28 }}>
                <a className="btn p" href={`/${go}`}>Open the demo workspace</a>
                <a className="btn" href="/upload" onClick={onRunDemo}>Run the guided demo</a>
              </div>
              <p className="fine" style={{ marginTop: 16 }}>
                Explainable AI resume analysis backed by deterministic 7-part weighted scoring. Preloaded with {NS} sample candidates; upload PDF or DOCX resumes in the workspace.
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
                          <b ref={heroScoreRef} aria-label={`Score ${s.tot} out of 100`}>{s.tot}</b>
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
              <div className="fc" aria-hidden="true">
                {FLOATING_CARDS.map((card) => (
                  <div
                    key={card.cls}
                    className={`fcw ${card.cls}`}
                    style={{
                      '--t': card.vars.t,
                      '--o': card.vars.o,
                      '--e': card.vars.e,
                      '--fx': card.vars.fx,
                      '--fy': card.vars.fy,
                      '--fz': card.vars.fz,
                      '--rx': card.vars.rx,
                      '--ry': card.vars.ry,
                      '--z': card.vars.z,
                      '--s': card.vars.s,
                      '--ix': card.vars.ix,
                      '--iy': card.vars.iy,
                    }}
                  >
                    <div className="fcb">
                      <div className="fcf">
                        <span className="fcl">
                          <i />
                          {card.label}
                        </span>
                        <b className={card.large ? 'fv fl' : 'fv'}>{card.value}</b>
                        {card.bar && (
                          <span className="fb">
                            <i />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <ul className="stats" aria-label="Workspace at a glance">
            {[
              [NS, 'sample resumes in the pool'],
              [JOBS.length, 'jobs to screen against'],
              [5, 'workflow steps, one decision at the end'],
              [0, 'hiring outcomes decided automatically'],
            ].map(([val, label]) => (
              <li key={label}>
                <b data-n={val}>{val}</b>
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <ScrollMorphShowcase />

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
                <p>NEXORA flags a candidate when they score under {HF.max} for the selected job, at least {HF.gap} points higher for another role, and the resume evidences at least half of that role&apos;s requirements. Consent and HR approval come before any outreach.</p>
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
                  ['upload', 'Job and resumes', 'Choose the job and add PDF or DOCX resumes. Each file is checked, then its text is extracted and scored with evidence.'],
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
                  NEXORA combines AI-assisted evidence extraction with deterministic 7-part weighted scoring and a transparent heuristic fallback. It ships with {NS} sample candidates, supports PDF and DOCX resume uploads with selectable text, and keeps recruiters in charge of every shortlist decision.
                </p>
                <p style={{ maxWidth: '62ch' }}>
                  Sending email is simulated and skill trend figures are illustrative. OCR for scanned image-only resumes is not enabled in this build.
                </p>
                <p><a className="link" href="/privacy">What the workspace stores</a></p>
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
