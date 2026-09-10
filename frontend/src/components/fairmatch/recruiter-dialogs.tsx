"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  ShieldCheck,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Field, StatusBadge } from "./shared";
import { academicDepartments, getJobPositions } from "@/lib/job-options";
import {
  type Job,
  type Candidate,
  type Stage,
} from "@/lib/demo-data";

type CloseProps = { onClose: () => void };

export function JobEditor({
  job,
  onClose,
  onSave,
  organizationName,
  organizationVerified,
}: CloseProps & { job?: Job; organizationName: string; organizationVerified: boolean; onSave: (job: Job) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [customDepartment, setCustomDepartment] = useState(!!job?.department && !academicDepartments.includes(job.department));
  const [customPosition, setCustomPosition] = useState(!!job?.title && !getJobPositions(job.department || "").includes(job.title));
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => ({
    title: job?.title || "",
    department: job?.department || "",
    location: job?.location || "Dhaka, Bangladesh",
    workplace: job?.workplace || "On-site",
    salary: job?.salary || "",
    description: job?.description || "",
    closes: job?.closes || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  }));
  const [requirements, setRequirements] = useState(
    job?.requirements || [
      "Relevant work experience",
      "Basic spreadsheet ability",
    ],
  );
  const [requirement, setRequirement] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const availablePositions = customDepartment ? [] : getJobPositions(form.department);
  const departmentSelected = !!form.department.trim();
  const [positionNotice, setPositionNotice] = useState("");
  const update = (key: keyof typeof form, value: string) => {
    setForm({ ...form, [key]: value });
    setErrors({ ...errors, [key]: "" });
  };
  function changeDepartment(value: string) {
    const custom = value === "__custom__";
    const department = custom ? "" : value;
    const keepPosition = !customPosition && getJobPositions(department).includes(form.title);
    setCustomDepartment(custom);
    setCustomPosition(false);
    setForm({ ...form, department, title: keepPosition ? form.title : "" });
    setErrors({ ...errors, department: "", title: "" });
    setPositionNotice(form.title && !keepPosition
      ? "Department changed. Please choose a related position or enter a custom position."
      : "");
  }
  const biased = requirements.filter((r) =>
    /\b(male|female|unmarried|married|religion|young|under \d|age \d)\b/i.test(
      r,
    ),
  );
  function next() {
    const e: Record<string, string> = {};
    if (step === 0) {
      for (const k of [
        "title",
        "department",
        "location",
        "salary",
        "description",
        "closes",
      ] as const)
        if (!form[k].trim()) e[k] = "Please complete this field.";
      if (form.description.trim().length < 25)
        e.description = "Add at least 25 characters describing the role.";
    }
    if (step === 1) {
      if (!requirements.length)
        e.requirements = "Add at least one job-related requirement.";
      if (biased.length)
        e.requirements = "Remove the flagged requirement before publishing.";
    }
    setErrors(e);
    if (!Object.keys(e).length) setStep(step + 1);
  }
  async function save(draft = false) {
    if (saving) return;
    setErrors({});
    if (!form.title.trim() || (!draft && !form.department.trim())) {
      setStep(0);
      setErrors({ ...(!form.title.trim() ? { title: "Choose a job position or enter a custom position." } : {}), ...(!draft && !form.department.trim() ? { department: "Select an academic department or program." } : {}) });
      return;
    }
    if (!draft && !confirmed) {
      setErrors({ confirmed: "Confirm the job details and no-fee policy." });
      return;
    }
    setSaving(true);
    try { await onSave({
      ...form,
      closes: form.closes || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      id: job?.id || "REF-" + Date.now().toString().slice(-5),
      requirements,
      status: draft ? "Draft" : "Active",
      applications: job?.applications || 0,
      noFeeConfirmed: confirmed,
    });
    } catch (e) { setErrors({ server: (e as Error).message }); toast.error((e as Error).message); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="fm-dialog fm-dialog-wide fm-job-editor">
        <DialogHeader>
          <DialogTitle>{job ? "Edit job" : "Create a job"}</DialogTitle>
          <DialogDescription>
            {organizationVerified ? "A clear role. Job-related requirements. A fair application." : "Save a draft now. To publish, upload evidence in Settings > Verification documents, then ask your platform administrator to review it."}
          </DialogDescription>
        </DialogHeader>
        <ol className="fm-steps">
          {["Job basics", "Requirements", "Review & publish"].map((s, i) => (
            <li
              key={s}
              className={i === step ? "active" : i < step ? "done" : ""}
            >
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="fm-dialog-body">
          {step === 0 && (
            <div className="fm-form-grid">
              <Field label="Academic department / program" error={customDepartment ? undefined : errors.department} hint="Select the applicant's academic background, such as EEE, CSE, ICT or BBA.">
                <select
                  autoFocus
                  value={customDepartment ? "__custom__" : form.department}
                  onChange={(e) => changeDepartment(e.target.value)}
                >
                  <option value="" disabled>Select academic department / program</option>
                  {academicDepartments.map(department => <option key={department}>{department}</option>)}
                  <option value="__custom__">Other academic department - specify</option>
                </select>
              </Field>
              <Field label="Job position" error={customPosition ? undefined : errors.title} hint={!departmentSelected ? "Select or enter an academic department first." : availablePositions.length ? "Positions related to your selected department. Choose custom if your role is not listed." : "Enter a custom position for this academic department."}>
                <select disabled={!departmentSelected} value={customPosition ? "__custom__" : form.title} onChange={e => {
                  const custom = e.target.value === "__custom__";
                  setCustomPosition(custom);
                  setPositionNotice("");
                  update("title", custom ? "" : e.target.value);
                }}>
                  <option value="" disabled>{departmentSelected ? "Select job position" : "Select a department first"}</option>
                  {availablePositions.map(position => <option key={position}>{position}</option>)}
                  <option value="__custom__">Custom job position</option>
                </select>
              </Field>
              {positionNotice && <p className="fm-position-notice" role="status">{positionNotice}</p>}
              {customDepartment && <Field label="Custom academic department / program" error={errors.department}><Input maxLength={120} value={form.department} onChange={e => update("department", e.target.value)} placeholder="e.g. Environmental Science" /></Field>}
              {customPosition && <Field label="Custom job position" error={errors.title}><Input maxLength={160} value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g. Junior Automation Engineer" /></Field>}
              <Field label="Location" error={errors.location}>
                <Input
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                />
              </Field>
              <Field label="Workplace">
                <select
                  value={form.workplace}
                  onChange={(e) => update("workplace", e.target.value)}
                >
                  <option>On-site</option>
                  <option>Hybrid</option>
                  <option>Remote</option>
                </select>
              </Field>
              <Field
                label="Salary range"
                error={errors.salary}
                hint="Transparency helps candidates decide whether to apply."
              >
                <Input
                  value={form.salary}
                  onChange={(e) => update("salary", e.target.value)}
                  placeholder="BDT 28,000 – 38,000 monthly"
                />
              </Field>
              <Field label="Application deadline" error={errors.closes}>
                <Input
                  type="date"
                  value={form.closes}
                  onChange={(e) => update("closes", e.target.value)}
                />
              </Field>
              <div className="fm-span-2">
                <Field label="Job description" error={errors.description}>
                  <Textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="What will this person do? Describe responsibilities and working conditions."
                  />
                </Field>
              </div>
            </div>
          )}
          {step === 1 && (
            <>
              <div className="fm-notice">
                <ShieldCheck size={20} />
                <div>
                  <strong>
                    Evaluate the work, not the person’s background
                  </strong>
                  <p>
                    Include only evidence a candidate needs to do this job. This
                    form checks common exclusionary wording.
                  </p>
                </div>
              </div>
              <p className="fm-muted">For candidate ranking, save this job as a draft, then open Jobs → Ranking setup to define weights and rating descriptions before publishing.</p>
              <div className="fm-requirements">
                {requirements.map((r, i) => (
                  <div key={i} className={biased.includes(r) ? "flagged" : ""}>
                    <span>{r}</span>
                    <StatusBadge
                      tone={biased.includes(r) ? "danger" : "positive"}
                    >
                      {biased.includes(r) ? "Needs correction" : "Job-related"}
                    </StatusBadge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={"Remove " + r}
                      onClick={() =>
                        setRequirements(
                          requirements.filter((_, index) => index !== i),
                        )
                      }
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="fm-inline-form">
                <Input
                  aria-label="New requirement"
                  value={requirement}
                  onChange={(e) => setRequirement(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && requirement.trim()) {
                      setRequirements([...requirements, requirement.trim()]);
                      setRequirement("");
                    }
                  }}
                  placeholder="Add a skill or experience requirement"
                />
                <Button
                  variant="outline"
                  disabled={!requirement.trim()}
                  onClick={() => {
                    setRequirements([...requirements, requirement.trim()]);
                    setRequirement("");
                  }}
                >
                  <Plus size={16} />
                  Add
                </Button>
              </div>
              {errors.requirements && (
                <p className="fm-error" role="alert">
                  {errors.requirements}
                </p>
              )}
            </>
          )}
          {step === 2 && (
            <>
              <div className="fm-review-card">
                <StatusBadge tone="positive">Candidate preview</StatusBadge>
                <h2>{form.title}</h2>
                <p><strong>Academic department / program:</strong> {form.department}</p>
                <p>
                  {organizationName} · {form.location} · {form.workplace}
                </p>
                <strong>{form.salary}</strong>
                <p>{form.description}</p>
                <h3>Confirmed requirements</h3>
                <ul>
                  {requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                <p>
                  Apply by{" "}
                  {new Date(form.closes + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </p>
              </div>
              <label className="fm-check-row">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                <span>
                  I confirm these requirements are job-related and applicants
                  will never be charged a fee.
                </span>
              </label>
              {errors.confirmed && (
                <p className="fm-error" role="alert">
                  {errors.confirmed}
                </p>
              )}
            </>
          )}
          {errors.server && <p className="fm-error" role="alert">{errors.server}</p>}
        </div>
        <DialogFooter className="fm-dialog-footer">
          <Button disabled={saving} variant="ghost" onClick={() => save(true)}>
            {saving ? "Saving…" : "Save as draft"}
          </Button>
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                <ArrowLeft size={16} />
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={next}>
                Continue
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button disabled={saving || !organizationVerified} onClick={() => save()}>
                <Check size={16} />
                {saving ? "Saving…" : "Publish job"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EvidenceDialog({
  candidate,
  onClose,
  onMove,
  onRequest, onReview, job,
}: CloseProps & {
  candidate: Candidate;
  onMove: () => void;
  onRequest: () => void;
  onReview: () => void;
  job?: Job;
}) {
  const [source, setSource] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="fm-dialog fm-dialog-wide">
        <DialogHeader>
          <DialogTitle>Candidate evidence</DialogTitle>
          <DialogDescription>
            {candidate.id} · Identity hidden during blind review
          </DialogDescription>
        </DialogHeader>
        <div className="fm-dialog-body">
          <div className="fm-evidence-heading">
            <div>
              <h2>Evidence, not assumptions</h2>
              <p>Candidate-confirmed claims with traceable sources.</p>
            </div>
            <StatusBadge>{candidate.band}</StatusBadge>
          </div>
          <div className="fm-facts">
            <div>
              <span>Relevant experience</span>
              <strong>{candidate.experience}</strong>
            </div>
            <div>
              <span>Education</span>
              <strong>{candidate.education}</strong>
            </div>
            <div>
              <span>Availability</span>
              <strong>{candidate.availability || "Not provided"}</strong>
            </div>
          </div>
          <h3 className="fm-subheading">Published job requirements</h3>
          <ul>{job?.requirements.map(r => <li key={r}>{r}</li>)}</ul>
          <h3 className="fm-subheading">Candidate skill claims</h3>
          <div className="fm-evidence-rows">
            {candidate.skills.map((skill) => (
              <div key={skill}>
                <div>
                  <strong>{skill}</strong>
                  <p>
                    Candidate confirmation · Profile review
                  </p>
                </div>
                <StatusBadge
                  tone={
                    candidate.band === "Needs review" ? "warning" : "positive"
                  }
                >
                  {candidate.band === "Needs review" ? "Awaiting review" : "Reviewed"}
                </StatusBadge>
                <Button variant="ghost" onClick={() => setSource(!source)}>
                  <FileText size={16} />
                  Source
                </Button>
              </div>
            ))}
          </div>
          {source && (
            <div className="fm-source">
              <div>
                <FileText size={18} />
                <strong>Candidate-provided experience</strong>
                <StatusBadge tone="neutral">Manual profile</StatusBadge>
              </div>
              <blockquote>{candidate.evidence}</blockquote>
              <p>
                The candidate reviewed this statement. Confirm relevance before
                making a decision.
              </p>
            </div>
          )}
          {candidate.stageReason && <div className="fm-source"><strong>Latest hiring decision: {candidate.stage}</strong><p>{candidate.stageReason}</p></div>}
          {candidate.example && <div className="fm-source"><strong>Role answer</strong><p>{candidate.example}</p></div>}
          <div className="fm-notice">
            <ShieldCheck size={20} />
            <div>
              <strong>Human decision required</strong>
              <p>
                Evidence bands support review. They never automatically hire or
                reject a candidate.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onReview}>Review evidence</Button>
          <Button variant="outline" onClick={onRequest}>
            Request information
          </Button>
          <Button onClick={onMove}>
            Update hiring stage
            <ArrowRight size={16} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StageDialog({
  candidate,
  onClose,
  onSave,
}: CloseProps & {
  candidate: Candidate;
  onSave: (stage: Stage, reason: string) => Promise<void>;
}) {
  const [stage, setStage] = useState<Stage>(
    candidate.stage === "New"
      ? "Shortlisted"
      : candidate.stage === "Shortlisted"
        ? "Interview"
        : candidate.stage === "Interview"
          ? "Offer"
          : candidate.stage,
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="fm-dialog">
        <DialogHeader>
          <DialogTitle>Record a hiring decision</DialogTitle>
          <DialogDescription>
            {candidate.id} · Current stage: {candidate.stage}
          </DialogDescription>
        </DialogHeader>
        <Field label="New stage">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as Stage)}
          >
            {(
              [
                "New",
                "Shortlisted",
                "Interview",
                "Offer",
                "Hired",
                "Not selected",
              ] as Stage[]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field
          label="Job-related reason"
          hint="Record the evidence behind your decision. This will appear in the activity history."
          error={error}
        >
          <Textarea
            autoFocus
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the evidence supporting this change…"
          />
        </Field>
        {stage === "Not selected" && (
          <div className="fm-notice fm-notice-warning">
            <p>
              Use a clear, respectful reason that relates to the role. The
              candidate can request a review.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button disabled={saving} variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving || stage === candidate.stage}
            onClick={async () => {
              if (saving) return;
              if (reason.trim().length < 15)
                setError(
                  "Please add a meaningful reason of at least 15 characters.",
                );
              else {
                setError(""); setSaving(true);
                try { await onSave(stage, reason.trim()); }
                catch (e) { setError((e as Error).message); }
                finally { setSaving(false); }
              }
            }}
          >
            {saving ? "Saving..." : "Save decision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestDialog({
  candidate,
  onClose,
  onSave,
}: CloseProps & { candidate: Candidate; onSave: (message: string) => Promise<void> }) {
  const [message, setMessage] = useState(
    "Please share an example of an order tracker or a delivery report you created. You may remove confidential company information.",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="fm-dialog">
        <DialogHeader>
          <DialogTitle>Request supporting information</DialogTitle>
          <DialogDescription>
            {candidate.id} · Keep your request specific and job-related.
          </DialogDescription>
        </DialogHeader>
        <Field label="Message to candidate" error={error}>
          <Textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <p className="fm-muted">
          The request will be saved in the candidate’s application conversation and in-app inbox. Email and SMS are not connected.
        </p>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={saving}
            onClick={async () => {
              if (message.trim().length < 20)
                setError(
                  "Please give the candidate a clear request (at least 20 characters).",
                );
              else { setSaving(true); setError(""); try { await onSave(message); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
            }}
          >
            Save request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
