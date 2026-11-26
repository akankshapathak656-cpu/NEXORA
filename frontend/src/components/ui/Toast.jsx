import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Legacy: toast(m) writes into #tt and clears it after 2600 ms.
// Classifies messages into ok / er / in (legacy app.js L1695-1696), shakes on error,
// and animates exit with .s3-out before clearing.

const TOAST_MS = 2600;
const EXIT_MS = 280;
const ERR_RE = /cannot be empty|^enter |^use a format|^add at least|^no valid|^compare up to|^name is required|names are hidden|marked rejected|already exists|could not|invalid|failed|rejected\./i;
const OK_RE = /saved|added to|created|updated|sent|removed|approved|simulated send|: (shortlisted|interview|hired|rejected|needs review)|: (on|off)$/i;
const SHAKE_KF = [
  { transform: 'translateX(0)' },
  { transform: 'translateX(-6px)' },
  { transform: 'translateX(5px)' },
  { transform: 'translateX(-3px)' },
  { transform: 'translateX(2px)' },
  { transform: 'translateX(0)' },
];

const ToastContext = createContext(null);

export function classifyToast(msg) {
  const text = String(msg || '');
  if (ERR_RE.test(text)) return 'er';
  if (OK_RE.test(text)) return 'ok';
  return 'in';
}

export function Toast({ message = '', kind, exiting = false, toastKey = 0 }) {
  const elRef = useRef(null);
  const tone = kind || classifyToast(message);

  useEffect(() => {
    if (!message || tone !== 'er' || exiting) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !elRef.current || typeof elRef.current.animate !== 'function') return;
    try {
      elRef.current.animate(SHAKE_KF, {
        duration: 380,
        delay: 320,
        easing: 'cubic-bezier(.2,.8,.2,1)',
      });
    } catch {
      // Ignore WAAPI errors in unsupported environments.
    }
  }, [message, tone, exiting, toastKey]);

  return (
    <div id="tt" role="status" aria-live="polite">
      {message ? (
        <div
          key={toastKey}
          ref={elRef}
          className={`tt ${tone}${exiting ? ' s3-out' : ''}`}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [item, setItem] = useState({ message: '', kind: 'in', exiting: false, id: 0 });
  const timer = useRef(null);
  const exitTimer = useRef(null);
  const seq = useRef(0);

  const toast = useCallback((m) => {
    clearTimeout(timer.current);
    clearTimeout(exitTimer.current);
    const text = String(m);
    const kind = classifyToast(text);
    const id = ++seq.current;
    setItem({ message: text, kind, exiting: false, id });

    timer.current = setTimeout(() => {
      timer.current = null;
      const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        setItem({ message: '', kind: 'in', exiting: false, id });
        return;
      }
      setItem((cur) => (cur.id === id ? { ...cur, exiting: true } : cur));
      exitTimer.current = setTimeout(() => {
        exitTimer.current = null;
        setItem((cur) => (cur.id === id ? { message: '', kind: 'in', exiting: false, id } : cur));
      }, EXIT_MS);
    }, TOAST_MS);
  }, []);

  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(exitTimer.current);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        message={item.message}
        kind={item.kind}
        exiting={item.exiting}
        toastKey={item.id}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() must be used inside <ToastProvider>');
  }
  return ctx.toast;
}
