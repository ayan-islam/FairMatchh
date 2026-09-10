import { request, type ApplicationInput, type Receipt } from "./api";
import type { Candidate } from "./demo-data";
export type User = {
  id: string;
  username: string;
  name: string;
  contact: string;
  role: "EMPLOYER" | "CANDIDATE" | "ADMIN";
  organizationId?: string;
};
export type Organization = {
  id: string;
  name: string;
  industry: string;
  location: string;
  website: string;
  contact: string;
  status: string;
  reviewReason: string;
  submittedAt: string;
  version: number;
};
export type Member = {
  name: string;
  email: string;
  role: string;
  status: string;
};
export type Profile = {
  role: string;
  experience: string;
  education: string;
  skills: string[];
};
export type OwnApplication = {
  jobTitle: string;
  id: string;
  jobId: string;
  stage: string;
  appliedAt: string;
  role: string;
  experience: string;
  education: string;
  skills: string[];
  example: string;
};
export type Notice = {
  id: string;
  title: string;
  message: string;
  reference: string;
  createdAt: string;
  read: boolean;
};
export type SupportCase = {
  id: string;
  subject: string;
  category: string;
  reference: string;
  status: string;
  detail: string;
  response: string;
  createdAt: string;
  version: number;
};
export type CaseInput = Pick<
  SupportCase,
  "subject" | "category" | "reference" | "detail"
>;
export type RawAudit = {
  id: string;
  action: string;
  reference: string;
  at: string;
  detail?: string;
  actor?: string;
};
export const platformApi = {
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>("public/auth/login", "POST", {
      username,
      password,
    }),
  register: (input: {
    username: string;
    password: string;
    contact: string;
    name: string;
    role: string;
    organizationName: string;
  }) =>
    request<{ token: string; user: User }>(
      "public/auth/register",
      "POST",
      input,
    ),
  me: (auth: string) => request<User>("account/me", "GET", undefined, auth),
  organization: (auth: string) =>
    request<Organization>("employer/organization", "GET", undefined, auth),
  saveOrganization: (org: Organization, auth: string) =>
    request<Organization>(
      "employer/organization",
      "PUT",
      {
        name: org.name,
        industry: org.industry,
        location: org.location,
        website: org.website,
        expectedVersion: org.version,
      },
      auth,
    ),
  members: (auth: string) =>
    request<Member[]>("employer/members", "GET", undefined, auth),
  notices: (auth: string) =>
    request<Notice[]>("account/notifications", "GET", undefined, auth),
  readNotice: (id: string, auth: string) =>
    request(
      `account/notifications/${encodeURIComponent(id)}/read`,
      "POST",
      {},
      auth,
    ),
  cases: (auth: string) =>
    request<SupportCase[]>("account/cases", "GET", undefined, auth),
  createCase: (input: CaseInput, auth: string) =>
    request<SupportCase>("account/cases", "POST", input, auth),
  profile: async (auth: string) => {
    const {role,experience,education,skills}=await request<Profile>("candidate/profile", "GET", undefined, auth);
    return {role,experience,education,skills};
  },
  saveProfile: (input: Profile, auth: string) =>
    request<Profile>("candidate/profile", "PUT", {role:input.role,experience:input.experience,education:input.education,skills:input.skills}, auth),
  applications: (auth: string) =>
    request<OwnApplication[]>("candidate/applications", "GET", undefined, auth),
  apply: (jobId: string, input: ApplicationInput, auth: string) =>
    request<Receipt>(
      `candidate/jobs/${encodeURIComponent(jobId)}/applications`,
      "POST",
      input,
      auth,
    ),
  draft: (jobId: string, auth: string) =>
    request<{ values: Partial<ApplicationInput> }>(
      `candidate/drafts/${encodeURIComponent(jobId)}`,
      "GET",
      undefined,
      auth,
    ),
  saveDraft: (jobId: string, input: Partial<ApplicationInput>, auth: string) =>
    request(
      `candidate/drafts/${encodeURIComponent(jobId)}`,
      "PUT",
      input,
      auth,
    ),
  withdraw: (id: string, auth: string) =>
    request(
      `candidate/applications/${encodeURIComponent(id)}/withdrawal`,
      "POST",
      {},
      auth,
    ),
  organizations: (auth: string) =>
    request<Organization[]>("admin/organizations", "GET", undefined, auth),
  reviewOrganization: (
    org: Organization,
    status: string,
    reason: string,
    auth: string,
    reviewedDocumentIds: string[] = [],
  ) =>
    request<Organization>(
      `admin/organizations/${encodeURIComponent(org.id)}/review`,
      "POST",
      { status, reason, reviewed: true, expectedVersion: org.version, reviewedDocumentIds },
      auth,
    ),
  allCases: (auth: string) =>
    request<SupportCase[]>("admin/cases", "GET", undefined, auth),
  reviewCase: (
    item: SupportCase,
    status: string,
    reason: string,
    auth: string,
  ) =>
    request<SupportCase>(
      `admin/cases/${encodeURIComponent(item.id)}/review`,
      "POST",
      { status, reason, expectedVersion: item.version },
      auth,
    ),
  audit: (auth: string) =>
    request<RawAudit[]>("admin/audit", "GET", undefined, auth),
  reviewEvidence: (
    candidate: Candidate,
    band: string,
    reason: string,
    auth: string,
  ) =>
    request<Candidate>(
      `employer/applications/${encodeURIComponent(candidate.id)}/review`,
      "POST",
      { band, expectedBand: candidate.band, reason },
      auth,
    ),
  requestInformation: (id: string, message: string, auth: string) =>
    request(
      `employer/applications/${encodeURIComponent(id)}/information-request`,
      "POST",
      { message },
      auth,
    ),
};
