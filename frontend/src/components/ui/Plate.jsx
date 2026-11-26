import { LOGO } from '../../data/logo.js';

// Legacy: plate(h = 52, l = '#'). `height` is in px and sets the --h custom property.
export function Plate({ height = 52, href = '#' }) {
  return (
    <a className="plate" href={href} style={{ '--h': `${height}px` }} aria-label="NEXORA home">
      <img src={LOGO} alt="NEXORA, AI-powered recruitment intelligence platform" />
    </a>
  );
}
