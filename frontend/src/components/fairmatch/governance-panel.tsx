"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field, Panel, PageHeading, StatusBadge } from "./shared";
import { request } from "@/lib/api";
import { platformApi, type Notice } from "@/lib/platform-api";
import type { Candidate, Job } from "@/lib/demo-data";
export function ReviewDialog({
  candidate,
  onClose,
  onSave,
}: {
  candidate: Candidate;
  onClose: () => void;
  onSave: (band: string, reason: string) => Promise<void>;
}) {
  const [band, setBand] = useState(candidate.band);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="fm-dialog">
        <DialogHeader>
          <DialogTitle>Record evidence review</DialogTitle>
          <DialogDescription>
            {candidate.id} · A human review against the job requirements.
          </DialogDescription>
        </DialogHeader>
        <Field label="Evidence band">
          <select
            value={band}
            onChange={(e) => setBand(e.target.value as Candidate["band"])}
          >
            {["Strong evidence", "Consider", "Needs review"].map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Evidence and reasoning">
          <Textarea
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain which requirements the evidence supports and what remains uncertain."
          />
        </Field>
        <p>
          This records an evidence assessment. The hiring stage changes only
          through a separate recorded decision.
        </p>
        {error && (
          <p role="alert" className="fm-error">
            {error}
          </p>
        )}
        <Button
          disabled={busy || reason.trim().length < 20}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await onSave(band, reason);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving..." : "Save review"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
type Report = {
  snapshot: string;
  applications: number;
  checks: { label: string; issues: number; explanation: string }[];
  latestReview?: { reason: string; actor: string; at: string };
  reviewCurrent: boolean;
};
export function GovernancePanel({ auth, jobs }: { auth: string; jobs: Job[] }) {
  const [job, setJob] = useState(jobs[0]?.id || "");
  const [report, setReport] = useState<Report>();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (job)
      void request<Report>(
        `employer/jobs/${encodeURIComponent(job)}/fairness`,
        "GET",
        undefined,
        auth,
      )
        .then((r) => {
          if (!cancelled) {
            setReport(r);
            setError("");
          }
        })
        .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [auth, job, revision]);
  return (
    <>
      <PageHeading
        title="Fairness process review"
        description="Check the hiring process using saved job and application records."
      />
      <Field label="Job">
        <select
          value={job}
          onChange={(e) => {
            setReport(undefined);
            setJob(e.target.value);
            setConfirmed(false);
            setReason("");
          }}
        >
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </Field>
      {!jobs.length && <p>Create a job to start a process review.</p>}
      {error && (
        <p role="alert" className="fm-error">
          {error}
        </p>
      )}
      {report && (
        <>
          <p>
            {report.applications} applications · These checks do not measure
            demographic fairness. Protected attributes are not collected for
            this report.
          </p>
          <div className="fs-cards">
            {report.checks.map((c) => (
              <Panel key={c.label} title={c.label}>
                <StatusBadge>
                  {c.issues ? `${c.issues} to review` : "No issue detected"}
                </StatusBadge>
                <p>{c.explanation}</p>
              </Panel>
            ))}
          </div>
          <Panel title="Human review record">
            <p>
              {report.reviewCurrent
                ? "A review is saved for the current data."
                : "The current data needs a review."}
            </p>
            {report.latestReview && (
              <blockquote>
                {report.latestReview.reason}
                <br />
                <small>
                  {report.latestReview.actor} ·{" "}
                  {new Date(report.latestReview.at).toLocaleString()}
                </small>
              </blockquote>
            )}
            <Field label="Observations and follow-up actions">
              <Textarea
                value={reason}
                maxLength={2000}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              I reviewed the criteria and recorded any unresolved issues.
            </label>
            <div className="fs-actions">
              <Button
                disabled={busy || !confirmed || reason.trim().length < 20}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const saved = await request<Report>(
                      `employer/jobs/${encodeURIComponent(job)}/fairness`,
                      "POST",
                      { snapshot: report.snapshot, reason, confirmed },
                      auth,
                    );
                    setReport(saved);
                    setReason("");
                    setConfirmed(false);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save review
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setReport(undefined);
                  setRevision((r) => r + 1);
                }}
              >
                Reload checks
              </Button>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
export function EmployerInbox({
  auth,
  onClose,
}: {
  auth: string;
  onClose: () => void;
}) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void platformApi
      .notices(auth)
      .then((n) => !cancelled && setNotices(n))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [auth]);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="fm-dialog">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            Saved account and application updates.
          </DialogDescription>
        </DialogHeader>
        <div className="fm-dialog-body">
          {error && <p role="alert">{error}</p>}
          {!notices.length && <p>No updates yet.</p>}
          {notices.map((n) => (
            <Panel key={n.id} title={n.title}>
              <p>{n.message}</p>
              <small>{n.reference}</small>
              {!n.read && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await platformApi.readNotice(n.id, auth);
                      setNotices((old) =>
                        old.map((x) =>
                          x.id === n.id ? { ...x, read: true } : x,
                        ),
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Mark read
                </Button>
              )}
            </Panel>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
