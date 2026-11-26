import { useEffect, useRef, useState } from 'react';
import { Plate } from './Plate.jsx';
import { Icon } from './Icon.jsx';

// Legacy: pubNav() + Stage 1B scroll shadow and scroll-spy underline.
const SECTIONS = [
  ['p', 'Product'],
  ['s', 'How scoring works'],
  ['o', 'Other roles'],
  ['v', 'This version'],
];

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}

export function PublicNav({ signedIn = false, onSectionLink }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const navRef = useRef(null);
  const indRef = useRef(null);
  const linkRefs = useRef([]);

  useEffect(() => {
    const updateIndicator = (idx) => {
      const ind = indRef.current;
      if (!ind) return;
      const link = idx >= 0 ? linkRefs.current[idx] : null;
      if (!link) {
        ind.style.opacity = '0';
        return;
      }
      ind.style.width = `${link.offsetWidth}px`;
      ind.style.transform = `translateX(${link.offsetLeft}px)`;
      ind.style.opacity = '1';
    };

    let raf = 0;
    let currentIdx = -2;

    const evaluate = () => {
      raf = 0;
      setScrolled(window.scrollY > 8);
      let k = -1;
      for (let i = 0; i < SECTIONS.length; i += 1) {
        const target = document.getElementById(SECTIONS[i][0]);
        if (target && target.getBoundingClientRect().top < window.innerHeight * 0.4) {
          k = i;
        }
      }
      if (k !== currentIdx) {
        currentIdx = k;
        setActiveIdx(k);
        updateIndicator(k);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(evaluate);
    };

    const onResize = () => {
      updateIndicator(currentIdx);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    evaluate();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const ind = indRef.current;
    if (!ind) return;
    const link = activeIdx >= 0 ? linkRefs.current[activeIdx] : null;
    if (!link) {
      ind.style.opacity = '0';
      return;
    }
    ind.style.width = `${link.offsetWidth}px`;
    ind.style.transform = `translateX(${link.offsetLeft}px)`;
    ind.style.opacity = '1';
  }, [activeIdx]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!e.target.closest('#pn, .burger')) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const onSkip = (e) => {
    e.preventDefault();
    document.getElementById('m')?.focus();
  };

  const onSection = (id) => (e) => {
    e.preventDefault();
    setOpen(false);
    scrollToSection(id);
    onSectionLink?.(id);
  };

  return (
    <>
      <a className="skip" href="#m" onClick={onSkip}>
        Skip to content
      </a>
      <header className={scrolled ? 'nav sc' : 'nav'}>
        <Plate height={40} />
        <nav id="pn" aria-label="Main" className={open ? 'o' : undefined} ref={navRef}>
          {SECTIONS.map(([id, label], i) => {
            const isOn = activeIdx === i;
            return (
              <a
                key={id}
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                href={`#${id}`}
                className={isOn ? 'on' : undefined}
                aria-current={isOn ? 'location' : undefined}
                onClick={onSection(id)}
              >
                {label}
              </a>
            );
          })}
          <i className="ni" ref={indRef} aria-hidden="true" />
        </nav>
        <div className="row" style={{ margin: 0 }}>
          <a className="btn p" href={signedIn ? '/dashboard' : '/login'}>
            {signedIn ? 'Open workspace' : 'Open demo'}
          </a>
          <button
            className="ib burger"
            type="button"
            aria-label="Menu"
            aria-controls="pn"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>
    </>
  );
}
