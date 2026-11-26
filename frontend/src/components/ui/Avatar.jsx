import { ini } from '../../lib/text.js';

// Legacy: av(n, i, s = 40)
export function Avatar({ name, size = 40 }) {
  return (
    <span className="av" style={{ width: size, height: size }} aria-hidden="true">
      {ini(name)}
    </span>
  );
}
