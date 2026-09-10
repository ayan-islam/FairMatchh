# FairMatch

A local fullstack recruitment application with employer, candidate and platform-administrator workspaces. The application records job-related evidence and reasoned human decisions; it does not automatically hire or reject applicants.

## Implemented features

- Account registration/sign-in, role checks, BCrypt passwords and revocable JWT sessions.
- Organization profiles, private supporting PDFs and recorded administrator approval before job publication.
- Job drafts, publishing/editing/closing, academic department selection and related/custom job positions.
- Exact shared-job links, candidate profiles, saved application drafts, consent-based submissions and duplicate protection.
- Private CV storage, text extraction, local English/Bangla OCR, source-linked suggestions and candidate confirmation.
- Blind application responses, per-requirement human evidence reviews and saved supporting-information conversations.
- Job-specific weighted candidate ranking with quoted evidence, reasons, ties, incomplete-review handling, version history and stale-score invalidation.
- Persistent hiring stages, recorded reasons, interviews/evaluations, notifications, support cases, reports and audit history.
- Candidate data export, draft/CV deletion and verified local backup/restore tools.

## Architecture

```text
Next.js / React / TypeScript (3000)
              | /api rewrite
              v
Java 21 / Spring Boot / Spring Security (8080)
         |                        |
         v                        v
MongoDB replica set (27018)    Python / FastAPI (8090)
                                  |
                                  v
                             MinIO (9000)
```

Frontend: Next.js 16, React 19, TypeScript, Tailwind 4 and shared Radix/shadcn components. Backend: Spring Boot 3.5.16, Spring Modulith 1.4.13 and Spring Data MongoDB. Document processing: Python 3.12, pypdf, pypdfium2 and local Tesseract OCR.

## Run locally

This repository contains source code, tests, synthetic fixtures and editable documentation. It does **not** contain the author's database, accounts, CV uploads, keys, installed runtimes, node_modules or compiled builds. A new clone requires setup; see [FRESH_SETUP.md](FRESH_SETUP.md).

After setup, double-click **START_FAIRMATCH.cmd**, or run this from the project root in PowerShell:

```powershell
.\START_FAIRMATCH.cmd
```

Open http://127.0.0.1:3000/?workspace=employer. The launcher starts/reuses all five services. Running only the frontend does not start the backend. STOP_FAIRMATCH.cmd stops the background processes without removing stored data. Keep the entire private data folder.

New installations do not automatically create sample jobs or accounts. Configure the first administrator privately, register an employer/candidate, and review organization evidence in the application. There are no published production login credentials. Public registration cannot create an administrator.

## Code and demonstration guides

- [Project demonstration and codebase guide](PROJECT_DEMONSTRATION_GUIDE.md): presentation route, feature operations, code tour and viva questions. This editable draft was prepared before the subsequent request to pause document work.
- [Candidate ranking](CANDIDATE_RANKING_GUIDE.md): rubric, calculation, operation and implementation.
- [Requirement review](REQUIREMENT_REVIEW_GUIDE.md), [account security](ACCOUNT_SECURITY_SETUP.md), [OCR](OCR_SETUP_AND_CODE_GUIDE.md), [candidate privacy](PRIVACY_FEATURE_GUIDE.md) and [backup/recovery](BACKUP_AND_RECOVERY_GUIDE.md).

The live frontend starts at src/app/page.tsx, which renders FullstackApp through fairmatch-app.tsx. Java modules are under backend/src/main/java/com/fairmatch. Some existing filenames and historical guide notes refer to earlier demo milestones; the active workspace loads saved backend records.

## Validation

The source milestone before this export passed 46 Java tests, frontend lint/type checks and production compilation. The seven ranking tests were rerun after final validation fixes. Browser/restart checks preserved a completed 75/100 assessment and an incomplete, unranked assessment with their evidence and histories. Eleven Python extraction/storage tests and eight backup safety tests passed in earlier checks. Local logs and user stores are intentionally not published.

The sanitized GitHub source snapshot also passed all 46 Java tests on 10 September 2026 using the laptop's existing local document services and isolated test databases. The first attempt ran before those services were available; the complete rerun passed without skips.

```powershell
# Start the local MongoDB replica set and document services first.
cd backend
.\mvnw.cmd test
cd ..\frontend
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Java integration tests create separate databases. Any fixed credentials in test/bootstrap fixtures are synthetic test values, distinct from retained laptop accounts; sample bootstrap is disabled by default.

## Remaining scope

Real SMTP sender setup and inbox verification; recruitment-event email/SMS; merchant-backed payments; team invitations and finer permissions; retention/account erasure; broader extraction/redaction quality; external organization registry checks; production deployment/hardening. The initial team-access edits were interrupted and are excluded from this working source snapshot.

Human scoring does not prove candidate competence or demographic fairness. OCR requires candidate correction. Administrator approval records a review of submitted evidence, not government verification. No online deployment is included.
