"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Panel, StatusBadge } from "./shared";

type TeamMember = { id: string; name: string; email: string; role: string; status: string; version: number };
type Invitation = { id: string; email: string; status: string; version: number; expiresAt: string };
type Team = { canManage: boolean; organizationName: string; members: TeamMember[]; invitations: Invitation[] };
type Created = { invitation: Invitation; code: string };

export function TeamAccess({ auth }: { auth: string }) {
  const [team, setTeam] = useState<Team>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<Created>();
  const [changing, setChanging] = useState<TeamMember>();
  const [reason, setReason] = useState("");
  useEffect(() => {
    let cancelled = false;
    request<Team>("employer/team", "GET", undefined, auth).then(value => {
      if (!cancelled) { setTeam(value); setError(""); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [auth, revision]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); setRevision(v => v + 1); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Panel title="Team & access" description="Owners manage membership. Recruiters manage the shared hiring work.">
    <div className="fs-form">
      {error && <p className="fm-error" role="alert">{error}</p>}
      {!team && !error && <p role="status">Loading team...</p>}
      <div className="fs-actions"><Button variant="outline" disabled={busy} onClick={() => setRevision(v => v + 1)}>Refresh team</Button></div>
      {team && <>
        <p>Recruiters can manage jobs, applications, assessments and interviews in {team.organizationName}. Only the owner can edit organization details, access business verification files or manage this team.</p>
        <div className="fm-table-scroll"><table className="fm-table">
          <thead><tr><th>MEMBER</th><th>ROLE</th><th>STATUS</th>{team.canManage && <th>ACCESS</th>}</tr></thead>
          <tbody>{team.members.map(member => <tr key={member.id}>
            <td><strong>{member.name}</strong><small>{member.email}</small></td><td>{member.role}</td><td><StatusBadge>{member.status}</StatusBadge></td>
            {team.canManage && <td>{member.role === "Owner" ? "Owner access protected" : <Button size="sm" variant="outline" disabled={busy} onClick={() => { setChanging(member); setReason(""); }}>{member.status === "Active" ? "Suspend access" : "Restore access"}</Button>}</td>}
          </tr>)}</tbody>
        </table></div>
        {changing && <form className="fs-team-decision fs-form" onSubmit={e => { e.preventDefault(); void run(async () => {
          await request(`employer/team/members/${encodeURIComponent(changing.id)}/access`, "POST", { status: changing.status === "Active" ? "Suspended" : "Active", expectedVersion: changing.version, reason }, auth);
          setChanging(undefined); toast.success("Team access saved.");
        }); }}>
          <h3>{changing.status === "Active" ? "Suspend" : "Restore"} access for {changing.name}</h3>
          <p>{changing.status === "Active" ? "This ends their current sessions and prevents another sign-in. Their hiring records are kept." : "They can sign in again after access is restored. Earlier sessions remain revoked."}</p>
          <Field label="Reason for changing access"><Textarea required minLength={15} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} /></Field>
          <div className="fs-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setChanging(undefined)}>Cancel</Button><Button type="submit" disabled={busy}>Confirm access change</Button></div>
        </form>}
        {team.canManage ? <>
          <form className="fs-team-invite fs-form" onSubmit={e => { e.preventDefault(); void run(async () => {
            setCreated(await request<Created>("employer/team/invitations", "POST", { email }, auth)); setEmail("");
          }); }}>
            <h3>Invite a recruiter</h3>
            <p>Create a one-use code valid for 48 hours. Share it privately with the intended teammate. It creates a new employer account in this organization; it does not move existing accounts.</p>
            <Field label="Teammate's email"><Input type="email" required maxLength={160} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} autoComplete="off" /></Field>
            <div className="fs-actions"><Button type="submit" disabled={busy || !email || !!created}>Create invitation</Button></div>
          </form>
          {created && <section className="fs-team-code fs-form" aria-label="New invitation">
            <h3>Invitation for {created.invitation.email}</h3>
            <p>Ask your teammate to open FairMatch, choose Employer, then Join an organization. Give them this code and ask them to use the email above. The code is shown once and is not emailed automatically.</p>
            <Field label="Private invitation code"><Input readOnly value={created.code} autoComplete="off" onFocus={e => e.currentTarget.select()} /></Field>
            <p>Expires {new Date(created.invitation.expiresAt).toLocaleString()}.</p>
            <div className="fs-actions"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(created.code).then(() => toast.success("Invitation code copied.")).catch(() => toast.error("Select and copy the code manually."))}>Copy code</Button><Button variant="ghost" onClick={() => setCreated(undefined)}>Hide code</Button></div>
          </section>}
          <h3>Recent invitations</h3>
          {!team.invitations.length && <p>No invitations created yet.</p>}
          {team.invitations.map(invitation => <div className="fs-team-invitation" key={invitation.id}>
            <div><strong>{invitation.email}</strong><p><StatusBadge>{invitation.status}</StatusBadge> · Expires {new Date(invitation.expiresAt).toLocaleString()}</p></div>
            {invitation.status === "Pending" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
              await request(`employer/team/invitations/${encodeURIComponent(invitation.id)}/revocation`, "POST", { expectedVersion: invitation.version }, auth);
              if (created?.invitation.id === invitation.id) setCreated(undefined);
              toast.success("Invitation revoked.");
            })}>Revoke invitation</Button>}
          </div>)}
        </> : <p>Your organization owner manages invitations and access.</p>}
      </>}
    </div>
  </Panel>;
}

export function JoinOrganization({ onSession, onBack }: { onSession: (token: string) => void; onBack: () => void }) {
  const [form, setForm] = useState({ code: "", email: "", username: "", name: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="fm-login" id="main-content">
    <span className="fm-login-brand">FairMatch.</span><h1>Join an organization</h1>
    <p>Use the private invitation supplied by your organization owner. Create your own recruiter account.</p>
    <form onSubmit={async e => {
      e.preventDefault(); if (busy) return; setBusy(true); setError("");
      try { const session = await request<{ token: string }>("public/team/accept", "POST", { ...form, code: form.code.trim(), email: form.email.trim(), username: form.username.trim() }); setForm({ code: "", email: "", username: "", name: "", password: "" }); onSession(session.token); toast.success("You joined the organization."); }
      catch (e) { setError((e as Error).message); }
      finally { setBusy(false); }
    }}>
      <Field label="Invitation code"><Input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} maxLength={100} autoComplete="off" spellCheck={false} disabled={busy} /></Field>
      <Field label="Invited email"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} maxLength={160} autoComplete="email" disabled={busy} /></Field>
      <Field label="Your name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={160} autoComplete="name" disabled={busy} /></Field>
      <Field label="Choose a username"><Input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} minLength={3} maxLength={60} pattern="[a-zA-Z0-9_.-]+" autoComplete="username" disabled={busy} /></Field>
      <Field label="Choose a password"><Input required type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={10} maxLength={72} autoComplete="new-password" disabled={busy} /></Field>
      <p>Use an email that does not already have a FairMatch account. Your owner must share the code with you; it does not verify ownership of your email inbox.</p>
      {error && <p className="fm-error" role="alert">{error}</p>}
      <Button disabled={busy}>{busy ? "Joining..." : "Create account and join"}</Button>
    </form>
    <Button variant="ghost" disabled={busy} onClick={onBack}>Back to sign in</Button>
  </main>;
}
