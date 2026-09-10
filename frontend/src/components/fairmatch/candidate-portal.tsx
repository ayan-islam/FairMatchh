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
  ArrowUpRight,
  MapPin,
  BriefcaseBusiness,
  CalendarDays,
  ShieldCheck,
  Check,
  FileText,
  Upload,
  LockKeyhole,
  ChevronDown,
  Download,
  MessageSquare,
  CheckCircle2,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Field, StatusBadge } from "./shared";
import {
  initialJobs,
  exportCsv,
  type Job,
} from "@/lib/demo-data";
import type { ApplicationInput, Receipt } from "@/lib/api";
import "./candidate.css";

type CandidateView = "job" | "apply" | "receipt" | "status";
const steps = [
  "Your contact",
  "Privacy",
  "Your experience",
  "Confirm evidence",
  "Role questions",
  "Review & submit",
];
const sampleSkills = [
  "Order tracking",
  "Microsoft Excel",
  "Buyer communication",
];

export function CandidatePortal({
  onWorkspaceChange,
  job = initialJobs[0],
  onApplicationSubmitted,
}: {
  onWorkspaceChange: () => void;
  job?: Job;
  onApplicationSubmitted: (input: ApplicationInput) => Promise<Receipt>;
}) {
  const [view, setView] = useState<CandidateView>("job");
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [skills, setSkills] = useState(sampleSkills);
  const [newSkill, setNewSkill] = useState("");
  const [evidenceConfirmed, setEvidenceConfirmed] = useState(false);
  const [example, setExample] = useState("");
  const [availability, setAvailability] = useState("30 days");
  const [location, setLocation] = useState("Yes, I can work on-site in Dhaka");
  const [finalConsent, setFinalConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [applicationId, setApplicationId] = useState("FM-2026-0561");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("Submitted");
  const [action, setAction] = useState<
    "report" | "reply" | "appeal" | "privacy" | "interview" | null
  >(null);
  const [message, setMessage] = useState("");
  const [slot, setSlot] = useState("10 September · 11:00 AM");
  const [confirmedSlot, setConfirmedSlot] = useState("");
  const [updates, setUpdates] = useState(true);
  const [dialogError, setDialogError] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const go = (next: CandidateView) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };
  function next() {
    const e: Record<string, string> = {};
    if (step === 0 && !verified)
      e.contact = "Verify your contact using the demo code before continuing.";
    if (step === 1 && !consent)
      e.consent = "Agree to the required use of your application information.";
    if (step === 2) {
      if (!file && !manual)
        e.file = "Choose a CV or continue with a manual profile.";
      if (!name.trim()) e.name = "Enter your name.";
      if (!role.trim()) e.role = "Add your current or recent role.";
      if (experience.trim().length < 25)
        e.experience = "Describe your experience in at least 25 characters.";
    }
    if (step === 3) {
      if (!skills.length || skills.some((s) => !s.trim()))
        e.skills = "Keep at least one accurate skill claim.";
      if (!evidenceConfirmed)
        e.evidence = "Confirm that you reviewed your evidence.";
    }
    if (step === 4 && example.trim().length < 30)
      e.example = "Give a specific work example in at least 30 characters.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Please complete the highlighted fields.");
      return;
    }
    setStep(step + 1);
    window.scrollTo({ top: 0 });
  }
  async function submit() {
    if (submitting) return;
    if (!finalConsent) {
      setErrors({
        final: "Confirm the application is accurate before submitting.",
      });
      return;
    }
    setSubmitting(true); setErrors({});
    try {
      const saved = await onApplicationSubmitted({ name, contact, role, experience, education, skills: skills.map(s => s.trim()), example, availability, location, consent, evidenceConfirmed, finalConsent });
      setApplicationId(saved.id); setSubmitted(true); setStatus(saved.status); go("receipt");
      toast.success("Application saved. The employer can now review your evidence.");
    } catch (e) { setErrors({ final: (e as Error).message }); toast.error((e as Error).message); }
    finally { setSubmitting(false); }
  }
  function handleFile(selected: File | undefined) {
    if (!selected) return;
    const allowed = /\.(pdf|doc|docx|png|jpe?g)$/i;
    if (!allowed.test(selected.name)) {
      setErrors({ file: "Choose a PDF, Word document, JPG or PNG." });
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setErrors({ file: "The file must be 10 MB or smaller." });
      return;
    }
    setFile({ name: selected.name, size: selected.size });
    setErrors({});
    toast.success(
      "File selected locally. No document is uploaded in this demo.",
    );
  }
  function sample() {
    setName("Nusrat Jahan");
    setRole("Merchandising Assistant");
    setExperience(
      "I maintained the weekly Excel order tracker, checked production progress and coordinated shipment updates with buyers.",
    );
    setEducation("BBA in Marketing · National University");
    setExample(
      "When an order was delayed, I updated our delivery tracker, confirmed revised dates with production and shared a clear recovery plan with the buyer.",
    );
    setManual(true);
    toast.success("Sample profile added. Review and edit every claim.");
  }
  function receipt() {
    exportCsv("fairmatch-application-receipt.csv", [
      ["Field", "Value"],
      ["Application", applicationId],
      ["Job", job.title],
      ["Reference", job.id],
      ["Status", status],
      ["Submitted by", name || "Demo candidate"],
      ["Mode", "Persisted in local MongoDB database"],
    ]);
  }
  function openAction(next: typeof action) {
    setAction(next);
    setMessage("");
    setDialogError("");
  }
  return (
    <div className="cp-app">
      <header className="cp-header">
        <button className="cp-brand" onClick={() => go("job")}>
          FairMatch<span>.</span>
        </button>
        <div>
          <span className="cp-demo">Demo</span>
          {submitted && (
            <button className="cp-status-link" onClick={() => go("status")}>
              My application
            </button>
          )}
          <button className="cp-switch" onClick={onWorkspaceChange}>
            Candidate
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
      <main
        id="candidate-content"
        className={"cp-main " + (view === "apply" ? "cp-main-wizard" : "")}
      >
        {view === "job" && (
          <>
            <div className="cp-breadcrumb">
              Opportunities <span>/</span> {job.department}
            </div>
            <div className="cp-job-grid">
              <div>
                <StatusBadge tone="positive">
                  Sample verified employer
                </StatusBadge>
                <h1>{job.title}</h1>
                <p className="cp-company">Apex Textiles Ltd.</p>
                <div className="cp-job-facts">
                  <span>
                    <MapPin size={16} />
                    {job.location}
                  </span>
                  <span>
                    <BriefcaseBusiness size={16} />
                    Full-time
                  </span>
                  <span>
                    <CalendarDays size={16} />
                    {job.workplace}
                  </span>
                </div>
                <div className="cp-mobile-pay">
                  <strong>{job.salary}</strong>
                  <span>
                    Apply by{" "}
                    {new Date(job.closes + "T12:00:00").toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  </span>
                </div>
                <section className="cp-section">
                  <h2>A little about the role</h2>
                  <p>{job.description}</p>
                </section>
                <section className="cp-section">
                  <h2>What you’ll bring</h2>
                  <ul className="cp-requirements">
                    {job.requirements.map((r) => (
                      <li key={r}>
                        <CheckCircle2 size={18} />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="cp-section">
                  <h2>Working conditions</h2>
                  <div className="cp-conditions">
                    <div>
                      <span>Shift</span>
                      <strong>Day shift</strong>
                    </div>
                    <div>
                      <span>Overtime</span>
                      <strong>Paid during peak season</strong>
                    </div>
                    <div>
                      <span>Benefits</span>
                      <strong>Festival bonus, lunch, mobile bill</strong>
                    </div>
                    <div>
                      <span>Review target</span>
                      <strong>Within 7 working days</strong>
                    </div>
                  </div>
                </section>
                <div className="cp-fairness-note">
                  <ShieldCheck size={23} />
                  <div>
                    <strong>Your skills deserve a fair review.</strong>
                    <p>
                      Your name, photo and private contact details stay hidden
                      during the first evidence review.
                    </p>
                  </div>
                </div>
              </div>
              <aside className="cp-apply-card">
                <span className="cp-eyebrow">YOUR NEXT OPPORTUNITY</span>
                <h2>{job.salary}</h2>
                <p>Transparent pay. No application fee.</p>
                <div className="cp-deadline">
                  <CalendarDays size={18} />
                  <div>
                    <span>Apply by</span>
                    <strong>
                      {new Date(job.closes + "T12:00:00").toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </strong>
                  </div>
                </div>
                <Button
                  onClick={() => (submitted ? go("status") : go("apply"))}
                >
                  {submitted ? "View my application" : "Start application"}
                  <ArrowRight size={17} />
                </Button>
                <small>About 8–10 minutes · CV optional</small>
                <hr />
                <div className="cp-trust-line">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Never pay to apply</strong>
                    <p>FairMatch candidates are never charged a fee.</p>
                  </div>
                </div>
                <button
                  className="cp-link"
                  onClick={() => openAction("report")}
                >
                  Report a concern
                  <ArrowUpRight size={14} />
                </button>
              </aside>
            </div>
          </>
        )}
        {view === "apply" && (
          <>
            <button className="cp-back" onClick={() => go("job")}>
              <ArrowLeft size={15} />
              Back to job
            </button>
            <div className="cp-wizard-heading">
              <div>
                <span className="cp-eyebrow">{job.title}</span>
                <h1>Your next chapter starts here.</h1>
                <p>
                  You own your evidence. Review every detail before sharing it.
                </p>
              </div>
              <StatusBadge tone="neutral">Step {step + 1} of 6</StatusBadge>
            </div>
            <div className="cp-step-progress">
              <progress
                aria-label="Application progress"
                value={step + 1}
                max={6}
              />
              <div>
                {steps.map((s, i) => (
                  <span
                    key={s}
                    className={i === step ? "active" : i < step ? "done" : ""}
                  >
                    {i < step ? <Check size={12} /> : i + 1}
                    <small>{s}</small>
                  </span>
                ))}
              </div>
            </div>
            <section className="cp-form-card">
              <div className="cp-form-title">
                <span>0{step + 1}</span>
                <div>
                  <h2>{steps[step]}</h2>
                  <p>
                    {
                      [
                        "Verify a contact to keep your application connected to you.",
                        "Understand how your information will be used.",
                        "Upload a CV or tell us about your work directly.",
                        "Keep, edit or remove claims before the employer sees them.",
                        "Share a specific example of how you work.",
                        "Make sure this application represents you accurately.",
                      ][step]
                    }
                  </p>
                </div>
              </div>
              {step === 0 && (
                <div className="cp-form-content">
                  <Field label="Mobile number or email" error={errors.contact}>
                    <Input
                      value={contact}
                      onChange={(e) => {
                        setContact(e.target.value);
                        setVerified(false);
                        setCodeSent(false);
                      }}
                      placeholder="you@example.com or +880 17…"
                      type="text"
                    />
                  </Field>
                  <div className="cp-inline">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) &&
                          !/^\+?[0-9][0-9\s-]{8,15}$/.test(contact)
                        ) {
                          setErrors({
                            contact: "Enter a valid email or mobile number.",
                          });
                          return;
                        }
                        setCodeSent(true);
                        setErrors({});
                        toast.info(
                          "Demo code: 123456. No SMS or email is sent.",
                        );
                      }}
                    >
                      {codeSent ? "Resend demo code" : "Send verification code"}
                    </Button>
                    <button
                      className="cp-link"
                      onClick={() => {
                        setContact("candidate@example.com");
                        setCodeSent(true);
                        setErrors({});
                      }}
                    >
                      Use demo contact
                    </button>
                  </div>
                  {codeSent && (
                    <div className="cp-code-box">
                      <Field
                        label="Six-digit verification code"
                        hint="Demo code: 123456. No real authentication is performed."
                      >
                        <Input
                          value={code}
                          onChange={(e) =>
                            setCode(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          inputMode="numeric"
                          maxLength={6}
                          autoComplete="one-time-code"
                          placeholder="123456"
                        />
                      </Field>
                      <Button
                        disabled={verified}
                        onClick={() => {
                          if (code !== "123456") {
                            toast.error("Use the demo code 123456.");
                            return;
                          }
                          setVerified(true);
                          setErrors({});
                          toast.success("Demo contact verified.");
                        }}
                      >
                        {verified ? (
                          <>
                            <Check size={16} />
                            Verified
                          </>
                        ) : (
                          "Verify code"
                        )}
                      </Button>
                    </div>
                  )}
                  <div className="cp-soft-note">
                    <LockKeyhole size={18} />
                    <p>
                      Your contact is used for this application and its status
                      updates. It stays hidden during blind review.
                    </p>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="cp-form-content">
                  <div className="cp-privacy-items">
                    {[
                      [
                        "Your application",
                        "The employer reviews your confirmed skills, experience and role answers.",
                      ],
                      [
                        "Your identity",
                        "Names and contact details stay hidden during the initial evidence review.",
                      ],
                      [
                        "Your control",
                        "You can correct evidence, request a review or withdraw your application.",
                      ],
                    ].map(([t, d]) => (
                      <div key={t}>
                        <ShieldCheck size={20} />
                        <div>
                          <h3>{t}</h3>
                          <p>{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <label className="cp-check">
                    <Checkbox
                      checked={consent}
                      onCheckedChange={(v) => setConsent(v === true)}
                    />
                    <span>
                      I agree to use my application information to apply for
                      this role and receive application updates.
                    </span>
                  </label>
                  {errors.consent && (
                    <p className="fm-error">{errors.consent}</p>
                  )}
                  <p className="cp-fine-print">
                    No optional marketing consent is required. In this demo,
                    entries remain in browser memory.
                  </p>
                </div>
              )}
              {step === 2 && (
                <div className="cp-form-content">
                  <label className="cp-upload">
                    <Upload size={29} />
                    <strong>{file ? file.name : "Choose your CV"}</strong>
                    <span>
                      {file
                        ? `${(file.size / 1024).toFixed(0)} KB · Selected locally`
                        : "PDF, Word, JPG or PNG · Up to 10 MB"}
                    </span>
                    <input
                      aria-label="Upload your CV"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    <span className="cp-file-button">
                      {file ? "Choose another file" : "Browse files"}
                    </span>
                  </label>
                  {errors.file && <p className="fm-error">{errors.file}</p>}
                  <div className="cp-inline">
                    <button className="cp-link" onClick={() => setManual(true)}>
                      Continue without a CV
                      <ArrowRight size={14} />
                    </button>
                    <button className="cp-link" onClick={sample}>
                      Use sample profile
                    </button>
                  </div>
                  {(manual || file) && (
                    <>
                      <div className="cp-soft-note">
                        <FileText size={18} />
                        <p>
                          Demo mode doesn’t extract documents. Enter your
                          details below or use the editable sample profile.
                        </p>
                      </div>
                      <div className="cp-two-fields">
                        <Field label="Your name" error={errors.name}>
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                          />
                        </Field>
                        <Field
                          label="Current or recent role"
                          error={errors.role}
                        >
                          <Input
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="e.g. Merchandising Assistant"
                          />
                        </Field>
                      </div>
                      <Field
                        label="What did you personally do?"
                        error={errors.experience}
                      >
                        <Textarea
                          rows={4}
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          placeholder="Describe responsibilities and a specific contribution."
                        />
                      </Field>
                      <Field label="Education or training">
                        <Input
                          value={education}
                          onChange={(e) => setEducation(e.target.value)}
                          placeholder="Qualification, institution or relevant training"
                        />
                      </Field>
                    </>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="cp-form-content">
                  <div className="cp-soft-note">
                    <FileText size={18} />
                    <p>
                      These starting claims are sample suggestions, not
                      extracted facts. Keep only what accurately describes your
                      experience.
                    </p>
                  </div>
                  <div className="cp-skill-list">
                    {skills.map((skill, i) => (
                      <div key={i}>
                        <FileText size={18} />
                        <Input
                          aria-label={"Skill " + (i + 1)}
                          value={skill}
                          onChange={(e) => (
                            setSkills(
                              skills.map((s, index) =>
                                index === i ? e.target.value : s,
                              ),
                            ),
                            setEvidenceConfirmed(false)
                          )}
                        />
                        <button
                          aria-label={"Remove " + skill}
                          onClick={() => (
                            setSkills(skills.filter((_, index) => index !== i)),
                            setEvidenceConfirmed(false)
                          )}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="cp-inline">
                    <Input
                      aria-label="Add another skill"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      placeholder="Add another accurate skill"
                    />
                    <Button
                      variant="outline"
                      disabled={!newSkill.trim()}
                      onClick={() => {
                        setSkills([...skills, newSkill.trim()]);
                        setNewSkill("");
                        setEvidenceConfirmed(false);
                      }}
                    >
                      Add skill
                    </Button>
                  </div>
                  <div className="cp-evidence-source">
                    <span>YOUR SUPPORTING EXPERIENCE</span>
                    <p>{experience}</p>
                    <button className="cp-link" onClick={() => setStep(2)}>
                      <Pencil size={13} />
                      Edit experience
                    </button>
                  </div>
                  <label className="cp-check">
                    <Checkbox
                      checked={evidenceConfirmed}
                      onCheckedChange={(v) => setEvidenceConfirmed(v === true)}
                    />
                    <span>
                      I reviewed each claim and confirm it accurately reflects
                      my skills and experience.
                    </span>
                  </label>
                  {(errors.evidence || errors.skills) && (
                    <p className="fm-error">
                      {errors.evidence || errors.skills}
                    </p>
                  )}
                </div>
              )}
              {step === 4 && (
                <div className="cp-form-content">
                  <Field
                    label="Tell us about an order or task you helped deliver."
                    hint="What was your role, what did you do, and what happened?"
                    error={errors.example}
                  >
                    <Textarea
                      rows={5}
                      value={example}
                      onChange={(e) => setExample(e.target.value)}
                      placeholder="Share a specific work, study or project example…"
                    />
                  </Field>
                  <div className="cp-two-fields">
                    <Field label="When could you start?">
                      <select
                        value={availability}
                        onChange={(e) => setAvailability(e.target.value)}
                      >
                        <option>Immediately</option>
                        <option>15 days</option>
                        <option>30 days</option>
                        <option>60 days</option>
                      </select>
                    </Field>
                    <Field label="Work location">
                      <select
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      >
                        <option>Yes, I can work on-site in Dhaka</option>
                        <option>I would need to relocate</option>
                        <option>I need to discuss an accommodation</option>
                      </select>
                    </Field>
                  </div>
                </div>
              )}
              {step === 5 && (
                <div className="cp-form-content">
                  <div className="cp-review">
                    <div>
                      <h3>Your profile</h3>
                      <button className="cp-link" onClick={() => setStep(2)}>
                        Edit
                        <Pencil size={12} />
                      </button>
                    </div>
                    <strong>{name}</strong>
                    <p>
                      {role} · {education || "Education not provided"}
                    </p>
                    <p>{experience}</p>
                    <div className="cp-tags">
                      {skills.map((s, i) => (
                        <StatusBadge key={i} tone="positive">
                          {s}
                        </StatusBadge>
                      ))}
                    </div>
                    <hr />
                    <div>
                      <h3>Role answers</h3>
                      <button className="cp-link" onClick={() => setStep(4)}>
                        Edit
                        <Pencil size={12} />
                      </button>
                    </div>
                    <p>{example}</p>
                    <small>
                      Available in {availability.toLowerCase()} · {location}
                    </small>
                  </div>
                  <label className="cp-check">
                    <Checkbox
                      checked={finalConsent}
                      onCheckedChange={(v) => setFinalConsent(v === true)}
                    />
                    <span>
                      I confirm this application is accurate and agree to share
                      the confirmed information with Apex Textiles Ltd. for this
                      role.
                    </span>
                  </label>
                  {errors.final && <p className="fm-error">{errors.final}</p>}
                  <div className="cp-soft-note">
                    <ShieldCheck size={19} />
                    <p>
                      The employer makes the final decision. You can follow your
                      status and request a correction or review.
                    </p>
                  </div>
                </div>
              )}
              <footer className="cp-form-footer">
                <Button
                  variant="outline"
                  onClick={() => (step === 0 ? go("job") : setStep(step - 1))}
                >
                  <ArrowLeft size={15} />
                  Back
                </Button>
                <span>Progress stays in this open demo</span>
                {step < 5 ? (
                  <Button onClick={next}>
                    Continue
                    <ArrowRight size={15} />
                  </Button>
                ) : (
                  <Button disabled={submitting} onClick={submit}>
                    {submitting ? "Submitting…" : "Submit application"}
                    <Check size={15} />
                  </Button>
                )}
              </footer>
            </section>
          </>
        )}
        {view === "receipt" && (
          <section className="cp-receipt">
            <div className="cp-success-icon">
              <CheckCircle2 size={40} />
            </div>
            <span className="cp-eyebrow">APPLICATION RECEIVED</span>
            <h1>You’ve taken the next step.</h1>
            <p>
              Your application for <strong>{job.title}</strong> is saved and ready
              for review.
            </p>
            <div className="cp-receipt-details">
              <div>
                <span>Application reference</span>
                <strong>{applicationId}</strong>
              </div>
              <div>
                <span>Organization</span>
                <strong>Apex Textiles Ltd.</strong>
              </div>
              <div>
                <span>Expected review</span>
                <strong>Within 7 working days</strong>
              </div>
            </div>
            <Button onClick={() => go("status")}>
              Track my application
              <ArrowRight size={16} />
            </Button>
            <button className="cp-link" onClick={receipt}>
              <Download size={15} />
              Download receipt
            </button>
            <p className="cp-fine-print">
              Saved in the local FairMatch database and available in the employer
              workspace. No external notification is sent.
            </p>
          </section>
        )}
        {view === "status" && (
          <>
            <div className="cp-status-heading">
              <div>
                <span className="cp-eyebrow">{applicationId}</span>
                <h1>Your application</h1>
                <p>{job.title} · Apex Textiles Ltd.</p>
              </div>
              <StatusBadge
                tone={status === "Withdrawn" ? "neutral" : "positive"}
              >
                {status}
              </StatusBadge>
            </div>
            <div className="cp-status-grid">
              <section className="cp-status-card">
                <h2>Every step, in view.</h2>
                <p>Submission is saved. Later stages and actions below are session-only demonstrations.</p>
                <ol className="cp-timeline">
                  {[
                    "Application submitted",
                    "Evidence review",
                    "Interview",
                    "Hiring decision",
                  ].map((s, i) => (
                    <li
                      key={s}
                      className={
                        i === 0 || (confirmedSlot && i < 3) ? "done" : ""
                      }
                    >
                      <span>
                        {i === 0 || (confirmedSlot && i < 3) ? (
                          <Check size={14} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div>
                        <strong>{s}</strong>
                        <p>
                          {i === 0
                            ? "Your confirmed application is saved in the database."
                            : i === 1
                              ? "The hiring team reviews job-related evidence."
                              : i === 2
                                ? confirmedSlot ||
                                  "If shortlisted, choose an available interview time."
                                : "A human decision with a clear reason."}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
                {status === "Withdrawn" && (
                  <div className="cp-soft-note">
                    <p>Your demo application has been withdrawn.</p>
                  </div>
                )}
                <div className="cp-status-buttons">
                  <Button variant="outline" onClick={receipt}>
                    <Download size={15} />
                    Download receipt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openAction("privacy")}
                  >
                    <LockKeyhole size={15} />
                    Privacy & data
                  </Button>
                </div>
              </section>
              <div>
                <section className="cp-status-card cp-next-action">
                  <span className="cp-eyebrow">NEXT ACTION</span>
                  <h2>
                    {confirmedSlot
                      ? "Your interview is confirmed"
                      : "Explore the interview step"}
                  </h2>
                  <p>
                    {confirmedSlot ||
                      "In this demo, you can try choosing a time for the next stage."}
                  </p>
                  <Button
                    disabled={status === "Withdrawn"}
                    onClick={() => openAction("interview")}
                  >
                    <CalendarDays size={16} />
                    {confirmedSlot
                      ? "Change interview time"
                      : "Choose a demo interview time"}
                  </Button>
                </section>
                <section className="cp-status-card">
                  <h2>Need to add something?</h2>
                  <div className="cp-action-list">
                    <button onClick={() => openAction("reply")}>
                      <MessageSquare size={18} />
                      <span>Send a supporting response</span>
                      <ArrowUpRight size={15} />
                    </button>
                    <button onClick={() => openAction("appeal")}>
                      <ShieldCheck size={18} />
                      <span>Request a correction or review</span>
                      <ArrowUpRight size={15} />
                    </button>
                    <button onClick={() => openAction("report")}>
                      <LockKeyhole size={18} />
                      <span>Report a confidential concern</span>
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
            </div>
            {messages.length > 0 && (
              <section className="cp-status-card">
                <h2>Your saved responses</h2>
                {messages.map((m, i) => (
                  <div className="cp-saved-message" key={i}>
                    <MessageSquare size={17} />
                    <p>{m}</p>
                    <StatusBadge tone="neutral">Demo · Saved</StatusBadge>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
        <footer className="cp-footer">
          <span>FairMatch · Fairer hiring. Stronger Bangladesh.</span>
          <span>Demo data · No applicant fee</span>
        </footer>
      </main>
      {view === "job" && (
        <div className="cp-mobile-apply">
          <span>
            No applicant fee<small>CV optional</small>
          </span>
          <Button onClick={() => (submitted ? go("status") : go("apply"))}>
            {submitted ? "View application" : "Apply for this role"}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <Dialog open={!!action} onOpenChange={(v) => !v && setAction(null)}>
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>
              {action === "report"
                ? "Report a concern"
                : action === "reply"
                  ? "Add supporting information"
                  : action === "appeal"
                    ? "Request a correction or review"
                    : action === "privacy"
                      ? "Privacy and data controls"
                      : "Choose an interview time"}
            </DialogTitle>
            <DialogDescription>
              {action === "privacy"
                ? "Manage this local demo application."
                : "Your entry stays in this demo. No message is sent to another person."}
            </DialogDescription>
          </DialogHeader>
          {action === "interview" ? (
            <div className="cp-slot-list">
              {[
                "10 September · 11:00 AM",
                "10 September · 2:00 PM",
                "11 September · 10:00 AM",
              ].map((s) => (
                <label key={s}>
                  <input
                    type="radio"
                    name="interview-slot"
                    checked={slot === s}
                    onChange={() => setSlot(s)}
                  />
                  <span>
                    {s}
                    <small>Asia/Dhaka · Video interview</small>
                  </span>
                </label>
              ))}
            </div>
          ) : action === "privacy" ? (
            <>
              <label className="cp-check">
                <Checkbox
                  checked={updates}
                  onCheckedChange={(v) => setUpdates(v === true)}
                />
                <span>
                  Receive application status updates (demo preference)
                </span>
              </label>
              <div className="cp-soft-note">
                <LockKeyhole size={18} />
                <p>
                  Your submitted profile is stored in the local database. The controls
                  here demonstrate future privacy features; they do not change that stored record.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  exportCsv("fairmatch-my-application.csv", [
                    ["Field", "Value"],
                    ["Name", name],
                    ["Contact", contact],
                    ["Role", role],
                    ["Experience", experience],
                    ["Skills", skills.join("; ")],
                    ["Status", status],
                  ]);
                  toast.success("Your demo application data was downloaded.");
                }}
              >
                <Download size={16} />
                Download my data
              </Button>
              <Button
                variant="outline"
                disabled={status === "Withdrawn"}
                onClick={() => {
                  setStatus("Withdrawn");
                  setAction(null);
                  toast.success("Demo application withdrawn.");
                }}
              >
                Withdraw demo application
              </Button>
            </>
          ) : (
            <Field
              label={action === "report" ? "What happened?" : "Your message"}
              error={dialogError}
            >
              <Textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe the details so the right person can understand your request."
              />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>
              {action === "privacy" ? "Done" : "Cancel"}
            </Button>
            {action !== "privacy" && (
              <Button
                onClick={() => {
                  if (action === "interview") {
                    setConfirmedSlot(slot);
                    setStatus("Interview");
                    setAction(null);
                    toast.success("Demo interview time confirmed.");
                    return;
                  }
                  if (message.trim().length < 20) {
                    setDialogError(
                      "Please provide at least 20 characters of useful detail.",
                    );
                    return;
                  }
                  setMessages([...messages, message.trim()]);
                  setAction(null);
                  toast.success(
                    "Your response is saved locally. No message was sent.",
                  );
                }}
              >
                {action === "interview" ? "Confirm time" : "Save response"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
