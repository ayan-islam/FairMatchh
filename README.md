# FairMatch Full-stack Application

## Sign-in model

- **Candidates:** registration creates a unique 10-digit Candidate ID automatically. Candidates sign in with that ID and their password. The ID is shown in the candidate workspace.
- **Employers:** owners and invited recruiters use a username that starts with a letter, plus their password.
- **Administrators:** administrator usernames are provisioned by the platform owner; public administrator registration is disabled.

Existing accounts created before this rule remain valid so saved project data is not locked out.

## Application drafts and tracking

Candidates can save an unfinished application as a draft. Opening the same job while signed in restores the saved fields and displays when the draft was last saved. A successful submission removes that job's draft. The **My applications** page shows the current milestone across Applied, Shortlisted, Interview, Offer and Hired, plus the latest job-related stage reason recorded by the employer.

The candidate **Jobs** page is link-scoped. It does not display the platform's public job catalogue. Opening an employer's `?workspace=candidate&job=...` link while signed in records that job for the current candidate account; later visits to the Jobs page show only that account's still-open linked jobs. A direct link view remains limited to the one linked position.

Open PowerShell in the project folder (the folder containing this README), then run:

```powershell
.\START_FAIRMATCH.cmd
```

Run `SETUP_FAIRMATCH_AI.cmd` once before the first AI-enabled start. It installs Ollama and the Qwen3 4B Instruct model under `D:\FairMatch\Ollama`; the large model files do not use drive C:. Normal starts then launch the local Ollama API automatically. In Candidate > Documents, PDF text is extracted with PyPDF/Tesseract, Qwen turns it into page-linked structured suggestions, FairMatch rejects quotations it cannot locate in the extracted page, and the candidate must review and confirm the facts.

Or double-click that file. The launcher starts/reuses MongoDB, MinIO, the Python document worker, Spring Boot and Next.js. Open http://127.0.0.1:3000/?workspace=employer. Running only the frontend does not start the other services.

Double-click **STOP_FAIRMATCH.cmd** to stop the background services without deleting data. While the app is running, **BACKUP_FAIRMATCH.cmd** creates a verified private backup on the Desktop and restarts the app. **RESTORE_FAIRMATCH.cmd** extracts a backup to a new recovery folder without replacing current data. See **BACKUP_AND_RECOVERY_GUIDE.md** for the tested recovery procedure.

Existing employer, administrator and candidate accounts remain in the local database. New candidates can register in the Candidate workspace. New organization owners can register as employers, submit business evidence and obtain an administrator review before publishing. An organization owner can invite additional recruiters from **Settings > Team & access**.

Read **PROJECT_DEMONSTRATION_GUIDE.md** for the current presentation script, architecture, codebase walkthrough and viva questions. The original Desktop project also includes a rendered **FairMatch_Project_Demonstration_Guide.pdf**; generated PDFs are omitted from the GitHub source snapshot. **TEAM_ACCESS_GUIDE.md** explains recruiter invitations and permissions. **FULLSTACK_PROGRESS.md** in the Desktop project records implemented and remaining scope. Older guides describe earlier milestones.

## Working workflows

**Candidate ranking:** Employer > Candidate ranking now automatically orders applications by explained text matches against the selected job requirements. Recruiters do not need to rate every candidate to get a first-pass order. A saved rubric supplies custom weights; otherwise requirements have equal weights. Private CV PDFs are excluded, but candidate-confirmed details submitted in an application are included. Optional human rubric assessments remain separate, with evidence quotes and history. Text match is not verified competence or an automatic hiring decision. See [CANDIDATE_RANKING_GUIDE.md](CANDIDATE_RANKING_GUIDE.md).

**Local AI CV review:** Ollama runs Qwen3 4B Instruct locally after PyPDF/Tesseract extraction. It creates structured skills, courses, projects, experience and a work-focused summary with page numbers and source quotations. Java validates every cited quotation before showing it. The candidate must confirm suggestions, and deterministic ranking remains separate from the LLM. [AI_CV_REVIEW_PLAN.md](AI_CV_REVIEW_PLAN.md) documents the privacy and evidence design.

**Team access:** An organization owner creates a one-use, email-bound recruiter invitation in Settings > Team & access. A teammate opens Employer > Join an organization on the same FairMatch installation and creates their own account. Recruiters can work on hiring records but cannot manage membership or business verification files. The owner can suspend and restore access; suspension revokes saved sessions. Invitations are shared manually and do not verify email inbox ownership. See **TEAM_ACCESS_GUIDE.md**.

JWT sign-in and roles; organization registration/settings/review; academic department and related position selection; job draft/publish/edit/close; candidate profiles and saved application drafts; consent-based submissions and duplicate checks; permanent candidate-owned application withdrawal; blind employer responses; human evidence-band reviews; recorded hiring stages; supporting-information conversations; interviews and evaluations; in-app notifications; admin support/appeal cases; fairness process checks; saved audit and real-data CSV reports; private PDF upload, text extraction, candidate confirmation, download and deletion.

**Withdrawal behavior:** confirming withdrawal permanently removes the application and its linked messages, assessments, ranking records, interviews, notifications, support references and saved draft from operational data. The job count is corrected and the candidate can apply again. FairMatch keeps only a non-identifying organization audit event stating that a withdrawal occurred.

