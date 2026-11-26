// Legacy: chips(a, k) renders one `chip <k>` span per item, or "None found" when the list is empty.

export function Chip({ children, kind, title }) {
  return (
    <span className={kind ? `chip ${kind}` : 'chip'} title={title}>
      {children}
    </span>
  );
}

export function ChipList({ items, kind, emptyText = 'None found' }) {
  if (!items || !items.length) {
    return <span className="chip">{emptyText}</span>;
  }
  return (
    <>
      {items.map((x, i) => (
        <Chip key={`${i}-${x}`} kind={kind}>
          {x}
        </Chip>
      ))}
    </>
  );
}
