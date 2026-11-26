// Scroll reveal for elements with the .rv class. The stylesheet hides .rv until it gets the .in class.
// Port of the legacy watch() observer (app.js line 1496). Reduced motion shows everything at once, as legacy did.
export function revealOnScroll(root) {
  if (!root) return () => {};
  const pending = [...root.querySelectorAll('.rv:not(.in)')];
  if (!pending.length) return () => {};
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    pending.forEach(el => el.classList.add('in'));
    return () => {};
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.04, rootMargin: '0px 0px -4% 0px' });
  pending.forEach(el => io.observe(el));
  return () => io.disconnect();
}
