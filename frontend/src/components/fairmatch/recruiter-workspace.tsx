"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  UsersRound,
  Columns3,
  CalendarDays,
  ShieldCheck,
  ChartNoAxesCombined,
  Settings,
  ChevronDown,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Download,
  Link2,
  Bell,
  Menu,
  X,
  Check,
  Clock3,
  FileCheck2,
  ArrowLeftRight,
  LockKeyhole,
} from "lucide-react";
import { useMobileNavigation } from "./use-mobile-navigation";
import { toast } from "sonner";
import {
  exportCsv,
  type Job,
  type Candidate,
  type Stage,
  type AuditEvent,
  type Interview,
} from "@/lib/demo-data";
import {
  PageHeading,
  Panel,
  Metric,
  SearchField,
  EmptyState,
  StatusBadge,
  TextAction,
  Field,
} from "./shared";
import {
  JobEditor,
  EvidenceDialog,
  StageDialog,
} from "./recruiter-dialogs";
import { ScheduleDialog, RubricDialog, CancelInterviewDialog } from "./interview-dialogs";
import type { InterviewInput } from "@/lib/api";
import { useCurrentTime } from "./use-current-time";
import "./recruiter.css";
import { ApplicationConversation } from "./application-conversation";
import type { Organization, Member } from "@/lib/platform-api";
import { OrganizationDocuments, type OrganizationEvidence } from "./organization-documents";
import { GovernancePanel, EmployerInbox } from "./governance-panel";
import { CandidateRanking } from "./candidate-ranking";
import { CriteriaReviewDialog } from "./criteria-review";

