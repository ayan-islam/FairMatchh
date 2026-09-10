"use client";
import { useEffect, useState } from "react";
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
export function PlatformAdmin({ auth }: { auth: string }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [audit, setAudit] = useState<RawAudit[]>([]);
  const [tab, setTab] = useState("Organizations");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [org, setOrg] = useState<Organization | null>(null);
  const [reviewEvidence, setReviewEvidence] = useState<OrganizationEvidence>();
  const [reviewedDocumentIds, setReviewedDocumentIds] = useState<string[]>([]);
  const [item, setItem] = useState<SupportCase | null>(null);
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
          value={orgs.filter((o) => o.status !== "Verified").length}
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
      <Field label="Search records">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      {tab === "Organizations" && (
        <div className="fs-cards">
          {orgs
            .filter((o) =>
              (o.name + o.id + o.status)
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((o) => (
              <Panel key={o.id}>
                <StatusBadge>{o.status}</StatusBadge>
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
                    setError("");
                  }}
                >
                  Review organization
                </Button>
              </Panel>
            ))}
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
          if (!v && !busy) {
            setOrg(null);
            setItem(null);
          }
        }}
      >
        <DialogContent className={`fm-dialog fs-review-dialog${org ? " fm-dialog-wide" : ""}`}>
          <DialogHeader>
            <DialogTitle>
              {org ? "Review organization" : "Respond to support case"}
            </DialogTitle>
            <DialogDescription>{org?.name || item?.subject}</DialogDescription>
          </DialogHeader>
          <div className="fm-dialog-body fs-form">
            {org && (
              <>
                <OrganizationDocuments key={org.id} auth={auth} adminOrgId={org.id} onLoaded={setReviewEvidence} checkedIds={reviewedDocumentIds} onChecked={setReviewedDocumentIds} />
                <label className="fm-check-row">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  <span>
                    I reviewed the organization details and supporting evidence and can
                    explain this decision.
                  </span>
                </label>
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
            <p>{org ? "Review the evidence and provide a reason (at least 20 characters)." : "Provide a response of at least 20 characters."}</p>
            <div className="fs-actions">
              <Button
                variant="outline"
                disabled={busy || reason.trim().length < 20 || (!!org && (!reviewEvidence || !reviewed))}
                onClick={() =>
                  void decide(org ? "Changes requested" : "In review")
                }
              >
                {org ? "Request changes" : "Keep in review"}
              </Button>
              <Button
                disabled={busy || reason.trim().length < 20 || (!!org && (!reviewEvidence?.documents.length || reviewedDocumentIds.length !== reviewEvidence.documents.length || !reviewed))}
                onClick={() => void decide(org ? "Verified" : "Resolved")}
              >
                {org ? "Approve organization" : "Resolve case"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
