import type { Candidate, Job, Stage, AuditEvent, Interview } from "./demo-data";
export type InterviewInput = Pick<Interview, "candidateId" | "date" | "time" | "format" | "location">;
export type ApplicationInput = { name: string; contact: string; role: string; experience: string; education: string; skills: string[]; example: string; availability: string; location: string; consent: boolean; evidenceConfirmed: boolean; finalConsent: boolean; };
export type Receipt = { id: string; jobId: string; status: string; submittedAt: string };
export const AUTH_KEY = "fairmatch.employer.auth";
export async function request<T>(path: string, method = "GET", body?: unknown, auth?: string): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/${path}`, { method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", ...(auth ? { Authorization: auth.startsWith("Bearer ") ? auth : `Basic ${auth}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
  catch { throw new Error("Cannot reach the backend. Run START_FAIRMATCH.cmd and try again."); }
  if (!response.ok) { const error = await response.json().catch(() => ({})); const details = error.fields ? Object.entries(error.fields).map(([field, message]) => `${field}: ${message}`).join("; ") : ""; throw new Error(response.status === 401 ? "Your session is missing or expired. Sign in again." : details || error.message || `Request failed (${response.status}). Please try again.`); }
  return response.json();
}
export const api = {
  interviews: (auth: string) => request<Interview[]>("employer/interviews", "GET", undefined, auth),
  scheduleInterview: (input: InterviewInput, auth: string, existing?: Interview) => request<Interview>(`employer/interviews${existing ? `/${encodeURIComponent(existing.id)}` : ""}`, existing ? "PUT" : "POST", { ...input, ...(existing ? { expectedVersion: existing.version } : {}) }, auth),
  evaluateInterview: (interview: Interview, scores: number[], notes: string, auth: string) => request<Interview>(`employer/interviews/${encodeURIComponent(interview.id)}/evaluation`, "POST", { scores, notes, expectedVersion: interview.version }, auth),
  cancelInterview: (interview: Interview, reason: string, auth: string) => request<Interview>(`employer/interviews/${encodeURIComponent(interview.id)}/cancellation`, "POST", { reason, expectedVersion: interview.version }, auth),
  moveCandidate: (candidate: Candidate, stage: Stage, reason: string, auth: string) => request<Candidate>(`employer/applications/${encodeURIComponent(candidate.id)}/stage`, "PATCH", { stage, expectedStage: candidate.stage, reason }, auth),
  audit: async (auth: string): Promise<AuditEvent[]> => {
    const entries = await request<{id: string; action: string; reference: string; at: string; detail?: string; actor?: string}[]>("employer/audit", "GET", undefined, auth);
    return entries.map(e => ({ id: e.id, title: e.action.replaceAll("_", " "), detail: [e.reference, e.detail, e.actor].filter(Boolean).join(" · "), time: new Date(e.at).toLocaleString("en-GB") }));
  },
  publicJobs: () => request<Job[]>("public/jobs"),
  employerJobs: (auth: string) => request<Job[]>("employer/jobs", "GET", undefined, auth),
  applications: (auth: string) => request<Candidate[]>("employer/applications", "GET", undefined, auth),
  saveJob: (job: Job, auth: string, existing: boolean) => { const { title, department, location, workplace, salary, description, requirements, status, closes, noFeeConfirmed } = job; return request<Job>(`employer/jobs${existing ? `/${encodeURIComponent(job.id)}` : ""}`, existing ? "PUT" : "POST", { title, department, location, workplace, salary, description, requirements, status, closes, noFeeConfirmed: !!noFeeConfirmed }, auth); },
  apply: (jobId: string, input: ApplicationInput) => request<Receipt>(`public/jobs/${encodeURIComponent(jobId)}/applications`, "POST", input),
};
