// Page registry. One entry per route key. Pages receive { route, candidates, job } from AppShell.
import Dashboard from './Dashboard.jsx';
import Upload from './Upload.jsx';
import Match from './Match.jsx';
import Gap from './Gap.jsx';
import Roles from './Roles.jsx';
import Trends from './Trends.jsx';
import Dups from './Dups.jsx';
import Comms from './Comms.jsx';
import Cands from './Cands.jsx';
import Profile from './Profile.jsx';
import Work from './Work.jsx';
import Admin from './Admin.jsx';
import { Landing, Login, Legal } from './public/index.js';

export const PAGES = {
  dashboard: Dashboard,
  upload: Upload,
  match: Match,
  roles: Roles,
  gap: Gap,
  trends: Trends,
  dups: Dups,
  comms: Comms,
  cands: Cands,
  profile: Profile,
  work: Work,
  admin: Admin,
};

// Public routes. Legal pages share one component and get the route as a prop.
export const PUBLIC_PAGES = {
  '': Landing,
  login: Login,
  terms: Legal,
  privacy: Legal,
};
