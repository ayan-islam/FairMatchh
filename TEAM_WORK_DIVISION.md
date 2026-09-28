# FairMatch five-member work division

This division covers the current FairMatch codebase without giving two people routine ownership of the same file. Everyone works from the complete repository, but each member normally edits only the paths assigned below. If a task requires another member's file, discuss it before editing and mention that coordination in the pull request.

Repository: `https://github.com/ayan-islam/FairMatchh`

## Team summary

| Member | Primary responsibility | Working branch | Main demonstration |
| --- | --- | --- | --- |
| 1 | Frontend foundation, shared UI, authentication shell and accessibility | `member-1-frontend-foundation` | Switch roles, sign in/register, show responsive shared interface |
| 2 | Candidate journey, applications, tracking and privacy | `member-2-candidate-journey` | Open an exact job link, save a draft, apply, track and withdraw/export/delete |
| 3 | Employer hiring operations, jobs, pipeline, interviews and team access | `member-3-employer-hiring` | Create/publish a job, review an application, move a stage and schedule an interview |
| 4 | Administration, security, organization verification, email and audit | `member-4-admin-security` | Verify an organization, explain role security, account security, support and audit |
| 5 | CV extraction, local AI, explainable ranking, documents, tests and operations | `member-5-ai-infrastructure` | Upload a CV, show source-linked Qwen output, ranking explanation and service architecture |

## Member 1 — Frontend foundation and authentication

### Features

- Application shell and workspace switching.
- Employer, candidate and administrator sign-in/registration screens.
- Shared form controls, validation presentation, required/optional labels and notifications.
- Responsive layout, design tokens, accessibility and shared frontend types/API helpers.
- Frontend build configuration and presentation-level documentation.

### Owned paths

```text
frontend/src/app/**
frontend/src/components/ui/**
frontend/src/components/fairmatch/fullstack-app.tsx
frontend/src/components/fairmatch/fairmatch-app.tsx
frontend/src/components/fairmatch/shared.tsx
frontend/src/components/fairmatch/backend.css
frontend/src/components/fairmatch/platform.css
frontend/src/components/fairmatch/use-current-time.ts
frontend/src/components/fairmatch/use-mobile-navigation.ts
frontend/src/lib/api.ts
frontend/src/lib/demo-data.ts
frontend/src/lib/utils.ts
frontend/AGENTS.md
frontend/eslint.config.mjs
frontend/next-env.d.ts
frontend/next.config.ts
frontend/package.json
frontend/package-lock.json
frontend/postcss.config.mjs
frontend/tsconfig.json
README.md
PROJECT_DEMONSTRATION_GUIDE.md
FULLSTACK_PROGRESS.md
FRESH_SETUP.md
```

### Required checks

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Suggested commit: `fix(frontend): improve responsive authentication layout`

## Member 2 — Candidate journey and application lifecycle

### Features

- Link-scoped candidate jobs and candidate profile.
- Application draft, submission snapshot, consent and duplicate protection.
- Application milestone tracker, notifications and supporting-information conversation.
- Candidate document confirmation UI and compact CV highlights.
- Permanent application withdrawal, data export and account privacy controls.

### Owned paths

```text
frontend/src/components/fairmatch/candidate-workspace.tsx
frontend/src/components/fairmatch/candidate-portal.tsx
frontend/src/components/fairmatch/candidate-documents.tsx
frontend/src/components/fairmatch/candidate-privacy.tsx
frontend/src/components/fairmatch/application-conversation.tsx
frontend/src/components/fairmatch/candidate.css
backend/src/main/java/com/fairmatch/application/ApplicationController.java
backend/src/main/java/com/fairmatch/application/ApplicationDocument.java
backend/src/main/java/com/fairmatch/application/ApplicationRepository.java
backend/src/main/java/com/fairmatch/application/ApplicationRequest.java
backend/src/main/java/com/fairmatch/application/ApplicationService.java
backend/src/main/java/com/fairmatch/application/StageRequest.java
backend/src/main/java/com/fairmatch/privacy/**
backend/src/test/java/com/fairmatch/CandidatePrivacyTest.java
backend/src/test/java/com/fairmatch/WorkingFeaturesTest.java
PRIVACY_FEATURE_GUIDE.md
```

### Required checks

```powershell
Set-Location backend
.\mvnw.cmd -Dtest=CandidatePrivacyTest,WorkingFeaturesTest test
Set-Location ..\frontend
npm.cmd run lint
npm.cmd run typecheck
```

Suggested commit: `feat(candidate): improve application milestone tracking`

## Member 3 — Employer hiring operations

### Features

- Department-based positions and job draft/publish/edit/close workflows.
- Employer overview, application list, evidence dialog and hiring pipeline.
- Reasoned stage movement and candidate notifications.
- Interview scheduling, cancellation and evaluation.
- Organization recruiter invitation, owner/recruiter permissions and suspension.

### Owned paths

```text
frontend/src/components/fairmatch/recruiter-workspace.tsx
frontend/src/components/fairmatch/recruiter-dialogs.tsx
frontend/src/components/fairmatch/interview-dialogs.tsx
frontend/src/components/fairmatch/team-access.tsx
frontend/src/components/fairmatch/recruiter.css
frontend/src/lib/job-options.ts
backend/src/main/java/com/fairmatch/job/**
backend/src/main/java/com/fairmatch/interview/**
backend/src/main/java/com/fairmatch/platform/TeamController.java
backend/src/main/java/com/fairmatch/platform/TeamService.java
backend/src/test/java/com/fairmatch/InterviewFeaturesTest.java
backend/src/test/java/com/fairmatch/platform/TeamAccessTest.java
TEAM_ACCESS_GUIDE.md
```

