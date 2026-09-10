export type Stage =
  "New" | "Shortlisted" | "Interview" | "Offer" | "Hired" | "Not selected" | "Withdrawn";
export type Band = "Strong evidence" | "Consider" | "Needs review";
export type Job = {
  company?: string;
  id: string;
  title: string;
  department: string;
  location: string;
  workplace: string;
  salary: string;
  description: string;
  requirements: string[];
  status: "Active" | "Draft" | "Closed";
  applications: number;
  closes: string;
  noFeeConfirmed?: boolean;
};
export type Candidate = {
  id: string;
  jobId: string;
  experience: string;
  skills: string[];
  band: Band;
  stage: Stage;
  applied: string;
  evidence: string;
  education: string;
  example?: string;
  availability?: string;
  location?: string;
  stageReason?: string;
  stageChangedAt?: string;
};
export type AuditEvent = {
  id: string;
  title: string;
  detail: string;
  time: string;
};
export type Interview = {
  id: string;
  candidateId: string;
  date: string;
  time: string;
  format: string;
  completed: boolean;
  scores: number[];
  notes: string;
  jobId?: string;
  location: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  cancellationReason?: string;
  version: number;
};
export const initialJobs: Job[] = [
  {
    id: "REF-1278",
    title: "Junior Merchandising Executive",
    department: "Merchandising",
    location: "Dhaka, Bangladesh",
    workplace: "On-site",
    salary: "BDT 28,000 – 38,000 monthly",
    description:
      "Support buyer communication, order tracking, costing, production follow-up and export documentation for knitwear products.",
    requirements: [
      "Relevant merchandising experience",
      "Order tracking and production follow-up",
      "Basic spreadsheet ability",
      "Buyer communication",
    ],
    status: "Active",
    applications: 124,
    closes: "2026-09-14",
  },
  {
    id: "REF-1281",
    title: "Production Planning Officer",
    department: "Production",
    location: "Gazipur, Bangladesh",
    workplace: "On-site",
    salary: "BDT 35,000 – 45,000 monthly",
    description:
      "Coordinate production schedules, capacity planning and on-time delivery with factory teams.",
    requirements: [
      "Production planning experience",
      "Spreadsheet reporting",
      "Cross-team communication",
    ],
    status: "Active",
    applications: 82,
    closes: "2026-09-18",
  },
  {
    id: "REF-1284",
    title: "HR Operations Associate",
    department: "People & Culture",
    location: "Dhaka, Bangladesh",
    workplace: "Hybrid",
    salary: "BDT 25,000 – 32,000 monthly",
    description:
      "Support employee onboarding, documentation and people operations.",
    requirements: ["HR operations experience", "Document management"],
    status: "Active",
    applications: 48,
    closes: "2026-09-20",
  },
  {
    id: "REF-1287",
    title: "Quality Inspector",
    department: "Quality Assurance",
    location: "Narayanganj, Bangladesh",
    workplace: "On-site",
    salary: "BDT 22,000 – 30,000 monthly",
    description: "Inspect garment quality and document corrective actions.",
    requirements: ["Garment quality inspection", "Attention to detail"],
    status: "Draft",
    applications: 0,
    closes: "2026-09-22",
  },
  {
    id: "REF-1260",
    title: "Accounts Executive",
    department: "Finance",
    location: "Dhaka, Bangladesh",
    workplace: "On-site",
    salary: "BDT 30,000 – 40,000 monthly",
    description: "Maintain accounts and prepare financial reports.",
    requirements: ["Bookkeeping", "Spreadsheet proficiency"],
    status: "Closed",
    applications: 92,
    closes: "2026-08-30",
  },
];
export const initialCandidates: Candidate[] = [
  {
    id: "FM-2026-0413",
    jobId: "REF-1278",
    experience: "3 years",
    skills: ["Merchandising", "Product costing"],
    band: "Strong evidence",
    stage: "Shortlisted",
    applied: "2026-09-05",
    evidence:
      "Prepared product costing sheets and coordinated buyer approvals across three seasonal collections.",
    education: "BBA in Marketing",
  },
  {
    id: "FM-2026-0376",
    jobId: "REF-1278",
    experience: "2 years",
    skills: ["Order tracking", "Production planning", "Microsoft Excel"],
    band: "Strong evidence",
    stage: "Interview",
    applied: "2026-09-05",
    evidence:
      "Maintained the weekly Excel order tracker, checked production progress and coordinated shipment updates with buyers.",
    education: "BBA in Marketing",
  },
  {
    id: "FM-2026-0521",
    jobId: "REF-1278",
    experience: "4 years",
    skills: ["Buyer communication", "Microsoft Excel"],
    band: "Strong evidence",
    stage: "New",
    applied: "2026-09-06",
    evidence:
      "Managed buyer correspondence and maintained Excel-based delivery reports for export orders.",
    education: "BBA in Management",
  },
  {
    id: "FM-2026-0289",
    jobId: "REF-1278",
    experience: "2 years",
    skills: ["Production planning", "LC process"],
    band: "Consider",
    stage: "Shortlisted",
    applied: "2026-09-04",
    evidence:
      "Supported production planning and prepared letter-of-credit documentation under supervision.",
    education: "Diploma in Textile Engineering",
  },
  {
    id: "FM-2026-0467",
    jobId: "REF-1278",
    experience: "1 year",
    skills: ["Merchandising", "Communication"],
    band: "Consider",
    stage: "Interview",
    applied: "2026-09-03",
    evidence:
      "Supported merchandising follow-up and communicated production updates with the team.",
    education: "BBA",
  },
  {
    id: "FM-2026-0312",
    jobId: "REF-1278",
    experience: "2 years",
    skills: ["Product costing", "Sourcing"],
    band: "Consider",
    stage: "Offer",
    applied: "2026-09-02",
    evidence:
      "Assisted with material sourcing and supplier costing comparisons.",
    education: "BSc in Textile Engineering",
  },
  {
    id: "FM-2026-0399",
    jobId: "REF-1278",
    experience: "1 year",
    skills: ["General merchandising", "Reporting"],
    band: "Needs review",
    stage: "New",
    applied: "2026-09-06",
    evidence:
      "Described general merchandising responsibilities; a specific work example is still needed.",
    education: "BBA",
  },
  {
    id: "FM-2026-0550",
    jobId: "REF-1278",
    experience: "Less than 1 year",
    skills: ["Documentation", "Communication"],
    band: "Needs review",
    stage: "New",
    applied: "2026-09-06",
    evidence:
      "Supported documentation during an internship. Candidate confirmation of dates is pending.",
    education: "BBA, final year",
  },
];
export const initialEvents: AuditEvent[] = [
  {
    id: "event-1",
    title: "Candidate moved to interview",
    detail: "FM-2026-0376 · Relevant order-management evidence confirmed.",
    time: "10:32",
  },
  {
    id: "event-2",
    title: "Fairness review completed",
    detail: "HR Operations Associate · Review notes recorded.",
    time: "09:48",
  },
  {
    id: "event-3",
    title: "Application link published",
    detail: "Junior Merchandising Executive · REF-1278",
    time: "Yesterday",
  },
  {
    id: "event-4",
    title: "Candidate corrected an evidence claim",
    detail: "FM-2026-0376 · Microsoft Excel level confirmed as intermediate.",
    time: "Yesterday",
  },
];
export const rubricQuestions = [
  {
    title: "Order management",
    question: "Describe a delayed order and how you recovered it.",
  },
  {
    title: "Buyer communication",
    question: "How would you explain a production risk to a buyer?",
  },
  {
    title: "Spreadsheet evidence",
    question: "Walk through a tracker or report you created.",
  },
  {
    title: "Compliance judgment",
    question: "What would you verify before shipment release?",
  },
];
export function exportCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value);
          const safe = /^[=+@\-]/.test(text) ? "'" + text : text;
          return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
