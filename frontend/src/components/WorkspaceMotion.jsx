// Workspace motion engine (port of legacy Stage 2 & Stage 3 micro-interactions).
// Mounted once inside AppShell: <WorkspaceMotion route={route} />.
// Respects prefers-reduced-motion, uses no window.* globals or innerHTML, and cleans up on unmount.
import { useEffect, useRef } from 'react';

const EASE = 'cubic-bezier(.33,1,.68,1)';
const EASE_FAST = 'cubic-bezier(.2,.8,.2,1)';
const EIO = 'cubic-bezier(.65,0,.35,1)';
const SPR = 'cubic-bezier(.34,1.56,.64,1)';

const NUM_RE = /^([+\u2212-]?)(\d+(?:\.\d+)?)(\s*%|\s+points?)?$/;
const COUNTER_SEL = '.kp .kv, .ps b';

function easeOutCubic(p) {
  return 1 - Math.pow(1 - p, 3);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function parseNumeric(el) {
  if (!el || el.children.length) return null;
  const raw = el.textContent;
  const m = NUM_RE.exec(raw.trim());
  if (!m) return null;
  return {
    orig: raw,
    prefix: m[1],
    num: Number(m[2]),
    decimals: (m[2].split('.')[1] || '').length,
    suffix: m[3] || '',
  };
}

function setElementText(el, value) {
  // Updating the existing Text node preserves React's text-node reference.
  if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
    el.firstChild.nodeValue = value;
  } else {
    el.textContent = value;
  }
}

function safeAnimate(el, keyframes, options, reduced) {
  if (reduced || !el || typeof el.animate !== 'function') return null;
  try {
    return el.animate(keyframes, options);
  } catch {
    return null;
  }
}

function triggerPing(el, reduced) {
  if (reduced || !el) return;
  const card = el.closest('.card, .ps, .kp');
  if (!card || card.classList.contains('s2-ping')) return;
  card.classList.add('s2-ping');
  const cleanup = (e) => {
    if (e && e.target !== card) return;
    card.classList.remove('s2-ping');
    card.removeEventListener('animationend', cleanup);
  };
  card.addEventListener('animationend', cleanup);
  setTimeout(() => card.classList.remove('s2-ping'), 1000);
}

