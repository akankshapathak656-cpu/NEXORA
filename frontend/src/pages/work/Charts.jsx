// Legacy: ring(v, s) and area(d, lb, w, h, tip). Same geometry and class names, written as JSX SVG.
// Gradient fills use url(#gd) and url(#ga); those defs live in the static SVG of the app shell.

export function Ring({ value, size = 64 }) {
  const v = value;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={v == null ? 'Not scored' : v + ' percent'}>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bd)" strokeWidth="3" />
      <circle
        className="rg"
        cx="18"
        cy="18"
        r="15.9"
        fill="none"
        stroke="url(#gd)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${v || 0} 100`}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="21" textAnchor="middle" fill="var(--tx)" fontSize="9" fontWeight="700">
        {v == null ? '—' : v + '%'}
      </text>
    </svg>
  );
}

export function AreaChart({ data, labels, w = 460, h = 190, tip = '' }) {
  const n = data.length;
  const last = n - 1;
  const mx = Math.max(...data) * 1.15;
  const X = i => 26 + i * (w - 40) / last;
  const Y = v => h - 26 - v / mx * (h - 46);
  const pts = data.map((v, i) => X(i) + ',' + Y(v)).join(' ');
  return (
    <svg className="ch" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Trend chart">
      {[0, 0.5, 1].map(k => (
        <line key={k} x1="20" x2={w - 6} y1={Y(mx * k)} y2={Y(mx * k)} stroke="var(--bd)" />
      ))}
      <polygon points={`${X(0)},${h - 26} ${pts} ${X(last)},${h - 26}`} fill="url(#ga)" />
      <polyline points={pts} fill="none" stroke="url(#gd)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r="5" fill="var(--panel)" stroke="var(--c)" strokeWidth="2">
          <title>{labels[i]}: {v}</title>
        </circle>
      ))}
      {tip ? (
        <>
          <rect x={X(last) - 112} y={Y(data[last]) - 36} width="122" height="24" rx="12" fill="#7c4dff" />
          <text x={X(last) - 51} y={Y(data[last]) - 20} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700">
            {tip}
          </text>
        </>
      ) : null}
      {labels.map((l, i) => (
        <text key={i} x={X(i)} y={h - 7} textAnchor="middle" fill="var(--mu)" fontSize="10">{l}</text>
      ))}
    </svg>
  );
}
