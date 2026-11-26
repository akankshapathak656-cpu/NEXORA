// Sidebar navigation groups. Port of legacy `const G` (app.js line 99).
// Each entry: [routeKey, label, iconName]. Icon names without an icon render nothing, as in legacy.
export const NAV_GROUPS = [
  ['Overview', [['dashboard', 'Dashboard', 'dash']]],
  ['Recruiter workflow', [
    ['upload', '1 · Job & resumes', 'file'],
    ['match', '2 · Candidate analysis', 'match'],
    ['roles', '3 · Other role matches', 'roles'],
    ['cands', '4 · Compare candidates', 'users'],
    ['profile', '5 · Final decision', 'check'],
  ]],
  ['Insights', [
    ['gap', 'Skill gap', 'gap'],
    ['trends', 'Skill trends & JD', 'trend'],
    ['dups', 'Duplicate detection', 'dup'],
    ['work', 'Workforce intelligence', 'work'],
  ]],
  ['Communication', [['comms', 'Outreach', 'mail']]],
];

// Route key -> page title, from legacy LBL plus the settings page. Used for the document title and routing.
export const PAGE_LABELS = Object.fromEntries([
  ...NAV_GROUPS.flatMap(([, items]) => items.map(([key, label]) => [key, label])),
  ['admin', 'Settings'],
  ['profile', 'Final decision'],
]);

// Pages that need a signed-in user. Public routes are handled in src/routes.js.
export const APP_PAGES = Object.keys(PAGE_LABELS);
