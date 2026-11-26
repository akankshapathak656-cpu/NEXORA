import { useEffect, useRef } from 'react';

/* Illustrative sample candidates: [initials, display name, role, match %, skills, evidence]. Fictional, not real people. */
const CANDIDATES = [
  ['IK', 'Isha K.', 'Frontend Developer', 94, ['React', 'TypeScript', 'Testing'], 'Dashboard project names React and TypeScript. Unit tests listed.'],
  ['RM', 'Rohan M.', 'Full Stack Developer', 88, ['Node.js', 'React', 'REST APIs'], 'Job board project uses a Node API with a React front end.'],
  ['SP', 'Sana P.', 'UI Developer', 91, ['CSS', 'Accessibility', 'React'], 'Component kit project cites keyboard and screen reader testing.'],
  ['AT', 'Arjun T.', 'SDE', 86, ['JavaScript', 'Git', 'REST APIs'], 'Placement portal project calls REST endpoints. Git listed.'],
  ['NB', 'Nidhi B.', 'Frontend Developer', 79, ['React', 'CSS', 'Git'], 'React named in two projects. TypeScript not mentioned.'],
  ['VS', 'Vivaan S.', 'Web Designer', 72, ['Figma', 'CSS', 'HTML'], 'UI kit project built in Figma. CSS listed, not shown in use.'],
  ['TD', 'Tara D.', 'SDE', 90, ['TypeScript', 'Testing', 'Git'], 'Analytics project mentions Jest tests and typed components.'],
  ['KJ', 'Kabir J.', 'Backend Developer', 68, ['Python', 'Flask', 'REST APIs'], 'Inventory API built with Flask. Front-end skills not shown.'],
  ['MN', 'Meera N.', 'Frontend Developer', 83, ['JavaScript', 'CSS', 'Accessibility'], 'Portfolio sites cite semantic HTML and contrast checks.'],
  ['DR', 'Dev R.', 'UI Developer', 77, ['HTML', 'CSS', 'JavaScript'], 'Landing page projects listed. No testing evidence found.'],
  ['LA', 'Lina A.', 'SDE', 92, ['React', 'REST APIs', 'Testing'], 'Scheduling app project pairs React with API tests.'],
  ['YG', 'Yash G.', 'Full Stack Developer', 81, ['JavaScript', 'Node.js', 'Git'], 'MERN project named. Related skills count at half weight.'],
  ['PH', 'Pooja H.', 'Frontend Developer', 85, ['React', 'TypeScript', 'CSS'], 'Design-system library project lists React and TypeScript.'],
  ['OV', 'Omar V.', 'Web Designer', 74, ['Figma', 'HTML', 'Accessibility'], 'Accessible prototype project. JavaScript only listed.'],
  ['EC', 'Esha C.', 'SDE', 87, ['JavaScript', 'TypeScript', 'Git'], 'Two projects name TypeScript. Git used in team work.'],
  ['BS', 'Bhavya S.', 'UI Developer', 80, ['React', 'CSS', 'Git'], 'Storefront project lists React. Evidence for Git is thin.'],
];

const N = CANDIDATES.length;
const EPS = [0.05, 0.05, 0.05, 0.0008, 0.0008];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a * (1 - t) + b * t;

