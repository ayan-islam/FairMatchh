"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmptyState, Panel } from "./shared";
import { request } from "@/lib/api";

type Draft = { id: string; jobId: string; updatedAt: string; values: { role?: string } };

export function CandidatePrivacy({auth}: {auth: string}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void request<Draft[]>("candidate/privacy/drafts", "GET", undefined, auth)
      .then(data => { if (!cancelled) { setDrafts(data); setError(""); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [auth, revision]);

  async function download() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/candidate/privacy/export", {headers: {Authorization: auth}, cache: "no-store", signal: AbortSignal.timeout(45000)});
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || "Your data could not be exported. Try again.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = "fairmatch-candidate-data.json"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Your export is ready and the download was requested. Check your browser's downloads.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="fs-form fs-privacy">
    {error && <p role="alert" className="fm-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <Panel title="Your data" description="Download the records linked to your candidate account.">
      <p>The JSON file includes your account details, profile, saved drafts, applications, conversations, interviews, notifications, support cases and CV extraction. Original PDFs are available separately in Documents.</p>
      <p>Keep the downloaded file private: it contains your personal information. Applications made before creating this account are not automatically linked to it.</p>
      <Button disabled={busy} onClick={() => void download()}>{busy ? "Please wait..." : "Download my data"}</Button>
    </Panel>
    <Panel title="Saved application drafts" description="Remove unfinished drafts you no longer need. Submitted applications stay in My applications.">
      <Button variant="outline" disabled={busy} onClick={() => { setLoading(true); setRevision(r => r + 1); }}>Refresh drafts</Button>
      {loading ? <p>Loading saved drafts...</p> : drafts.length === 0 ? <EmptyState title="No saved drafts" description="An unfinished application appears here after you save a draft." /> :
        <div className="fs-cards">{drafts.map(draft => <Panel key={draft.id} title={draft.values.role || "Application draft"}>
          <p>Job reference: {draft.jobId}</p>
          <p>Saved {new Date(draft.updatedAt).toLocaleString()}</p>
          <Button variant="outline" disabled={busy} onClick={() => { setRemoving(draft); setError(""); }}>Delete draft</Button>
        </Panel>)}</div>}
    </Panel>
    <Panel title="Other privacy requests">
      <p>Delete individual CVs from Documents. To ask about account removal or other retained records, open Support and select Privacy. Automatic account erasure is not available yet.</p>
    </Panel>
    <Dialog open={!!removing} onOpenChange={open => { if (!open && !busy) setRemoving(null); }}>
      <DialogContent className="fm-dialog"><DialogHeader><DialogTitle>Delete this saved draft?</DialogTitle><DialogDescription>This removes the unfinished draft for {removing?.values.role || removing?.jobId}. Your profile and any submitted application remain saved.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="fm-error">{error}</p>}
        <Button variant="outline" disabled={busy} onClick={() => setRemoving(null)}>Keep draft</Button>
        <Button disabled={busy} onClick={async () => {
          if (!removing || busy) return;
          setBusy(true); setError("");
          try {
            await request(`candidate/privacy/drafts/${encodeURIComponent(removing.jobId)}`, "DELETE", {expectedUpdatedAt: removing.updatedAt}, auth);
            setRemoving(null); setMessage("Saved draft deleted."); setRevision(r => r + 1);
          } catch (e) { setError((e as Error).message); }
          finally { setBusy(false); }
        }}>Delete saved draft</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
