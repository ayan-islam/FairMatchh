"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Panel, Metric, Field, StatusBadge } from "./shared";
import {
  platformApi,
  type Organization,
  type SupportCase,
  type RawAudit,
} from "@/lib/platform-api";
import { exportCsv } from "@/lib/demo-data";
import { toast } from "sonner";
import { OrganizationDocuments, type OrganizationEvidence } from "./organization-documents";
const organizationStatuses = ["Pending", "Verified", "Changes requested", "Cancelled"] as const;
type OrganizationStatus = (typeof organizationStatuses)[number];

export function PlatformAdmin({ auth }: { auth: string }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [audit, setAudit] = useState<RawAudit[]>([]);
  const [tab, setTab] = useState("Organizations");
  const [organizationStatus, setOrganizationStatus] = useState<OrganizationStatus>("Pending");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [org, setOrg] = useState<Organization | null>(null);
  const [reviewEvidence, setReviewEvidence] = useState<OrganizationEvidence>();
  const [reviewedDocumentIds, setReviewedDocumentIds] = useState<string[]>([]);
  const [item, setItem] = useState<SupportCase | null>(null);
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClearCancelled, setConfirmClearCancelled] = useState(false);
  const [confirmCancelVerification, setConfirmCancelVerification] = useState(false);
  const [showClearedCancelled, setShowClearedCancelled] = useState(false);
  const [error, setError] = useState("");
  const pdfFullscreen = useRef(false);
  const pdfFullscreenExitAt = useRef(0);
  const handlePdfFullscreenChange = useCallback((active: boolean) => {
    if (pdfFullscreen.current && !active) pdfFullscreenExitAt.current = performance.now();
    pdfFullscreen.current = active;
  }, []);
  const keepReviewOpenAfterFullscreen = () => pdfFullscreen.current || (pdfFullscreenExitAt.current > 0 && performance.now() - pdfFullscreenExitAt.current < 750);
  const visibleOrganizations = orgs.filter(
    (organization) =>
      organization.status === organizationStatus && (organizationStatus !== "Cancelled" || showClearedCancelled || !organization.clearedFromAdmin) &&
      (organization.name + organization.id + organization.status)
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      platformApi.organizations(auth),
      platformApi.allCases(auth),
      platformApi.audit(auth),
    ])
      .then(([o, c, a]) => {
        if (!cancelled) {
          setOrgs(o);
          setCases(c);
          setAudit(a);
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
  async function decide(status: string) {
    if (busy) return;
    if (reason.trim().length < 20 || (org && !reviewed)) {
      setError(
        "Review the record and explain your decision in at least 20 characters.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (org) {
        if (!reviewEvidence || reviewEvidence.organization.id !== org.id) throw new Error("Load the current supporting documents before reviewing.");
        await platformApi.reviewOrganization(reviewEvidence.organization, status, reason, auth, reviewedDocumentIds);
      }
      if (item) await platformApi.reviewCase(item, status, reason, auth);
      setOrg(null);
      setItem(null);
      setRevision((r) => r + 1);
      toast.success("Decision saved and activity recorded.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function clearCancelled() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await platformApi.clearCancelledOrganizations(auth);
      setConfirmClearCancelled(false);
      setRevision(value => value + 1);
      toast.success(`${result.cleared} cancelled request${result.cleared === 1 ? "" : "s"} cleared from this list. Audit history remains.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function changeVerification(action: "cancel" | "reopen") {
    if (busy || !org) return;
    if (reason.trim().length < 20) { setError("Explain this decision in at least 20 characters."); return; }
    if (!reviewEvidence || reviewEvidence.organization.id !== org.id) { setError("Load the current organization record before changing its status."); return; }
    setBusy(true); setError("");
    try {
      if (action === "cancel") await platformApi.cancelVerification(reviewEvidence.organization, reason, auth);
      else await platformApi.reopenVerification(reviewEvidence.organization, reason, auth);
      setOrg(null);
      setConfirmCancelVerification(false);
      setRevision(value => value + 1);
      toast.success(action === "cancel" ? "Verification request cancelled and recorded." : "Verification request reopened for review.");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <main className="fs-workspace" id="main-content">
      <div className="fs-heading">
        <div>
          <p className="fm-eyebrow">PLATFORM OPERATIONS</p>
          <h1>Administration</h1>
          <p>
            Review organizations, respond to cases and inspect saved activity.
          </p>
        </div>
        <Button variant="outline" onClick={() => setRevision((r) => r + 1)}>
          Refresh records
        </Button>
      </div>
      <div className="fm-metrics">
        <Metric
          label="Organizations"
          value={orgs.length}
          note="Registered organizations"
        />
        <Metric
          label="Pending review"
          value={orgs.filter((o) => o.status === "Pending").length}
          note="Require an administrator decision"
        />
        <Metric
          label="Open support cases"
          value={cases.filter((c) => c.status !== "Resolved").length}
          note="Candidate and employer requests"
        />
      </div>
      <nav className="fs-tabs">
        {["Organizations", "Support & appeals", "Audit"].map((t) => (
          <Button
            key={t}
            variant={tab === t ? "default" : "outline"}
            onClick={() => setTab(t)}
          >
            {t}
          </Button>
        ))}
      </nav>
      {error && (
        <p className="fm-error" role="alert">
          {error}
        </p>
      )}
      {tab === "Organizations" && (
        <div className="fs-admin-status-filters" role="group" aria-label="Filter organizations by verification status">
          {organizationStatuses.map((status) => (
            <Button
              key={status}
              type="button"
              variant={organizationStatus === status ? "default" : "outline"}
              aria-pressed={organizationStatus === status}
              onClick={() => setOrganizationStatus(status)}
            >
              {status === "Pending" ? "Pending review" : status}
              <span className="fs-admin-status-count">{orgs.filter((organization) => organization.status === status && !organization.clearedFromAdmin).length}</span>
            </Button>
          ))}
        </div>
      )}
      {tab === "Organizations" && organizationStatus === "Cancelled" && <div className="fs-cancelled-actions">
        <p>Cancelled requests are retained for audit. Clear all hides them from the default list; it does not delete accounts or documents.</p>
        {orgs.some(organization => organization.status === "Cancelled" && organization.clearedFromAdmin) && <Button type="button" variant="outline" onClick={() => setShowClearedCancelled(value => !value)}>{showClearedCancelled ? "Hide cleared" : "Show cleared"}</Button>}
        {confirmClearCancelled ? <div className="fs-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmClearCancelled(false)}>Keep requests</Button><Button type="button" disabled={busy} onClick={() => void clearCancelled()}>Confirm clear all</Button></div> :
          <Button type="button" variant="outline" disabled={busy || !orgs.some(organization => organization.status === "Cancelled" && !organization.clearedFromAdmin)} onClick={() => setConfirmClearCancelled(true)}>Clear all</Button>}
      </div>}
      <Field label={tab === "Organizations" ? "Search organizations" : "Search records"}>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      {tab === "Organizations" && (
        <div className="fs-cards fs-organization-cards" aria-live="polite">
          {visibleOrganizations.map((o) => (
              <Panel key={o.id}>
                <StatusBadge>{o.status}</StatusBadge>
                {o.status === "Cancelled" && o.clearedFromAdmin && <small>Cleared from default list</small>}
                <h2>{o.name}</h2>
                <p>
                  {o.industry} · {o.location}
                </p>
                <p>{o.contact}</p>
                <p>{o.reviewReason}</p>
                <Button
                  onClick={() => {
                    setOrg(o);
                    setReviewEvidence(undefined);
                    setReviewedDocumentIds([]);
                    setReason("");
                    setReviewed(false);
                    setConfirmCancelVerification(false);
                    setError("");
                  }}
                >
                  {o.status === "Cancelled" ? "View cancelled request" : "Review organization"}
                </Button>
              </Panel>
            ))}
          {visibleOrganizations.length === 0 && (
            <Panel>
              <h2>{organizationStatus === "Changes requested" ? "No organizations awaiting changes" : `No ${organizationStatus.toLowerCase()} organizations found`}</h2>
              <p>{query.trim() ? "Try another search or choose a different status." : "Choose another status to view those organizations."}</p>
            </Panel>
          )}
        </div>
      )}
      {tab === "Support & appeals" && (
        <div className="fs-cards">
          {cases
            .filter((c) =>
              (c.subject + c.detail + c.status)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((c) => (
              <Panel key={c.id}>
                <StatusBadge>{c.status}</StatusBadge>
                <h2>{c.subject}</h2>
                <p>
                  {c.category} · {c.reference}
                </p>
                <p>{c.detail}</p>
                {c.response && (
                  <p>
                    <strong>Last response:</strong> {c.response}
                  </p>
                )}
                <Button
                  onClick={() => {
                    setItem(c);
                    setReason("");
                    setError("");
                  }}
                >
                  Review case
                </Button>
              </Panel>
            ))}
          {!cases.length && <p>No support cases have been submitted.</p>}
        </div>
      )}
      {tab === "Audit" && (
        <>
          <Button
            variant="outline"
            onClick={() =>
              exportCsv("platform-audit.csv", [
                ["Time", "Action", "Reference", "Actor", "Detail"],
                ...audit.map((a) => [
                  a.at,
                  a.action,
                  a.reference,
                  a.actor || "",
                  a.detail || "",
                ]),
              ])
            }
          >
            Export audit
          </Button>
          <div className="fs-cards">
            {audit
              .filter((a) =>
                (a.action + a.reference + (a.detail || ""))
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((a) => (
                <Panel key={a.id}>
                  <h2>{a.action.replaceAll("_", " ")}</h2>
                  <p className="fs-reference">{a.reference}</p>
                  <p>{a.detail}</p>
                  <small>
                    {new Date(a.at).toLocaleString("en-GB")} · {a.actor}
                  </small>
                </Panel>
              ))}
          </div>
        </>
      )}
      <Dialog
        open={!!org || !!item}
        onOpenChange={(v) => {
          if (!v && !busy && !keepReviewOpenAfterFullscreen()) {
            setOrg(null);
            setItem(null);
          }
        }}
      >
        <DialogContent
          className={`fm-dialog fs-review-dialog${org ? " fm-dialog-wide" : ""}`}
          onEscapeKeyDown={event => { if (keepReviewOpenAfterFullscreen()) event.preventDefault(); }}
          onInteractOutside={event => { if (keepReviewOpenAfterFullscreen()) event.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>
              {org ? "Review organization" : "Respond to support case"}
            </DialogTitle>
            <DialogDescription>{org?.name || item?.subject}</DialogDescription>
          </DialogHeader>
          <div className="fm-dialog-body fs-form">
            {org && (
              <>
                <OrganizationDocuments key={org.id} auth={auth} adminOrgId={org.id} onLoaded={setReviewEvidence} checkedIds={reviewedDocumentIds} onChecked={setReviewedDocumentIds} onPdfFullscreenChange={handlePdfFullscreenChange} />
                {org.status !== "Cancelled" && <label className="fm-check-row">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  <span>
                    I reviewed the organization details and supporting evidence and can
                    explain this decision.
                  </span>
                </label>}
              </>
            )}
            {item && <p>{item.detail}</p>}
            <Field label={org ? "Decision reason" : "Response to candidate"}>
              <Textarea
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {error && (
              <p className="fm-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="fs-review-footer">
            <p>{org?.status === "Cancelled" ? "This request is cancelled. Explain why it should be reopened (at least 20 characters)." : org ? "Review the evidence and provide a reason (at least 20 characters)." : "Provide a response of at least 20 characters."}</p>
            {confirmCancelVerification && org?.status === "Pending" && <p role="alert">Cancel this pending request? The owner will be notified, and only an administrator can reopen it.</p>}
            <div className="fs-actions">
              {org?.status === "Pending" && (confirmCancelVerification ? <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmCancelVerification(false)}>Keep request</Button>
                <Button type="button" variant="destructive" disabled={busy || reason.trim().length < 20} onClick={() => void changeVerification("cancel")}>Confirm cancellation</Button>
              </> : <Button type="button" variant="outline" disabled={busy || reason.trim().length < 20 || !reviewEvidence} onClick={() => setConfirmCancelVerification(true)}>Cancel verification request</Button>)}
              {org?.status === "Cancelled" && <Button type="button" disabled={busy || reason.trim().length < 20 || !reviewEvidence} onClick={() => void changeVerification("reopen")}>Reopen for review</Button>}
              {org?.status !== "Cancelled" && <>
              <Button
                variant="outline"
                disabled={busy || reason.trim().length < 20 || (!!org && (org.status === "Cancelled" || !reviewEvidence || !reviewed))}
                onClick={() =>
                  void decide(org ? "Changes requested" : "In review")
                }
              >
                {org ? "Request changes" : "Keep in review"}
              </Button>
              <Button
                disabled={busy || reason.trim().length < 20 || (!!org && (org.status === "Cancelled" || !reviewEvidence?.documents.length || reviewedDocumentIds.length !== reviewEvidence.documents.length || !reviewed))}
                onClick={() => void decide(org ? "Verified" : "Resolved")}
              >
                {org ? "Approve organization" : "Resolve case"}
              </Button>
              </>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
