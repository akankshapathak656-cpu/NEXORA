// Legacy ig() and ir(): the "Actionable insights" cards and their rows on the dashboard.

// One row. onPick runs before the link navigates; w marks a warning row.
export function InsightRow({ href, onPick, w, title, detail, right }) {
  return (
    <a className={`ix ${w ? 'w' : ''}`} href={href} onClick={onPick}>
      <i className="ix-d" aria-hidden="true" />
      <span className="ix-t">
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      {right || null}
      <span className="ix-c" aria-hidden="true">›</span>
    </a>
  );
}

// One card. cnt is the item count; w marks a warning count; more is the footer markup.
export function InsightCard({ title, sub, cnt, w, rows, empty, more }) {
  const hasRows = Array.isArray(rows) ? rows.length > 0 : !!rows;
  return (
    <div className="card ig">
      <div className="ig-h">
        <div>
          <h3>{title}</h3>
          <p>{sub}</p>
        </div>
        <span className={`ig-n ${cnt ? (w ? 'w' : '') : 'z'}`} aria-label={`${cnt} item${cnt === 1 ? '' : 's'}`}>
          {cnt}
        </span>
      </div>
      <div className="ig-l">{hasRows ? rows : <p className="ig-e">{empty}</p>}</div>
      {more || null}
    </div>
  );
}
