// Backend calls. Port of legacy API / apiRequest (app.js lines 167-186).
// Resume text (PDF, DOCX) is extracted on the server; nothing else is read by the browser.
export const API_BASE = import.meta.env.VITE_API_BASE ?? '';

// FastAPI errors arrive as JSON: { "detail": string } or { "detail": [{ "msg": ... }] } for validation errors.
// Returns the readable message, falling back to the raw body or the status code.
async function errorMessage(response, fallback) {
  const body = await response.text();
  try {
    const detail = JSON.parse(body).detail;
    if (typeof detail === 'string' && detail) return detail;
    if (Array.isArray(detail) && detail.length) return detail.map(d => d.msg || String(d)).join('; ');
  } catch { /* not JSON */ }
  return body || fallback;
}

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'API request failed (' + response.status + ')'));
  }
  return response.status === 204 ? null : response.json();
}

// Sends one PDF or DOCX file to the backend. Resolves to { text, pages }.
export async function extractResume(file) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(API_BASE + '/api/resumes/extract', { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'Resume extraction failed (' + response.status + ')'));
  }
  return response.json();
}

export const createJob = (payload, upsert = false) =>
  request('/api/jobs' + (upsert ? '?upsert=true' : ''), { method: 'POST', body: JSON.stringify(payload) });

export const createCandidate = (payload, upsert = false) =>
  request('/api/candidates' + (upsert ? '?upsert=true' : ''), { method: 'POST', body: JSON.stringify(payload) });

export const updateCandidateStatus = (apiId, status) =>
  request('/api/candidates/' + apiId + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });

export const getAiConfig = () => request('/api/config/ai');

export const listJobs = () => request('/api/jobs');

export async function analyzeResumes(jobId, files, includeOverview = true) {
  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  const response = await fetch(
    `${API_BASE}/api/jobs/${jobId}/analyze?include_overview=${includeOverview ? 'true' : 'false'}`,
    { method: 'POST', body: form },
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response, 'Resume analysis failed (' + response.status + ')'));
  }
  return response.json();
}

export const scoreCandidateApi = (jobId, candidateId, force = false) =>
  request(`/api/jobs/${jobId}/score/${candidateId}?force=${force ? 'true' : 'false'}`, { method: 'POST' });

export const getJobAnalyses = jobId => request(`/api/jobs/${jobId}/analyses`);

export const getJobOverview = (jobId, force = false) =>
  request(`/api/jobs/${jobId}/overview?force=${force ? 'true' : 'false'}`, { method: 'POST' });
