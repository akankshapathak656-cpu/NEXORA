import { useState } from 'react';
import { Plate } from './Plate.jsx';
import { Icon } from './Icon.jsx';

// Legacy: pubNav(). Section links scroll to the anchor ids and close the mobile menu.
const SECTIONS = [
  ['p', 'Product'],
  ['s', 'How scoring works'],
  ['o', 'Other roles'],
  ['v', 'This version'],
];

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}

export function PublicNav({ signedIn = false, onSectionLink }) {
  const [open, setOpen] = useState(false);

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
      <header className="nav">
        <Plate height={40} />
        <nav id="pn" aria-label="Main" className={open ? 'o' : undefined}>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href="#" onClick={onSection(id)}>
              {label}
            </a>
          ))}
        </nav>
        <div className="row" style={{ margin: 0 }}>
          <a className="btn p" href={signedIn ? '#dashboard' : '#login'}>
            {signedIn ? 'Open workspace' : 'Open demo'}
          </a>
          <button
            className="ib burger"
            type="button"
            aria-label="Menu"
            aria-controls="pn"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>
    </>
  );
}