export function ScrollMorphShowcase() {
  const secRef = useRef(null);
  const stageRef = useRef(null);
  const introRef = useRef(null);
  const ihRef = useRef(null);
  const ebRef = useRef(null);
  const copyRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const sec = secRef.current;
    const stage = stageRef.current;
    const intro = introRef.current;
    const ih = ihRef.current;
    const eb = ebRef.current;
    const copy = copyRef.current;
    const list = listRef.current;
    if (!sec || !stage || !intro || !ih || !eb || !copy || !list) return undefined;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const lis = Array.from(list.children);
    const btns = lis.map((li) => li.firstElementChild).filter(Boolean);

    let W = 0;
    let H = 0;
    let CW = 104;
    let navH = 66;
    let raf = 0;
    let last = 0;
    let phase = 'scatter';
    let timers = [];
    let vis = false;
    let stageVis = false;
    let started = false;
    let dead = false;
    let rm = mq.matches;
    let parT = 0;

    const scat = CANDIDATES.map(() => ({
      x: (Math.random() - 0.5) * 1.4,
      y: (Math.random() - 0.5) * 1.2,
      r: (Math.random() - 0.5) * 180,
    }));
    const mk = () => ({ x: 0, v: 0 });
    const S = CANDIDATES.map(() => [mk(), mk(), mk(), mk(), mk()]);
    const M = mk();
    const R = mk();
    const P = mk();
    const tab = new Array(N).fill(false);

    function target(i) {
      const mob = W < 768;
      const cs = mob ? 0.8 : 0.82;
      if (phase === 'scatter') {
        const s = scat[i];
        return [s.x * W, s.y * H, s.r, 0.6, 0];
      }
      if (phase === 'line') {
        const sp = Math.min(CW * cs + 10, (W * 0.9) / N);
        return [i * sp - (N * sp) / 2 + sp / 2, 0, 0, cs, 1];
      }
      const m = M.x;
      const cr = Math.min(Math.min(W, H) * 0.35, 350);
      const ca = (i / N) * 360;
      const cd = (ca * Math.PI) / 180;
      const ar = Math.min(W, H * 1.5) * (mob ? 1.4 : 1.1);
      const acy = H * (mob ? 0.1 : 0.14) + ar;
      const spread = mob ? 190 : 130;
      const ang = -90 - spread / 2 + i * (spread / (N - 1)) - clamp(R.x, 0, 1) * spread * 0.8;
      const ad = (ang * Math.PI) / 180;
      return [
        lerp(Math.cos(cd) * cr, Math.cos(ad) * ar + P.x, m),
        lerp(Math.sin(cd) * cr, Math.sin(ad) * ar + acy, m),
        lerp(ca + 90, ang + 90, m),
        lerp(cs, mob ? 1.2 : 1.5, m),
        1,
      ];
    }

    function paint(i) {
      const s = S[i];
      const o = clamp(s[4].x, 0, 1);
      lis[i].style.transform = `translate3d(${s[0].x.toFixed(2)}px,${s[1].x.toFixed(2)}px,0) rotate(${s[2].x.toFixed(2)}deg) scale(${Math.max(0, s[3].x).toFixed(3)})`;
      lis[i].style.opacity = o.toFixed(3);
      const ok = o > 0.6 && Math.abs(s[0].x) < W / 2 - 30 && Math.abs(s[1].x) < H / 2 - 20;
      if (ok !== tab[i]) {
        tab[i] = ok;
        if (btns[i]) btns[i].tabIndex = ok ? 0 : -1;
      }
    }

    function snap() {
      for (let i = 0; i < N; i += 1) {
        const t = target(i);
        for (let j = 0; j < 5; j += 1) {
          S[i][j].x = t[j];
          S[i][j].v = 0;
        }
        paint(i);
      }
    }

    function size() {
      const nav = document.querySelector('.nav');
      navH = nav ? nav.offsetHeight : 66;
      sec.style.setProperty('--smh-top', `${navH}px`);
      W = stage.clientWidth;
      H = stage.clientHeight;
      CW = lis[0]?.offsetWidth || 104;
    }

    function stop() {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function wake() {
      if (raf || dead || !vis || rm || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function setPhase(p) {
      if (phase === p) return;
      phase = p;
      if (p === 'circle') {
        timers.forEach(clearTimeout);
        timers = [];
      }
      wake();
    }

    function maybeIntro() {
      if (started || rm || !stageVis || dead) return;
      started = true;
      timers.push(
        setTimeout(() => setPhase('line'), 450),
        setTimeout(() => setPhase('circle'), 2400)
      );
    }

    function frame(now) {
      raf = 0;
      if (dead || !vis || rm) return;
      const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
      last = now;

      const r = sec.getBoundingClientRect();
      const len = r.height - stage.offsetHeight;
      const prog = len > 0 ? clamp((navH - r.top) / len, 0, 1) : 0;
      if (prog > 0.015 && phase !== 'circle') setPhase('circle');

      let mv = false;
      const sp = (s, t, k, c, e) => {
        s.v += ((t - s.x) * k - s.v * c) * dt;
        s.x += s.v * dt;
        if (Math.abs(s.v) > e * 3 || Math.abs(t - s.x) > e) mv = true;
      };

      sp(M, phase === 'circle' ? clamp(prog / 0.2, 0, 1) : 0, 40, 20, 0.0005);
      sp(R, clamp((prog - 0.2) / 0.8, 0, 1), 40, 20, 0.0005);
      sp(P, parT, 30, 20, 0.05);

      for (let i = 0; i < N; i += 1) {
        const t = target(i);
        for (let j = 0; j < 5; j += 1) {
          sp(S[i][j], t[j], 40, 15, EPS[j]);
        }
        paint(i);
      }

      const m = M.x;
      const c = clamp((m - 0.8) / 0.2, 0, 1);
      copy.style.opacity = c.toFixed(3);
      copy.style.transform = `translateY(${((1 - c) * 20).toFixed(1)}px)`;
      intro.classList.toggle('on', phase === 'circle');

      if (m > 0.001) {
        intro.classList.add('sc');
        ih.style.opacity = clamp(1 - m * 2, 0, 1).toFixed(3);
        eb.style.opacity = clamp(0.7 - m * 1.4, 0, 0.7).toFixed(3);
      } else {
        intro.classList.remove('sc');
        ih.style.opacity = '';
        eb.style.opacity = '';
      }

      if (mv) raf = requestAnimationFrame(frame);
    }

    const unflip = () => {
      btns.forEach((x) => {
        x.classList.remove('fl');
        x.setAttribute('aria-pressed', 'false');
      });
    };

    const onClick = (e) => {
      const b = e.target.closest('.smc');
      if (!b) return;
      if (e.detail > 0 && hoverFine.matches) return;
      const on = !b.classList.contains('fl');
      unflip();
      if (on) {
        b.classList.add('fl');
        b.setAttribute('aria-pressed', 'true');
      }
    };

    const onKey = (e) => {
      const b = e.target.closest('.smc');
      if (!b) return;
      if (e.key === 'Escape') {
        b.classList.remove('fl');
        b.setAttribute('aria-pressed', 'false');
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const vs = btns.filter((x) => x.tabIndex === 0);
        const next = vs[vs.indexOf(b) + (e.key === 'ArrowRight' ? 1 : -1)];
        if (next) {
          e.preventDefault();
          next.focus({ preventScroll: true });
        }
      }
    };

    const onFocusIn = () => {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    };

    const onPtr = (e) => {
      if (e.pointerType === 'touch' || rm) return;
      const b = stage.getBoundingClientRect();
      parT = (((e.clientX - b.left) / b.width) * 2 - 1) * (W < 768 ? 30 : 70);
      wake();
    };

    const onLeave = () => {
      parT = 0;
      wake();
    };

    const onScroll = () => wake();
    const onResize = () => {
      if (rm) return;
      size();
      wake();
    };
    const onVis = () => {
      if (document.hidden) stop();
      else wake();
    };

    function applyRM() {
      rm = mq.matches;
      sec.classList.toggle('rm', rm);
      if (rm) {
        stop();
        timers.forEach(clearTimeout);
        timers = [];
        btns.forEach((b) => {
          b.tabIndex = 0;
        });
        tab.fill(true);
        lis.forEach((li) => {
          li.style.transform = '';
          li.style.opacity = '';
        });
        copy.style.opacity = '';
        copy.style.transform = '';
        ih.style.opacity = '';
        eb.style.opacity = '';
      } else {
        btns.forEach((b) => {
          b.tabIndex = -1;
        });
        tab.fill(false);
        phase = 'scatter';
        started = false;
        M.x = 0;
        R.x = 0;
        P.x = 0;
        M.v = 0;
        R.v = 0;
        P.v = 0;
        size();
        snap();
        maybeIntro();
        wake();
      }
    }

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    const io1 =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (es) => {
              vis = es[0].isIntersecting;
              if (vis) wake();
              else stop();
            },
            { rootMargin: '120px 0px' }
          )
        : null;
    const io2 =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (es) => {
              stageVis = es[0].isIntersecting && es[0].intersectionRatio >= 0.3;
              maybeIntro();
            },
            { threshold: [0, 0.3, 0.6] }
          )
        : null;

    list.addEventListener('click', onClick);
    list.addEventListener('keydown', onKey);
    stage.addEventListener('focusin', onFocusIn);
    stage.addEventListener('pointermove', onPtr, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    if (mq.addEventListener) mq.addEventListener('change', applyRM);
    else mq.addListener(applyRM);

    sec.classList.toggle('rm', rm);
    if (rm) {
      btns.forEach((b) => {
        b.tabIndex = 0;
      });
    } else {
      size();
      snap();
    }

    if (ro) ro.observe(stage);
    if (io1) io1.observe(sec);
    else {
      vis = true;
      stageVis = true;
      maybeIntro();
      wake();
    }
    if (io2) io2.observe(stage);

    return () => {
      dead = true;
      stop();
      timers.forEach(clearTimeout);
      timers = [];
      ro?.disconnect();
      io1?.disconnect();
      io2?.disconnect();
      list.removeEventListener('click', onClick);
      list.removeEventListener('keydown', onKey);
      stage.removeEventListener('focusin', onFocusIn);
      stage.removeEventListener('pointermove', onPtr);
      stage.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
      if (mq.removeEventListener) mq.removeEventListener('change', applyRM);
      else mq.removeListener(applyRM);
    };
  }, []);

  return (
    <section className="smh" id="smh" aria-labelledby="smh-t" ref={secRef}>
      <div className="smh-stage" ref={stageRef}>
        <div className="smh-intro" aria-hidden="true" ref={introRef}>
          <h2 ref={ihRef}>Every candidate, with the evidence.</h2>
          <p className="eyebrow" ref={ebRef}>Scroll to explore</p>
        </div>
        <div className="smh-copy" ref={copyRef}>
          <h2 id="smh-t">Evidence behind every match.</h2>
          <p>Hover, tap, or press Enter on a card to see the resume line behind its score.</p>
        </div>
        <ul className="smh-list" aria-label="Sample candidate cards" ref={listRef}>
          {CANDIDATES.map((d) => (
            <li key={d[0]}>
              <button
                type="button"
                className="smc"
                tabIndex={-1}
                aria-pressed="false"
                aria-label={`${d[1]}, ${d[2]}, ${d[3]} percent match. Press to show the evidence.`}
              >
                <span className="smc-in" aria-hidden="true">
                  <span className="smc-f">
                    <span className="smc-top">
                      <span className="smc-av">{d[0]}</span>
                      <span className="smc-pc">
                        {d[3]}
                        <small>%</small>
                      </span>
                    </span>
                    <span className="smc-bar">
                      <i style={{ width: `${d[3]}%` }} />
                    </span>
                    <span className="smc-role">{d[2]}</span>
                    <span className="smc-sk">
                      {d[4].slice(0, 2).map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </span>
                  </span>
                  <span className="smc-b">
                    <span className="smc-name">{d[1]}</span>
                    <span className="smc-lb">Evidence</span>
                    <span className="smc-ev">{d[5]}</span>
                    <span className="smc-sk">
                      {d[4].map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="smh-note">Illustrative sample candidates. Not real people.</p>
      </div>
    </section>
  );
}

export default ScrollMorphShowcase;
