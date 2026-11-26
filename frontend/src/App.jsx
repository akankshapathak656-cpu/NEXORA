// Root component. Replaces the legacy script loader. Routing and the sign-in guard follow legacy render() (app.js line 1294).
import { useEffect } from 'react';
import { useAppState, setState } from './store/state.js';
import { useRoute, useClientLinks, go, PUBLIC_ROUTES, LEGAL_ROUTES } from './routes.js';
import { ToastProvider } from './components/ui/Toast.jsx';
import AppShell from './shell/AppShell.jsx';
import { PUBLIC_PAGES } from './pages/index.js';

export default function App() {
  const route = useRoute();
  useClientLinks();
  const auth = useAppState(s => s.auth);
  const theme = useAppState(s => s.thm);

  useEffect(() => {
    document.documentElement.dataset.theme = theme || 'light';
  }, [theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  // Sign-in guard. Unauthenticated users are sent to login, remembering where they were going (state.next).
  // Signed-in users who open login are sent to the dashboard.
  useEffect(() => {
    if (route && route !== 'login' && !LEGAL_ROUTES.includes(route) && !auth) {
      setState({ next: route });
      go('login');
    } else if (route === 'login' && auth) {
      go('dashboard');
    }
  }, [route, auth]);

  let body;
  if (PUBLIC_ROUTES.includes(route) && (route === '' || route === 'login' || LEGAL_ROUTES.includes(route))) {
    const Public = PUBLIC_PAGES[route] || PUBLIC_PAGES[''];
    body = <Public route={route} />;
  } else if (auth) {
    body = <AppShell route={route} />;
  } else {
    body = null; // the guard above is redirecting to login
  }

  return (
    <ToastProvider>
      {/* Shared SVG gradients referenced as url(#gd) and url(#ga) by the charts. Ported from legacy index.html. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="gd">
            <stop offset="0" style={{ stopColor: 'var(--a)' }} />
            <stop offset="1" style={{ stopColor: 'var(--a)' }} />
          </linearGradient>
          <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--a)' }} stopOpacity=".25" />
            <stop offset="1" style={{ stopColor: 'var(--a)' }} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      {body}
    </ToastProvider>
  );
}