export function WorkspaceMotion({ route }) {
  const engineRef = useRef(null);

  // Persistent workspace setup: progress bar, chart tooltip, drag glow, rAF tween loop,
  // tab keyboard navigation, resize handling, and first-mount shell entrance.
  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reduced = mq ? mq.matches : false;
    const onMqChange = (e) => {
      reduced = e.matches;
    };
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onMqChange);
      else if (mq.addListener) mq.addListener(onMqChange);
    }

    // 1. Top hairline route progress bar (#s3-lb)
    const lb = document.createElement('div');
    lb.id = 's3-lb';
    lb.setAttribute('aria-hidden', 'true');
    document.body.appendChild(lb);

    // 2. Floating chart scrubbing tooltip (.s2-tip) — DOM nodes only, no innerHTML
    const tip = document.createElement('div');
    tip.className = 's2-tip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('aria-live', 'polite');
    document.body.appendChild(tip);

    // Shared rAF loop for number count-ups
    const tweens = [];
    const activeCounters = new WeakSet();
    const lastValues = new WeakMap();
    let rafId = 0;

    function tick(now) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const o = tweens[i];
        if (!o.el.isConnected) {
          activeCounters.delete(o.el);
          tweens.splice(i, 1);
          continue;
        }
        const elapsed = now - o.t0 - o.delay;
        if (elapsed < 0) continue;
        const p = Math.min(1, elapsed / o.duration);
        o.onUpdate(easeOutCubic(p));
        if (p >= 1) {
          o.onEnd();
          activeCounters.delete(o.el);
          tweens.splice(i, 1);
        }
      }
      rafId = tweens.length ? requestAnimationFrame(tick) : 0;
    }

    function cancelTweenFor(el) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        if (tweens[i].el === el) tweens.splice(i, 1);
      }
      activeCounters.delete(el);
    }

    function countUp(el, parsed, from, delay, duration) {
      if (reduced) {
        setElementText(el, parsed.orig);
        return;
      }
      cancelTweenFor(el);
      activeCounters.add(el);
      const format = (v) => parsed.prefix + v.toFixed(parsed.decimals) + parsed.suffix;
      setElementText(el, format(from));
      tweens.push({
        el,
        t0: performance.now(),
        delay,
        duration,
        onUpdate: (k) => {
          setElementText(el, format(from + (parsed.num - from) * k));
        },
        onEnd: () => {
          setElementText(el, parsed.orig);
        },
      });
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    // State for sliding pill, sliding tab indicators, and charts
    let pillState = null;
    let pillEl = null;
    const tabStates = new WeakMap();
    const chartMap = new WeakMap();
    let activeChart = null;
    let touchHideTimer = 0;

    function showTip(x, y, label, value, deltaText) {
      const wasVisible = tip.classList.contains('on');
      tip.classList.toggle('sn', !wasVisible);
      tip.textContent = '';
      if (label) {
        const sm = document.createElement('small');
        sm.textContent = label;
        tip.appendChild(sm);
      }
      const b = document.createElement('b');
      b.textContent = value;
      tip.appendChild(b);
      if (deltaText) {
        const d = document.createElement('small');
        d.textContent = deltaText;
        tip.appendChild(d);
      }
      const w = tip.offsetWidth;
      const h = tip.offsetHeight;
      let top = y - h - 14;
      if (top < 8) top = y + 20;
      const left = clamp(x - w / 2, 8, window.innerWidth - w - 8);
      tip.style.transform = `translate(${left}px,${top}px)`;
      tip.classList.add('on');
    }

    function hideTip() {
      tip.classList.remove('on');
      if (activeChart) {
        const meta = chartMap.get(activeChart);
        if (meta) {
          meta.pts.forEach((p) => p.c.classList.remove('s2-on'));
          meta.g.classList.remove('on');
        }
        activeChart = null;
      }
    }

    function activatePoint(svg, idx) {
      const meta = chartMap.get(svg);
      if (!meta || !meta.pts[idx]) return;
      if (activeChart && activeChart !== svg) hideTip();
      activeChart = svg;
      meta.k = idx;
      const p = meta.pts[idx];
      const prev = meta.pts[idx - 1];
      meta.pts.forEach((pt, i) => pt.c.classList.toggle('s2-on', i === idx));
      meta.g.style.transform = `translateX(${p.x}px)`;
      meta.g.classList.add('on');

      const curVal = parseFloat(p.v);
      const prevVal = prev ? parseFloat(prev.v) : NaN;
      const delta = prev && Number.isFinite(curVal) && Number.isFinite(prevVal)
        ? Math.round((curVal - prevVal) * 100) / 100
        : null;
      const deltaText = delta == null
        ? ''
        : `${delta >= 0 ? '+' : '\u2212'}${Math.abs(delta)} vs ${prev.l || 'prev'}`;

      const ctm = svg.getScreenCTM && svg.getScreenCTM();
      if (!ctm || !svg.createSVGPoint) return;
      const pt = svg.createSVGPoint();
      pt.x = p.x;
      pt.y = p.y;
      const screen = pt.matrixTransform(ctm);
      showTip(screen.x, screen.y, p.l, p.v, deltaText);
    }

    function prepAndPlayCharts(root) {
      if (!root) return;
      const svgs = root.querySelectorAll('svg.ch');
      svgs.forEach((svg) => {
        if (chartMap.has(svg)) return;
        const circles = Array.from(svg.querySelectorAll('circle'));
        const pts = circles.map((c) => {
          const titleEl = c.querySelector('title');
          const tx = titleEl ? titleEl.textContent : c.getAttribute('aria-label') || '';
          if (titleEl) titleEl.remove();
          if (tx) c.setAttribute('aria-label', tx);
          const sep = tx.lastIndexOf(': ');
          return {
            c,
            x: Number(c.getAttribute('cx')) || 0,
            y: Number(c.getAttribute('cy')) || 0,
            l: sep > -1 ? tx.slice(0, sep) : '',
            v: sep > -1 ? tx.slice(sep + 2) : tx,
          };
        });
        if (!pts.length) return;

        const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : { width: 460, height: 190 };
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        g.setAttribute('class', 's2-g');
        g.setAttribute('x1', '0');
        g.setAttribute('x2', '0');
        g.setAttribute('y1', '12');
        g.setAttribute('y2', String(Math.max(20, vb.height - 26)));
        g.setAttribute('aria-hidden', 'true');
        const poly = svg.querySelector('polygon');
        if (poly) svg.insertBefore(g, poly);
        else svg.appendChild(g);
        svg.setAttribute('tabindex', '0');

        const meta = { pts, g, k: pts.length - 1 };
        chartMap.set(svg, meta);

        // Draw-in animation
        if (!reduced) {
          const pl = svg.querySelector('polyline');
          const dur = 1300;
          const d0 = 140;
          safeAnimate(
            svg,
            [{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0px)' }],
            { duration: 480, easing: 'ease-out', fill: 'backwards' },
            reduced
          );
          svg.querySelectorAll('line:not(.s2-g)').forEach((line, i) => {
            safeAnimate(
              line,
              [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }],
              { duration: 560, delay: i * 80, easing: EASE, fill: 'backwards' },
              reduced
            );
          });
          if (pl && typeof pl.getTotalLength === 'function') {
            const len = pl.getTotalLength();
            safeAnimate(
              pl,
              [
                { strokeDasharray: `${len} ${len}`, strokeDashoffset: len, opacity: 0 },
                { opacity: 1, offset: 0.03 },
                { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0, opacity: 1 },
              ],
              { duration: dur, delay: d0, easing: EIO, fill: 'backwards' },
              reduced
            );
          }
          if (poly) {
            safeAnimate(
              poly,
              [{ opacity: 0 }, { opacity: 1 }],
              { duration: 850, delay: d0 + dur * 0.55, easing: 'ease-out', fill: 'backwards' },
              reduced
            );
          }
          const cum = [0];
          let tot = 0;
          pts.forEach((p, i) => {
            if (i > 0) {
              tot += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
              cum.push(tot);
            }
          });
          pts.forEach((p, i) => {
            const f = tot ? cum[i] / tot : 0;
            const t = f <= 0 ? 0 : f >= 1 ? 1 : (f < 0.5 ? Math.cbrt(f / 4) : 1 - Math.cbrt((1 - f) / 4));
            safeAnimate(
              p.c,
              [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
              { duration: 380, delay: d0 + dur * t, easing: SPR, fill: 'backwards' },
              reduced
            );
          });
          svg.querySelectorAll('text').forEach((tx, i) => {
            safeAnimate(
              tx,
              [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
              { duration: 420, delay: 300 + i * 50, easing: EASE, fill: 'backwards' },
              reduced
            );
          });
        }
      });
    }

    function syncSidebarPill(animate) {
      const sd = document.querySelector('aside.side');
      if (!sd) return;
      const activeLink = sd.querySelector('a[aria-current="page"]');
      if (!activeLink) {
        if (pillEl && pillEl.parentNode) pillEl.remove();
        pillState = null;
        return;
      }
      if (!pillEl || pillEl.parentNode !== sd) {
        if (pillEl && pillEl.parentNode) pillEl.remove();
        pillEl = document.createElement('i');
        pillEl.className = 's2-pill';
        pillEl.setAttribute('aria-hidden', 'true');
        sd.appendChild(pillEl);
      }
      const sdRect = sd.getBoundingClientRect();
      const aRect = activeLink.getBoundingClientRect();
      const y = aRect.top - sdRect.top + sd.scrollTop;
      const h = aRect.height;
      pillEl.style.top = `${y}px`;
      pillEl.style.height = `${h}px`;

      if (animate && !reduced) {
        if (pillState && Math.abs(pillState.y - y) > 0.5) {
          safeAnimate(
            pillEl,
            [
              { transform: `translateY(${pillState.y - y}px)`, height: `${pillState.h}px` },
              { transform: 'none', height: `${h}px` },
            ],
            { duration: 460, easing: EASE },
            reduced
          );
        } else if (!pillState) {
          safeAnimate(
            pillEl,
            [{ transform: 'scaleY(0)' }, { transform: 'none' }],
            { duration: 400, delay: 180, easing: EASE, fill: 'backwards' },
            reduced
          );
        }
      }
      pillState = { y, h };
    }

    function syncTabIndicators(root, animate) {
      if (!root) return;
      const lists = root.querySelectorAll('[role="tablist"].tabs');
      lists.forEach((tl) => {
        const sel = tl.querySelector('[aria-selected="true"]');
        if (!sel) return;
        tl.classList.add('s2t');
        let ind = tl.querySelector(':scope > .s2-ti');
        if (!ind) {
          ind = document.createElement('i');
          ind.className = 's2-ti';
          ind.setAttribute('aria-hidden', 'true');
          tl.appendChild(ind);
        }
        const tlRect = tl.getBoundingClientRect();
        const selRect = sel.getBoundingClientRect();
        const x = selRect.left - tlRect.left + tl.scrollLeft;
        const w = selRect.width;
        ind.style.width = `${w}px`;
        ind.style.transform = `translateX(${x}px)`;

        const prev = tabStates.get(tl);
        if (animate && !reduced && prev && prev.sel !== sel) {
          safeAnimate(
            ind,
            [
              { transform: `translateX(${prev.x}px)`, width: `${prev.w}px` },
              { transform: `translateX(${x}px)`, width: `${w}px` },
            ],
            { duration: 420, easing: EASE },
            reduced
          );
          const panel = tl.parentElement && tl.parentElement.querySelector('[role="tabpanel"]');
          if (panel) {
            panel.classList.remove('s2-tabin');
            void panel.offsetWidth;
            panel.classList.add('s2-tabin');
            panel.addEventListener('animationend', (e) => {
              if (e.target === panel) panel.classList.remove('s2-tabin');
            }, { once: true });
          }
        }
        tabStates.set(tl, { x, w, sel });
      });
    }

    function scanCounters(root, isRouteEntry) {
      if (!root) return;
      const els = root.querySelectorAll(COUNTER_SEL);
      els.forEach((el, idx) => {
        if (activeCounters.has(el)) return;
        const parsed = parseNumeric(el);
        if (!parsed) return;
        const prev = lastValues.get(el);
        if (isRouteEntry || prev === undefined) {
          lastValues.set(el, parsed.num);
          if (isRouteEntry && !reduced) {
            countUp(el, parsed, 0, Math.min(idx, 10) * 45, 920);
          }
        } else if (prev !== parsed.num) {
          lastValues.set(el, parsed.num);
          if (!reduced) {
            countUp(el, parsed, prev, 0, 820);
            triggerPing(el, reduced);
          }
        }
      });
    }

    function sweepProgressBar() {
      safeAnimate(
        lb,
        [
          { transform: 'scaleX(0)', opacity: 1 },
          { transform: 'scaleX(.65)', opacity: 1, offset: 0.5 },
          { transform: 'scaleX(.92)', opacity: 1, offset: 0.8 },
          { transform: 'scaleX(1)', opacity: 1, offset: 0.9 },
          { transform: 'scaleX(1)', opacity: 0 },
        ],
        { duration: 720, easing: 'ease-out' },
        reduced
      );
    }

    // Delegated pointer + keyboard listeners for chart scrubbing
    const onPointer = (e) => {
      const target = e.target;
      if (!target || !target.closest) return;
      const svg = target.closest('svg.ch');
      if (svg && chartMap.has(svg)) {
        const meta = chartMap.get(svg);
        const r = svg.getBoundingClientRect();
        if (!r.width) return;
        const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : { width: r.width };
        const x = ((e.clientX - r.left) * vb.width) / r.width;
        let bestIdx = 0;
        let bestDist = Infinity;
        meta.pts.forEach((p, i) => {
          const d = Math.abs(p.x - x);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        });
        activatePoint(svg, bestIdx);
        return;
      }
      if (tip.classList.contains('on')) hideTip();
    };

    const onPointerUp = (e) => {
      if (e.pointerType === 'touch') {
        clearTimeout(touchHideTimer);
        touchHideTimer = window.setTimeout(hideTip, 1600);
      }
    };

    const onScroll = () => {
      if (tip.classList.contains('on')) hideTip();
    };

    const onFocusIn = (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('svg.ch') && chartMap.has(t)) {
        activatePoint(t, chartMap.get(t).k);
      }
    };

    const onFocusOut = (e) => {
      const t = e.target;
      if (t && t.matches && t.matches('svg.ch')) hideTip();
    };

    const onKeyDown = (e) => {
      const t = e.target;
      if (!t || !t.getAttribute) return;

      // Keyboard scrubbing on focused SVG chart
      if (t.matches && t.matches('svg.ch') && chartMap.has(t)) {
        const meta = chartMap.get(t);
        const n = meta.pts.length;
        let k = meta.k;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') k = Math.min(n - 1, k + 1);
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') k = Math.max(0, k - 1);
        else if (e.key === 'Home') k = 0;
        else if (e.key === 'End') k = n - 1;
        else return;
        e.preventDefault();
        activatePoint(t, k);
        return;
      }

      // Arrow-key tab navigation inside [role="tablist"]
      if (t.getAttribute('role') === 'tab') {
        const list = t.closest('[role="tablist"]');
        if (!list) return;
        const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
        const idx = tabs.indexOf(t);
        if (idx === -1) return;
        let nextIdx = idx;
        if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') nextIdx = (idx + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') nextIdx = 0;
        else if (e.key === 'End') nextIdx = tabs.length - 1;
        else return;
        e.preventDefault();
        const nextTab = tabs[nextIdx];
        if (nextTab) {
          nextTab.click();
          nextTab.focus();
        }
      }
    };

    // Window-wide file drag glow (body.s3-drag)
    let dragDepth = 0;
    const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const dragOff = () => {
      dragDepth = 0;
      document.body.classList.remove('s3-drag');
    };
    const onDragEnter = (e) => {
      if (!hasFiles(e)) return;
      if (!dragDepth++) document.body.classList.add('s3-drag');
    };
    const onDragLeave = (e) => {
      if (!hasFiles(e)) return;
      if (e.relatedTarget == null || --dragDepth <= 0) dragOff();
    };

    // Resize sync (debounced)
    let resizeTimer = 0;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        syncSidebarPill(false);
        syncTabIndicators(document.getElementById('m'), false);
      }, 120);
    };

    // Observe main#m for dynamic tab changes, live AI score updates, and newly mounted charts
    let mutTimer = 0;
    const mainEl = document.getElementById('m');
    const observer = new MutationObserver(() => {
      clearTimeout(mutTimer);
      mutTimer = window.setTimeout(() => {
        const m = document.getElementById('m');
        if (!m) return;
        syncTabIndicators(m, true);
        prepAndPlayCharts(m);
        scanCounters(m, false);
      }, 24);
    });
    if (mainEl) {
      observer.observe(mainEl, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['aria-selected'],
      });
    }

    const appRoot = document.querySelector('.app') || document;
    appRoot.addEventListener('pointermove', onPointer, { passive: true });
    appRoot.addEventListener('pointerdown', onPointer, { passive: true });
    appRoot.addEventListener('pointerleave', hideTip);
    appRoot.addEventListener('pointerup', onPointerUp);
    appRoot.addEventListener('focusin', onFocusIn);
    appRoot.addEventListener('focusout', onFocusOut);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('dragenter', onDragEnter);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', dragOff, true);
    document.addEventListener('dragend', dragOff);

    // First-mount shell entrance (staggered sidebar links + topbar)
    if (!reduced) {
      const sideItems = document.querySelectorAll('aside.side a, aside.side .gl, aside.side button.lo');
      sideItems.forEach((el, i) => {
        safeAnimate(
          el,
          [{ opacity: 0, translate: '-10px 0' }, { opacity: 1, translate: '0 0' }],
          { duration: 400, delay: 30 + Math.min(i, 14) * 26, easing: EASE_FAST, fill: 'backwards' },
          reduced
        );
      });
      const tbar = document.querySelector('.tbar');
      safeAnimate(
        tbar,
        [{ opacity: 0, translate: '0 -8px' }, { opacity: 1, translate: '0 0' }],
        { duration: 380, easing: EASE_FAST, fill: 'backwards' },
        reduced
      );
    }

    engineRef.current = {
      onRouteChange: () => {
        hideTip();
        sweepProgressBar();
        syncSidebarPill(true);
        const m = document.getElementById('m');
        if (m) {
          syncTabIndicators(m, false);
          prepAndPlayCharts(m);
          scanCounters(m, true);
        }
      },
    };

    return () => {
      engineRef.current = null;
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      tweens.length = 0;
      clearTimeout(resizeTimer);
      clearTimeout(mutTimer);
      clearTimeout(touchHideTimer);
      dragOff();
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onMqChange);
        else if (mq.removeListener) mq.removeListener(onMqChange);
      }
      appRoot.removeEventListener('pointermove', onPointer);
      appRoot.removeEventListener('pointerdown', onPointer);
      appRoot.removeEventListener('pointerleave', hideTip);
      appRoot.removeEventListener('pointerup', onPointerUp);
      appRoot.removeEventListener('focusin', onFocusIn);
      appRoot.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('dragenter', onDragEnter);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', dragOff, true);
      document.removeEventListener('dragend', dragOff);
      lb.remove();
      tip.remove();
      if (pillEl && pillEl.parentNode) pillEl.remove();
      document.querySelectorAll('.s2-ti').forEach((n) => n.remove());
      document.querySelectorAll('svg.ch .s2-g').forEach((n) => n.remove());
    };
  }, []);

  // Re-run route transition motion whenever route changes
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (engineRef.current) engineRef.current.onRouteChange();
    });
    return () => cancelAnimationFrame(id);
  }, [route]);

  return null;
}

export default WorkspaceMotion;
