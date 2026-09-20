"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, Panel, StatusBadge, EmptyState } from "./shared";
import {
  platformApi,
  type User,
  type Profile,
  type OwnApplication,
  type Notice,
  type SupportCase,
} from "@/lib/platform-api";
import { type Job, exportCsv } from "@/lib/demo-data";
import type { ApplicationInput } from "@/lib/api";
import { CandidateDocuments } from "./candidate-documents";
import { CandidatePrivacy } from "./candidate-privacy";
import { ApplicationConversation } from "./application-conversation";
import { request } from "@/lib/api";
import { toast } from "sonner";

type CandidateInterview = {
  id: string;
  candidateId: string;
  jobId: string;
  date: string;
  time: string;
  format: string;
  location: string;
  status: string;
  cancellationReason?: string;
};
const emptyProfile: Profile = {
  role: "",
  experience: "",
  education: "",
  skills: [],
};
export function CandidateWorkspace({
  auth,
  user,
  requestedId,
}: {
  auth: string;
  user: User;
  requestedId: string | null;
}) {
  const [conversation, setConversation] = useState<string | null>(null);
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [tab, setTab] = useState("Jobs");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [applications, setApplications] = useState<OwnApplication[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [visitedJobs, setVisitedJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Job | null>(null);
  const [query, setQuery] = useState("");
  const [support, setSupport] = useState(false);
  const [withdraw, setWithdraw] = useState<OwnApplication | null>(null);
  const [shareTarget, setShareTarget] = useState<OwnApplication | null>(null);
  const [caseForm, setCaseForm] = useState({
    subject: "",
    category: "Candidate appeal",
    reference: "",
    detail: "",
  });
  useEffect(() => {
    let cancelled = false;
    const scopedJobs = (requestedId
      ? platformApi.visitJob(requestedId, auth).then((job) => [job])
      : platformApi.visitedJobs(auth)
    )
      .then((value) => ({ value, error: "" }))
      .catch((e: Error) => ({ value: [] as Job[], error: e.message }));
    void Promise.all([
      platformApi.profile(auth),
      platformApi.applications(auth),
      platformApi.notices(auth),
      platformApi.cases(auth),
      request<CandidateInterview[]>(
        "candidate/interviews",
        "GET",
        undefined,
        auth,
      ),
      scopedJobs,
    ])
      .then(([p, a, n, c, i, scoped]) => {
        if (!cancelled) {
          setProfile(p);
          setApplications(a);
          setNotices(n);
          setCases(c);
          setInterviews(i);
          setVisitedJobs(scoped.value);
          setError(scoped.error);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, requestedId, revision]);
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(message);
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // A shared application link is scoped to that exact job, even if it is unavailable.
  const linkedJob = requestedId !== null;
  const visible = linkedJob
    ? visitedJobs.filter(j => j.id === requestedId)
    : visitedJobs.filter(j =>
        (j.title + " " + j.department + " " + j.location)
          .toLowerCase().includes(query.toLowerCase()),
      );
  const cvHighlightsReady = !!profile.cvSummary?.confirmedAt && !!(
    profile.cvSummary.skills?.length || profile.cvSummary.courses?.length || profile.cvSummary.projects?.length
  );
  return (
    <main className="fs-workspace" id="main-content">
      <div className="fs-heading">
        <div>
          <p className="fm-eyebrow">CANDIDATE WORKSPACE</p>
          <h1>Hello, {user.name}</h1>
          <p>Your profile, applications and updates in one place.</p>
          <p className="fm-muted">Candidate ID: <strong>{user.username}</strong></p>
        </div>
        <Button variant="outline" onClick={() => setRevision((r) => r + 1)}>
          Refresh my data
        </Button>
      </div>
      <nav className="fs-tabs" aria-label="Candidate pages">
        {[
          "Jobs",
          "My applications",
          "Profile",
          "Documents",
          "Interviews",
          "Notifications",
          "Support",
          "Privacy",
        ].map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Notifications" && notices.some((n) => !n.read)
              ? ` (${notices.filter((n) => !n.read).length})`
              : ""}
          </Button>
        ))}
      </nav>
      {tab === "Privacy" && <CandidatePrivacy auth={auth} />}
      {error && (
        <p className="fm-error" role="alert">
          {error}
        </p>
      )}
      {tab === "Jobs" && (
        <>
          {linkedJob ? (
            <div className="fs-linked-job-heading">
              <h2>Job from your link</h2>
              <p>This page shows the position you opened. Your profile and saved applications are available in the tabs above.</p>
            </div>
          ) : <>
            <div className="fs-linked-job-heading">
              <h2>Jobs from your links</h2>
              <p>Only positions you opened from an employer&apos;s shared link are saved here.</p>
            </div>
            <Field label="Search linked jobs">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Position, department or location"
              />
            </Field>
          </>}
          <div className={`fs-cards${linkedJob ? " fs-linked-job" : ""}`}>
            {visible.map((j) => (
              <Panel key={j.id}>
                <StatusBadge>{j.department}</StatusBadge>
                <h2>{j.title}</h2>
                  <p>{j.company}</p>
                <p>
                  {j.location} · {j.workplace}
                </p>
                <p>{j.salary}</p>
                <p>{j.description}</p>
                {linkedJob && j.requirements.length > 0 && <div className="fs-job-requirements"><h3>Job requirements</h3><ul>{j.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ul></div>}
                <p>Apply by {j.closes}</p>
                <Button
                  disabled={applications.some((a) => a.jobId === j.id)}
                  onClick={() => setSelected(j)}
                >
                  {applications.some((a) => a.jobId === j.id)
                    ? "Already applied"
                    : "View and apply"}
                </Button>
              </Panel>
            ))}
          </div>
          {!visible.length && (
            <EmptyState
              title={linkedJob ? "This job is unavailable" : query ? "No matching linked jobs" : "No job links visited yet"}
              description={linkedJob ? "The job may have closed or been unpublished, or the link may be incorrect. Ask the employer for an updated link." : query ? "Try another search within the jobs you opened from employer links." : "Open a job link shared by an employer. That job will then be saved in this workspace for your account."}
            />
          )}
        </>
      )}
      {tab === "My applications" && (
        <>
          <Button
            variant="outline"
            onClick={() =>
              exportCsv("my-applications.csv", [
                ["Reference", "Job", "Stage", "Submitted"],
                ...applications.map((a) => [
                  a.id,
                  a.jobTitle || visitedJobs.find((j) => j.id === a.jobId)?.title || a.role,
                  a.stage,
                  a.appliedAt,
                ]),
              ])
            }
          >
            Export my applications
          </Button>
          <div className="fs-cards">
            {applications.map((a) => (
              <Panel key={a.id}>
                <StatusBadge>{a.stage}</StatusBadge>
                <h2>{a.jobTitle || visitedJobs.find((j) => j.id === a.jobId)?.title || a.role}</h2>
                <p className="fs-reference">{a.id}</p>
                <p>Submitted {new Date(a.appliedAt).toLocaleString("en-GB")}</p>
                <ApplicationTracker stage={a.stage} />
                {a.stageReason && (
                  <p className="fs-stage-note">
                    <strong>Latest update:</strong> {a.stageReason}
                    {a.stageChangedAt ? ` · ${new Date(a.stageChangedAt).toLocaleString("en-GB")}` : ""}
                  </p>
                )}
                <p>{a.experience}</p>
                <p>{a.skills.join(" · ")}</p>
                {a.cvHighlightsShared ? <p className="fm-muted">Compact CV highlights shared with this employer.</p> :
                  !["Hired", "Not selected", "Withdrawn"].includes(a.stage) && cvHighlightsReady ?
                    <Button variant="outline" disabled={busy} onClick={() => setShareTarget(a)}>Share compact CV highlights</Button> : null}
                <Button variant="outline" onClick={() => setConversation(a.id)}>
                  Supporting information
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCaseForm({
                      subject: "Application review request",
                      category: "Candidate appeal",
                      reference: a.id,
                      detail: "",
                    });
                    setSupport(true);
                  }}
                >
                  Request a review
                </Button>
                {!["Hired", "Not selected", "Withdrawn"].includes(a.stage) && (
                  <Button variant="ghost" onClick={() => setWithdraw(a)}>
                    Withdraw application
                  </Button>
                )}
              </Panel>
            ))}
          </div>
          {!applications.length && (
            <EmptyState
              title="No applications yet"
              description="Apply to a job to see its saved status here. Older anonymous submissions are not automatically attached to new accounts."
            />
          )}
        </>
      )}
      {tab === "Documents" && (
        <CandidateDocuments
          auth={auth}
          profile={profile}
          onConfirmed={() => setRevision((r) => r + 1)}
        />
      )}
      {tab === "Interviews" && (
        <div className="fs-cards">
          {interviews.map((i) => (
            <Panel
              key={i.id}
              title={applications.find((a) => a.jobId === i.jobId)?.jobTitle || visitedJobs.find((j) => j.id === i.jobId)?.title || "Interview"}
            >
              <StatusBadge>{i.status}</StatusBadge>
              <p>
                {i.date} at {i.time} (Asia/Dhaka)
              </p>
              <p>
                {i.format} · {i.location}
              </p>
              {i.cancellationReason && <p>{i.cancellationReason}</p>}
              <small>{i.candidateId}</small>
            </Panel>
          ))}
          {!interviews.length && (
            <p>No interviews have been scheduled for your applications.</p>
          )}
        </div>
      )}
      {conversation && (
        <ApplicationConversation
          auth={auth}
          id={conversation}
          onClose={() => setConversation(null)}
        />
      )}
      {tab === "Profile" && (
        <Panel
          title="Reusable profile"
          description="Save your experience here and reuse it when applying. Application submissions remain separate snapshots."
        >
          <form
            className="fs-form"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  platformApi.saveProfile(
                    {
                      ...profile,
                      skills: profile.skills
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                    auth,
                  ),
                "Profile saved.",
              );
            }}
          >
            <Field label="Current or recent position" optional>
              <Input
                maxLength={160}
                value={profile.role}
                onChange={(e) =>
                  setProfile({ ...profile, role: e.target.value })
                }
              />
            </Field>
            <Field label="Experience" optional>
              <Textarea
                maxLength={6000}
                value={profile.experience}
                onChange={(e) =>
                  setProfile({ ...profile, experience: e.target.value })
                }
              />
            </Field>
            <Field label="Education" optional>
              <Input
                maxLength={500}
                value={profile.education}
                onChange={(e) =>
                  setProfile({ ...profile, education: e.target.value })
                }
              />
            </Field>
            <Field label="Skills (comma separated)" optional>
              <Input
                value={profile.skills.join(",")}
                onChange={(e) =>
                  setProfile({ ...profile, skills: e.target.value.split(",") })
                }
              />
            </Field>
            <Button disabled={busy}>Save profile</Button>
            <p>
              Email: {user.contact}. Open Account security to check verification
              status and email delivery availability.
            </p>
          </form>
        </Panel>
      )}
      {tab === "Notifications" && (
        <div className="fs-cards">
          {notices.map((n) => (
            <Panel key={n.id}>
              <StatusBadge>{n.read ? "Read" : "New update"}</StatusBadge>
              <h2>{n.title}</h2>
              <p>{n.message}</p>
              <small>
                {new Date(n.createdAt).toLocaleString("en-GB")} · {n.reference}
              </small>
              {!n.read && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => platformApi.readNotice(n.id, auth),
                      "Marked as read.",
                    )
                  }
                >
                  Mark read
                </Button>
              )}
            </Panel>
          ))}
          {!notices.length && (
            <p>
              No updates yet. Status changes and interview details will appear
              here.
            </p>
          )}
        </div>
      )}
      {tab === "Support" && (
        <>
          <Button onClick={() => setSupport(true)}>New support request</Button>
          <div className="fs-cards">
            {cases.map((c) => (
              <Panel key={c.id}>
                <StatusBadge>{c.status}</StatusBadge>
                <h2>{c.subject}</h2>
                <p>{c.detail}</p>
                {c.response && (
                  <p>
                    <strong>Platform response:</strong> {c.response}
                  </p>
                )}
              </Panel>
            ))}
          </div>
        </>
      )}
      {selected && (
        <ApplicationForm
          key={selected.id}
          job={selected}
          profile={profile}
          user={user}
          auth={auth}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setTab("My applications");
            setRevision((r) => r + 1);
          }}
        />
      )}
      <Dialog open={!!shareTarget} onOpenChange={(open) => !open && !busy && setShareTarget(null)}>
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>Share CV highlights?</DialogTitle>
            <DialogDescription>
              The employer for {shareTarget?.jobTitle || shareTarget?.role} will see these candidate-confirmed claims in this application. Your original PDF stays private.
            </DialogDescription>
          </DialogHeader>
          <div className="fm-dialog-body fs-form">
            <div><strong>Skills</strong><p>{profile.cvSummary?.skills?.join(" · ") || "None"}</p></div>
            <div><strong>Courses</strong><p>{profile.cvSummary?.courses?.join(" · ") || "None"}</p></div>
            <div><strong>Projects</strong><p>{profile.cvSummary?.projects?.join(" · ") || "None"}</p></div>
            <p className="fm-muted">Sharing updates the evidence available for review and automatic comparison. It does not change your hiring stage.</p>
            {error && <p className="fm-error" role="alert">{error}</p>}
          </div>
          <div className="fs-actions">
            <Button variant="outline" disabled={busy} onClick={() => setShareTarget(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void run(async () => {
              if (!shareTarget) return;
              await request(`candidate/applications/${encodeURIComponent(shareTarget.id)}/cv-highlights`, "POST", {}, auth);
              setShareTarget(null);
            }, "CV highlights shared with this employer")}>Share highlights</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={support} onOpenChange={(v) => !busy && setSupport(v)}>
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>Support request</DialogTitle>
            <DialogDescription>
              This request is saved for the platform administrator. Replies
              appear in your inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="fm-dialog-body fs-form">
            <Field label="Subject">
              <Input
                required
                maxLength={160}
                value={caseForm.subject}
                onChange={(e) =>
                  setCaseForm({ ...caseForm, subject: e.target.value })
                }
              />
            </Field>
            <Field label="Category" required>
              <select
                required
                value={caseForm.category}
                onChange={(e) =>
                  setCaseForm({ ...caseForm, category: e.target.value })
                }
              >
                {["Candidate appeal", "Trust & safety", "Privacy"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Details">
              <Textarea
                required
                minLength={20}
                maxLength={5000}
                value={caseForm.detail}
                onChange={(e) =>
                  setCaseForm({ ...caseForm, detail: e.target.value })
                }
              />
            </Field>
            {error && (
              <p role="alert" className="fm-error">
                {error}
              </p>
            )}
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await platformApi.createCase(caseForm, auth);
                  setSupport(false);
                }, "Support request saved.")
              }
            >
              Submit request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!withdraw}
        onOpenChange={(v) => !v && !busy && setWithdraw(null)}
      >
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>Withdraw this application?</DialogTitle>
            <DialogDescription>
              This permanently removes the application from your account and the employer workspace, including its messages, assessments and interviews. You may apply to the job again later.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          <Button variant="outline" onClick={() => setWithdraw(null)}>
            Keep application
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                if (withdraw) await platformApi.withdraw(withdraw.id, auth);
                setWithdraw(null);
              }, "Application withdrawn and removed.")
            }
          >
            Confirm withdrawal
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}

