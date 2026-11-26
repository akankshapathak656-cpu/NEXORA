import { useEffect, useRef } from 'react';

// Port of the legacy hero AI core (public/legacy/app.js, "NEXORA hero AI core").
// A dependency-free canvas 3D scene: perspective projection, depth-bucketed batching.
// Every listener, observer and animation frame is released on unmount.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const D = 4.6;
const NB = 6;

const PAL = {
  light: { line: '15,92,73', mint: '38,170,125', glow: '70,210,160', gold: '196,138,40', core: ['#ffffff', '#c9f5e2', '#6fd4ab', '#1f8a6a'], add: false },
  dark: { line: '127,207,178', mint: '110,225,185', glow: '90,230,180', gold: '240,200,110', core: ['#ffffff', '#d2fff0', '#7fe3bb', '#2c9a77'], add: true },
};
const BA = [0.12, 0.2, 0.32, 0.48, 0.68, 0.9];
const BW = [0.6, 0.8, 1, 1.2, 1.4, 1.7];

// 3x3 matrix helpers (row-major arrays of 9 numbers).
const mmul = (a, b) => {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
};
const Rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const Ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const Rz = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const ap = (m, x, y, z) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
const bk = (z) => clamp(Math.floor(((1.3 - z) / 2.6) * NB), 0, NB - 1);

// Deterministic scene data, generated once per module load (same seed and order as legacy).
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const RINGS = [
  { r: 1.12, tilt: 1.15, roll: 0.2, pre: 0.22, spin: 0.5, kind: 'solid', w: 1.5, col: 'line', comets: [{ a: 0, c: 'gold' }, { a: 3.4, c: 'mint' }] },
  { r: 0.92, tilt: 0.45, roll: -0.6, pre: -0.31, spin: -0.35, kind: 'ticks', n: 72, w: 1, col: 'mint' },
  { r: 0.74, tilt: 1.45, roll: 0.9, pre: 0.45, spin: 0.8, kind: 'solid', w: 1.2, col: 'line', comets: [{ a: 1.6, c: 'mint' }] },
  { r: 0.56, tilt: 0.8, roll: 0, pre: -0.62, spin: -1.1, kind: 'dash', n: 14, w: 1.6, col: 'mint' },
  { r: 1.22, tilt: 0.25, roll: 1.2, pre: 0.12, spin: 0.15, kind: 'ticks', n: 36, w: 0.9, col: 'line', comets: [{ a: 2.2, c: 'gold' }] },
];

const LAT = [];
const LP = [];
(function buildLattice() {
  const n = 84, ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), t = i * ga;
    LAT.push([Math.cos(t) * r * 0.44, y * 0.44, Math.sin(t) * r * 0.44]);
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = LAT[i], b = LAT[j];
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.27) LP.push([i, j]);
    }
  }
})();

const HUBS = [];
for (let i = 0; i < 12; i++) HUBS.push({ r: 0.95 + rnd() * 0.35, inc: rnd() * Math.PI, ph: rnd() * TAU, w: (0.1 + rnd() * 0.18) * (rnd() < 0.5 ? -1 : 1), yaw: rnd() * TAU, fl: rnd() * TAU });
const PARTS = [];
for (let i = 0; i < 64; i++) PARTS.push({ r: 0.55 + rnd() * 0.7, inc: rnd() * Math.PI, ph: rnd() * TAU, w: (0.05 + rnd() * 0.12) * (rnd() < 0.5 ? -1 : 1), yaw: rnd() * TAU, s: 0.7 + rnd() * 1.3, tw: rnd() * TAU });

function makeSprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.18, `rgba(${rgb},.85)`);
  r.addColorStop(0.5, `rgba(${rgb},.22)`);
  r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export default function HeroCore() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    let W = 0, H = 0, dpr = 1, raf = 0, vis = true, run = false, t = 0, last = 0;
    let mx = 0, my = 0, smx = 0, smy = 0, small = false;
    let theme = 'light', pal = PAL.light, sprites = {};
    let ro = null, io = null;

    function setTheme() {
      theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      pal = PAL[theme];
      sprites = { mint: makeSprite(pal.glow), gold: makeSprite(pal.gold), line: makeSprite(pal.line), halo: null };
    }

    function size() {
      const b = cv.parentNode.getBoundingClientRect();
      W = Math.max(1, b.width);
      H = Math.max(1, b.height);
      small = W < 420;
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }

    function stop() {
      run = false;
      cancelAnimationFrame(raf);
    }

    function loop(n) {
      if (!run) return;
      const dt = Math.min(0.05, (n - last) / 1000);
      last = n;
      frame(dt);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (run || !vis || document.hidden) return;
      if (mq.matches) { frame(0, true); return; }
      run = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }

    function frame(dt, still) {
      if (!cv.isConnected) return;
      const th = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      if (th !== theme) setTheme();
      if (still) t = t || 3.2;
      else t += dt;
      smx += (mx - smx) * 0.04;
      smy += (my - smy) * 0.04;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, SC = Math.min(W * 0.25, H * 0.33);
      const bob = Math.sin(t * 0.7) * 0.03;
      const Rs = mmul(Rx(-0.3 + smy * 0.22 + bob), Ry(t * 0.12 + smx * 0.5));
      const P = (x, y, z) => {
        const q = ap(Rs, x, y, z), s = D / (D + q[2]);
        return [cx + q[0] * SC * s, cy + q[1] * SC * s, q[2], s];
      };
      const mk = () => Array.from({ length: NB }, () => new Path2D());
      const L = { ring: mk(), ringF: mk(), tick: mk(), lat: mk(), link: mk(), dotL: mk(), dotM: mk(), dotG: mk() };
      const heads = Array.from({ length: NB }, () => []);

      // Rings, ticks, dashes and comets.
      RINGS.forEach((rg, i) => {
        const M = mmul(Rs, mmul(Ry(rg.pre * t + i * 1.3), mmul(Rz(rg.roll), Rx(rg.tilt))));
        const pt = (a) => {
          const q = ap(M, Math.cos(a) * rg.r, 0, Math.sin(a) * rg.r), s = D / (D + q[2]);
          return [cx + q[0] * SC * s, cy + q[1] * SC * s, q[2], s];
        };
        const sp = rg.spin * t;
        if (rg.kind === 'solid') {
          const N = small ? 72 : 110;
          let p0 = pt(0);
          for (let k = 1; k <= N; k++) {
            const p1 = pt((k / N) * TAU), b = bk((p0[2] + p1[2]) / 2);
            const pa = rg.col === 'line' ? L.ring[b] : L.ringF[b];
            pa.moveTo(p0[0], p0[1]);
            pa.lineTo(p1[0], p1[1]);
            p0 = p1;
          }
        } else if (rg.kind === 'ticks') {
          const n = rg.n;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU + sp, c = Math.cos(a), s = Math.sin(a), l = k % 6 === 0 ? 0.06 : 0.028;
            const q1 = ap(M, c * (rg.r - l), 0, s * (rg.r - l)), q2 = ap(M, c * (rg.r + l), 0, s * (rg.r + l));
            const s1 = D / (D + q1[2]), s2 = D / (D + q2[2]);
            const pa = L.tick[bk((q1[2] + q2[2]) / 2)];
            pa.moveTo(cx + q1[0] * SC * s1, cy + q1[1] * SC * s1);
            pa.lineTo(cx + q2[0] * SC * s2, cy + q2[1] * SC * s2);
          }
          const N = small ? 60 : 90;
          let p0 = pt(0);
          for (let k = 1; k <= N; k++) {
            const p1 = pt((k / N) * TAU), pa = L.ringF[bk((p0[2] + p1[2]) / 2)];
            pa.moveTo(p0[0], p0[1]);
            pa.lineTo(p1[0], p1[1]);
            p0 = p1;
          }
        } else {
          const n = rg.n, seg = TAU / n;
          for (let k = 0; k < n; k += 1) {
            const a0 = k * seg + sp, steps = 5;
            let p0 = pt(a0);
            for (let j = 1; j <= steps; j++) {
              const p1 = pt(a0 + (seg * 0.6 * j) / steps), pa = L.ring[bk((p0[2] + p1[2]) / 2)];
              pa.moveTo(p0[0], p0[1]);
              pa.lineTo(p1[0], p1[1]);
              p0 = p1;
            }
          }
        }
        (rg.comets || []).forEach((c) => {
          const dir = rg.spin >= 0 ? 1 : -1, ang = c.a + rg.spin * 1.6 * t, T = small ? 9 : 14;
          for (let k = T; k >= 1; k--) {
            const p = pt(ang - dir * k * 0.055), b = bk(p[2]), r = (1.6 * (1 - k / T) + 0.3) * p[3];
            const dp = c.c === 'gold' ? L.dotG[b] : L.dotM[b];
            dp.moveTo(p[0] + r, p[1]);
            dp.arc(p[0], p[1], r, 0, TAU);
          }
          const p = pt(ang);
          heads[bk(p[2])].push({ x: p[0], y: p[1], s: (9 + 3 * Math.sin(t * 3 + c.a)) * p[3], sp: c.c === 'gold' ? 'gold' : 'mint', a: 1 });
        });
      });

      // Core lattice.
      const lp = LAT.map((v) => {
        const q = ap(mmul(Ry(t * 0.35), Rx(0.4 + Math.sin(t * 0.3) * 0.15)), v[0], v[1], v[2]);
        return P(q[0], q[1], q[2]);
      });
      for (const e of LP) {
        const a = lp[e[0]], b = lp[e[1]];
        const pa = L.lat[bk((a[2] + b[2]) / 2)];
        pa.moveTo(a[0], a[1]);
        pa.lineTo(b[0], b[1]);
      }
      lp.forEach((p, i) => {
        if (i % 2) return;
        const b = bk(p[2]), r = 1.5 * p[3];
        L.dotL[b].moveTo(p[0] + r, p[1]);
        L.dotL[b].arc(p[0], p[1], r, 0, TAU);
      });

      // Hubs, data pulses.
      const hp = HUBS.map((h) => {
        const a = h.ph + h.w * t;
        const q0 = ap(Rx(h.inc), Math.cos(a) * h.r, Math.sin(t * 0.5 + h.fl) * 0.08, Math.sin(a) * h.r);
        return Object.assign(P(q0[0], q0[1], q0[2]), { raw: q0 });
      });
      hp.forEach((p, i) => {
        const b = bk(p[2]), q = p.raw, l = Math.hypot(q[0], q[1], q[2]), k = 0.46 / l, e = P(q[0] * k, q[1] * k, q[2] * k), pa = L.link[b];
        pa.moveTo(p[0], p[1]);
        pa.lineTo(e[0], e[1]);
        const f = (t * 0.35 + i * 0.37) % 1;
        const dx = p[0] + (e[0] - p[0]) * f, dy = p[1] + (e[1] - p[1]) * f, db = bk(p[2] + (e[2] - p[2]) * f);
        L.dotM[db].moveTo(dx + 1.7, dy);
        L.dotM[db].arc(dx, dy, 1.7, 0, TAU);
        heads[b].push({ x: p[0], y: p[1], s: (6 + 1.5 * Math.sin(t * 2 + i)) * p[3], sp: 'mint', a: 0.9 });
      });

      // Particles and their short links.
      const np = small ? 40 : PARTS.length, pp = [];
      for (let i = 0; i < np; i++) {
        const o = PARTS[i], a = o.ph + o.w * t;
        const q = ap(Rx(o.inc), Math.cos(a) * o.r, Math.sin(t * 0.4 + o.tw) * 0.1, Math.sin(a) * o.r);
        const p = P(q[0], q[1], q[2]);
        pp.push([p, q]);
        const b = bk(p[2]), r = (0.7 + o.s * 0.5) * p[3] * (0.75 + 0.25 * Math.sin(t * 2 + o.tw));
        const target = i % 3 ? L.dotL : L.dotM;
        target[b].moveTo(p[0] + r, p[1]);
        target[b].arc(p[0], p[1], r, 0, TAU);
      }
      let nl = 0;
      for (let i = 0; i < np && nl < 70; i++) {
        for (let j = i + 1; j < np && nl < 70; j++) {
          const a = pp[i][1], b = pp[j][1];
          if (Math.abs(a[0] - b[0]) < 0.4 && Math.abs(a[1] - b[1]) < 0.4 && Math.abs(a[2] - b[2]) < 0.4 && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.4) {
            const A = pp[i][0], B = pp[j][0];
            const pa = L.link[bk((A[2] + B[2]) / 2)];
            pa.moveTo(A[0], A[1]);
            pa.lineTo(B[0], B[1]);
            nl++;
          }
        }
      }

      // Draw.
      const add = pal.add, rgbL = pal.line, rgbM = pal.mint, rgbG = pal.gold;
      const stroke = (path, rgb, w, b, am) => { ctx.strokeStyle = `rgba(${rgb},${BA[b] * am})`; ctx.lineWidth = w * BW[b]; ctx.stroke(path); };
      const fillP = (path, rgb, b, am) => { ctx.fillStyle = `rgba(${rgb},${Math.min(1, BA[b] * am + 0.05)})`; ctx.fill(path); };
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.8);
      ctx.lineCap = 'round';

      // Background halo.
      const orb = SC * 0.3 * (1 + 0.035 * Math.sin(t * 1.8));
      ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
      ctx.globalAlpha = (add ? 0.55 : 0.8) + 0.2 * pulse;
      const hr = orb * (4.2 + 0.5 * pulse);
      ctx.drawImage(sprites.mint, cx - hr, cy - hr, hr * 2, hr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      const drawBucket = (b) => {
        ctx.lineWidth = 1;
        stroke(L.ringF[b], rgbM, 1, b, 0.75);
        stroke(L.ring[b], rgbL, 1.4, b, 0.95);
        stroke(L.tick[b], rgbM, 1, b, 1.1);
        stroke(L.lat[b], rgbL, 0.9, b, 0.8);
        stroke(L.link[b], rgbM, 0.8, b, 0.7);
        fillP(L.dotL[b], rgbL, b, 1);
        fillP(L.dotM[b], rgbM, b, 1.15);
        fillP(L.dotG[b], rgbG, b, 1.2);
        ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
        for (const h of heads[b]) {
          const sz = h.s * 2.2;
          ctx.globalAlpha = h.a * (0.55 + 0.45 * BA[b]);
          ctx.drawImage(sprites[h.sp], h.x - sz, h.y - sz, sz * 2, sz * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      };

      const drawCore = () => {
        // Orb.
        const g = ctx.createRadialGradient(cx - orb * 0.3, cy - orb * 0.35, orb * 0.05, cx, cy, orb);
        g.addColorStop(0, pal.core[0]);
        g.addColorStop(0.28, pal.core[1]);
        g.addColorStop(0.7, pal.core[2]);
        g.addColorStop(1, pal.core[3]);
        ctx.globalAlpha = 0.97;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, orb, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Swirling energy bands clipped to the orb.
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, orb, 0, TAU);
        ctx.clip();
        for (let k = 0; k < 3; k++) {
          const a = t * (0.5 + k * 0.2) * (k % 2 ? -1 : 1) + k * 2.1;
          ctx.strokeStyle = `rgba(255,255,255,${0.28 + 0.12 * pulse})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, orb * (0.95 - k * 0.12), orb * (0.28 + 0.2 * k), a, 0, TAU);
          ctx.stroke();
        }
        const ig = ctx.createRadialGradient(cx, cy, 0, cx, cy, orb * 0.7);
        ig.addColorStop(0, `rgba(255,255,255,${0.75 + 0.2 * pulse})`);
        ig.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = ig;
        ctx.fillRect(cx - orb, cy - orb, orb * 2, orb * 2);
        ctx.restore();

        // Rim light.
        ctx.strokeStyle = `rgba(${pal.mint},${0.55 + 0.25 * pulse})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, orb, 0, TAU);
        ctx.stroke();

        // Inner glow bloom.
        ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
        ctx.globalAlpha = 0.5 + 0.3 * pulse;
        const br = orb * 2.3;
        ctx.drawImage(sprites.mint, cx - br, cy - br, br * 2, br * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';

        // Expanding pulse waves.
        for (let k = 0; k < 2; k++) {
          const f = (t / 3.4 + k * 0.5) % 1, rr = orb * (1.15 + f * 3.2);
          ctx.strokeStyle = `rgba(${pal.mint},${(1 - f) * (1 - f) * 0.55})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(cx, cy, rr, 0, TAU);
          ctx.stroke();
        }
      };

      for (let b = 0; b < NB; b++) {
        if (b === 3) drawCore();
        drawBucket(b);
      }
    }

    // Input and lifecycle.
    const onPointer = (e) => {
      if (mq.matches) return;
      mx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      my = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotionChange = () => { stop(); start(); };

    function bind() {
      setTheme();
      size();
      ro = new ResizeObserver(() => { size(); if (!run) frame(0, true); });
      ro.observe(cv.parentNode);
      io = new IntersectionObserver((entries) => {
        vis = entries[0].isIntersecting;
        if (vis) start();
        else stop();
      }, { threshold: 0.01 });
      io.observe(cv.parentNode);
      start();
    }

    bind();
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onMotionChange);
    else mq.addListener(onMotionChange);

    return () => {
      stop();
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      if (typeof mq.removeEventListener === 'function') mq.removeEventListener('change', onMotionChange);
      else mq.removeListener(onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
