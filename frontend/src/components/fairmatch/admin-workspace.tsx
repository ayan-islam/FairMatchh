"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
  LayoutDashboard,
  Building2,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  ArrowLeftRight,
  ChevronDown,
  Menu,
  X,
  ArrowUpRight,
  Download,
  Check,
  Activity,
  LockKeyhole,
  FileText,
} from "lucide-react";
import { useMobileNavigation } from "./use-mobile-navigation";
import { toast } from "sonner";
import {
  PageHeading,
  Panel,
  Metric,
  SearchField,
  EmptyState,
  StatusBadge,
  Field,
  TextAction,
} from "./shared";
import { exportCsv } from "@/lib/demo-data";
import "./admin.css";

type Organization = {
  id: string;
  name: string;
  industry: string;
  location: string;
  status: "Pending" | "Verified" | "Changes requested";
  submitted: string;
  contact: string;
};
type SupportCase = {
  id: string;
  subject: string;
  category: string;
  reference: string;
  priority: string;
  status: "Open" | "In review" | "Resolved";
  detail: string;
};
type AdminEvent = {
  id: string;
  action: string;
  target: string;
  reason: string;
  time: string;
};
const seedOrganizations: Organization[] = [
  {
    id: "ORG-2041",
    name: "Apex Textiles Ltd.",
    industry: "Apparel & Textiles",
    location: "Dhaka",
    status: "Pending",
    submitted: "6 Sep 2026",
    contact: "recruitment@apextextiles.com",
  },
  {
    id: "ORG-2038",
    name: "Bengal Logistics",
    industry: "Logistics",
    location: "Chattogram",
    status: "Pending",
    submitted: "5 Sep 2026",
    contact: "people@bengallogistics.example",
  },
  {
    id: "ORG-2032",
    name: "Northstar Digital",
    industry: "Technology",
    location: "Dhaka",
    status: "Verified",
    submitted: "4 Sep 2026",
    contact: "hiring@northstar.example",
  },
  {
    id: "ORG-2029",
    name: "Greenfield Foods",
    industry: "Food & Agriculture",
    location: "Rajshahi",
    status: "Changes requested",
    submitted: "3 Sep 2026",
    contact: "team@greenfield.example",
  },
];
const seedCases: SupportCase[] = [
  {
    id: "CASE-901",
    subject: "Request to correct experience dates",
    category: "Candidate appeal",
    reference: "FM-2026-0399",
    priority: "Normal",
    status: "Open",
    detail:
      "The candidate reports that an employment end date was interpreted incorrectly and asks for the evidence profile to be reviewed.",
  },
  {
    id: "CASE-902",
    subject: "Reported application fee request",
    category: "Trust & safety",
    reference: "ORG-2038",
    priority: "High",
    status: "Open",
    detail:
      "A candidate reports being asked for a processing fee after following an external application link. Review the submitted account before taking action.",
  },
  {
    id: "CASE-903",
    subject: "Application data export",
    category: "Privacy",
    reference: "FM-2026-0289",
    priority: "Normal",
    status: "In review",
    detail:
      "The candidate requested a copy of their application data and a clear explanation of retention.",
  },
  {
    id: "CASE-904",
    subject: "Employer verification clarification",
    category: "Employer support",
    reference: "ORG-2029",
    priority: "Normal",
    status: "Resolved",
    detail:
      "The employer needed clarification on the acceptable registration documentation. Guidance was provided.",
  },
];
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "organizations", label: "Organizations", icon: Building2 },
  { id: "support", label: "Support & appeals", icon: MessagesSquare },
  { id: "audit", label: "Audit & system", icon: ScrollText },
] as const;
type AdminView = (typeof nav)[number]["id"];

