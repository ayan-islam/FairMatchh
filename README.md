# FairMatch - local fullstack application

Start from `C:\Users\HP\Desktop\fairmatch` in PowerShell:

```powershell
.\START_FAIRMATCH.cmd
```

Or double-click that file. The launcher starts/reuses MongoDB, MinIO, the Python document worker, Spring Boot and Next.js. Open http://127.0.0.1:3000/?workspace=employer. Running only the frontend does not start the other services.

Double-click **STOP_FAIRMATCH.cmd** to stop the background services without deleting data. While the app is running, **BACKUP_FAIRMATCH.cmd** creates a verified private backup on the Desktop and restarts the app. **RESTORE_FAIRMATCH.cmd** extracts a backup to a new recovery folder without replacing current data. See **BACKUP_AND_RECOVERY_GUIDE.md** for the tested recovery procedure.

Existing employer, administrator and candidate accounts remain in the local database. New candidates can register in the Candidate workspace. New organization owners can register as employers, submit business evidence and obtain an administrator review before publishing. An organization owner can invite additional recruiters from **Settings > Team & access**.

Read **FairMatch_Project_Demonstration_Guide.pdf** or its editable source **PROJECT_DEMONSTRATION_GUIDE.md** for the current presentation script, architecture, codebase walkthrough and viva questions. **TEAM_ACCESS_GUIDE.md** explains recruiter invitations and permissions. **FULLSTACK_PROGRESS.md** records implemented and remaining scope. Older guides describe earlier milestones.

## Working workflows

**Candidate ranking:** Employer > Candidate ranking compares completed human assessments for a selected job and hiring stage. Configure weights and rating definitions, cite submitted evidence, then save ratings. Scores, explanations and version history persist; incomplete or stale assessments remain unranked. See [CANDIDATE_RANKING_GUIDE.md](CANDIDATE_RANKING_GUIDE.md) for operation and code explanations.

**Team access:** An organization owner creates a one-use, email-bound recruiter invitation in Settings > Team & access. A teammate opens Employer > Join an organization on the same FairMatch installation and creates their own account. Recruiters can work on hiring records but cannot manage membership or business verification files. The owner can suspend and restore access; suspension revokes saved sessions. Invitations are shared manually and do not verify email inbox ownership. See **TEAM_ACCESS_GUIDE.md**.

JWT sign-in and roles; organization registration/settings/review; academic department and related position selection; job draft/publish/edit/close; candidate profiles and saved application drafts; consent-based submissions and duplicate checks; candidate application history and withdrawal; blind employer responses; human evidence-band reviews; recorded hiring stages; supporting-information conversations; interviews and evaluations; in-app notifications; admin support/appeal cases; fairness process checks; saved audit and real-data CSV reports; private PDF upload, text extraction, candidate confirmation, download and deletion.

Text PDFs are supported up to 8 MB and 10 pages, with page-linked source highlights and editable suggestions from explicit section headings. Refresh extraction upgrades an older CV without uploading it again or changing the confirmed profile. English/Bangla scanned-page OCR now runs locally, with an explicit Read with OCR retry and warnings for uncertain reading. See OCR_SETUP_AND_CODE_GUIDE.md. The original PDF is private in MinIO; a candidate must review and confirm extracted information. No automatic hiring decisions are made.

## Stack and data

Java 21, Spring Boot 3.5.16, Spring Modulith 1.4.13, Maven, Spring Security JWT, Spring Data MongoDB 8 replica set; Next.js 16, React 19, TypeScript, Tailwind 4 and Radix/shadcn components; Python 3.12, FastAPI, pypdf, pypdfium2, Tesseract English/Bangla OCR and local MinIO.

Keep the entire **data** folder: MongoDB records, MinIO objects and local signing/service keys live there. Do not delete it to restart. Existing jobs and anonymous applications are preserved. Old anonymous applications are not automatically assigned to new accounts based on an unverified email address.

All services bind locally. No online deployment is configured or required for the September 15 assessment. Email verification/recovery, revocable sessions and SMTP retries are implemented; actual delivery still requires a configured sender account. Team invitations work on the same local installation and are shared manually. Payments, SMS, advanced matching/fairness and automated retention remain unfinished.

## Tests and rebuild

Start local services first. Integration tests need MongoDB and the document worker/MinIO. Tests create isolated test databases, not changes to the student's `fairmatch` database.

```powershell
Set-Location C:\Users\HP\Desktop\fairmatch\backend
.\mvnw.cmd test
Set-Location ..\frontend
npm.cmd run lint
npm.cmd run typecheck
```

Before replacing a running build, stop only the FairMatch backend and frontend processes. Windows locks the running JAR, and Next.js reads its production build while serving. Then run `.\mvnw.cmd -DskipTests package` **from the backend folder**, `npm.cmd run build` **from the frontend folder**, and the root launcher again. Prefer the commands in **REBUILD_FAIRMATCH.ps1**, which performs the scoped stop, tests, build and restart.

The latest full backend run has **53 passing tests** (`logs/team-full-build.log`), including seven ranking and seven team-access tests. Frontend lint, TypeScript and production compilation passed in the same build. An isolated browser check verified invitation redemption, shared organization membership, read-only recruiter settings, persistence after reload, owner suspension and session revocation. Eleven Python extraction/OCR/storage tests passed earlier. `logs/fullstack-restart-result.json` records the earlier packaged-backend restart test. Complete the guide's manual rehearsal before the assessment.

Eight additional backup safety tests pass. A full cold-backup restore rehearsal opened copied MongoDB/MinIO stores on separate ports, matched database collection hashes/counts and downloaded both stored PDFs. See `logs/backup-restore-result.json`. CV extraction/confirmation, candidate privacy actions and persisted requirement reviews were also checked in the browser against a separate test database; see `logs/fullstack-ui-result.json`.

Read **ACCOUNT_SECURITY_SETUP.md** for the new account-security features and real SMTP setup. New installations default to no sample jobs/accounts; earlier classroom accounts and records are preserved. Change retained classroom passwords through Account security before wider use. No SMTP credentials or merchant account have been supplied, and neither delivered emails nor payments are simulated.

To restore the Python worker environment on this computer: Python 3.12 `-m venv document-worker/.venv`, then use that environment's Python to `-m pip install -r document-worker/requirements.txt`. MinIO's installed community binary is under tools; local generated credentials are not in source control. Dependency installation needs internet; running the supplied installed build does not.

Service references: [MinIO Windows setup](https://min.io/docs/minio/windows/operations/install-deploy-manage/deploy-minio-single-node-single-drive.html), [FastAPI file handling](https://fastapi.tiangolo.com/tutorial/request-files/). The supplied recommended-stack PDF remains the architecture reference.

## Candidate privacy controls

Candidate > Privacy downloads real account-linked records as JSON and deletes saved drafts with stale-edit protection. Original PDFs are downloaded from Documents. See PRIVACY_FEATURE_GUIDE.md for the code flow, included data and remaining privacy work.

## Requirement evidence review

Employer > Applications > Review evidence records an assessment, exact submitted-source quote and reason for every job requirement. Java calculates a transparent summary, stores versioned history and invalidates it when requirements change. Hiring stages remain separate human decisions. See REQUIREMENT_REVIEW_GUIDE.md.

## Business verification and drafts

Read **ORGANIZATION_VERIFICATION_GUIDE.md** for employer uploads, administrator login/review and reopening job drafts. Private supporting files, current-document checks, decision history and version protection are connected to the backend. The earlier 39-test milestone and isolated browser draft-to-approval-to-publication rehearsal passed; the current suite has 53 passing tests.
