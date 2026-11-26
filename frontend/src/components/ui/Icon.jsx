// Legacy: ic(n). Only 'menu' existed in the legacy helper; any other name renders nothing.

const PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h16',
};

export function Icon({ name }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg className="ic" viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
