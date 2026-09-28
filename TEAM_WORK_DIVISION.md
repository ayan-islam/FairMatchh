# FairMatch five-member feature division

This is the original feature-based division agreed for the project presentation. Newer FairMatch work is placed with the feature it naturally extends. Each member receives a physical ZIP with an assignment guide, Git commands, an owned-source manifest and relevant cross-feature reference files.

Repository: `https://github.com/ayan-islam/FairMatchh`

| Member | Feature area | Features to present | What to demonstrate and explain | Branch |
| --- | --- | --- | --- | --- |
| 1 | Accounts and organizations | Role-based login, account security/email, organization verification, admin review, recruiter invitations and permissions | Approve an organization, invite a recruiter and explain backend role/ownership enforcement | `member-1-accounts-organizations` |
| 2 | Job management | Department and position selection, custom positions, job drafts, publishing, closing and exact candidate links | Create or reopen a draft, publish a completed job and copy its exact candidate link | `member-2-job-management` |
| 3 | Candidate journey | Link-scoped jobs, CV upload/extraction, local Qwen review, profile confirmation, application drafts/submission, tracking, withdrawal and privacy | Open Member 2's link, extract and confirm a CV, apply, track the application and explain MinIO/privacy | `member-3-candidate-journey` |
| 4 | Application review and ranking | Blind review, requirement evidence, candidate messages, evidence bands, automatic explained ranking, rubric and human assessment | Review Member 3's application, record requirement evidence and explain exactly how ranking points are calculated | `member-4-application-review-ranking` |
| 5 | Hiring and oversight | Hiring pipeline, recorded reasons, interviews, notifications, fairness checks, reports, audit, support and operations/backup | Move the same application with a reason, schedule/evaluate an interview, show reports/fairness and explain current limits | `member-5-hiring-oversight` |

## Member 1 — Accounts and organizations

Owns the identity and organization boundary: login/registration, JWT/session security, email verification and recovery, employer ownership, administrator review, business evidence, team invitations and access suspension.

Primary paths:

```text
frontend/src/components/fairmatch/fullstack-app.tsx
frontend/src/components/fairmatch/account-security.tsx
frontend/src/components/fairmatch/admin-workspace.tsx
frontend/src/components/fairmatch/platform-admin.tsx
frontend/src/components/fairmatch/admin.css
frontend/src/components/fairmatch/organization-documents.tsx
frontend/src/components/fairmatch/team-access.tsx
frontend/src/lib/platform-api.ts
backend/src/main/java/com/fairmatch/BackendConfiguration.java
backend/src/main/java/com/fairmatch/DemoSeed.java
backend/src/main/java/com/fairmatch/common/**
backend/src/main/java/com/fairmatch/platform/**
backend account, organization, platform and team tests
ACCOUNT_SECURITY_SETUP.md
ORGANIZATION_VERIFICATION_GUIDE.md
TEAM_ACCESS_GUIDE.md
integrations.properties.example
```

## Member 2 — Job management

Owns employer job creation and the public link boundary: academic department, related/custom position, draft, publish, edit, close, application count and exact candidate link/visit.

Primary paths:

```text
frontend/src/components/fairmatch/recruiter-workspace.tsx
frontend/src/components/fairmatch/recruiter-dialogs.tsx
frontend/src/components/fairmatch/recruiter.css
frontend/src/lib/job-options.ts
backend/src/main/java/com/fairmatch/job/**
backend/src/test/java/com/fairmatch/WorkingFeaturesTest.java
```

`recruiter-workspace.tsx` and `recruiter-dialogs.tsx` also contain some review/pipeline rendering. Members 4 and 5 receive them as reference files, while Member 2 coordinates edits to these shared components.

## Member 3 — Candidate journey

Owns the candidate's end-to-end path: employer link, profile, PDF upload, PyPDF/OCR extraction, source-linked local Qwen suggestions, candidate confirmation, application draft/submission snapshot, milestone tracker, withdrawal, export and erasure.

Primary paths:

```text
frontend/src/components/fairmatch/candidate-workspace.tsx
frontend/src/components/fairmatch/candidate-portal.tsx
frontend/src/components/fairmatch/candidate-documents.tsx
frontend/src/components/fairmatch/candidate-privacy.tsx
frontend/src/components/fairmatch/candidate.css
frontend/src/components/fairmatch/pdf-preview.tsx
backend/src/main/java/com/fairmatch/application/ApplicationController.java
backend/src/main/java/com/fairmatch/application/ApplicationDocument.java
backend/src/main/java/com/fairmatch/application/ApplicationRepository.java
backend/src/main/java/com/fairmatch/application/ApplicationRequest.java
backend/src/main/java/com/fairmatch/application/ApplicationService.java
backend/src/main/java/com/fairmatch/application/StageRequest.java
backend/src/main/java/com/fairmatch/document/**
backend/src/main/java/com/fairmatch/privacy/**
document-worker/**
candidate privacy and AI CV tests/guides
```

## Member 4 — Application review and ranking

Owns employer review after submission: blind identity projection, requirement-by-requirement evidence, supporting-information conversation, evidence bands, deterministic automatic ranking, explained points and optional human rubric history.

Primary paths:

```text
frontend/src/components/fairmatch/application-conversation.tsx
frontend/src/components/fairmatch/candidate-ranking.tsx
frontend/src/components/fairmatch/criteria-review.tsx
backend/src/main/java/com/fairmatch/application/AutomaticEvidenceMatcher.java
backend/src/main/java/com/fairmatch/application/CriteriaReviewController.java
backend/src/main/java/com/fairmatch/application/RankingController.java
backend/src/test/java/com/fairmatch/CriteriaReviewTest.java
backend/src/test/java/com/fairmatch/RankingTest.java
CANDIDATE_RANKING_GUIDE.md
REQUIREMENT_REVIEW_GUIDE.md
```

The ZIP also supplies `recruiter-workspace.tsx`, `recruiter-dialogs.tsx` and application models as read-only reference because those shared files call the review features.

## Member 5 — Hiring and oversight

Owns what happens after review and the health of the complete process: recorded hiring stages, pipeline, interviews/evaluations, notifications, fairness checks, reports, support/audit, backups, recovery and launch/test infrastructure.

Primary paths:

```text
frontend/src/components/fairmatch/interview-dialogs.tsx
frontend/src/components/fairmatch/governance-panel.tsx
backend/src/main/java/com/fairmatch/application/GovernanceController.java
backend/src/main/java/com/fairmatch/audit/**
backend/src/main/java/com/fairmatch/interview/**
interview and fairness/platform integration tests
operations/**
tools/**
START/STOP/REBUILD/BACKUP/RESET/RESTORE scripts
BACKUP_AND_RECOVERY_GUIDE.md
shared UI/build configuration and project-level documentation
```

The ZIP includes recruiter/candidate/platform files as read-only reference where pipeline, notifications and reports are rendered or stored.

## Collaboration rules

1. Clone the full repository and work on the assigned branch. The ZIP is an offline work package and source reference, not a standalone runnable installation.
2. Edit owned files. Coordinate before changing a shared reference file.
3. Never commit credentials, `data`, `logs`, backups, uploaded documents, `node_modules`, `.next`, `.venv` or `target`.
4. Rebase from `origin/main`, run the relevant tests, then push the member branch and open a pull request.
5. Automatic ranking only orders review. It never changes a hiring stage. Qwen only structures source-linked CV evidence and never ranks or hires.
