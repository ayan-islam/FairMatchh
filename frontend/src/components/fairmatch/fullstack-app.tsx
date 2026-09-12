"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "./shared";
import { RecruiterWorkspace } from "./recruiter-workspace";
import { CandidateWorkspace } from "./candidate-workspace";
import { PlatformAdmin } from "./platform-admin";
import { AccountSecurity, PasswordRecovery } from "./account-security";
import { JoinOrganization } from "./team-access";
import { api, request, type InterviewInput } from "@/lib/api";
import {
  platformApi,
  type User,
  type Organization,
  type Member,
} from "@/lib/platform-api";
import type {
  Job,
  Candidate,
  Stage,
  Interview,
  AuditEvent,
} from "@/lib/demo-data";
import "./backend.css";
import "./recruiter.css";
import "./platform.css";
type Workspace = "employer" | "candidate" | "admin";
const roles = { employer: "EMPLOYER", candidate: "CANDIDATE", admin: "ADMIN" };
export function FullstackApp() {
  const params = useSearchParams();
  const [workspace, setWorkspace] = useState<Workspace>(
    params.get("workspace") === "candidate"
      ? "candidate"
      : params.get("workspace") === "admin"
        ? "admin"
        : "employer",
  );
  const [user, setUser] = useState<User | null>(null);
  const [auth, setAuth] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [org, setOrg] = useState<Organization>();
  const [members, setMembers] = useState<Member[]>([]);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  function clearSession(all = false) {
    for (const w of all ? ["employer", "candidate", "admin"] : [workspace]) {
      sessionStorage.removeItem(`fairmatch.session.${w}`);
    }
    setSecurityOpen(false);
    setUser(null);
    setAuth("");
    setRevision(r => r + 1);
  }
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await request("account/logout", "POST", {}, auth);
      clearSession();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSigningOut(false); }
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setBusy(true);
      setError("");
      try {
        const token =
          sessionStorage.getItem(`fairmatch.session.${workspace}`) || "";
        const me = token ? await platformApi.me(token) : null;
        if (me && me.role !== roles[workspace])
          throw new Error("Use an account for this workspace.");
        const publicJobs = await api.publicJobs();
        if (!cancelled) {
          setAuth(token);
          setUser(me);
          setJobs(publicJobs);
        }
        if (token && me && workspace === "employer") {
          const [j, c, i, a, o, m] = await Promise.all([
            api.employerJobs(token),
            api.applications(token),
            api.interviews(token),
            api.audit(token),
            platformApi.organization(token),
            platformApi.members(token),
          ]);
          if (!cancelled) {
            setJobs(j);
            setCandidates(c);
            setInterviews(i);
            setAudit(a);
            setOrg(o);
            setMembers(m);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setUser(null);
          setAuth("");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workspace, revision]);
  function change(next: Workspace, job?: Job) {
    if (next === workspace) {
      setRevision((r) => r + 1);
      return;
    }
    setUser(null);
    setAuth("");
    setSecurityOpen(false);
    setWorkspace(next);
    window.history.replaceState(
      null,
      "",
      `/?workspace=${next}${job ? `&job=${encodeURIComponent(job.id)}` : ""}`,
    );
    window.scrollTo({ top: 0 });
  }
  async function history() {
    try {
      setAudit(await api.audit(auth));
    } catch {
      /* A committed save remains successful even if history reload fails. */
    }
  }
  async function acceptInterview(saved: Interview) {
    setInterviews((old) =>
      [saved, ...old.filter((i) => i.id !== saved.id)].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time),
      ),
    );
    await history();
  }
  async function saveJob(job: Job) {
    const saved = await api.saveJob(
      job,
      auth,
      jobs.some((j) => j.id === job.id),
    );
    setJobs((old) => [saved, ...old.filter((j) => j.id !== saved.id)]);
    await history();
    return saved;
  }
  async function move(candidate: Candidate, stage: Stage, reason: string) {
    const saved = await api.moveCandidate(candidate, stage, reason, auth);
    setCandidates((old) => old.map((c) => (c.id === saved.id ? saved : c)));
    await history();
  }
  return (
    <>
      <div
        className="fm-live-bar"
        data-sidebar={workspace === "employer" && !!user}
      >
        <span>
          <strong>FairMatch · Local fullstack</strong> ·{" "}
          {user
            ? `${user.name} · ${user.role.toLowerCase()}`
            : "Sign in to continue"}
        </span>
        <div>
          {(["employer", "candidate", "admin"] as Workspace[]).map((w) => (
            <button
              key={w}
              aria-current={workspace === w ? "page" : undefined}
              onClick={() => change(w)}
            >
              {w[0].toUpperCase() + w.slice(1)}
            </button>
          ))}
          {user && (
            <>
              <button disabled={busy} onClick={() => setRevision((r) => r + 1)}>
                Refresh data
              </button>
              <button disabled={busy} onClick={() => setSecurityOpen(true)}>Account security</button>
              <button disabled={signingOut} onClick={() => void signOut()}>
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p className="fm-backend-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="fm-loading" role="status">
          Loading saved records...
        </p>
      )}
      {!busy && !user && (
        <AccountForm
          key={workspace}
          workspace={workspace}
          onSession={(token) => {
            sessionStorage.setItem(
              `fairmatch.session.${workspace}`,
              `Bearer ${token}`,
            );
            setRevision((r) => r + 1);
          }}
        />
      )}
      {!busy && user && workspace === "employer" && org && (
        <RecruiterWorkspace
          key={org.id}
          jobs={jobs}
          candidates={candidates}
          auditEvents={audit}
          interviews={interviews}
          organization={org}
          accountId={user.id}
          members={members}
          onOrganizationChanged={setOrg}
          onSaveOrganization={async (value) => {
            const saved = await platformApi.saveOrganization(value, auth);
            setOrg(saved);
            await history();
            return saved;
          }}
          onReviewCandidate={(saved) => {
            setCandidates((old) =>
              old.map((x) => (x.id === saved.id ? saved : x)),
            );
            void history().catch(e => setError(e.message));
          }}
          onRequestInformation={async (c, message) => {
            await platformApi.requestInformation(c.id, message, auth);
            await history();
          }}
          auth={auth}
          onMoveCandidate={move}
          onSaveJob={saveJob}
          onScheduleInterview={async (
            input: InterviewInput,
            existing?: Interview,
          ) =>
            acceptInterview(await api.scheduleInterview(input, auth, existing))
          }
          onEvaluateInterview={async (i, s, n) =>
            acceptInterview(await api.evaluateInterview(i, s, n, auth))
          }
          onCancelInterview={async (i, r) =>
            acceptInterview(await api.cancelInterview(i, r, auth))
          }
          onWorkspaceChange={() => change("candidate")}
          onCandidatePreview={(j) => change("candidate", j)}
        />
      )}
      {!busy && user && workspace === "candidate" && (
        <CandidateWorkspace
          key={`${user.id}:${params.get("job") ?? "browse"}`}
          auth={auth}
          user={user}
          jobs={jobs}
          requestedId={params.get("job")}
        />
      )}
      {user && workspace === "admin" && <PlatformAdmin auth={auth} />}
      {user && securityOpen && <AccountSecurity auth={auth} onClose={() => setSecurityOpen(false)} onSignedOut={() => { clearSession(true); toast.success("Sessions signed out. Sign in again to continue."); }} />}
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}
function AccountForm({
  workspace,
  onSession,
}: {
  workspace: Workspace;
  onSession: (token: string) => void;
}) {
  const [register, setRegister] = useState(false);
  const [joining, setJoining] = useState(false);
  const [username, setUsername] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const session = register
        ? await platformApi.register({
            username,
            password,
            name,
            contact,
            organizationName: company,
            role: roles[workspace],
          })
        : await platformApi.login(username, password);
      if (session.user.role !== roles[workspace]) {
        await request("account/logout", "POST", {}, `Bearer ${session.token}`);
        throw new Error(`This account belongs to the ${session.user.role.toLowerCase()} workspace.`);
      }
      setPassword("");
      onSession(session.token);
      toast.success(register ? "Account created." : "Signed in.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (joining) return <JoinOrganization onSession={onSession} onBack={() => setJoining(false)} />;
  return (
    <main className="fm-login" id="main-content">
      <span className="fm-login-brand">FairMatch.</span>
      <h1>{register ? "Create your account" : "Welcome back"}</h1>
      <p>
        {workspace[0].toUpperCase() + workspace.slice(1)} workspace · Saved
        records, clear decisions.
      </p>
      <form onSubmit={submit}>
        <Field label="Username">
          <Input
            required
            maxLength={60}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <Input
            required
            minLength={register ? 10 : undefined}
            maxLength={72}
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {register && (
          <>
            <Field label="Your name">
              <Input
                required
                maxLength={160}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                required
                type="email"
                maxLength={160}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </Field>
            {workspace === "employer" && (
              <Field label="Organization name">
                <Input
                  required
                  maxLength={160}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </Field>
            )}
            <p>
              Use a password of at least 10 characters. You can check email
              verification availability in Account security after signing in.
            </p>
          </>
        )}
        {error && (
          <p className="fm-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={busy}>
          {busy ? "Please wait..." : register ? "Create account" : "Sign in"}
        </Button>
      </form>
      {workspace !== "admin" && (
        <Button
          variant="ghost"
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "Already registered? Sign in" : "Create a new account"}
        </Button>
      )}
      {!register && <Button variant="ghost" onClick={() => setRecovering(true)}>Forgot password?</Button>}
      {workspace === "employer" && <Button variant="ghost" onClick={() => setJoining(true)}>Join an organization</Button>}
      {recovering && <PasswordRecovery onClose={() => setRecovering(false)} />}
    </main>
  );
}
