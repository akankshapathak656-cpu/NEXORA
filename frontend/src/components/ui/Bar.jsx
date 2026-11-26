// Legacy: bar(v, l). Same wrapper and inline styles as the legacy markup.

export function Bar({ value, label }) {
  return (
    <div style={{ margin: '10px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="bar">
        <i style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