const applicationStages = ["New", "Shortlisted", "Interview", "Offer", "Hired"] as const;

function ApplicationTracker({ stage }: { stage: string }) {
  const current = applicationStages.indexOf(stage as (typeof applicationStages)[number]);
  const finalNegative = stage === "Not selected";
  return (
    <div aria-label={`Application progress: ${stage}`}>
      <p className="fm-muted"><strong>Application progress</strong>{finalNegative ? " · Application closed" : ""}</p>
      <ol className="fs-application-tracker">
        {applicationStages.map((item, index) => (
          <li
            key={item}
            className={current >= 0 && index < current ? "is-complete" : current === index ? "is-current" : ""}
            aria-current={current === index ? "step" : undefined}
          >
            {item === "New" ? "Applied" : item}
          </li>
        ))}
      </ol>
      {finalNegative && <StatusBadge tone="danger">Not selected</StatusBadge>}
    </div>
  );
}

function ApplicationForm({
  job,
  profile,
  user,
  auth,
  onClose,
  onSaved,
}: {
  job: Job;
  profile: Profile;
  user: User;
  auth: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ApplicationInput>({
    role: profile.role,
    experience: profile.experience,
    education: profile.education,
    skills: profile.skills,
    name: user.name,
    contact: user.contact,
    example: "",
    availability: "30 days",
    location: job.location,
    consent: false,
    evidenceConfirmed: false,
    finalConsent: false,
    shareCvSummary: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftWasRestored, setDraftWasRestored] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void platformApi
      .draft(job.id, auth)
      .then((d) => {
        if (!cancelled) {
          setForm((f) => ({ ...f, ...d.values }));
          if (Object.keys(d.values || {}).length) {
            setDraftRestoredAt(d.updatedAt || "saved earlier");
            setDraftWasRestored(true);
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, job.id]);
  async function save(draft: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setFieldErrors({});
    try {
      const {
        role,
        experience,
        education,
        skills,
        example,
        availability,
        location,
      } = form;
      if (draft) {
        await platformApi.saveDraft(
          job.id,
          {
            role,
            experience,
            education,
            skills,
            example,
            availability,
            location,
          },
          auth,
        );
        setDraftRestoredAt(new Date().toISOString());
        setDraftWasRestored(false);
        toast.success("Draft saved. You can resume after signing in again.");
      } else {
        const cleanSkills=skills.map((s) => s.trim()).filter(Boolean);
        const nextErrors: Record<string, string> = {};
        if (!role.trim()) nextErrors.role="Enter your current or recent position.";
        if (experience.trim().length < 25) nextErrors.experience=`Enter at least 25 characters (${experience.trim().length} entered).`;
        if (experience.length > 6000) nextErrors.experience="Work experience must be at most 6000 characters.";
        if (education.length > 500) nextErrors.education="Education must be at most 500 characters.";
        if (!cleanSkills.length) nextErrors.skills="Add at least one relevant skill.";
        if (cleanSkills.length > 20) nextErrors.skills=`Add no more than 20 skills (${cleanSkills.length} entered).`;
        if (cleanSkills.some((skill) => skill.length > 160)) nextErrors.skills="Each skill must be at most 160 characters.";
        if (example.trim().length < 30) nextErrors.example=`Enter at least 30 characters (${example.trim().length} entered).`;
        if (!availability.trim()) nextErrors.availability="Enter when you can start.";
        if (!location.trim()) nextErrors.location="Enter your work location or arrangements.";
        if (!form.consent) nextErrors.consent="Confirm that the application may be shared with the employer.";
        if (!form.evidenceConfirmed) nextErrors.evidenceConfirmed="Confirm that you reviewed your experience and skills.";
        if (!form.finalConsent) nextErrors.finalConsent="Confirm that the application is accurate and ready to submit.";
        if (Object.keys(nextErrors).length) {
          setFieldErrors(nextErrors);
          setError("Please fix the highlighted fields before submitting. Your draft has not been lost.");
          return;
        }
        await platformApi.apply(
          job.id,
          { ...form, skills: cleanSkills },
          auth,
        );
        toast.success("Application saved.");
        onSaved();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="fm-dialog fm-dialog-wide">
        <DialogHeader>
          <DialogTitle>Apply: {job.title}</DialogTitle>
          <DialogDescription>
            {job.department} · {job.salary} · No applicant fee
          </DialogDescription>
        </DialogHeader>
        <div className="fm-dialog-body fs-form">
          <p>{job.description}</p>
          <ul>
            {job.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p>
            Submitting as {user.name} ({user.contact}). You can upload and
            confirm a CV in Documents before applying.
          </p>
          {draftRestoredAt && (
            <div className="fs-draft-notice" role="status">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>{draftWasRestored ? "Saved draft restored" : "Draft saved"}</strong>
                <span>{draftWasRestored ? "You can continue where you left off. " : "You can safely close this form and continue later. "}Last saved {draftRestoredAt === "saved earlier" ? "earlier" : new Date(draftRestoredAt).toLocaleString("en-GB")}.</span>
              </div>
            </div>
          )}
          {profile.cvSummary?.confirmedAt && (profile.cvSummary.skills?.length || profile.cvSummary.courses?.length || profile.cvSummary.projects?.length) ? <label className="fm-check-row">
            <input type="checkbox" checked={!!form.shareCvSummary} onChange={e=>setForm({...form,shareCvSummary:e.target.checked})}/>
            <span>Share my reviewed CV highlights (skills, courses and projects) with this employer. The original PDF remains private.</span>
          </label> : <p className="fm-muted">To share a compact CV summary, confirm highlights in Documents first. You can still apply without a CV.</p>}
          {(
            [
              "role",
              "experience",
              "education",
              "example",
              "availability",
              "location",
            ] as const
          ).map((k) => (
            <Field
              key={k}
              required={k !== "education"}
              optional={k === "education"}
              error={fieldErrors[k]}
              label={
                {
                  role: "Current or recent position",
                  experience: "Work experience",
                  education: "Education",
                  example: "Specific work example",
                  availability: "Availability",
                  location: "Work location / arrangements",
                }[k]
              }
            >
              {["experience", "example"].includes(k) ? (
                <Textarea
                  required
                  minLength={k === "experience" ? 25 : 30}
                  maxLength={6000}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              ) : (
                <Input
                  required={k !== "education"}
                  maxLength={
                    k === "education"
                      ? 500
                      : k === "availability"
                        ? 100
                        : k === "location"
                          ? 200
                          : 160
                  }
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              )}
            </Field>
          ))}
          <Field label="Skills (comma separated)" required error={fieldErrors.skills} hint="Add 1–20 job-relevant skills, separated by commas.">
            <Input
              required
              value={form.skills.join(",")}
              onChange={(e) =>
                setForm({ ...form, skills: e.target.value.split(",") })
              }
            />
          </Field>
          {(["consent", "evidenceConfirmed", "finalConsent"] as const).map(
            (k) => (
              <label className="fm-check-row" key={k}>
                <input
                  required
                  type="checkbox"
                  checked={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
                />
                <span>
                  {
                    {
                      consent:
                        "I agree to share this application with the employer for recruitment.",
                      evidenceConfirmed:
                        "I reviewed and confirmed every experience and skill claim.",
                      finalConsent:
                        "This application is accurate and ready to submit.",
                    }[k]
                  }
                  <b className="fm-required" aria-hidden="true">*</b>
                </span>
                {fieldErrors[k] && <small className="fm-error" role="alert">{fieldErrors[k]}</small>}
              </label>
            ),
          )}
          {error && (
            <p className="fm-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="fs-actions">
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => void save(true)}
          >
            Save draft
          </Button>
          <Button disabled={busy || loading} onClick={() => void save(false)}>
            {busy ? "Saving..." : "Submit application"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