type View =
  | "overview"
  | "jobs"
  | "applications"
  | "ranking"
  | "pipeline"
  | "interviews"
  | "fairness"
  | "reports"
  | "settings";
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { id: "applications", label: "Applications", icon: UsersRound },
  { id: "ranking", label: "Candidate ranking", icon: ChartNoAxesCombined },
  { id: "pipeline", label: "Hiring pipeline", icon: Columns3 },
  { id: "interviews", label: "Interviews", icon: CalendarDays },
  { id: "fairness", label: "Fairness", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
export function RecruiterWorkspace({
  onWorkspaceChange,
  onCandidatePreview,
  jobs,
  onSaveJob,
  candidates,
  onMoveCandidate,
  auditEvents,
  interviews,
  onScheduleInterview,
  onEvaluateInterview,
  onCancelInterview, organization, members, onSaveOrganization, onOrganizationChanged, onReviewCandidate, auth,
}: {
  organization: Organization;
  members: Member[];
  onSaveOrganization: (org: Organization) => Promise<Organization>;
  onOrganizationChanged: (org: Organization) => void;
  onReviewCandidate: (candidate: Candidate) => void;
  onRequestInformation: (candidate: Candidate, message: string) => Promise<void>;
  auth: string;
  onWorkspaceChange: () => void;
  onCandidatePreview: (job?: Job) => void;
  jobs: Job[];
  onSaveJob: (job: Job) => Promise<Job>;
  candidates: Candidate[];
  onMoveCandidate: (candidate: Candidate, stage: Stage, reason: string) => Promise<void>;
  auditEvents: AuditEvent[];
  interviews: Interview[];
  onScheduleInterview: (input: InterviewInput, existing?: Interview) => Promise<void>;
  onEvaluateInterview: (interview: Interview, scores: number[], notes: string) => Promise<void>;
  onCancelInterview: (interview: Interview, reason: string) => Promise<void>;
}) {
  const [rankingJobId, setRankingJobId] = useState<string>();
  const [view, setView] = useState<View>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const { sidebarRef, contentRef, toggleRef } = useMobileNavigation(
    mobileMenu,
    setMobileMenu,
  );
  const switchWorkspace = () => {
    setMobileMenu(false);
    onWorkspaceChange();
  };
  const [sessionEvents, setEvents] = useState<AuditEvent[]>([]);
  const events = [...sessionEvents, ...auditEvents];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [jobFilter, setJobFilter] = useState("All jobs");
  const [selected, setSelected] = useState("FM-2026-0376");
  const [editingJob, setEditingJob] = useState<Job | true | null>(null);
  const [evidence, setEvidence] = useState<Candidate | null>(null);
  const [decision, setDecision] = useState<Candidate | null>(null);
  const [request, setRequest] = useState<Candidate | null>(null);
  const [schedule, setSchedule] = useState<Interview | true | null>(null);
  const [cancellingInterview, setCancellingInterview] = useState<Interview | null>(null);
  const [rubric, setRubric] = useState<Interview | null>(null);
  const [shareJob, setShareJob] = useState<Job | null>(null);
  const [notifications, setNotifications] = useState(false);
  const [settingsTab, setSettingsTab] = useState("Organization");
  const [org, setOrg] = useState(organization);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const evidenceLoaded = useCallback((bundle: OrganizationEvidence) => { setOrg(bundle.organization); onOrganizationChanged(bundle.organization); }, [onOrganizationChanged]);
  const [reviewing, setReviewing] = useState<Candidate | null>(null);
  const team = members;
  const current = candidates.find((c) => c.id === selected) || candidates[0];
  const activeJobs = jobs.filter((j) => j.status === "Active");
  const newCandidates = candidates.filter((c) => c.stage === "New");
  const now = useCurrentTime();
  const upcomingInterviews = interviews.filter(i => i.status === "Scheduled" && new Date(`${i.date}T${i.time}+06:00`).getTime() >= now);
  const filteredInterviews = interviews.filter(i => filter === "All" || (filter === "Upcoming" ? upcomingInterviews.some(u => u.id === i.id) : i.status === filter));
  const navigate = (next: View) => {
    setView(next);
    setQuery("");
    setFilter("All");
    setMobileMenu(false);
    window.scrollTo({ top: 0 });
  };
  const log = (title: string, detail: string) =>
    setEvents((prev) => [
      {
        id: "event-" + Date.now(),
        title,
        detail,
        time: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
  const saveJob = async (input: Job) => {
    const job = await onSaveJob(input);
    setEditingJob(null);
    log(
      job.status === "Active" ? "Job published" : "Job draft saved",
      job.title + " · " + job.id,
    );
    toast.success(
      job.status === "Active"
        ? "Job published and saved to the database."
        : "Draft saved to the database.",
    );
    navigate("jobs");
    setFilter(job.status === "Draft" ? "Draft" : "All");
    if (job.status === "Active") setShareJob(job);
  };
  const saveDecision = async (stage: Stage, reason: string) => {
    if (!decision) return;
    await onMoveCandidate(decision, stage, reason);
    toast.success("Hiring stage and reason saved to the database.");
    setDecision(null);
  };
  const filteredJobs = jobs.filter(
    (j) =>
      (filter === "All" || j.status === filter) &&
      (j.title + " " + j.id).toLowerCase().includes(query.toLowerCase()),
  );
  const filteredCandidates = candidates.filter(
    (c) =>
      (jobFilter === "All jobs" || c.jobId === jobFilter) &&
      (filter === "All" || c.band === filter || c.stage === filter) &&
      (c.id + " " + c.skills.join(" "))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function downloadReport() {
    exportCsv("fairmatch-hiring-report.csv", [
      ["Job", "Department", "Reference", "Status", "Applications", "Completed interviews", "Hired", "Closes"],
      ...jobs.map((j) => [j.title, j.department, j.id, j.status, j.applications,
        interviews.filter(i => i.jobId === j.id && i.completed).length,
        candidates.filter(c => c.jobId === j.id && c.stage === "Hired").length, j.closes]),
    ]);
    toast.success("Report downloaded.");
  }
  function copyLink(job: Job) {
    const url = window.location.origin + "/?workspace=candidate&job=" + job.id;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Application link copied."))
      .catch(() => toast.error("Copy the link from the field below."));
  }

  return (
    <div className="fm-app">
      {mobileMenu && (
        <button
          className="fm-menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="employer-navigation"
        role={mobileMenu ? "dialog" : undefined}
        aria-modal={mobileMenu || undefined}
        className={"fm-sidebar " + (mobileMenu ? "is-open" : "")}
        aria-label="Employer navigation"
      >
        <button
          className="fm-nav-close"
          aria-label="Close menu"
          onClick={() => setMobileMenu(false)}
        >
          <X size={20} />
        </button>
        <button className="fm-brand" onClick={() => navigate("overview")}>
          <span>
            FairMatch<span className="fm-brand-dot">.</span>
          </span>
          <small>Fairer hiring. Stronger Bangladesh.</small>
        </button>
        <button className="fm-workspace-button" onClick={switchWorkspace}>
          <span className="fm-org-avatar">AT</span>
          <span>
            <strong>{org.name}</strong>
            <small>Employer workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <p className="fm-nav-label">WORKSPACE</p>
        <nav>
          {navigation.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "applications" && (
                <span className="fm-nav-count">{candidates.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="fm-sidebar-bottom">
          <div className="fm-sidebar-note">
            <ShieldCheck size={19} />
            <div>
              <strong>Evidence comes first</strong>
              <p>Every decision stays human.</p>
            </div>
          </div>
          <button className="fm-user" onClick={switchWorkspace}>
            <span className="fm-user-avatar">RK</span>
            <span>
              <strong>{members[0]?.name || "Employer"}</strong>
              <small>Recruiter</small>
            </span>
            <ArrowLeftRight size={16} />
          </button>
        </div>
      </aside>
      <div className="fm-workspace-main" ref={contentRef}>
        <header className="fm-topbar">
          <div>
            <button
              className="fm-mobile-toggle"
              ref={toggleRef}
              aria-expanded={mobileMenu}
              aria-controls="employer-navigation"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="fm-breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{navigation.find((n) => n.id === view)?.label}</strong>
            </span>
          </div>
          <div className="fm-topbar-actions">
            <span className="fm-demo-label">
              <span />
              Connected workspace
            </span>
            <button
              className="fm-topbar-link"
              onClick={() => onCandidatePreview()}
            >
              Candidate view
              <ArrowUpRight size={14} />
            </button>
            <button
              className="fm-icon-button"
              aria-label="View recent activity"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              <span className="fm-notification-dot" />
            </button>
            <span className="fm-user-avatar small">RK</span>
          </div>
        </header>
        <main className="fm-main" id="main-content">
          {view === "overview" && (
            <>
              <PageHeading
                eyebrow="YOUR HIRING WORKSPACE"
                title="Your hiring workspace"
                description="A clearer view of your hiring. Here’s what needs your attention."
                actions={
                  <Button onClick={() => setEditingJob(true)}>
                    <Plus size={17} />
                    Create a job
                  </Button>
                }
              />
              <div className="fm-metrics">
                <Metric
                  label="Active jobs"
                  value={activeJobs.length}
                  note="Across your organization"
                  icon={<BriefcaseBusiness size={18} />}
                />
                <Metric
                  label="Applications"
                  value={jobs
                    .filter((j) => j.status !== "Closed")
                    .reduce((n, j) => n + j.applications, 0)}
                  note="Across current openings"
                  icon={<UsersRound size={18} />}
                />
                <Metric
                  label="Needs review"
                  value={
                    candidates.filter((c) => c.band === "Needs review").length
                  }
                  note="Evidence needs a closer look"
                  icon={<FileCheck2 size={18} />}
                />
                <Metric
                  label="Upcoming interviews"
                  value={upcomingInterviews.length}
                  note="Structured, job-related conversations"
                  icon={<CalendarDays size={18} />}
                />
              </div>
              <div className="fm-attention-strip">
                <div className="fm-attention-icon">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <strong>Good hiring starts with a fair review.</strong>
                  <p>
                    {newCandidates.length} new applications are ready. Review
                    confirmed evidence before making your next decision.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate("applications")}
                >
                  Review applications
                  <ArrowRight size={16} />
                </Button>
              </div>
              <div className="fm-overview-grid">
                <Panel
                  title="Your active jobs"
                  description="Keep each opportunity moving forward."
                  action={
                    <TextAction onClick={() => navigate("jobs")}>
                      View all jobs
                    </TextAction>
                  }
                >
                  <div className="fm-table-scroll">
                    <table className="fm-table">
                      <thead>
                        <tr>
                          <th>JOB</th>
                          <th>APPLICANTS</th>
                          <th>STATUS</th>
                          <th>
                            <span className="sr-only">Action</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeJobs.slice(0, 4).map((j) => (
                          <tr key={j.id}>
                            <td>
                              <button
                                className="fm-cell-title"
                                onClick={() => {
                                  setJobFilter(j.id);
                                  navigate("applications");
                                }}
                              >
                                {j.title}
                              </button>
                              <small>
                                {j.id} · {j.department}
                              </small>
                            </td>
                            <td>
                              <span className="fm-count">{j.applications}</span>
                            </td>
                            <td>
                              <StatusBadge>{j.status}</StatusBadge>
                            </td>
                            <td>
                              <button
                                className="fm-row-arrow"
                                aria-label={"Open " + j.title}
                                onClick={() =>
                                  j.status === "Draft"
                                    ? setEditingJob(j)
                                    : (setJobFilter(j.id),
                                      navigate("applications"))
                                }
                              >
                                <ArrowUpRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="fm-panel-foot">
                    <span>Clear requirements. Better applications.</span>
                    <button onClick={() => setEditingJob(true)}>
                      Create a job
                      <Plus size={15} />
                    </button>
                  </div>
                </Panel>
                <Panel
                  title="Recent activity"
                  description="A traceable history of your hiring work."
                  className="fm-activity-panel"
                >
                  <div className="fm-activity-list">
                    {events.slice(0, 4).map((e, i) => (
                      <div className="fm-activity" key={e.id}>
                        <span
                          className={
                            "fm-activity-mark " + (i === 0 ? "recent" : "")
                          }
                        >
                          <Check size={12} />
                        </span>
                        <div>
                          <span>{e.time}</span>
                          <strong>{e.title}</strong>
                          <p>{e.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <TextAction onClick={() => setNotifications(true)}>
                    View activity history
                  </TextAction>
                </Panel>
              </div>
              <div className="fm-bottom-grid">
                <Panel
                  title="Next on your calendar"
                  action={
                    <TextAction onClick={() => navigate("interviews")}>
                      All interviews
                    </TextAction>
                  }
                >
                  <div className="fm-calendar-preview">
                    {upcomingInterviews
                      .slice(0, 2)
                      .map((i) => (
                        <button key={i.id} onClick={() => setRubric(i)}>
                          <span className="fm-date-tile">
                            <small>{new Date(i.date + "T12:00:00").toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</small>
                            <strong>{i.date.slice(-2)}</strong>
                          </span>
                          <span>
                            <strong>{i.candidateId}</strong>
                            <small>
                              {i.time} · {i.format}
                            </small>
                          </span>
                          <ArrowUpRight size={17} />
                        </button>
                      ))}
                    {!upcomingInterviews.length && <p>No upcoming interviews. Schedule one from an application.</p>}
                  </div>
                </Panel>
                <Panel
                  title="Built around candidate trust"
                  className="fm-trust-panel"
                >
                  <p>
                    Blind review protects identity until it’s relevant.
                    Candidate-confirmed evidence makes your next conversation
                    count.
                  </p>
                  <div>
                    <StatusBadge tone="positive">
                      Blind review enabled
                    </StatusBadge>
                    <button onClick={() => navigate("fairness")}>
                      View fairness checks
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </Panel>
              </div>
            </>
          )}
          {view === "jobs" && (
            <>
              <PageHeading
                title="Jobs"
                description="Create, publish and manage opportunities in one place."
                actions={
                  <Button onClick={() => setEditingJob(true)}>
                    <Plus size={17} />
                    Create a job
                  </Button>
                }
              />
              <div className="fm-toolbar">
                <div className="fm-filter-tabs">
                  {["All", "Active", "Draft", "Closed"].map((f) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      className={filter === f ? "active" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                      <span>
                        {f === "All"
                          ? jobs.length
                          : jobs.filter((j) => j.status === f).length}
                      </span>
                    </button>
                  ))}
                </div>
                <SearchField
                  label="Search jobs"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search title or reference…"
                />
              </div>
              <Panel>
                <div className="fm-table-scroll">
                  <table className="fm-table">
                    <thead>
                      <tr>
                        <th>JOB</th>
                        <th>APPLICATIONS</th>
                        <th>LOCATION</th>
                        <th>CLOSES</th>
                        <th>STATUS</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((j) => (
                        <tr key={j.id}>
                          <td>
                            <button
                              className="fm-cell-title"
                              onClick={() => setEditingJob(j)}
                            >
                              {j.title}
                            </button>
                            <small>
                              {j.id} · {j.department}
                            </small>
                          </td>
                          <td>{j.applications}</td>
                          <td>
                            {j.location}
                            <small>{j.workplace}</small>
                          </td>
                          <td>
                            {new Date(
                              j.closes + "T12:00:00",
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td>
                            <StatusBadge>{j.status}</StatusBadge>
                          </td>
                          <td>
                            <div className="fm-table-actions">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingJob(j)}
                              >
                                Edit
                              </Button>
                              {j.status === "Active" && (
                                <button
                                  className="fm-icon-button"
                                  aria-label={"Share " + j.title}
                                  onClick={() => setShareJob(j)}
                                >
                                  <Link2 size={17} />
                                </button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => { setRankingJobId(j.id); setView("ranking"); }}>Ranking setup</Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await onSaveJob({ ...j, status: j.status === "Closed" ? "Draft" : "Closed" });
                                    toast.success(j.status === "Closed" ? "Job moved to drafts." : "Job closed to new applications.");
                                  } catch (e) { toast.error((e as Error).message); }
                                }}
                              >
                                {j.status === "Closed" ? "Reopen" : "Close"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredJobs.length && (
                    <EmptyState
                      title="No jobs found"
                      description="Try another search or clear your filters."
                      action={
                        <Button
                          variant="outline"
                          onClick={() => {
                            setQuery("");
                            setFilter("All");
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  )}
                </div>
              </Panel>
            </>
          )}
          {view === "ranking" && <CandidateRanking key={rankingJobId || "all"} jobs={jobs} auth={auth} initialJobId={rankingJobId} />}
          {view === "applications" && (
            <>
              <PageHeading
                eyebrow="EVIDENCE-FIRST REVIEW"
                title="Applications"
                description="See the skills. Understand the evidence. Make an informed decision."
                actions={
                  <Button
                    variant="outline"
                    onClick={() => {
                      exportCsv("fairmatch-blind-shortlist.csv", [
                        [
                          "Candidate ID",
                          "Evidence band",
                          "Skills",
                          "Experience",
                          "Stage",
                        ],
                        ...filteredCandidates.map((c) => [
                          c.id,
                          c.band,
                          c.skills.join("; "),
                          c.experience,
                          c.stage,
                        ]),
                      ]);
                      toast.success("Blind shortlist downloaded.");
                    }}
                  >
                    <Download size={16} />
                    Export shortlist
                  </Button>
                }
              />
              <div className="fm-review-banner">
                <ShieldCheck size={18} />
                <strong>Blind review is on</strong>
                <span>
                  Names, photos and private contact details stay hidden.
                </span>
                <button onClick={() => navigate("fairness")}>
                  Fairness checks
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <div className="fm-toolbar">
                <div className="fm-filter-selects">
                  <select
                    aria-label="Filter applications by job"
                    value={jobFilter}
                    onChange={(e) => setJobFilter(e.target.value)}
                  >
                    <option>All jobs</option>
                    {jobs
                      .filter((j) => j.status !== "Draft")
                      .map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.title}
                        </option>
                      ))}
                  </select>
                  <select
                    aria-label="Filter by evidence band"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    {["All", "Strong evidence", "Consider", "Needs review"].map(
                      (f) => (
                        <option key={f} value={f}>
                          {f === "All" ? "All evidence bands" : f}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <SearchField
                  value={query}
                  onChange={setQuery}
                  label="Search applications"
                  placeholder="Search ID or skill…"
                />
              </div>
              <div className="fm-shortlist-grid">
                <Panel
                  title="Blind shortlist"
                  description={`${filteredCandidates.length} saved applications · Select a row to review`}
                >
                  <div className="fm-table-scroll">
                    <table className="fm-table fm-candidate-table">
                      <thead>
                        <tr>
                          <th>CANDIDATE</th>
                          <th>EVIDENCE BAND</th>
                          <th>CONFIRMED SKILLS</th>
                          <th>EXP.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCandidates.map((c) => (
                          <tr
                            key={c.id}
                            className={c.id === selected ? "is-selected" : ""}
                            onClick={() => setSelected(c.id)}
                          >
                            <td>
                              <button
                                className="fm-cell-title"
                                aria-pressed={c.id === selected}
                                onClick={() => {
                                  setSelected(c.id);
                                  if (window.innerWidth <= 1250) setEvidence(c);
                                }}
                              >
                                {c.id}
                              </button>
                              <small>{c.stage}</small>
                            </td>
                            <td>
                              <StatusBadge>{c.band}</StatusBadge>
                            </td>
                            <td>{c.skills.slice(0, 2).join(" · ")}</td>
                            <td>{c.experience}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredCandidates.length && (
                      <EmptyState
                        title="No matching applications"
                        description="Try a different skill, ID, job or evidence band."
                        action={
                          <Button
                            variant="outline"
                            onClick={() => {
                              setQuery("");
                              setFilter("All");
                              setJobFilter("All jobs");
                            }}
                          >
                            Clear filters
                          </Button>
                        }
                      />
                    )}
                  </div>
                </Panel>
                {current && <Panel className="fm-inspector">
                  <div className="fm-inspector-top">
                    <span className="fm-eyebrow">EVIDENCE INSPECTOR</span>
                    <button
                      className="fm-icon-button"
                      aria-label="Open full candidate evidence"
                      onClick={() => setEvidence(current)}
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  <h2>{current.id}</h2>
                  <StatusBadge>{current.band}</StatusBadge>
                  <div className="fm-inspector-summary">
                    <h3>Evidence-backed summary</h3>
                    <p>{current.evidence}</p>
                  </div>
                  <h3>Top evidence</h3>
                  {current.skills.slice(0, 3).map((skill) => (
                    <div className="fm-evidence-mini" key={skill}>
                      <FileCheck2 size={17} />
                      <div>
                        <strong>{skill}</strong>
                        <p>
                          Candidate-confirmed profile
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="fm-inspector-footer">
                    <Button onClick={() => setEvidence(current)}>
                      Open full evidence
                      <ArrowRight size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDecision(current)}
                    >
                      Update hiring stage
                    </Button>
                  </div>
                </Panel>}
              </div>
            </>
          )}
          {view === "pipeline" && (
            <>
              <PageHeading
                title="Hiring pipeline"
                description="Keep every candidate moving with a clear, recorded reason."
                actions={
                  <Button onClick={() => setSchedule(true)}>
                    <CalendarDays size={16} />
                    Schedule interview
                  </Button>
                }
              />
              <div className="fm-notice">
                <ShieldCheck size={19} />
                <p>
                  Stage changes require a job-related reason. Your decision is
                  saved in the activity history.
                </p>
              </div>
              <div className="fm-kanban">
                {(
                  [
                    "New",
                    "Shortlisted",
                    "Interview",
                    "Offer",
                    "Hired",
                  ] as Stage[]
                ).map((stage) => (
                  <section className="fm-kanban-column" key={stage}>
                    <h2>
                      {stage}
                      <span>
                        {candidates.filter((c) => c.stage === stage).length}
                      </span>
                    </h2>
                    <div className="fm-kanban-items" role="region" aria-label={`${stage} candidates`} tabIndex={0}>
                      {candidates
                        .filter((c) => c.stage === stage)
                        .map((c) => (
                          <article className="fm-kanban-card" key={c.id}>
                            <button
                              className="fm-cell-title"
                              onClick={() => setEvidence(c)}
                            >
                              {c.id}
                            </button>
                            <p>{c.skills.slice(0, 2).join(" · ")}</p>
                            <StatusBadge>{c.band}</StatusBadge>
                            <footer>
                              <span>{c.experience}</span>
                              <button
                                aria-label={`Move ${c.id} to another stage`}
                                onClick={() => setDecision(c)}
                              >
                                Move
                                <ArrowRight size={14} />
                              </button>
                            </footer>
                          </article>
                        ))}
                      {!candidates.some((c) => c.stage === stage) && (
                        <p className="fm-kanban-empty">
                          Candidates will appear here after a recorded decision.
                        </p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
              {candidates.some((c) => ["Not selected", "Withdrawn"].includes(c.stage)) && (
                <Panel title="Closed applications">
                  <div className="fm-closed-candidates">
                    {candidates
                      .filter((c) => ["Not selected", "Withdrawn"].includes(c.stage))
                      .map((c) => (
                        <button key={c.id} onClick={() => setEvidence(c)}>
                          {c.id}
                          <StatusBadge tone="neutral">
                            {c.stage}
                          </StatusBadge>
                        </button>
                      ))}
                  </div>
                </Panel>
              )}
            </>
          )}
          {view === "interviews" && (
            <>
              <PageHeading
                title="Interviews"
                description="Consistent questions. Independent evaluation. Better hiring conversations."
                actions={
                  <Button onClick={() => setSchedule(true)}>
                    <Plus size={16} />
                    Schedule interview
                  </Button>
                }
              />
              <div className="fm-toolbar">
                <div className="fm-filter-tabs">
                  {["All", "Upcoming", "Scheduled", "Completed", "Cancelled"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "active" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fm-interview-grid">
                {filteredInterviews
                  .map((i) => (
                    <Panel key={i.id} className="fm-interview-card">
                      <div>
                        <span className="fm-date-tile">
                          <small>
                            {new Date(i.date + "T12:00:00")
                              .toLocaleDateString("en-GB", { month: "short" })
                              .toUpperCase()}
                          </small>
                          <strong>{i.date.slice(-2)}</strong>
                        </span>
                        <StatusBadge
                          tone={i.status === "Cancelled" ? "neutral" : i.completed ? "positive" : "warning"}
                        >
                          {i.status}
                        </StatusBadge>
                      </div>
                      <h2>{i.candidateId}</h2>
                      <p>{jobs.find(j => j.id === i.jobId)?.title || "Application interview"}</p>
                      <ul>
                        <li>
                          <Clock3 size={16} />
                          {i.time} · Asia/Dhaka
                        </li>
                        <li>
                          <CalendarDays size={16} />
                          {i.format}
                        </li>
                        <li>
                          <UsersRound size={16} />
                          Structured evaluation · 4 criteria
                        </li>
                      </ul>
                      <p className="fm-interview-details">{i.location}</p>
                      {i.status === "Cancelled" ? <p className="fm-interview-details"><strong>Cancellation reason:</strong> {i.cancellationReason}</p> : <>
                      <Button
                        variant={i.completed ? "outline" : "default"}
                        onClick={() => setRubric(i)}
                      >
                        {i.completed
                          ? "View evaluation"
                          : "Open interview workspace"}
                        <ArrowUpRight size={16} />
                      </Button>
                      {i.status === "Scheduled" && <div className="fm-interview-actions">
                        <Button variant="outline" onClick={() => setSchedule(i)}>Reschedule</Button>
                        <Button variant="ghost" onClick={() => setCancellingInterview(i)}>Cancel interview</Button>
                      </div>}
                      </>}
                    </Panel>
                  ))}
              </div>
              {!filteredInterviews.length && (
                <EmptyState
                  title="No interviews in this view"
                  description="Schedule an interview or choose another filter."
                  action={
                    <Button onClick={() => setSchedule(true)}>
                      Schedule interview
                    </Button>
                  }
                />
              )}
            </>
          )}
          {view === "fairness" && <GovernancePanel auth={auth} jobs={jobs} />}
          {view === "reports" && (
            <>
              <PageHeading
                title="Hiring reports"
                description="Understand progress across the hiring process."
                actions={
                  <Button variant="outline" onClick={downloadReport}>
                    <Download size={16} />
                    Export report
                  </Button>
                }
              />
              <div className="fm-metrics">
                <Metric
                  label="Applications received"
                  value={jobs.reduce((n, j) => n + j.applications, 0)}
                  note="All job records in this workspace"
                />
                <Metric
                  label="Candidate records"
                  value={candidates.length}
                  note="Saved application records"
                />
                <Metric
                  label="Interviews completed"
                  value={interviews.filter((i) => i.completed).length}
                  note="Evaluations with recorded evidence"
                />
                <Metric
                  label="Hiring decisions"
                  value={
                    candidates.filter((c) =>
                      ["Offer", "Hired", "Not selected"].includes(c.stage),
                    ).length
                  }
                  note="Human-controlled outcomes"
                />
              </div>
              <div className="fm-two-columns">
                <Panel
                  title="Current candidate stages"
                  description="Current stages from saved applications."
                >
                  <div className="fm-funnel">
                    {(
                      [
                        "New",
                        "Shortlisted",
                        "Interview",
                        "Offer",
                        "Hired",
                        "Not selected",
                        "Withdrawn",
                      ] as Stage[]
                    ).map((stage) => (
                      <div key={stage}>
                        <span>{stage}</span>
                        <progress
                          value={
                            candidates.filter((c) => c.stage === stage).length
                          }
                          max={Math.max(candidates.length, 1)}
                        />
                        <strong>
                          {candidates.filter((c) => c.stage === stage).length}
                        </strong>
                      </div>
                    ))}
                  </div>
                </Panel>
                <Panel
                  title="Evidence readiness"
                  description="Review bands recorded for saved applications."
                >
                  <div className="fm-readiness">
                    {(
                      ["Strong evidence", "Consider", "Needs review"] as const
                    ).map((b) => (
                      <div key={b}>
                        <StatusBadge>{b}</StatusBadge>
                        <strong>
                          {candidates.filter((c) => c.band === b).length}
                        </strong>
                        <span>candidates</span>
                      </div>
                    ))}
                  </div>
                  <p className="fm-panel-description">
                    Evidence bands indicate review readiness, not a prediction
                    of a person’s worth or an automatic hiring recommendation.
                  </p>
                </Panel>
              </div>
              <Panel title="Job performance">
                <div className="fm-table-scroll">
                  <table className="fm-table">
                    <thead>
                      <tr>
                        <th>JOB</th>
                        <th>APPLICATIONS</th>
                        <th>STATUS</th>
                        <th>DEADLINE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id}>
                          <td>{j.title}</td>
                          <td>{j.applications}</td>
                          <td>
                            <StatusBadge>{j.status}</StatusBadge>
                          </td>
                          <td>{j.closes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </>
          )}
          {view === "settings" && (
            <>
              <PageHeading
                title="Workspace settings"
                description="Manage your saved organization profile and account access."
              />
              <div className="fm-filter-tabs fm-settings-tabs">
                {[
                  "Organization",
                  "Verification documents",
                  "Team & access",
                  "Billing",
                  "Data & privacy",
                ].map((t) => (
                  <button
                    className={settingsTab === t ? "active" : ""}
                    key={t}
                    onClick={() => setSettingsTab(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {settingsTab === "Organization" && (
                <Panel
                  title="Organization profile"
                  description="These details help candidates understand who they are applying to."
                >
                  <form
                    className="fm-settings-form"
                    onSubmit={async (e) => {
                      e.preventDefault(); if (savingOrganization) return;
                      setSavingOrganization(true);
                      try { setOrg(await onSaveOrganization({...org, version: organization.version})); toast.success("Organization saved."); }
                      catch (error) { toast.error((error as Error).message); }
                      finally { setSavingOrganization(false); }
                    }}
                  >
                    <div className="fm-form-grid">
                      {(
                        ["name", "industry", "location", "website"] as const
                      ).map((k) => (
                        <Field
                          key={k}
                          label={
                            {
                              name: "Organization name",
                              industry: "Industry",
                              location: "Head office location",
                              website: "Company website",
                            }[k]
                          }
                        >
                          <Input
                            required
                            type={k === "website" ? "url" : "text"}
                            value={org[k]}
                            onChange={(e) =>
                              setOrg({ ...org, [k]: e.target.value })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                    <div className="fm-notice">
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Employer verification</strong>
                        <p>
                          Status: {organization.status}. {organization.reviewReason} Changing the organization name requires another review.
                        </p>
                      </div>
                    </div>
                    <Button type="submit" disabled={savingOrganization}>{savingOrganization ? "Saving..." : "Save changes"}</Button>
                  </form>
                </Panel>
              )}
              {settingsTab === "Verification documents" && <OrganizationDocuments auth={auth} onLoaded={evidenceLoaded} />}
              {settingsTab === "Team & access" && (
                <Panel
                  title="Team members"
                  description="Give each person the access their work needs."

                >
                  <div className="fm-table-scroll">
                    <table className="fm-table">
                      <thead>
                        <tr>
                          <th>MEMBER</th>
                          <th>ROLE</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {team.map((t) => (
                          <tr key={t.email}>
                            <td>
                              <strong>{t.name}</strong>
                              <small>{t.email}</small>
                            </td>
                            <td>{t.role}</td>
                            <td>
                              <StatusBadge>{t.status}</StatusBadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="fm-panel-description">
                    Only registered members of this organization are listed. Team invitations are planned for a later milestone.
                  </p>
                </Panel>
              )}
              {settingsTab === "Billing" && <Panel title="Local classroom edition" description="Payments and subscriptions are not enabled. No payment is required to use this local build."><p>Payment integration remains part of the remaining project work.</p></Panel>}
              {settingsTab === "Data & privacy" && (
                <Panel
                  title="Data controls"
                  description="Keep candidate information purposeful and accountable."
                >
                  <div className="fm-settings-form">
                    <div className="fm-notice">
                      <LockKeyhole size={20} />
                      <div>
                        <strong>Identity hidden during first review</strong>
                        <p>
                          The backend limits records to your organization and excludes candidate names and contact details from employer application responses. Automated retention deletion is not enabled.
                        </p>
                      </div>
                    </div>
                    <div className="fm-inline-form">
                      <Button
                        variant="outline"
                        onClick={() => {
                          exportCsv("fairmatch-activity.csv", [
                            ["Time", "Action", "Detail"],
                            ...events.map((e) => [e.time, e.title, e.detail]),
                          ]);
                          toast.success("Activity history downloaded.");
                        }}
                      >
                        <Download size={16} />
                        Export activity history
                      </Button>
                    </div>
                  </div>
                </Panel>
              )}
            </>
          )}
          <footer className="fm-page-footer">
            <span>FairMatch · Evidence-led hiring</span>
            <span>Jobs, applications, hiring stages & interviews saved in MongoDB</span>
          </footer>
        </main>
      </div>
      {editingJob && (
        <JobEditor
          key={editingJob === true ? "new" : editingJob.id}
          job={editingJob === true ? undefined : editingJob}
          organizationName={org.name}
          organizationVerified={org.status === "Verified"}
          onClose={() => setEditingJob(null)}
          onSave={saveJob}
        />
      )}
      {evidence && (
        <EvidenceDialog
          job={jobs.find(j => j.id === evidence.jobId)}
          candidate={evidence}
          onClose={() => setEvidence(null)}
          onMove={() => {
            setDecision(evidence);
            setEvidence(null);
          }}
          onReview={() => { setReviewing(evidence); setEvidence(null); }}
          onRequest={() => {
            setRequest(evidence);
            setEvidence(null);
          }}
        />
      )}
      {decision && (
        <StageDialog
          candidate={decision}
          onClose={() => setDecision(null)}
          onSave={saveDecision}
        />
      )}
      {request && <ApplicationConversation auth={auth} id={request.id} employer onClose={() => setRequest(null)} />}
      {schedule && (
        <ScheduleDialog
          candidates={candidates.filter((c) => !["Not selected", "Hired", "Withdrawn"].includes(c.stage) || (schedule !== true && c.id === schedule.candidateId))}
          jobs={jobs}
          interview={schedule === true ? undefined : schedule}
          onClose={() => setSchedule(null)}
          onSave={async (input) => {
            await onScheduleInterview(input, schedule === true ? undefined : schedule);
            setSchedule(null);
            toast.success("Interview saved to the database. Share the meeting details with the candidate.");
            navigate("interviews");
          }}
        />
      )}
      {rubric && (
        <RubricDialog
          interview={rubric}
          onClose={() => setRubric(null)}
          onSave={async (scores, notes) => {
            await onEvaluateInterview(rubric, scores, notes);
            setRubric(null);
            toast.success("Evaluation and evidence notes saved to the database.");
          }}
        />
      )}
      {cancellingInterview && <CancelInterviewDialog interview={cancellingInterview} onClose={() => setCancellingInterview(null)} onSave={async reason => {
        await onCancelInterview(cancellingInterview, reason);
        setCancellingInterview(null);
        toast.success("Interview cancelled. The reason is saved in the activity history.");
      }} />}
      <Dialog open={!!shareJob} onOpenChange={(v) => !v && setShareJob(null)}>
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>Application link is ready</DialogTitle>
            <DialogDescription>
              {shareJob?.title} · {shareJob?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="fm-notice">
            <Link2 size={20} />
            <p>
              This local demo link opens the candidate application experience.
            </p>
          </div>
          <Field label="Application link">
            <Input
              readOnly
              value={
                typeof window !== "undefined" && shareJob
                  ? window.location.origin +
                    "/?workspace=candidate&job=" +
                    shareJob.id
                  : ""
              }
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (shareJob) {
                  onCandidatePreview(shareJob);
                  setShareJob(null);
                }
              }}
            >
              Preview as candidate
              <ArrowUpRight size={16} />
            </Button>
            <Button onClick={() => shareJob && copyLink(shareJob)}>
              Copy link
              <Link2 size={16} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {notifications && <EmployerInbox auth={auth} onClose={() => setNotifications(false)} />}
      {reviewing && <CriteriaReviewDialog auth={auth} candidate={reviewing} onClose={() => setReviewing(null)} onSaved={saved => { onReviewCandidate(saved); setReviewing(null); toast.success("Requirement review saved. Hiring stage unchanged."); }} />}

    </div>
  );
}
