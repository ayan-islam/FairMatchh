"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Field } from "./shared";
import { rubricQuestions, type Candidate, type Interview, type Job } from "@/lib/demo-data";
import type { InterviewInput } from "@/lib/api";
import { useCurrentTime } from "./use-current-time";

type CloseProps = { onClose: () => void };
const dhakaDate = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function ScheduleDialog({ candidates, jobs, interview, onClose, onSave }: CloseProps & {
  candidates: Candidate[]; jobs: Job[]; interview?: Interview;
  onSave: (input: InterviewInput) => Promise<void>;
}) {
  const [candidateId, setCandidateId] = useState(interview?.candidateId || "");
  const [date, setDate] = useState(() => interview?.date || dhakaDate(new Date(Date.now() + 86400000)));
  const [time, setTime] = useState(interview?.time || "11:00");
  const [format, setFormat] = useState(interview?.format || "Video interview");
  const [location, setLocation] = useState(interview?.location || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (saving) return;
    if (!candidateId || !date || !time || !location.trim()) {
      setError("Choose a candidate, date, time and meeting details."); return;
    }
    if (new Date(`${date}T${time}:00+06:00`).getTime() <= Date.now()) {
      setError("Choose a future date and time in Asia/Dhaka."); return;
    }
    setSaving(true); setError("");
    try { await onSave({ candidateId, date, time, format, location }); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={v => !v && !saving && onClose()}>
    <DialogContent className="fm-dialog">
      <DialogHeader><DialogTitle>{interview ? "Reschedule interview" : "Schedule an interview"}</DialogTitle>
        <DialogDescription>Times use Asia/Dhaka. Candidate accounts receive an in-app update. Email and SMS are not connected; share details manually with legacy applicants.</DialogDescription></DialogHeader>
      <div className="fm-dialog-body">
        <fieldset disabled={saving} className="fm-interview-form">
          <Field label="Candidate">
            <select value={candidateId} disabled={!!interview} onChange={e => setCandidateId(e.target.value)}>
              <option value="" disabled>Select an application</option>
              {candidates.map(c => <option key={c.id} value={c.id}>{c.id} - {jobs.find(j => j.id === c.jobId)?.title || "Application"}</option>)}
            </select>
          </Field>
          {!candidates.length && <p role="status">No eligible applications yet. Candidates with final hiring decisions cannot be scheduled.</p>}
          <div className="fm-form-grid">
            <Field label="Date"><Input type="date" min={dhakaDate(new Date())} value={date} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Time (Asia/Dhaka)"><Input type="time" value={time} onChange={e => setTime(e.target.value)} /></Field>
          </div>
          <Field label="Format"><select value={format} onChange={e => setFormat(e.target.value)}>
            <option>Video interview</option><option>On-site interview</option><option>Phone interview</option>
          </select></Field>
          <Field label="Meeting details" hint={format === "Video interview" ? "Meeting link and joining instructions." : format === "On-site interview" ? "Office address and arrival instructions." : "Phone arrangements and calling instructions."}>
            <Textarea maxLength={500} value={location} onChange={e => setLocation(e.target.value)} />
          </Field>
        </fieldset>
        {error && <p className="fm-error" role="alert">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Back</Button>
        <Button disabled={saving || !candidates.length} onClick={save}>{saving ? "Saving..." : interview ? "Save changes" : "Save interview"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function RubricDialog({ interview, onClose, onSave }: CloseProps & {
  interview: Interview; onSave: (scores: number[], notes: string) => Promise<void>;
}) {
  const [scores, setScores] = useState(interview.scores);
  const [notes, setNotes] = useState(interview.notes);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const readOnly = interview.status !== "Scheduled";
  const now = useCurrentTime(1000);
  const future = new Date(`${interview.date}T${interview.time}+06:00`).getTime() > now;
  async function save() {
    if (saving || readOnly) return;
    if (scores.length !== 4 || scores.some(s => s < 1 || s > 5) || notes.trim().length < 15) {
      setError("Rate all four areas and add at least 15 characters of evidence notes."); return;
    }
    setSaving(true); setError("");
    try { await onSave(scores, notes); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={v => !v && !saving && onClose()}>
    <DialogContent className="fm-dialog fm-dialog-wide">
      <DialogHeader><DialogTitle>Structured interview evaluation</DialogTitle>
        <DialogDescription>{interview.candidateId} · Rate observed evidence from 1 (limited) to 5 (strong). Evaluations do not change hiring stages.</DialogDescription></DialogHeader>
      <div className="fm-dialog-body">
        {future && !readOnly && <p role="status">You can review the questions now. Save the evaluation after the scheduled time.</p>}
        {readOnly && <p role="status">This completed evaluation is a saved record and cannot be edited.</p>}
        <fieldset disabled={saving || readOnly}>
          {rubricQuestions.map((q, i) => <div className="fm-rubric-row" key={q.title}>
            <span className="fm-rubric-number">0{i + 1}</span><div><h3>{q.title}</h3><p>{q.question}</p>
              <div className="fm-rating" role="group" aria-label={`${q.title} score`}>
                {[1,2,3,4,5].map(n => <button key={n} aria-label={`${q.title}: ${n}`} aria-pressed={scores[i] === n}
                  className={scores[i] === n ? "selected" : ""} onClick={() => setScores(scores.map((s, index) => index === i ? n : s))}>{n}</button>)}
              </div></div>
          </div>)}
          <Field label="Evidence notes"><Textarea maxLength={5000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Record specific examples from the interview." /></Field>
        </fieldset>
        {error && <p className="fm-error" role="alert">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Close evaluation</Button>
        {!readOnly && <Button disabled={saving || future} onClick={save}>{saving ? "Saving..." : "Save evaluation"}</Button>}</DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function CancelInterviewDialog({ interview, onClose, onSave }: CloseProps & {
  interview: Interview; onSave: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (saving) return;
    if (reason.trim().length < 15) { setError("Add a reason of at least 15 characters."); return; }
    setSaving(true); setError("");
    try { await onSave(reason); } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={v => !v && !saving && onClose()}><DialogContent className="fm-dialog">
    <DialogHeader><DialogTitle>Cancel interview</DialogTitle><DialogDescription>{interview.candidateId} · {interview.date} at {interview.time} Asia/Dhaka. The record and reason will remain in the history.</DialogDescription></DialogHeader>
    <Field label="Cancellation reason"><Textarea disabled={saving} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></Field>
    {error && <p className="fm-error" role="alert">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={saving} onClick={onClose}>Keep interview</Button><Button variant="destructive" disabled={saving} onClick={save}>{saving ? "Saving..." : "Cancel interview"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
