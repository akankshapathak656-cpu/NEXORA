import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Legacy: toast(m) writes into #tt and clears it after 2600 ms.
// State lives in ToastProvider (no globals). Mount ToastProvider once, high in the tree
// (the app shell). Any descendant calls `const toast = useToast(); toast('Saved');`.
// The #tt region is rendered by the provider itself, so only one region exists.

const TOAST_MS = 2600;
const ToastContext = createContext(null);

export function Toast({ message = '' }) {
  return (
    <div id="tt" role="status" aria-live="polite">
      {message ? <div className="tt">{message}</div> : null}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef(null);

  const toast = useCallback((m) => {
    clearTimeout(timer.current);
    setMessage(String(m));
    timer.current = setTimeout(() => {
      timer.current = null;
      setMessage('');
    }, TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast message={message} />
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