export function AdminWorkspace({
  onWorkspaceChange,
}: {
  onWorkspaceChange: () => void;
}) {
  const [view, setView] = useState<AdminView>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const { sidebarRef, contentRef, toggleRef } = useMobileNavigation(
    mobileMenu,
    setMobileMenu,
  );
  const switchWorkspace = () => {
    setMobileMenu(false);
    onWorkspaceChange();
  };
  const [organizations, setOrganizations] = useState(seedOrganizations);
  const [cases, setCases] = useState(seedCases);
  const [events, setEvents] = useState<AdminEvent[]>([
    {
      id: "AUD-510",
      action: "Organization verified",
      target: "ORG-2032",
      reason: "Registration and official domain evidence reviewed.",
      time: "09:45",
    },
    {
      id: "AUD-509",
      action: "Support case resolved",
      target: "CASE-904",
      reason: "Acceptable registration documentation explained.",
      time: "Yesterday",
    },
    {
      id: "AUD-508",
      action: "Privacy case opened",
      target: "CASE-903",
      reason: "Candidate export request received for review.",
      time: "Yesterday",
    },
  ]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [org, setOrg] = useState<Organization | null>(null);
  const [support, setSupport] = useState<SupportCase | null>(null);
  const [reason, setReason] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const [document, setDocument] = useState(false);
  const [auditEvent, setAuditEvent] = useState<AdminEvent | null>(null);
  const navigate = (v: AdminView) => {
    setView(v);
    setQuery("");
    setFilter("All");
    setMobileMenu(false);
    window.scrollTo({ top: 0 });
  };
  const addEvent = (action: string, target: string, reason: string) =>
    setEvents((prev) => [
      {
        id: "AUD-" + Date.now().toString().slice(-6),
        action,
        target,
        reason,
        time: new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
  const openOrg = (o: Organization) => {
    setOrg(o);
    setReason("");
    setReviewed(false);
    setError("");
    setDocument(false);
  };
  const openCase = (c: SupportCase) => {
    setSupport(c);
    setReason("");
    setError("");
  };
  const saveOrg = (status: Organization["status"]) => {
    if (reason.trim().length < 20 || !reviewed) {
      setError(
        "Review the evidence and record a reason of at least 20 characters.",
      );
      return;
    }
    if (!org) return;
    setOrganizations(
      organizations.map((o) => (o.id === org.id ? { ...o, status } : o)),
    );
    addEvent("Organization " + status.toLowerCase(), org.id, reason);
    setOrg(null);
    toast.success("Demo verification decision recorded.");
  };
  const saveCase = (status: SupportCase["status"]) => {
    if (reason.trim().length < 20) {
      setError("Add a useful response of at least 20 characters.");
      return;
    }
    if (!support) return;
    setCases(cases.map((c) => (c.id === support.id ? { ...c, status } : c)));
    addEvent("Support case " + status.toLowerCase(), support.id, reason);
    setSupport(null);
    toast.success("Demo response saved. No message was sent.");
  };
  const shownOrgs = organizations.filter(
    (o) =>
      (filter === "All" || o.status === filter) &&
      (o.name + " " + o.id + " " + o.industry)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const shownCases = cases.filter(
    (c) =>
      (filter === "All" || c.status === filter) &&
      (c.subject + " " + c.id + " " + c.reference + " " + c.category)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="fm-app am-app">
      {mobileMenu && (
        <button
          className="fm-menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="platform-navigation"
        aria-label="Platform navigation"
        role={mobileMenu ? "dialog" : undefined}
        aria-modal={mobileMenu || undefined}
        className={"fm-sidebar " + (mobileMenu ? "is-open" : "")}
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
          <small>Platform operations</small>
        </button>
        <button className="fm-workspace-button" onClick={switchWorkspace}>
          <span className="fm-org-avatar am-avatar">
            <ShieldCheck size={18} />
          </span>
          <span>
            <strong>FairMatch operations</strong>
            <small>Purpose-limited workspace</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <p className="fm-nav-label">OPERATIONS</p>
        <nav aria-label="Platform navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              aria-current={view === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "support" && (
                <span className="fm-nav-count">
                  {cases.filter((c) => c.status === "Open").length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="fm-sidebar-bottom">
          <div className="fm-sidebar-note">
            <LockKeyhole size={19} />
            <div>
              <strong>Accountable operations</strong>
              <p>Every action needs a reason.</p>
            </div>
          </div>
          <button className="fm-user" onClick={switchWorkspace}>
            <span className="fm-user-avatar">FA</span>
            <span>
              <strong>Platform reviewer</strong>
              <small>Demo operator</small>
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
              aria-controls="platform-navigation"
              aria-label="Open platform navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span className="fm-breadcrumb">
              Operations<span>/</span>
              <strong>{nav.find((n) => n.id === view)?.label}</strong>
            </span>
          </div>
          <div>
            <span className="fm-demo-label">
              <span />
              Demo workspace
            </span>
            <StatusBadge tone="purple">Platform reviewer</StatusBadge>
          </div>
        </header>
        <main id="admin-content" className="fm-main">
          {view === "overview" && (
            <>
              <PageHeading
                eyebrow="PLATFORM HEALTH & TRUST"
                title="Operations overview"
                description="Keep hiring trustworthy, transparent and accountable."
                actions={
                  <Button variant="outline" onClick={() => navigate("audit")}>
                    <ScrollText size={16} />
                    Open audit history
                  </Button>
                }
              />
              <div className="fm-metrics">
                <Metric
                  label="Pending verification"
                  value={
                    organizations.filter((o) => o.status === "Pending").length
                  }
                  note="Organizations awaiting a human review"
                  icon={<Building2 size={18} />}
                />
                <Metric
                  label="Open support cases"
                  value={cases.filter((c) => c.status === "Open").length}
                  note="Candidate and employer requests"
                  icon={<MessagesSquare size={18} />}
                />
                <Metric
                  label="Priority concerns"
                  value={
                    cases.filter(
                      (c) => c.priority === "High" && c.status !== "Resolved",
                    ).length
                  }
                  note="Trust and safety review needed"
                  icon={<ShieldCheck size={18} />}
                />
                <Metric
                  label="Recorded actions"
                  value={events.length}
                  note="Traceable decisions in this demo"
                  icon={<ScrollText size={18} />}
                />
              </div>
              <div className="fm-attention-strip">
                <div className="fm-attention-icon">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <strong>
                    {cases.some(
                      (c) => c.priority === "High" && c.status !== "Resolved",
                    )
                      ? "One trust concern needs your attention."
                      : "Priority concerns have been reviewed."}
                  </strong>
                  <p>
                    {cases.some(
                      (c) => c.priority === "High" && c.status !== "Resolved",
                    )
                      ? "Review the reported application-fee request and record the next action."
                      : "Continue through the support queue to help the next person."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    openCase(cases.find((c) => c.id === "CASE-902")!)
                  }
                >
                  Review concern
                  <ArrowUpRight size={15} />
                </Button>
              </div>
              <div className="fm-two-columns">
                <Panel
                  title="Verification queue"
                  description="Check evidence before issuing an employer TrustSeal."
                  action={
                    <TextAction onClick={() => navigate("organizations")}>
                      All organizations
                    </TextAction>
                  }
                >
                  <div className="fm-table-scroll">
                    <table className="fm-table am-verification-table">
                      <thead>
                        <tr>
                          <th>ORGANIZATION</th>
                          <th>STATUS</th>
                          <th>REVIEW</th>
                        </tr>
                      </thead>
                      <tbody>
                        {organizations.slice(0, 3).map((o) => (
                          <tr key={o.id}>
                            <td>
                              <button
                                className="fm-cell-title"
                                onClick={() => openOrg(o)}
                              >
                                {o.name}
                              </button>
                              <small>
                                {o.id} · {o.industry}
                              </small>
                            </td>
                            <td>
                              <StatusBadge
                                tone={
                                  o.status === "Verified"
                                    ? "positive"
                                    : "warning"
                                }
                              >
                                {o.status}
                              </StatusBadge>
                            </td>
                            <td>
                              <button
                                className="fm-row-arrow"
                                aria-label={"Review " + o.name}
                                onClick={() => openOrg(o)}
                              >
                                <ArrowUpRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
                <Panel
                  title="System snapshot"
                  description="Sample service health, not live monitoring."
                >
                  <div className="am-services">
                    {[
                      "Application API",
                      "Document processing",
                      "Notifications",
                      "Audit storage",
                    ].map((s) => (
                      <div key={s}>
                        <span>
                          <Activity size={15} />
                          {s}
                        </span>
                        <StatusBadge tone="positive">
                          Sample · Healthy
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              <Panel
                title="Recent platform actions"
                action={
                  <TextAction onClick={() => navigate("audit")}>
                    View history
                  </TextAction>
                }
              >
                <div className="am-event-preview">
                  {events.slice(0, 3).map((e) => (
                    <button key={e.id} onClick={() => setAuditEvent(e)}>
                      <span className="fm-activity-mark recent">
                        <Check size={12} />
                      </span>
                      <span>
                        <strong>{e.action}</strong>
                        <small>
                          {e.target} · {e.reason}
                        </small>
                      </span>
                      <time>{e.time}</time>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </Panel>
            </>
          )}
          {view === "organizations" && (
            <>
              <PageHeading
                title="Organizations & verification"
                description="Review identity, official contacts and no-fee hiring policies."
              />
              <div className="fm-toolbar">
                <div className="fm-filter-tabs">
                  {["All", "Pending", "Verified", "Changes requested"].map(
                    (f) => (
                      <button
                        key={f}
                        className={filter === f ? "active" : ""}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </button>
                    ),
                  )}
                </div>
                <SearchField
                  label="Search organizations"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search name, ID or industry…"
                />
              </div>
              <Panel>
                <div className="fm-table-scroll">
                  <table className="fm-table">
                    <thead>
                      <tr>
                        <th>ORGANIZATION</th>
                        <th>LOCATION</th>
                        <th>SUBMITTED</th>
                        <th>STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownOrgs.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <button
                              className="fm-cell-title"
                              onClick={() => openOrg(o)}
                            >
                              {o.name}
                            </button>
                            <small>
                              {o.id} · {o.industry}
                            </small>
                          </td>
                          <td>{o.location}</td>
                          <td>{o.submitted}</td>
                          <td>
                            <StatusBadge
                              tone={
                                o.status === "Verified"
                                  ? "positive"
                                  : o.status === "Pending"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              {o.status}
                            </StatusBadge>
                          </td>
                          <td>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openOrg(o)}
                            >
                              Review
                              <ArrowUpRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shownOrgs.length && (
                    <EmptyState
                      title="No organizations found"
                      description="Try another search or status filter."
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
          {view === "support" && (
            <>
              <PageHeading
                title="Support & appeals"
                description="Give candidate concerns and employer requests a clear route to resolution."
              />
              <div className="fm-toolbar">
                <div className="fm-filter-tabs">
                  {["All", "Open", "In review", "Resolved"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "active" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <SearchField
                  label="Search support cases"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search case, subject or reference…"
                />
              </div>
              <Panel>
                <div className="fm-table-scroll">
                  <table className="fm-table">
                    <thead>
                      <tr>
                        <th>CASE</th>
                        <th>CATEGORY</th>
                        <th>PRIORITY</th>
                        <th>STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownCases.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <button
                              className="fm-cell-title"
                              onClick={() => openCase(c)}
                            >
                              {c.subject}
                            </button>
                            <small>
                              {c.id} · {c.reference}
                            </small>
                          </td>
                          <td>{c.category}</td>
                          <td>
                            <StatusBadge
                              tone={
                                c.priority === "High" ? "danger" : "neutral"
                              }
                            >
                              {c.priority}
                            </StatusBadge>
                          </td>
                          <td>
                            <StatusBadge
                              tone={
                                c.status === "Resolved" ? "positive" : "warning"
                              }
                            >
                              {c.status}
                            </StatusBadge>
                          </td>
                          <td>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCase(c)}
                            >
                              Open case
                              <ArrowUpRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shownCases.length && (
                    <EmptyState
                      title="No matching cases"
                      description="Choose another filter or clear your search."
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
          {view === "audit" && (
            <>
              <PageHeading
                title="Audit & system"
                description="Inspect the action, the reason and the accountable human review."
                actions={
                  <Button
                    variant="outline"
                    onClick={() => {
                      exportCsv("fairmatch-platform-audit.csv", [
                        ["Event", "Action", "Target", "Reason", "Time"],
                        ...events.map((e) => [
                          e.id,
                          e.action,
                          e.target,
                          e.reason,
                          e.time,
                        ]),
                      ]);
                      toast.success("Platform audit downloaded.");
                    }}
                  >
                    <Download size={16} />
                    Export audit
                  </Button>
                }
              />
              <div className="am-health-bar">
                <Activity size={18} />
                <strong>Sample services healthy</strong>
                <span>
                  This frontend is not connected to live operational monitoring.
                </span>
              </div>
              <div className="fm-toolbar">
                <h2 className="am-subheading">Event history</h2>
                <SearchField
                  label="Search audit events"
                  value={query}
                  onChange={setQuery}
                  placeholder="Search action, target or reason…"
                />
              </div>
              <Panel>
                <div className="fm-table-scroll">
                  <table className="fm-table">
                    <thead>
                      <tr>
                        <th>EVENT</th>
                        <th>ACTION</th>
                        <th>TARGET</th>
                        <th>RECORDED</th>
                        <th>DETAIL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events
                        .filter((e) =>
                          (e.action + " " + e.target + " " + e.reason)
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                        )
                        .map((e) => (
                          <tr key={e.id}>
                            <td>{e.id}</td>
                            <td>{e.action}</td>
                            <td>{e.target}</td>
                            <td>{e.time}</td>
                            <td>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAuditEvent(e)}
                              >
                                Inspect
                                <ArrowUpRight size={14} />
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!events.some((e) =>
                    (e.action + " " + e.target + " " + e.reason)
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  ) && (
                    <EmptyState
                      title="No events found"
                      description="Try a different search term."
                    />
                  )}
                </div>
              </Panel>
              <div className="fm-notice">
                <LockKeyhole size={20} />
                <div>
                  <strong>Purpose-limited access</strong>
                  <p>
                    This demo records actions locally. Production access checks,
                    immutable audit storage and cross-tenant restrictions must
                    be enforced by the backend.
                  </p>
                </div>
              </div>
            </>
          )}
          <footer className="fm-page-footer">
            <span>FairMatch · Accountable platform operations</span>
            <span>Demo data · Changes last for this session</span>
          </footer>
        </main>
      </div>
      <Dialog open={!!org} onOpenChange={(v) => !v && setOrg(null)}>
        <DialogContent className="fm-dialog fm-dialog-wide">
          <DialogHeader>
            <DialogTitle>Employer verification</DialogTitle>
            <DialogDescription>
              {org?.name} · {org?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="fm-dialog-body">
            <div className="am-org-details">
              <div>
                <span>Industry</span>
                <strong>{org?.industry}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{org?.location}</strong>
              </div>
              <div>
                <span>Official contact</span>
                <strong>{org?.contact}</strong>
              </div>
            </div>
            <h3 className="fm-subheading">Verification evidence</h3>
            <div className="am-document-list">
              {[
                "Company registration",
                "Official domain control",
                "Responsible owner",
                "No applicant-fee policy",
              ].map((d) => (
                <button key={d} onClick={() => setDocument(true)}>
                  <FileText size={18} />
                  <span>{d}</span>
                  <StatusBadge tone="neutral">Sample evidence</StatusBadge>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            {document && (
              <div className="fm-source">
                <strong>Sample evidence record</strong>
                <p>
                  Organization details, official contact and no-fee policy are
                  provided for this demonstration. No real registration document
                  has been verified.
                </p>
              </div>
            )}
            <Field label="Review reason" error={error}>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Record what you checked and why the next action is appropriate."
              />
            </Field>
            <label className="fm-check-row">
              <Checkbox
                checked={reviewed}
                onCheckedChange={(v) => setReviewed(v === true)}
              />
              <span>
                I reviewed the sample evidence and recorded a clear reason.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => saveOrg("Changes requested")}
            >
              Request changes
            </Button>
            <Button onClick={() => saveOrg("Verified")}>
              <ShieldCheck size={16} />
              Approve demo verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!support} onOpenChange={(v) => !v && setSupport(null)}>
        <DialogContent className="fm-dialog fm-dialog-wide">
          <DialogHeader>
            <DialogTitle>{support?.subject}</DialogTitle>
            <DialogDescription>
              {support?.id} · {support?.category} · {support?.reference}
            </DialogDescription>
          </DialogHeader>
          <div className="fm-notice">
            <MessagesSquare size={20} />
            <p>{support?.detail}</p>
          </div>
          <Field label="Response and reason" error={error}>
            <Textarea
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain your review, the next action and what the person can expect."
            />
          </Field>
          <p className="fm-muted">
            This response is saved only in the local demo. No external message
            is sent.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => saveCase("In review")}>
              Keep in review
            </Button>
            <Button onClick={() => saveCase("Resolved")}>
              <Check size={16} />
              Resolve demo case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!auditEvent}
        onOpenChange={(v) => !v && setAuditEvent(null)}
      >
        <DialogContent className="fm-dialog">
          <DialogHeader>
            <DialogTitle>Audit event</DialogTitle>
            <DialogDescription>
              {auditEvent?.id} · {auditEvent?.time}
            </DialogDescription>
          </DialogHeader>
          <div className="am-audit-detail">
            <StatusBadge tone="neutral">Demo operator</StatusBadge>
            <h3>{auditEvent?.action}</h3>
            <p>Target: {auditEvent?.target}</p>
            <div>
              <span>RECORDED REASON</span>
              <p>{auditEvent?.reason}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditEvent(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
