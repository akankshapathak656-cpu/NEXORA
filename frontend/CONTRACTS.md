# NEXORA frontend port: shared contracts

Source of truth for behaviour: `public/legacy/app.js` (the legacy app) and `src/legacy/styles.css` (styles, unchanged).
Line 1 of `app.js` is a base64 logo: skip it when reading (`sed -n '2,$p'` or grep).
The root `index.html` stays untouched until the port is complete.

## Rules for every module

1. ES modules only. Named exports. No `window.*` assignments, no implicit globals, no `eval`/`new Function`.
2. No `innerHTML` and no inline `onclick="..."` strings. Use React JSX and React event handlers.
3. Keep the legacy class names in JSX so `src/legacy/styles.css` applies unchanged. Do not edit that CSS file. If a style is missing, report it.
4. `src/lib/*` must be pure: no React imports, no DOM, no `localStorage`. They take their inputs as arguments.
5. Shared state comes only from `src/store/state.js`: `useAppState(selector)` in components, `setState(patchOrUpdater)` for changes. Never mutate state objects in place.
6. Do not edit files you do not own. If you need a change in another owner's file, write it in your report instead.
7. Do not run `npm install`. Do not run `vite build` (other agents' files may be half-written). Verify your own pure modules with `node --input-type=module` against the legacy behaviour.

## Bugs

Fix a bug when porting a function if the legacy code crashes, gives a wrong result against its own comments or obvious intent, or leaves a dead reference. Scoring must match the legacy output exactly except for documented bug fixes. For each fix, record in your report: the legacy line, what was wrong, and what changed. Do not make unrelated improvements.

## Data shapes

**Job** (`JOBS` entries): `{ t: string, req: string[], d: string, jd?: ParsedJD, ...}`. `req` is the required-skills list. `t` is the title.

**Candidate**: the fields the legacy `persist()` stores: `{ id, real (name), n (display name when blind review is off), ed, ex (experience text, e.g. "3 yrs"), r (role), pr (project text), sk (skills string[]), em, ph, lo, cert[], wk[], an (analysis or null), apiId, st (status), file? }`.
- Sample candidates have `id < NS` (`NS` = number of samples). Added candidates have `id >= NS`.
- Display name rule: when `set.blind` is on, show `'Candidate ' + (id + 1)`, otherwise the real name. Implement this as a function (`displayName(c, set)`), not a getter.

**Analysis** (`c.an`): the normalized resume analysis object, built in `lib/resume.js`. Scoring reads it. An analysis is valid when `anOk(an)` is true.

**Scores are never stored.** Compute them with `score()` from the candidate, the requirement list, the job, and the analysis.

## Store (`src/store/state.js`, owner: lead)

`useAppState(s => s.job)`, `setState({ job: 2 })`, `setState(s => ({ ...s, sel: 4 }))`, `resetState()`.
Persisted keys, same localStorage key `nexora.v2` as legacy: `status, dup, jd, set, logs, auth, job, jobs, thm, alt, chk, hr, fix, add, ob, rec, jdd, sl`.
Sample-candidate edits and additions live in `fix` (by id) and `add` (by id minus NS). Keep that layout.

## Folder layout and ownership

| Path | Owner | Contents |
|---|---|---|
| `src/store/state.js` | lead (done) | state store |
| `src/data/*.js` | Wave 1 A | `JOBS`, `SAMPLE_CANDIDATES`, `NS`, `XR`, `TRX`, `AL`, `VOC`, `SKA`, `RD`-style role maps, `WT`, `CRED`, `HF`, `LOGO` (as an exported string) |
| `src/lib/scoring.js` | Wave 1 A | `score(c, requirements, job)`, `sco`, `fit`, `mm`, `pm`, `prRel`, `cmpS`, `rankAll`, `rolesFor`, `hidden`, `ev`, `prTxt`, `brk`, `valid`, `yrs` |
| `src/lib/text.js` | Wave 1 A | `clean`, `parseEx`, `canon`, `ini`, `escapeText` (only if still needed), `d1`, `pct` |
| `src/lib/jd.js` | Wave 1 B | `parseJD`, `jdHead`, `jdCat`, `jdLineSkills`, `jdExp`, `jdEdu`, `jdTitle`, `jdSummary`, `JDH`, `JSMALL`, `JDMAX`, `JDMIN`, `JDDESC` |
| `src/lib/resume.js` | Wave 1 C | `anOk`, `anGet`, `respMatch`, `mergeMo`, `eduFit`, `degs`, `persistRecord(c)` (returns the record to store, does not write), `sampleFiles`, `runAnalysis` pure parts |
| `src/components/ui/*.jsx` | Wave 1 D | `Avatar`, `Chip`, `Bar`, `Toast` (+ `useToast`), `Stepper`, `Plate`, `Footer`, `PublicNav`, `PublicFooter`, `Icon`, `EmptyState` |
| `src/shell/*.jsx` | lead | `AppShell` (sidebar, top bar, hash routing) |
| `src/pages/*.jsx` | Wave 2 | one file per screen |

Wave 2 (pages) starts after Wave 1 is merged. Pages import only from the modules above.

## Routing

Hash routing, same as legacy: `#login`, `#dashboard`, `#upload`, `#match`, `#gap`, `#roles`, `#trends`, `#dups`, `#comms`, `#cands`, `#profile`, `#work`, `#admin`, `#terms`, `#privacy`, `#landing`. Owned by the lead.

## Wave 1 final signatures (as built)

Read these before writing pages. They supersede the table above where they differ.

- `src/data/`: `LOGO` (logo.js), `JOBS` (jobs.js), `XR`, `RD(jobs)` (roles.js), `SAMPLE_CANDIDATES`, `NS` (samples.js), `TRX`, `AL`, `SKA`, `VOC` (skills.js, built-in only), `WT`, `CRED`, `XCAP`, `UNVER`, `HF` (weights.js), `WF` (workflow.js).
- `src/lib/text.js`: `clean`, `parseEx`, `canon(x, vocab, aliases)`, `vocabulary(candidates)`, `ini`, `displayName(c, set)`, `d1`, `pct`.
- `src/lib/scoring.js`:
  - `score(c, q, job, ctx)`, `sco`, `fit` take the same `(c, q, job, ctx)`.
  - `ctx` is the resume context from `lib/resume.js`: `{ job, skills, jobs, xr, candidates, ns }`. Pass it so a stale analysis is rebuilt for the job being scored. Without `ctx`, the stored `c.an` is used as is.
  - `cmpS(a, b, q, job, ctx)`, `rankAll(list, q, job, ctx)`, `rankMap(list, q, job, ctx)`.
  - `rolesFor(c, jobs)`, `hidden(candidates, job, status, jobs)`, `valid`, `yrs`, `mm`, `pm`, `prRel`, `ev`, `prTxt`, `brk`.
- `src/lib/resume.js`:
  - `anGet(c, ctx)` returns the analysis to use. It does not assign `c.an`. The caller stores the result.
  - `anOk`, `anBuild`, `respMatch`, `mergeMo`, `eduFit`, `degs`, `persistRecord(c, ns)`, `persistTarget`, `sampleFiles(candidates, ns)`, `parseResume(text, ctx, meta)`, `resumeDraft(P, fileName, ctx)`, `skillDict(ctx)`, `findSkills`.
  - Parsing takes text only. PDF and DOCX extraction goes through the backend (`/api/resumes/extract`), which is the page or API layer's job.
- `src/lib/jd.js`: `parseJD(raw, skills)` and `jdLineSkills(t, list, skills)` take `skills = { findSkills(text, skillsText), canon(name) }`. `jdSummary(j)` returns a view model, not HTML. `EXPRE` is exported for the submit step.
- UI components (`src/components/ui/`):
  - `Avatar({ name, size })`
  - `Chip({ children, kind, title })`, `ChipList({ items, kind, emptyText })`
  - `Bar({ value, label })`
  - `ToastProvider({ children })` and `useToast()`. The shell wraps the app in `ToastProvider`. Remove the static `<div id="tt">` from the shell once the port is complete.
  - `Stepper({ current, jobTitle, steps, onPickDecision })`
  - `Plate({ height, href })`
  - `Footer()`, `PublicFooter()`
  - `PublicNav({ signedIn, onSectionLink })`
  - `Icon({ name })` (only `menu` so far)
  - `EmptyState({ title, children })`

## Known gaps for the lead and the page wave

- The base skill dictionary (legacy SKD, lines 506-527) is not in `src/data/`. It is passed through `ctx.skills`. Export it from `src/data/skills.js` or build it with `skillDict(ctx)`.
- The custom job-description submit step (legacy lines 310-318) and the analysis edit actions (`setField`, `anEval`) are not ported yet. They belong to the page wave.
- The PDF and DOCX reading in `analyse()` is not ported. It goes through the backend.

## Wave 2: pages (as built by the lead)

- Routes and the sign-in guard: `src/routes.js` and `src/App.jsx`. Shell: `src/shell/AppShell.jsx`.
- The shell renders app pages as `<Page route candidates job />`. Props: `route` (route key), `candidates` (full list from `useCandidates()`), `job` (the current job object, `JOBS[state.job]`).
- Public pages render as `<Public route />`.
- Pages are registered in `src/pages/index.js` by the lead. Each page file exports a **default** component. Do not edit `index.js`.
- Read state with `useAppState(selector)`. Change it with `setState(patch)`. Get candidates with `useCandidates()`. Navigate with `go(routeKey)` from `src/routes.js`.
- Do not create new global state, new stores, or `window` assignments. Page-private state uses `useState`.
- The analysis-rebuild context for `score()`, `sco()`, `cmpS()`, and `anGet()` is the `ctx` object from `lib/resume.js`. Build it in your page with the job and the candidate list.
- Shared helpers: a page that needs a helper used by two pages puts it in `src/lib/` (pure) or `src/components/`, and tells the lead. Do not duplicate it.
- Legacy inline `onclick` strings become React handlers. Legacy `render()` calls become state updates, because React re-renders on `setState`.
- Keep the legacy class names and markup so `src/legacy/styles.css` applies.