In **Admin > Organizations > Review organization**, choose **View in browser** to read a private supporting PDF in the review dialog, move between pages and zoom. A download is optional. After viewing, explicitly check that you reviewed the document before approving the organization.

Text PDFs are supported up to 8 MB and 10 pages, with page-linked source highlights and editable suggestions from explicit section headings. Refresh extraction upgrades an older CV without uploading it again or changing the confirmed profile. English/Bangla scanned-page OCR now runs locally, with an explicit Read with OCR retry and warnings for uncertain reading. See OCR_SETUP_AND_CODE_GUIDE.md. The original PDF is private in MinIO; a candidate must review and confirm extracted information. No automatic hiring decisions are made.

## Stack and data

Java 21, Spring Boot 3.5.16, Spring Modulith 1.4.13, Maven, Spring Security JWT, Spring Data MongoDB 8 replica set; Next.js 16, React 19, TypeScript, Tailwind 4 and Radix/shadcn components; Python 3.12, FastAPI, pypdf, pypdfium2, Tesseract English/Bangla OCR and local MinIO.

The frontend build uses Node.js 22.13+ (Node.js 24 on this laptop). PDF.js renders private business PDFs inside the browser; its matching worker and license are in `frontend/public`.

Keep the entire **data** folder: MongoDB records, MinIO objects and local signing/service keys live there. Do not delete it to restart. Existing jobs and anonymous applications are preserved. Old anonymous applications are not automatically assigned to new accounts based on an unverified email address.

All services bind locally. No online deployment is configured or required for the September 15 assessment. Email verification/recovery, transactional recruitment emails, emailed recruiter invitations, revocable sessions and SMTP retries are implemented; actual delivery still requires a configured sender account and real inbox verification. Payments, SMS, semantic skill matching, fairness validation and automated retention remain unfinished.

## Tests and rebuild

Start local services first. Integration tests need MongoDB and the document worker/MinIO. Tests create isolated test databases, not changes to the student's `fairmatch` database.

```powershell
Set-Location .\backend
.\mvnw.cmd test
Set-Location ..\frontend
npm.cmd run lint
npm.cmd run typecheck
```

Before replacing a running build, stop only the FairMatch backend and frontend processes. Windows locks the running JAR, and Next.js reads its production build while serving. Then run `.\mvnw.cmd -DskipTests package` **from the backend folder**, `npm.cmd run build` **from the frontend folder**, and the root launcher again. Prefer the commands in **REBUILD_FAIRMATCH.ps1**, which performs the scoped stop, tests, build and restart.

The latest full backend run has **58 passing tests** (`backend/target/surefire-reports`), including automatic ranking and validated local-AI output without manual ratings. Frontend lint and TypeScript checks passed; the packaged build is verified during the rebuild workflow. Twelve Python extraction/OCR/storage tests passed. Complete the guide's manual rehearsal before the assessment.

Eight additional backup safety tests pass. A full cold-backup restore rehearsal opened copied MongoDB/MinIO stores on separate ports, matched database collection hashes/counts and downloaded both stored PDFs. See `logs/backup-restore-result.json`. CV extraction/confirmation, candidate privacy actions and persisted requirement reviews were also checked in the browser against a separate test database; see `logs/fullstack-ui-result.json`.

Read **ACCOUNT_SECURITY_SETUP.md** for the new account-security features and real SMTP setup. New installations default to no sample jobs/accounts; earlier classroom accounts and records are preserved. Change retained classroom passwords through Account security before wider use. No SMTP credentials or merchant account have been supplied, and neither delivered emails nor payments are simulated.

To restore the Python worker environment on this computer: Python 3.12 `-m venv document-worker/.venv`, then use that environment's Python to `-m pip install -r document-worker/requirements.txt`. MinIO's installed community binary is under tools; local generated credentials are not in source control. Dependency installation needs internet; running the supplied installed build does not.

Service references: [MinIO Windows setup](https://min.io/docs/minio/windows/operations/install-deploy-manage/deploy-minio-single-node-single-drive.html), [FastAPI file handling](https://fastapi.tiangolo.com/tutorial/request-files/). The supplied recommended-stack PDF remains the architecture reference.

## Candidate privacy controls

Candidate > Privacy downloads real account-linked records as JSON and deletes saved drafts with stale-edit protection. Original PDFs are downloaded from Documents. See PRIVACY_FEATURE_GUIDE.md for the code flow, included data and remaining privacy work.

## Requirement evidence review

Employer > Applications > Review evidence records an assessment, exact submitted-source quote and reason for every job requirement. Java calculates a transparent summary, stores versioned history and invalidates it when requirements change. Hiring stages remain separate human decisions. See REQUIREMENT_REVIEW_GUIDE.md.

## Business verification and drafts

Read **ORGANIZATION_VERIFICATION_GUIDE.md** for employer uploads, administrator login/review and reopening job drafts. Private supporting files, current-document checks, decision history and version protection are connected to the backend. The earlier 39-test milestone and isolated browser draft-to-approval-to-publication rehearsal passed; the current suite has 58 passing tests.
