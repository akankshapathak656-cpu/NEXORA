// App layout: sidebar, top bar, workflow stepper, page body and prev/next links.
// Port of legacy shell() (app.js lines 156-161) and the top-bar and profile-menu markup.
import { useEffect, useState } from 'react';
import { useAppState, setState } from '../store/state.js';
import { candidatesFromState, pendingCount } from '../store/candidates.js';
import { NAV_GROUPS, PAGE_LABELS } from '../data/nav.js';
import { WF } from '../data/workflow.js';
import { allJobs } from '../store/context.js';
import { loadAiConfig } from '../store/actions.js';
import { rankAll } from '../lib/scoring.js';
import { go } from '../routes.js';
import { PAGES } from '../pages/index.js';
import { Plate } from '../components/ui/Plate.jsx';
import { Icon } from '../components/ui/Icon.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { Stepper } from '../components/ui/Stepper.jsx';
import { Footer } from '../components/ui/Footer.jsx';
import CompareModal from '../components/CompareModal.jsx';
import AnalysisOverlay from '../components/AnalysisOverlay.jsx';
import { revealOnScroll } from '../components/revealOnScroll.js';

// Port of legacy pickDec(): the best-ranked compared candidate becomes the decision candidate.
function pickDecisionFrom(state, candidates, job) {
  if (!state.cmp.length) return;
  const list = state.cmp.map(i => candidates[i]).filter(Boolean);
  const best = rankAll(list, job.req, job)[0];
  if (best) setState({ sel: best.id });
}

export default function AppShell({ route }) {
  const state = useAppState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const candidates = candidatesFromState(state);
  const jobs = allJobs(state);
  const job = jobs[state.job] || jobs[0];
  const Page = PAGES[route] || PAGES.dashboard;
  const stepIndex = WF.findIndex(w => w[0] === route);
  const prev = stepIndex > 0 ? WF[stepIndex - 1] : null;
  const next = stepIndex >= 0 && stepIndex < WF.length - 1 ? WF[stepIndex + 1] : null;

  // Re-run after every render so newly shown panels reveal on scroll.
  useEffect(() => revealOnScroll(document.getElementById('m')));

  useEffect(() => {
    loadAiConfig();
  }, []);

  useEffect(() => {
    document.title = 'NEXORA | ' + (PAGE_LABELS[route] || 'Shortlists you can explain');
  }, [route]);

  // Escape closes the drawer, the menu, or the compare modal, as legacy did.
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return;
      if (state.cm) setState({ cm: 0 });
      else setDrawerOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.cm]);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    setState({ thm: next });
  };

  const onSearch = e => {
    e.preventDefault();
    const q = e.currentTarget.elements.gs.value;
    setState({ q, page: 0, sf: 'All', stf: null, role: 'All', min: 0 });
    if (route !== 'cands') go('cands');
  };

  const signOut = () => {
    setState({ auth: 0 });
    go('login');
  };

  const pickDecision = () => pickDecisionFrom(state, candidates, job);
  const pending = pendingCount(candidates, state.status);

  return (
    <div className={'app' + (drawerOpen ? ' open' : '')}>
      <aside className="side" aria-label="Primary">
        <Plate height={76} />
        {NAV_GROUPS.map(([group, items]) => (
          <div key={group}>
            <p className="gl">{group}</p>
            {items.map(([key, label, icon]) => (
              <a key={key} href={'/' + key} aria-current={key === route ? 'page' : undefined}>
                <Icon name={icon} />
                {label}
              </a>
            ))}
          </div>
        ))}
        <div className="sp" />
        <a href="/admin" aria-current={route === 'admin' ? 'page' : undefined}>
          <Icon name="cog" />Settings
        </a>
        <button className="lo" onClick={signOut}>
          <Icon name="out" />Sign out
        </button>
      </aside>
      <div className="scrim" onClick={() => setDrawerOpen(false)} />

      <div className="main">
        <div className="tbar">
          <button className="ib burger" aria-label="Open menu" onClick={() => setDrawerOpen(o => !o)}>
            <Icon name="menu" />
          </button>
          <form role="search" onSubmit={onSearch}>
            <label className="sr" htmlFor="gs" style={{ position: 'absolute', left: -9999 }}>Search candidates</label>
            <Icon name="search" />
            <input id="gs" name="gs" type="search" placeholder="Search candidates or skills…" defaultValue={state.q} />
          </form>
          <div className="sp" />
          <span className={(state.aiConfig && state.aiConfig.ai_enabled ? 'chip ok' : 'chip tr') + ' pn'}>
            {state.aiConfig
              ? state.aiConfig.ai_enabled
                ? 'AI live · ' + (state.aiConfig.model || 'LLM')
                : 'Backend heuristic mode'
              : 'Demo mode · connecting…'}
          </span>
          <button className="ib" aria-label="Switch light or dark theme" onClick={toggleTheme}>Theme</button>
          <a className="ib" href="/cands" aria-label={`Notifications: ${pending} candidates awaiting review`}>
            Review{pending ? <b>{pending}</b> : null}
          </a>
          <div className="pm">
            <button className="pbtn" aria-haspopup="menu" aria-expanded={menuOpen} onClick={e => { e.stopPropagation(); setMenuOpen(o => !o) }}>
              <Avatar name={state.set.name} size={34} />
              <span className="pn">{state.set.name}</span>
              <span aria-hidden="true">▾</span>
            </button>
            <div className="pd" role="menu" hidden={!menuOpen}>
              <a role="menuitem" href="/admin">Profile</a>
              <a role="menuitem" href="/admin">Account &amp; privacy</a>
              <button role="menuitem" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </div>

        <main id="m" tabIndex={-1}>
          <Stepper current={route} jobTitle={job.t} steps={WF} onPickDecision={pickDecision} />
          <Page route={route} candidates={candidates} job={job} />
          {stepIndex >= 0 ? (
            <div className="row nx">
              {prev ? <a className="btn sm" href={'/' + prev[0]}>← {prev[1]}</a> : <span />}
              {next ? (
                <a className="btn p sm" href={'/' + next[0]}>Next: {next[1]} →</a>
              ) : (
                <a className="btn p sm" href="/dashboard">Finish →</a>
              )}
            </div>
          ) : null}
        </main>
        <Footer />
      </div>
      {state.cm ? <CompareModal /> : null}
      <AnalysisOverlay />
    </div>
  );
}
