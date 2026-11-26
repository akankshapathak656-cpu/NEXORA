// Scoring weights. Seven components; a component is used only when the selected job states what it needs,
// and the weights of the used components are rescaled to 100 (see score() in lib/scoring.js).
// Each entry: [label, weight].
export const WT = { req: ['Required skills', 40], pref: ['Preferred skills', 10], exp: ['Relevant experience', 20], edu: ['Education', 10], proj: ['Project experience', 10], resp: ['JD responsibilities', 5], ctx: ['Use in work experience', 5] };

// Credit per skill tier: D stated or demonstrated, E same, M listed only (half), X listed only (half), I inferred, N not found.
export const CRED = { D: 1, E: 1, M: .5, X: .5, I: 0, N: 0 };

// Default years of experience for full marks in the experience component when the job states no minimum.
export const XCAP = 5;

// Share of experience credit given to a candidate whose listed years have no dated work entries to confirm.
export const UNVER = .5;

// Hidden-fit rule: weak for the selected job (score below max), at least gap points higher for another role,
// and at least cov of that role's requirements evidenced.
export const HF = { max: 65, gap: 15, cov: .5 };
