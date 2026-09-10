"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Panel, StatusBadge } from "./shared";
import { request } from "@/lib/api";
import type { Organization } from "@/lib/platform-api";

type Evidence = { id: string; type: string; description: string; filename: string; bytes: number; sha256: string; createdAt: string };
export type OrganizationEvidence = { organization: Organization; documents: Evidence[]; history: { id: string; status: string; reason: string; actor: string; at: string; organizationVersion: number; documents: Evidence[] }[] };
const types = ["Trade licence", "Business registration", "Tax document", "Other supporting document"];

export function OrganizationDocuments({ auth, adminOrgId, onLoaded, checkedIds = [], onChecked }: {
  auth: string; adminOrgId?: string; onLoaded?: (bundle: OrganizationEvidence) => void;
  checkedIds?: string[]; onChecked?: (ids: string[]) => void;
}) {
  const [bundle, setBundle] = useState<OrganizationEvidence>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File>();
  const [type, setType] = useState(types[0]);
  const [description, setDescription] = useState("");
  const [removing, setRemoving] = useState<string>();
  const [opened, setOpened] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const base = adminOrgId ? `admin/organizations/${encodeURIComponent(adminOrgId)}/evidence` : "employer/organization/evidence";
  useEffect(() => {
    let cancelled = false;
    void request<OrganizationEvidence>(base, "GET", undefined, auth).then(value => {
      if (!cancelled) { setBundle(value); setError(""); onLoaded?.(value); }
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [auth, base, revision, onLoaded]);
  async function upload() {
    if (!file || !bundle || busy) return;
    setBusy(true); setError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Choose a PDF up to 8 MB.");
      const body = new FormData();
      body.append("file", file); body.append("type", type); body.append("description", description);
      body.append("expectedVersion", String(bundle.organization.version));
      const response = await fetch(`/api/${base}`, { method: "POST", headers: { Authorization: auth }, body, signal: AbortSignal.timeout(45000) });
      const value = await response.json();
      if (!response.ok) throw new Error(value.message || "Upload failed.");
      setFile(undefined); setDescription(""); if (fileInput.current) fileInput.current.value = "";
      setRevision(v => v + 1);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function download(item: Evidence) {
    if (busy) return; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/${base}/${encodeURIComponent(item.id)}/file`, { headers: { Authorization: auth }, cache: "no-store", signal: AbortSignal.timeout(40000) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.message || "Download failed."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = item.filename;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      setOpened(ids => [...new Set([...ids, item.id])]);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!bundle || busy) return; setBusy(true); setError("");
    try {
      await request(`${base}/${encodeURIComponent(id)}`, "DELETE", { expectedVersion: bundle.organization.version }, auth);
      setRemoving(undefined); setRevision(v => v + 1);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <Panel className="fs-organization-evidence" title="Business verification documents" description="Private evidence for an administrator's organization review. Uploads are not a government verification.">
    <div className="fs-form">
      <div className="fs-verification-status"><StatusBadge>{bundle?.organization.status || "Loading…"}</StatusBadge>{bundle?.organization.reviewReason && <p>{bundle.organization.reviewReason}</p>}</div>
      {adminOrgId && bundle && <dl className="fs-organization-details">
        {[['Organization', bundle.organization.name], ['Industry', bundle.organization.industry], ['Location', bundle.organization.location], ['Website', bundle.organization.website], ['Contact', bundle.organization.contact]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value?.trim() || "Not provided"}</dd></div>)}
      </dl>}
      <p>Up to five PDFs, 8 MB and ten pages each. Adding or removing a document requires another administrator review. Files are available only to this organization and platform administrators.</p>
      {error && <p role="alert" className="fm-error">{error}</p>}
      <Button variant="outline" disabled={busy} onClick={() => { onChecked?.([]); setOpened([]); setRevision(v => v + 1); }}>Refresh documents</Button>
      {bundle?.documents.length === 0 && <p>No supporting documents uploaded. Approval requires at least one.</p>}
      {bundle?.documents.map(item => <section className="fs-business-document" key={item.id}>
        <strong>{item.type}</strong><p>{item.description}</p>
        <p className="fs-reference">{item.filename} · {(item.bytes / 1024).toFixed(0)} KB</p>
        <div className="fs-actions">
          <Button variant="outline" disabled={busy} onClick={() => void download(item)}>Download {item.filename}</Button>
          {!adminOrgId && <Button variant="ghost" disabled={busy} onClick={() => setRemoving(item.id)}>Remove document</Button>}
        </div>
        {adminOrgId && <label className="fm-check-row"><input type="checkbox" disabled={busy || !opened.includes(item.id)} checked={checkedIds.includes(item.id)} onChange={event => onChecked?.(event.target.checked ? [...checkedIds, item.id] : checkedIds.filter(id => id !== item.id))} /><span>I downloaded and reviewed {item.filename}.</span></label>}
        {removing === item.id && <div role="alert" className="fm-notice"><div><p>Remove this private file and require a new organization review? Historical decisions retain its description and checksum.</p><div className="fs-actions"><Button variant="outline" disabled={busy} onClick={() => setRemoving(undefined)}>Keep document</Button><Button disabled={busy} onClick={() => void remove(item.id)}>Confirm removal</Button></div></div></div>}
      </section>)}
      {!adminOrgId && <form className="fs-form" onSubmit={event => { event.preventDefault(); void upload(); }}>
        <Field label="Supporting document type"><select value={type} onChange={event => setType(event.target.value)} disabled={busy}>{types.map(value => <option key={value}>{value}</option>)}</select></Field>
        <Field label="What does this document establish?"><Input required minLength={10} maxLength={500} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} placeholder="For example, the registered business name and address" /></Field>
        <Field label="Business document PDF"><Input ref={fileInput} type="file" accept="application/pdf,.pdf" required disabled={busy} onChange={event => setFile(event.target.files?.[0])} /></Field>
        <Button type="submit" disabled={busy || !bundle || !file || bundle.documents.length >= 5}>{busy ? "Working…" : "Upload for verification"}</Button>
      </form>}
      {!!bundle?.history.length && <details><summary>Previous verification decisions ({bundle.history.length})</summary>{bundle.history.map(item => <div key={item.id} className="fs-business-document"><strong>{item.status}</strong><p>{item.reason}</p><small>{new Date(item.at).toLocaleString("en-GB")} · {item.actor} · {item.documents.length} document(s) recorded</small></div>)}</details>}
    </div>
  </Panel>;
}
