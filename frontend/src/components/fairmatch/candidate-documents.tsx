"use client";
import { useEffect, useRef, useState } from "react";
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
import { Panel, Field, StatusBadge } from "./shared";
import { request } from "@/lib/api";
import type { Profile } from "@/lib/platform-api";
type Resume = {
  id: string;
  filename: string;
  bytes: number;
  status: string;
  text: string;
  createdAt: string;
  pages?: { number: number; text: string; method: string; truncated: boolean }[];
  suggestions?: { field: "role" | "experience" | "education" | "skills"; value: string; page: number; start: number; end: number; method: string }[];
  warnings?: string[];
  extractionVersion?: number;
};
export function CandidateDocuments({
  auth,
  profile,
  onConfirmed,
}: {
  auth: string;
  profile: Profile;
  onConfirmed: () => void;
}) {
  const [documents, setDocuments] = useState<Resume[]>([]);
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Resume | null>(null);
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void request<Resume[]>("candidate/documents", "GET", undefined, auth)
      .then((d) => !cancelled && setDocuments(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [auth, revision]);
  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Choose a PDF smaller than 8 MB.");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/candidate/documents", {
        method: "POST",
        headers: { Authorization: auth },
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Upload failed.");
      setReview(result);
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refreshExtraction(document: Resume, ocr = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/candidate/documents/${document.id}/extraction?ocr=${ocr}`, {
        method: "POST", headers: { Authorization: auth }, signal: AbortSignal.timeout(45000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Extraction could not be refreshed.");
      setReview(result);
      setRevision(r => r + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Panel
        title="Private CV documents"
        description="PDF files stay in local MinIO storage and are accessible only through your candidate account."
      >
        <Field label="Choose a PDF (maximum 8 MB, 10 pages)">
          <Input
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </Field>
        <p>
          PDFs include page sources and editable section suggestions. Scanned pages
          are read locally using English/Bangla OCR. Check the original PDF for
          reading errors; nothing is added to your profile until you confirm it.
        </p>
        <Button disabled={busy || !file} onClick={() => void upload()}>
          {busy ? "Processing document..." : "Upload CV"}
        </Button>
        {error && (
          <p role="alert" className="fm-error">
            {error}
          </p>
        )}
      </Panel>
      <div className="fs-cards">
        {documents.map((d) => (
          <Panel key={d.id} title={d.filename}>
            <StatusBadge>{d.status}</StatusBadge>
            <p>
              {Math.ceil(d.bytes / 1024)} KB ·{" "}
              {new Date(d.createdAt).toLocaleDateString()}
            </p>
            <Button variant="outline" onClick={() => setReview(d)}>
              Review extraction
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void refreshExtraction(d)}>Refresh extraction</Button>
            <Button variant="outline" disabled={busy} onClick={() => void refreshExtraction(d, true)}>Read with OCR</Button>
            <p className="fm-muted">Use OCR if the extracted text is missing or unreadable. Processing may take up to 30 seconds.</p>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch(
                    `/api/candidate/documents/${d.id}/file`,
                    { headers: { Authorization: auth } },
                  );
                  if (!response.ok) throw new Error("Download unavailable.");
                  const url = URL.createObjectURL(await response.blob());
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = d.filename;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Download
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(d)}>
              Delete CV
            </Button>
          </Panel>
        ))}
      </div>
      {review && (
        <ConfirmResume
          key={review.id}
          resume={review}
          profile={profile}
          auth={auth}
          onClose={() => setReview(null)}
          onSaved={() => {
            setReview(null);
            setRevision((r) => r + 1);
            onConfirmed();
          }}
        />
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(v) => !v && !busy && setDeleting(null)}
      >
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>Delete this CV?</DialogTitle>
            <DialogDescription>
              This removes the stored PDF and extraction. Existing confirmed
              profile fields and submitted applications remain saved.
            </DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{error}</p>}
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Keep CV
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              setBusy(true);
              try {
                await request(
                  `candidate/documents/${deleting.id}`,
                  "DELETE",
                  undefined,
                  auth,
                );
                setDeleting(null);
                setRevision((r) => r + 1);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete permanently
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function ConfirmResume({
  resume,
  profile,
  auth,
  onClose,
  onSaved,
}: {
  resume: Resume;
  profile: Profile;
  auth: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(profile);
  const [source, setSource] = useState<NonNullable<Resume["suggestions"]>[number]>();
  const [notice, setNotice] = useState("");
  const sourceRef = useRef<HTMLElement>(null);
  useEffect(()=>{ if (source) sourceRef.current?.focus(); },[source]);
  const sourcePage = resume.pages?.find(p=>p.number===source?.page);
  function applySuggestion(suggestion: NonNullable<Resume["suggestions"]>[number]) {
    if (suggestion.field === "skills") {
      const additions = suggestion.value.split(/[,;\n•|]+/).map(s=>s.replace(/^[-–]\s*/, "").trim()).filter(Boolean);
      const skills = [...new Map([...form.skills, ...additions].map(s=>[s.toLowerCase(),s])).values()];
      if (skills.length>30 || skills.some(s=>s.length>100)) {setError("This section needs editing. Enter at most 30 skills, each up to 100 characters.");return;}
      setForm({...form,skills});
    } else setForm({...form,[suggestion.field]:suggestion.value});
    setConfirmed(false);setError("");setSource(suggestion);
    setNotice("Suggestion copied to the editable form. Review it before confirming; your saved profile has not changed.");
  }
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="fm-dialog fm-dialog-wide">
        <DialogHeader>
          <DialogTitle>Confirm your CV evidence</DialogTitle>
          <DialogDescription>
            Review each suggestion against its source page, edit the profile
            fields, then confirm. Suggestions copy document text; they do not
            verify qualifications or make hiring decisions.
          </DialogDescription>
        </DialogHeader>
        <div className="fm-dialog-body fs-form">
          {!!resume.warnings?.length && <div role="note" className="fs-extraction-note"><strong>Check these pages</strong><ul>{resume.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></div>}
          {!!resume.suggestions?.length && <section className="fs-suggestions" aria-label="Unverified profile suggestions">
            <h3>Suggestions from section headings</h3><p>Your current profile stays below. Choose a suggestion only after checking its page.</p>
            {resume.suggestions.map((suggestion,i)=><article key={i}>
              <strong>{({role:"Position",experience:"Experience",education:"Education",skills:"Skills"})[suggestion.field]} · Page {suggestion.page}</strong>
              <p>{suggestion.value}</p>
              <div className="fs-actions"><Button type="button" variant="outline" onClick={()=>setSource(suggestion)}>View page {suggestion.page} source</Button><Button type="button" variant="outline" onClick={()=>applySuggestion(suggestion)}>{suggestion.field==="skills"?"Add suggested skills":"Use instead of current field"}</Button></div>
            </article>)}
          </section>}
          {notice && <p role="status">{notice}</p>}
          {source && sourcePage && <section ref={sourceRef} tabIndex={-1} className="fs-source" aria-label={`Source page ${source.page}`}>
            <h3>Page {source.page} · {sourcePage.method === "tesseract-eng-ben" ? "OCR source (check original)" : "selected source"}</h3>
            <pre>{Array.from(sourcePage.text).slice(0,source.start).join("")}<mark>{Array.from(sourcePage.text).slice(source.start,source.end).join("")}</mark>{Array.from(sourcePage.text).slice(source.end).join("")}</pre>
            <Button type="button" variant="ghost" onClick={()=>setSource(undefined)}>Close source</Button>
          </section>}
          {resume.pages?.map(page=><details className="fs-source" key={page.number}><summary>Page {page.number} · {page.method === "tesseract-eng-ben" ? "English/Bangla OCR" : "PDF text"}{page.truncated?" (shortened)":""}</summary><pre>{page.text || "No readable text found. Check the original PDF and enter missing details manually."}</pre></details>)}
          {!resume.pages?.length && <p>This older extraction has no page links. Close this form and choose Refresh extraction to add them. Your saved profile will remain unchanged.</p>}
          {!resume.pages?.length && <Field label="Extracted text (unverified)">
            <Textarea
              readOnly
              rows={8}
              value={
                resume.text ||
                "No usable text found. Enter the details below manually."
              }
            />
          </Field>}
          {(["role", "experience", "education"] as const).map((k) => (
            <Field
              key={k}
              label={
                {
                  role: "Current or recent position",
                  experience: "Confirmed work experience",
                  education: "Confirmed education",
                }[k]
              }
            >
              <Textarea
                value={form[k]}
                maxLength={
                  k === "experience" ? 6000 : k === "education" ? 1000 : 160
                }
                onChange={(e) => {
                  setForm({ ...form, [k]: e.target.value });
                  setConfirmed(false);
                }}
              />
            </Field>
          ))}
          <Field label="Confirmed skills (comma separated)">
            <Input
              value={form.skills.join(",")}
              onChange={(e) => {
                setForm({ ...form, skills: e.target.value.split(",") });
                setConfirmed(false);
              }}
            />
          </Field>
          <p>
            Keep names and contact details out of the evidence fields used for
            blind review.
          </p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I reviewed these profile fields and confirm they are accurate.
          </label>
          {error && (
            <p role="alert" className="fm-error">
              {error}
            </p>
          )}
        </div>
        <Button
          disabled={busy || !confirmed}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              await request(
                `candidate/documents/${resume.id}/confirmation`,
                "POST",
                {
                  profile: {
                    role: form.role,
                    experience: form.experience,
                    education: form.education,
                    skills: form.skills.map((s) => s.trim()).filter(Boolean),
                  },
                  confirmed,
                },
                auth,
              );
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm and save profile
        </Button>
      </DialogContent>
    </Dialog>
  );
}
