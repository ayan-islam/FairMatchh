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
  jobs,
  requestedId,
}: {
  auth: string;
  user: User;
  jobs: Job[];
  requestedId: string | null;
}) {
  const [conversation, setConversation] = useState<string | null>(null);
  const [interviews, setInterviews] = useState<CandidateInterview[]>([]);
  const [tab, setTab] = useState("Jobs");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [applications, setApplications] = useState<OwnApplication[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Job | null>(null);
  const [query, setQuery] = useState("");
  const [support, setSupport] = useState(false);
  const [withdraw, setWithdraw] = useState<OwnApplication | null>(null);
  const [caseForm, setCaseForm] = useState({
    subject: "",
    category: "Candidate appeal",
    reference: "",
    detail: "",
  });
  useEffect(() => {
    let cancelled = false;
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
    ])
      .then(([p, a, n, c, i]) => {
        if (!cancelled) {
          setProfile(p);
          setApplications(a);
          setNotices(n);
          setCases(c);
          setInterviews(i);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [auth, revision]);
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
    ? jobs.filter(j => j.id === requestedId)
    : jobs.filter(j =>
        (j.title + " " + j.department + " " + j.location)
          .toLowerCase().includes(query.toLowerCase()),
      );
  return (
    <main className="fs-workspace" id="main-content">
      <div className="fs-heading">
        <div>
          <p className="fm-eyebrow">CANDIDATE WORKSPACE</p>
          <h1>Hello, {user.name}</h1>
          <p>Your profile, applications and updates in one place.</p>
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
          ) : <Field label="Search jobs">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Position, department or location"
            />
          </Field>}
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
              title={linkedJob ? "This job is unavailable" : "No matching jobs"}
              description={linkedJob ? "The job may have closed or been unpublished, or the link may be incorrect. Ask the employer for an updated link." : "Try another search or check again later."}
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
                  jobs.find((j) => j.id === a.jobId)?.title || a.jobTitle || a.role,
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
                <h2>{jobs.find((j) => j.id === a.jobId)?.title || a.jobTitle || a.role}</h2>
                <p className="fs-reference">{a.id}</p>
                <p>Submitted {new Date(a.appliedAt).toLocaleString("en-GB")}</p>
                <p>{a.experience}</p>
                <p>{a.skills.join(" · ")}</p>
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
              title={jobs.find((j) => j.id === i.jobId)?.title || "Interview"}
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
            <Field label="Current or recent position">
              <Input
                maxLength={160}
                value={profile.role}
                onChange={(e) =>
                  setProfile({ ...profile, role: e.target.value })
                }
              />
            </Field>
            <Field label="Experience">
              <Textarea
                maxLength={6000}
                value={profile.experience}
                onChange={(e) =>
                  setProfile({ ...profile, experience: e.target.value })
                }
              />
            </Field>
            <Field label="Education">
              <Input
                maxLength={500}
                value={profile.education}
                onChange={(e) =>
                  setProfile({ ...profile, education: e.target.value })
                }
              />
            </Field>
            <Field label="Skills (comma separated)">
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
                maxLength={160}
                value={caseForm.subject}
                onChange={(e) =>
                  setCaseForm({ ...caseForm, subject: e.target.value })
                }
              />
            </Field>
            <Field label="Category">
              <select
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
              The employer will see Withdrawn. Your record and activity history
              remain saved.
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
              }, "Application withdrawn.")
            }
          >
            Confirm withdrawal
          </Button>
        </DialogContent>
      </Dialog>
    </main>
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
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void platformApi
      .draft(job.id, auth)
      .then((d) => {
        if (!cancelled) setForm((f) => ({ ...f, ...d.values }));
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
        toast.success("Draft saved. You can resume after signing in again.");
      } else {
        await platformApi.apply(
          job.id,
          { ...form, skills: skills.map((s) => s.trim()).filter(Boolean) },
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
              label={
                {
                  role: "Current or recent position",
                  experience: "Work experience (at least 25 characters)",
                  education: "Education",
                  example: "Specific work example (at least 30 characters)",
                  availability: "Availability",
                  location: "Work location / arrangements",
                }[k]
              }
            >
              {["experience", "example"].includes(k) ? (
                <Textarea
                  maxLength={6000}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              ) : (
                <Input
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
          <Field label="Skills (comma separated)">
            <Input
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
                </span>
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
