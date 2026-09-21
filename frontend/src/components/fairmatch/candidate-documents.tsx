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
  suggestions?: { field: "role" | "experience" | "education" | "skills" | "courses" | "projects"; value: string; page: number; start: number; end: number; method: string }[];
  warnings?: string[];
  extractionVersion?: number;
  aiStatus?: string;
  aiReview?: {
    provider: string;
    model: string;
    promptVersion: string;
    reviewedAt: string;
    summary: string;
    skills: AiEvidence[];
    courses: AiEvidence[];
    projects: AiEvidence[];
    experience: AiEvidence[];
    warnings: string[];
  } | null;
};
type AiEvidence = { label: string; sourcePage: number; evidence: string; confidence: number };
async function parseApiResponse<T>(response: Response, fallback: string): Promise<T> {
  const text = await response.text();
  let result: {message?: string};
  try { result = text ? JSON.parse(text) as {message?: string} : {}; }
  catch { throw new Error(`${fallback} The server returned HTTP ${response.status} instead of a valid response.`); }
  if (!response.ok) throw new Error(result.message || `${fallback} The server returned HTTP ${response.status}.`);
  return result as T;
}
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
      const result = await parseApiResponse<Resume>(response, "CV upload failed.");
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
        method: "POST", headers: { Authorization: auth }, signal: AbortSignal.timeout(300000),
      });
      const result = await parseApiResponse<Resume>(response, "Extraction could not be refreshed.");
      setReview(result);
      setRevision(r => r + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function runAiReview(document: Resume) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/candidate/documents/${document.id}/ai-review`, {
        method: "POST", headers: {Authorization: auth, "Content-Type":"application/json"}, body:"{}", signal:AbortSignal.timeout(300000),
      });
      await parseApiResponse<Resume>(response, "Qwen AI review could not be started.");
      let completed:Resume|undefined;
      for(let attempt=0;attempt<100;attempt++){
        await new Promise(resolve=>setTimeout(resolve,3000));
        const latest=await request<Resume[]>("candidate/documents","GET",undefined,auth);
        setDocuments(latest);
        const current=latest.find(item=>item.id===document.id);
        if(!current)throw new Error("This CV was removed while Qwen was reviewing it.");
        if(current.aiStatus!=="Processing"){completed=current;break;}
      }
      if(!completed)throw new Error("Qwen is still processing this CV. You can leave this page and check the document again shortly.");
      if(!completed.aiReview)throw new Error(completed.aiStatus || "Qwen AI review could not be completed.");
      setReview(completed);
      setRevision(r=>r+1);
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
            <StatusBadge>{d.aiReview ? "Qwen review ready" : d.aiStatus || "AI review pending"}</StatusBadge>
            <p>
              {Math.ceil(d.bytes / 1024)} KB ·{" "}
              {new Date(d.createdAt).toLocaleDateString()}
            </p>
            <Button variant="outline" onClick={() => setReview(d)}>
              Review extraction
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void refreshExtraction(d)}>Refresh extraction</Button>
            <Button variant="outline" disabled={busy} onClick={() => void refreshExtraction(d, true)}>Read with OCR</Button>
            <Button variant="outline" disabled={busy} onClick={() => void runAiReview(d)}>{d.aiReview ? "Refresh Qwen review" : "Run Qwen AI review"}</Button>
            <p className="fm-muted">Use OCR if the extracted text is missing or unreadable. Extraction and local AI review can take several minutes on this laptop.</p>
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
  const [highlightSkills, setHighlightSkills] = useState((profile.cvSummary?.skills?.length ? profile.cvSummary.skills : profile.skills).join("\n"));
  const [courses, setCourses] = useState(profile.cvSummary?.courses?.join("\n") || "");
  const [projects, setProjects] = useState(profile.cvSummary?.projects?.join("\n") || "");
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
      setHighlightSkills(skills.slice(0,8).join("\n"));
    } else if (suggestion.field === "courses") {
      setCourses(suggestion.value.split(/\r?\n|[;•|]+/).map(s=>s.replace(/^[-–]\s*/, "").trim()).filter(Boolean).slice(0,6).join("\n"));
    } else if (suggestion.field === "projects") {
      setProjects(suggestion.value.split(/\r?\n|[;•|]+/).map(s=>s.replace(/^[-–]\s*/, "").trim()).filter(Boolean).slice(0,5).join("\n"));
    } else setForm({...form,[suggestion.field]:suggestion.value});
    setConfirmed(false);setError("");setSource(suggestion);
    setNotice("Suggestion copied to the editable form. Review it before confirming; your saved profile has not changed.");
  }
  function showAiSource(item: AiEvidence) {
    const page = resume.pages?.find(candidate => candidate.number === item.sourcePage);
    const pattern=item.evidence.trim().split(/\s+/).map(token=>token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s+");
    const match=page?.text.match(new RegExp(pattern,"i"));
    const start=match?.index ?? -1;
    setSource({field:"skills", value:item.evidence, page:item.sourcePage, start:Math.max(0,start), end:start < 0 ? 0 : start + (match?.[0].length || 0), method:"qwen-evidence"});
  }
  function applyAiItem(kind:"skills"|"courses"|"projects"|"experience", item:AiEvidence) {
    if (kind === "skills") {
      const updated=[...new Set([...highlightSkills.split(/\r?\n/).filter(Boolean),item.label])].slice(0,8);
      setHighlightSkills(updated.join("\n"));
      setForm({...form,skills:[...new Set([...form.skills,item.label])].slice(0,30)});
    } else if (kind === "courses") setCourses([...new Set([...courses.split(/\r?\n/).filter(Boolean),item.label])].slice(0,6).join("\n"));
    else if (kind === "projects") setProjects([...new Set([...projects.split(/\r?\n/).filter(Boolean),item.label])].slice(0,5).join("\n"));
    else setForm({...form,experience:[form.experience,item.label].filter(Boolean).join("\n")});
    setConfirmed(false); setError(""); showAiSource(item);
    setNotice("AI suggestion copied. Check the highlighted CV quotation before confirming it.");
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
          <p className="fm-form-key"><b className="fm-required" aria-hidden="true">*</b> Required fields must be completed. Fields labelled Optional may be left blank.</p>
          {!!resume.warnings?.length && <div role="note" className="fs-extraction-note"><strong>Check these pages</strong><ul>{resume.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></div>}
          {resume.aiReview ? <section className="fs-ai-review" aria-label="Qwen AI CV review">
            <div className="fs-ai-review-heading"><div><h3>Qwen AI review</h3><p>Generated locally with {resume.aiReview.model}. Every item below passed FairMatch&apos;s page-and-quotation validation.</p></div><StatusBadge>Candidate review required</StatusBadge></div>
            {resume.aiReview.summary && <div className="fs-ai-summary"><strong>Work-focused summary</strong><p>{resume.aiReview.summary}</p></div>}
            {(["skills","courses","projects","experience"] as const).map(kind => resume.aiReview![kind].length > 0 && <div className="fs-ai-group" key={kind}>
              <h4>{({skills:"Skills",courses:"Courses and training",projects:"Projects",experience:"Experience"})[kind]}</h4>
              {resume.aiReview![kind].map((item,index)=><article key={`${kind}-${index}`}>
                <div><strong>{item.label}</strong><small>Page {item.sourcePage} · {Math.round(item.confidence*100)}% extraction confidence</small><blockquote>{item.evidence}</blockquote></div>
                <div className="fs-actions"><Button type="button" variant="outline" onClick={()=>showAiSource(item)}>Check source</Button><Button type="button" variant="outline" onClick={()=>applyAiItem(kind,item)}>Use suggestion</Button></div>
              </article>)}
            </div>)}
            {!!resume.aiReview.warnings?.length && <div role="note"><strong>AI cautions</strong><ul>{resume.aiReview.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
            <p className="fm-muted">Qwen organizes extracted evidence; it does not verify qualifications, rank the candidate or make a hiring decision.</p>
          </section> : <div className="fs-extraction-note"><strong>Qwen AI review: {resume.aiStatus || "Pending"}</strong><p>Close this window and choose Run Qwen AI review after Ollama is running. You can still review the deterministic extraction below.</p></div>}
          {!!resume.suggestions?.length && <section className="fs-suggestions" aria-label="Unverified profile suggestions">
            <h3>Suggestions from section headings</h3><p>Your current profile stays below. Choose a suggestion only after checking its page.</p>
            {resume.suggestions.map((suggestion,i)=><article key={i}>
              <strong>{({role:"Position",experience:"Experience",education:"Education",skills:"Skills",courses:"Courses",projects:"Projects"})[suggestion.field]} · Page {suggestion.page}</strong>
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
              optional
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
          <Field required label="Confirmed skills (comma separated)" hint="Enter at least one and at most 30 skills; separate each skill with a comma.">
            <Input
              required
              aria-required="true"
              value={form.skills.join(",")}
              onChange={(e) => {
                setForm({ ...form, skills: e.target.value.split(",") });
                setConfirmed(false);
              }}
            />
          </Field>
          <section className="fs-cv-highlight-editor" aria-label="Compact CV highlights">
            <h3>Compact CV highlights</h3>
            <p>Keep only the most relevant items. These are saved after your review and shared only if you opt in while applying. One item per line; remove names, contact details and unrelated personal information.</p>
            <Field optional label="Important skills (up to 8)" hint="Optional highlights for applications where you choose to share them."><Textarea value={highlightSkills} rows={3} onChange={e=>{setHighlightSkills(e.target.value);setConfirmed(false);}} placeholder="One skill per line"/></Field>
            <Field optional label="Relevant courses or training (up to 6)"><Textarea value={courses} rows={3} onChange={e=>{setCourses(e.target.value);setConfirmed(false);}} placeholder="One course per line"/></Field>
            <Field optional label="Relevant projects (up to 5)"><Textarea value={projects} rows={3} onChange={e=>{setProjects(e.target.value);setConfirmed(false);}} placeholder="One project and your contribution per line"/></Field>
          </section>
          <p>
            Keep names and contact details out of the evidence fields used for
            blind review.
          </p>
          <label>
            <input
              required
              aria-required="true"
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            I reviewed these profile fields and confirm they are accurate.<b className="fm-required" aria-hidden="true">*</b>
          </label>
          {error && (
            <p role="alert" className="fm-error">
              {error}
            </p>
          )}
        </div>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const lines=(value:string,max:number,length:number,label:string)=>{const items=[...new Set(value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];if(items.length>max||items.some(item=>item.length>length))throw new Error(`${label}: use at most ${max} lines, each no longer than ${length} characters.`);return items;};
              const profileSkills=[...new Set(form.skills.map(skill=>skill.trim()).filter(Boolean))];
              if(profileSkills.length===0)throw new Error("Confirmed skills is required. Enter at least one skill before saving.");
              if(profileSkills.length>30||profileSkills.some(skill=>skill.length>100))throw new Error("Confirmed skills must contain at most 30 skills, with no skill longer than 100 characters.");
              if(!confirmed)throw new Error("You must confirm that you reviewed the profile fields before saving.");
              await request(
                `candidate/documents/${resume.id}/confirmation`,
                "POST",
                {
                  profile: {
                    role: form.role,
                    experience: form.experience,
                    education: form.education,
                    skills: profileSkills,
                  },
                  highlights: {
                    skills: lines(highlightSkills,8,100,"Important skills"),
                    courses: lines(courses,6,160,"Courses"),
                    projects: lines(projects,5,240,"Projects"),
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
