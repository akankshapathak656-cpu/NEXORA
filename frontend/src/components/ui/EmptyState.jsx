// Legacy empty states are a plain <p>; the CSS (p.s3-empty) styles it and the
// legacy empties() pass only skips <p> elements that already carry this class.
// `title` is the message; `children` are optional inline extras.

export function EmptyState({ title, children }) {
  return (
    <p className="s3-empty">
      {title}
      {children}
    </p>
  );
}