### Required checks

```powershell
Set-Location backend
.\mvnw.cmd -Dtest=InterviewFeaturesTest,TeamAccessTest test
Set-Location ..\frontend
npm.cmd run lint
npm.cmd run typecheck
```

Suggested commit: `feat(employer): refine interview and pipeline workflow`

## Member 4 — Administration, security and verification

### Features

- JWT sessions, role authorization and organization ownership checks.
- Account security, password recovery, email verification and durable SMTP outbox.
- Organization evidence upload/review, approval, rejection, cancellation and filtering.
- Administrator organizations, support/appeals, audit views and business-file access.
- Platform bootstrap, common API errors and audit recording.

### Owned paths

```text
frontend/src/components/fairmatch/admin-workspace.tsx
frontend/src/components/fairmatch/platform-admin.tsx
frontend/src/components/fairmatch/admin.css
frontend/src/components/fairmatch/account-security.tsx
frontend/src/components/fairmatch/organization-documents.tsx
frontend/src/lib/platform-api.ts
backend/src/main/java/com/fairmatch/BackendConfiguration.java
backend/src/main/java/com/fairmatch/DemoSeed.java
backend/src/main/java/com/fairmatch/audit/**
backend/src/main/java/com/fairmatch/common/**
backend/src/main/java/com/fairmatch/platform/**
  except TeamController.java and TeamService.java
backend/src/test/java/com/fairmatch/OrganizationEvidenceTest.java
backend/src/test/java/com/fairmatch/PlatformFeaturesTest.java
backend/src/test/java/com/fairmatch/platform/AccountSecurityTest.java
backend/src/test/java/com/fairmatch/platform/AdminBootstrapTest.java
ACCOUNT_SECURITY_SETUP.md
ORGANIZATION_VERIFICATION_GUIDE.md
integrations.properties.example
```

### Required checks

```powershell
Set-Location backend
.\mvnw.cmd -Dtest=OrganizationEvidenceTest,PlatformFeaturesTest,AccountSecurityTest,AdminBootstrapTest test
Set-Location ..\frontend
npm.cmd run lint
npm.cmd run typecheck
```

Suggested commit: `feat(admin): improve organization review audit details`

## Member 5 — AI, ranking, documents and infrastructure

### Features

- Private PDF storage and browser preview.
- PyPDF extraction, English/Bangla OCR and source-page tracking.
- Local Ollama/Qwen3 4B structured CV review with Java quotation validation.
- Deterministic explainable candidate ranking and optional evidence assessments.
- MongoDB/MinIO/document-worker setup, backup/recovery, smoke tests and launch scripts.

### Owned paths

```text
frontend/src/components/fairmatch/candidate-ranking.tsx
frontend/src/components/fairmatch/criteria-review.tsx
frontend/src/components/fairmatch/governance-panel.tsx
frontend/src/components/fairmatch/pdf-preview.tsx
frontend/public/pdf.worker.min.mjs
frontend/public/pdfjs-LICENSE.txt
backend/src/main/java/com/fairmatch/FairMatchApplication.java
backend/src/main/java/com/fairmatch/application/AutomaticEvidenceMatcher.java
backend/src/main/java/com/fairmatch/application/CriteriaReviewController.java
backend/src/main/java/com/fairmatch/application/GovernanceController.java
backend/src/main/java/com/fairmatch/application/RankingController.java
backend/src/main/java/com/fairmatch/document/**
backend/src/main/resources/application.properties
backend/src/test/java/com/fairmatch/CriteriaReviewTest.java
backend/src/test/java/com/fairmatch/RankingTest.java
backend/src/test/java/com/fairmatch/document/**
backend/src/test/resources/**
backend/pom.xml
backend/mvnw.cmd
document-worker/**
operations/**
tools/**
START_*.cmd
START_*.ps1
STOP_*.cmd
STOP_*.ps1
REBUILD_FAIRMATCH.ps1
BACKUP_*.cmd
BACKUP_*.ps1
RESET_*.cmd
RESET_*.ps1
RESTORE_*.cmd
RESTORE_*.ps1
SETUP_FAIRMATCH_AI.*
AI_CV_REVIEW_PLAN.md
CANDIDATE_RANKING_GUIDE.md
OCR_SETUP_AND_CODE_GUIDE.md
REQUIREMENT_REVIEW_GUIDE.md
BACKUP_AND_RECOVERY_GUIDE.md
```

### Required checks

```powershell
Set-Location backend
.\mvnw.cmd -Dtest=RankingTest,CriteriaReviewTest,AiCvReviewServiceTest test
Set-Location ..\document-worker
.\.venv\Scripts\python.exe -m unittest discover -v
```

Suggested commit: `feat(ai): strengthen source-linked CV evidence validation`

## Shared rules

1. Never commit `data`, `logs`, `backups`, `.env` files, credentials, uploaded PDFs, `node_modules`, `.next`, `.venv` or `target`.
2. Never commit directly to `main`. Push the assigned member branch and open a pull request.
3. Keep each commit focused. Do not reformat files owned by another member.
4. Pull and rebase from `origin/main` before opening or updating a pull request.
5. A ranking result only orders review; it never changes a hiring stage. Qwen structures CV evidence; it never ranks or hires.
6. Run the checks listed for your area and include the results in the pull request.
7. The coordinator resolves changes to shared files and merges pull requests.

The ZIP work packages are responsibility guides and source snapshots. GitHub remains the source of truth: clone the repository and make the actual commit from the assigned branch.
