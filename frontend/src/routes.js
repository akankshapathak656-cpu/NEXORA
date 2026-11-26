// Path routing (/dashboard, /match, ...). The root path '/' is the landing page.
// Built in, with no router dependency: the app has a fixed set of routes and a handful of navigation calls.
// Served as a single-page app: Vite serves index.html for unknown paths in dev and preview, and vercel.json
// rewrites every path to index.html in production.
import { useEffect, useState } from 'react';
import { APP_PAGES } from './data/nav.js';

export const LEGAL_ROUTES = ['terms', 'privacy'];
export const PUBLIC_ROUTES = ['', 'login', ...LEGAL_ROUTES];

// Maps a pathname to a route key. Unknown paths fall back to the landing page, as the legacy hash router did.
export function routeFromPath(pathname) {
  const key = String(pathname || '').replace(/^\/+|\/+$/g, '');
  return PUBLIC_ROUTES.includes(key) || APP_PAGES.includes(key) ? key : '';
}

export function pathFor(route) {
  return route ? '/' + route : '/';
}

// Current route key, kept in sync with the address bar (back and forward included).
export function useRoute() {
  const [route, setRoute] = useState(() => routeFromPath(window.location.pathname));
  useEffect(() => {
    const onChange = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);
  return route;
}

// Programmatic navigation. Pushes the path and notifies useRoute listeners.
export function go(route) {
  const path = pathFor(route);
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

// Plain <a href="/dashboard"> links inside the app navigate without a page reload.
// Modified clicks (new tab, middle button) and links with a target keep the browser's default behaviour.
export function useClientLinks() {
  useEffect(() => {
    const onClick = e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!a || a.target || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      e.preventDefault();
      go(routeFromPath(href));
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
