# FairMatch
## Complete demonstration and codebase guide

**A practical script for your project presentation, live demonstration and viva.**

Prepared from the local implementation on 10 September 2026. Project folder: `C:\Users\HP\Desktop\fairmatch`.

> Your opening: "FairMatch is a recruitment application for employers, candidates and administrators. It connects job publishing, candidate applications, evidence review, explainable ranking and hiring stages. The core records are saved in a backend database, so the work survives refresh and restart."

This guide describes the current implementation, including the new candidate ranking feature. Use it instead of older presentation instructions where they disagree. It does not claim that every planned integration is finished.

### Read it in this order

| Pages | What to prepare |
| --- | --- |
| 2-3 | Startup checklist and timed presentation plan |
| 4-11 | Step-by-step demonstrations of the application features |
| 12-17 | Architecture, code map, request flows, data and security |
| 18 | Test evidence and recovery from common demo problems |
| 19-20 | Teacher questions, limitations and closing script |

### Three things to remember

- **Extraction reads text.** The candidate checks and confirms it.
- **Ranking calculates from human ratings.** It does not establish whether a claim is true.
- **Hiring decisions are separate actions.** A score never automatically hires, rejects or moves a candidate.

The code paths in this guide are relative to the project folder above. No account passwords, private keys or personal applicant records are reproduced. Suggested presentation examples are rehearsal material; they are not claims about an actual candidate or business.

<!-- page -->
# 2. Prepare and start the project

### Before the presentation

1. Open `Desktop\fairmatch` in VS Code. Keep this guide beside it.
2. Use an employer account you can sign into, a candidate account and the local administrator account. Keep your passwords private. Public registration creates employers or candidates, never administrators.
3. Prepare one clear job, its share link and candidate-owned sample evidence. Use your own CV or a clearly labeled practice CV. Use authentic business evidence for a real organization; a rehearsal PDF does not establish business authenticity.
4. Choose a future application deadline and future interview time. Do not use the fixed dates from an old screenshot.
5. Rehearse once before class. Do not rebuild, install dependencies or change database settings during the presentation.

### Start with one file

Double-click **START_FAIRMATCH.cmd**. Or open PowerShell in the project folder:

```powershell
Set-Location C:\Users\HP\Desktop\fairmatch
.\START_FAIRMATCH.cmd
```

Open `http://127.0.0.1:3000/?workspace=employer`. The launcher starts or reuses MongoDB, MinIO, the Python worker, Spring Boot and Next.js. Starting only `npm run dev` does not start the backend.

### Sessions and stopping

The top bar switches Employer, Candidate and Admin workspaces. Each requires the corresponding account. The app retains workspace tokens in the tab's session storage; selecting Admin does not grant admin privileges. Separate browser profiles can make a classroom demonstration easier, but are not required.

Use **STOP_FAIRMATCH.cmd** when finished. Closing VS Code alone does not stop background services. Keep the entire `data` folder: it contains database files, PDFs and local keys. Never delete it to fix startup.

> Say: "The frontend displays the interface. The launcher starts all the services needed for the complete application. MongoDB and MinIO keep the records and uploaded files beyond a browser session."

<!-- page -->
# 3. Your presentation route

### A 20-minute presentation

| Time | Show | Explain |
| --- | --- | --- |
| 0-2 min | Opening and architecture | Problem, three roles, frontend/API/storage |
| 2-5 min | Employer, job draft and share link | Department, position, verification gate, persistence |
| 5-8 min | Candidate Documents and application | Extraction, confirmation, exact linked job, saved submission |
| 8-12 min | Employer review and ranking | Blind response, quotes, weights, missing evidence, explanations |
| 12-14 min | Pipeline and interview | Explicit reason, saved stage, candidate update |
| 14-18 min | VS Code walkthrough | One request from React to Java to MongoDB |
| 18-20 min | Test evidence and closing | What is proven, what remains, questions |

Prepare organization approval beforehand if time is short. For a longer demonstration, add the full administrator review on page 4 and support/privacy features on page 11. Do not attempt every optional branch in a short presentation.

### A five-minute emergency version

1. Explain the purpose and three roles in 30 seconds.
2. Show a saved employer job and open its exact share link as a candidate.
3. Submit one prepared application and show its reference in the employer workspace.
4. Show a saved ranking explanation and a reasoned stage change. Refresh to prove persistence.
5. Open `ApplicationService.java` and explain the database transaction. Close with the real limitations.

### Keep one story throughout

Use the same job and application reference when moving between workspaces. A CSE Software Engineer role with two requirements is easy to explain: "Develop Java APIs" and "Test persistent application data." This is a rehearsal example, not a universal hiring rubric.

> Transition to code: "You have seen the result in the interface. I will now follow the same action through the code, so you can see which part validates it and which part saves it."

<!-- page -->
# 4. Organization verification and admin access

### Employer: submit evidence

1. Sign in as an employer. Open **Settings** and save the correct organization details.
2. Open **Verification documents**. Choose a document type, describe what it establishes, choose the PDF and upload it.
3. While the organization is Pending, create a job and **Save as draft**. Show that drafting works before approval. Publishing remains blocked.

Business uploads support up to five private PDFs, each at most 8 MB and ten pages. The files are evidence for a human reviewer; uploading them does not automatically verify the organization.

### Administrator: review the organization

1. Select **Admin**, sign in with the local administrator account and open **Organizations**.
2. Select **Review organization**. Read the current company details and download every current supporting document.
3. Review the contents. Mark each downloaded document as reviewed, then confirm the overall review.
4. Enter a meaningful decision reason of at least 20 characters. Choose **Approve organization** or **Request changes** as justified by the evidence.
5. Return to Employer and refresh. Show the saved status and notification. A verified employer can now publish completed jobs.

Approval requires at least one current document and acknowledgment of all current documents. A file or relevant organization change makes a stale review fail; the administrator must reload and review the new version. Adding/removing evidence and renaming the company require another review.

### Explain the code

`organization-documents.tsx` and `platform-admin.tsx` provide the forms. `OrganizationEvidenceController.java` and `OrganizationEvidenceService.java` enforce ownership and track documents. `PlatformService.verify` saves status, history, audit and notifications together. PDFs live in private MinIO storage through `PrivateBusinessFiles.java` and the Python worker.

> Say: "Verification here means a recorded administrator review of submitted evidence. FairMatch does not contact a government registry or certify the authenticity of a trade licence. Public users cannot register themselves as administrators."

First-admin setup for a fresh installation is described in `ACCOUNT_SECURITY_SETUP.md`. Do not reveal private configuration or passwords on the projector.

<!-- page -->
# 5. Create, save and share a job

### Click through the workflow

1. Open **Employer > Jobs > Create a job**.
2. Choose an academic department/program, such as **CSE, EEE, ICT, Mechanical Engineering or BBA**. Select a related job position. For a different title, choose the custom-position option and enter it.
3. Enter location, workplace, salary, application deadline and a clear job description. Add specific job-related requirements.
4. Choose **Save as draft**. Open the Draft filter, refresh and reopen the job using **Edit**. Point out that the saved fields remain.
5. Use **Ranking setup** to define the scoring rubric before collecting applications where possible. Page 9 explains it.
6. Finish the job details and no-applicant-fee confirmation. Publish after organization approval.
7. Use the job's share control and **Copy link**. Open that link in the candidate workspace.

### Expected results

- A draft is saved but not publicly listed. A job position identifies an incomplete draft; full publication fields are not required just to save it.
- Publication validates the completed fields and employer verification in Java.
- The share URL contains `?workspace=candidate&job=REF-...`. Candidates following it see that exact job. A missing or unavailable linked job shows an unavailable message rather than unrelated jobs.
- Academic department and job position are different concepts. The department describes the academic background; the position describes the work. Position suggestions depend on the selected department, and custom titles remain possible.

### Code to open

`recruiter-dialogs.tsx` contains the job editor. `frontend/src/lib/job-options.ts` defines department/position suggestions. `api.saveJob` sends only allowed job fields. `JobController.java` resolves the signed-in organization and checks verification for Active jobs; `JobService.java` validates and persists the job.

> Say: "A draft and a published job have different validation requirements. The browser gives immediate feedback, but the backend is authoritative even if someone sends a request directly. The dropdown is a selection aid, not a government-accredited degree validation service."

<!-- page -->
# 6. Candidate CV extraction and profile

### Demonstrate extraction carefully

1. Sign in as the candidate and open **Documents**. Upload a PDF with clear Experience, Education and Skills headings.
2. Open the extracted text and suggested sections. Show a page-linked source highlight so the teacher can compare the suggestion with its origin.
3. Select useful text, copy it into the editable profile fields and correct mistakes. **Confirm** the reviewed fields.
4. Open **Profile** and refresh. Show that the confirmed information remains.
5. If a CV contains scanned pages or broken embedded text, use **Read with OCR**. Inspect the result and warnings rather than assuming every word is correct.
6. Demonstrate **Refresh extraction** if useful. It rereads the existing file; it does not automatically replace an already confirmed profile or submitted application.

### Explain the boundaries

The feature supports private PDF storage, text extraction, local English/Bangla OCR, page sources, heading-based suggestions, candidate confirmation, download and deletion. A PDF is limited to 8 MB and ten pages. Reading order, unusual layouts and OCR may produce mistakes, so manual correction remains part of the workflow.

The original PDF stays in MinIO. Java saves owner-linked metadata and extracted results in MongoDB. The candidate chooses what becomes their reusable profile. A later application is a separate snapshot, so changing the profile does not rewrite an earlier submission.

### Code to open

`candidate-documents.tsx` handles the review interface. `DocumentController.java` checks ownership, sends the private worker request and saves metadata. `document-worker/app.py` handles private file operations; `extract_text.py` reads PDF text and sections; `ocr.py` runs local OCR.

> Say: "We extract information to reduce repeated typing. We show its source and ask the candidate to confirm it. The parser does not verify qualifications, assign hiring scores or send CVs to a cloud AI model."

For a deeper explanation, use `FairMatch_CV_Extraction_Explained.pdf` and `OCR_SETUP_AND_CODE_GUIDE.md` after the main demonstration.

<!-- page -->
# 7. Apply through the exact job link

### Candidate steps

1. Open the employer's copied job link. Sign in or register as a candidate without removing the `job=...` part of the URL.
2. Check the position, organization, requirements and deadline. The linked view should contain only that job. The general candidate workspace may offer the broader jobs list when no job link is supplied.
3. Choose **View and apply**. Review or edit your experience, education, skills, work example, availability and location.
4. Save an unfinished application draft. Close and reopen it to show recovery of saved fields.
5. Complete the consent and evidence-confirmation steps, then submit.
6. Open **My applications**. Show the application reference and initial **New** stage. Reload to demonstrate that the submission is stored.

### Explain what is saved

Java associates the submission with the authenticated candidate, using account name/contact on the server rather than trusting identity fields from the browser. It validates the job, consent and duplicate rules, then saves a snapshot of the submitted evidence. Drafts and final applications are separate records.

The same candidate contact cannot create repeated applications for the same job. Both service checks and a database unique index support duplicate protection. Use a different clearly identified rehearsal account only when you intentionally need a second application; do not retry successful submission to produce duplicates.

### Follow-up actions

**Supporting information** opens the saved conversation with the employer. **Withdraw** changes the candidate-owned application's status and retains its history; demonstrate withdrawal only on a record intended for that purpose. Candidate-visible interviews, notifications and support requests are separate tabs.

### Code to open

`candidate-workspace.tsx` controls linked-job filtering and application forms. `PlatformController.java` handles profile and draft requests. `ApplicationController.ownedSubmit` builds trusted identity fields. `ApplicationService.submitOwned` saves the application, related job count and audit work in a transaction.

> Say: "A submitted application is not just React state or a browser draft. The server owns its identity and stores the submitted snapshot, which is why refresh does not remove it."

<!-- page -->
# 8. Evidence review, messages and pipeline

### Employer demonstration

1. Open **Applications** and find the reference shown in the candidate workspace.
2. Explain that the employer response omits structured name and contact fields. Review skills, experience and the work example.
3. Open **Review evidence**. For each requirement, choose Supported, Partial or Needs evidence, select the submitted source, copy an exact quote where required and record your reason. Save and reopen the review.
4. Use **Supporting information** to request a relevant clarification. Switch to Candidate, reply on that application, then return to Employer to show the saved reply.
5. Open **Hiring pipeline**. Move the application to a suitable stage and enter a job-related reason. Refresh and show that the card stays in that stage.

Each of the five visible pipeline columns scrolls internally as cards grow, rather than expanding with every new application. Other statuses, such as Not selected or Withdrawn, are handled separately from those active columns.

### Three different records

| Record | Meaning | Changes hiring stage? |
| --- | --- | --- |
| Requirement review | Human evidence bands per requirement | No |
| Candidate ranking | Weighted 0-4 assessment and comparison | No |
| Stage change | Explicit recruiter decision with a reason | Yes |

The evidence-band summary is Strong evidence when every requirement is Supported; Consider when some evidence is Supported or Partial; otherwise Needs review. It is not automatically converted into a numerical ranking. Free text may still reveal identity, so blind presentation is not guaranteed anonymization.

### Code to open

`criteria-review.tsx` and `CriteriaReviewController.java` manage requirement assessments. `application-conversation.tsx` handles shared messages. `StageDialog` in `recruiter-dialogs.tsx` calls the stage-save callback; `ApplicationService.changeStage` checks the expected saved stage and records the decision.

> Say: "The system records evidence and a reason. It does not infer that a candidate is unsuitable just because information is missing. A stage move is a separate human action, and stale updates are rejected."

<!-- page -->
# 9. Configure and operate candidate ranking

### Set the rubric first

1. Open **Employer > Candidate ranking**, select the job and choose a hiring stage. Or open **Jobs > Ranking setup**.
2. Select **Configure scoring rubric**. Each job requirement becomes one criterion.
3. Set integer weights totaling exactly **100%**. Edit all five rating descriptions so they describe concrete evidence for that job.
4. Mark an essential criterion only when justified by the work, and explain why. Essential criteria rated below 3 or not yet assessed receive a visible clarification flag; they do not trigger automatic rejection.
5. Record the rubric reason, confirm consistent use and save. Prefer doing this while the job is still a draft, before reviewing applicants.

### Assess and explain

1. Open **Assess candidate** in the Assessment queue.
2. Read the criterion's rating definitions. Select **0-4** only after reviewing it. Leave missing or unclear evidence **Not assessed**.
3. For each positive rating, select a source, copy an exact passage and explain the rating in at least 15 characters. Sources include submitted fields and the latest 20 candidate clarification replies.
4. Confirm and save. Incomplete assessments can be saved; they stay unranked without a total.
5. Open **Why this result?** to show points, quotes, reasons, reviewer, time and versions. **Export this comparison** downloads the selected job/stage comparison as CSV.

### Expected behavior

Only complete, current assessments appear in the numbered ranking. Equal totals share a rank. Comparisons are within one job and hiring stage, never a universal ranking across unrelated roles. A score is a rubric result, not a probability of success.

> Say: "The recruiter evaluates the evidence against a consistent rubric. Java calculates the total and exposes every contribution. We deliberately keep missing evidence separate from a rating of zero."

Code: `candidate-ranking.tsx` and `application/RankingController.java`. The implementation does not automatically import interview evaluations, infer ratings from CV keywords or make hiring decisions.

<!-- page -->
# 10. Explain the ranking calculation

### A worked example

The score is **sum of (rating / 4 x criterion weight)**. The weights total 100, so the maximum is 100 points.

| Criterion example | Weight | Human rating | Points |
| --- | --- | --- | --- |
| Java backend development | 40% | 4/4 | 40.00 |
| Relevant project contribution | 30% | 3/4 | 22.50 |
| Problem solving | 20% | 3/4 | 15.00 |
| Explaining technical decisions | 10% | 2/4 | 5.00 |
| Total | 100% | All assessed | 82.50 |

This is an arithmetic teaching example, not a validated weighting scheme for every job. All assigned ratings still require job-related review and reasons.

### Zero, missing evidence and ties

- **Zero:** the criterion was assessed and the required competency was not demonstrated.
- **Not assessed:** there is not yet a completed assessment. The application has no numerical total or rank; the other criteria are not reweighted to hide the gap.
- **Ties:** scores of 82.50, 82.50 and 77.50 receive ranks 1, 1 and 3. Reference order stabilizes display within a tie without inventing a merit difference.

### Why a saved score may require reassessment

Every rubric save creates a new version and invalidates previous scores for the job. Relevant job edits invalidate the rubric. A stage change or new candidate clarification makes affected old assessments stale. Restoring earlier requirement wording does not silently reactivate old scores. Salary/deadline changes alone do not invalidate competency scoring.

MongoDB retains versioned history. A snapshot hash binds the assessment to the rubric, stage and evidence. Transactions and expected versions reject conflicting saves. The browser sends ratings and evidence, not an authoritative total; Java computes `sum(rating * weight)` as integer score units, then divides by four.

> Teacher answer: "We avoid stale comparisons. If the evidence or assessment rules change, the earlier result remains in history but must be reviewed again before it can appear as a current rank."

<!-- page -->
# 11. Demonstrate the supporting features

| Feature | What to do | What to explain |
| --- | --- | --- |
| Interviews | Schedule for a future time; check Candidate > Interviews. Reschedule or cancel a rehearsal interview. | Schedules and versions persist. Evaluation requires the scheduled time to have passed. Internal evaluation is not automatically a ranking score. |
| Notifications | Open the inbox and mark an update read. Refresh. | Notifications and read state are stored. In-app updates work without an email provider. |
| Reports and audit | Open Reports, export CSV and inspect recent activity. | Counts come from saved records. Audit entries record actions and reasons; they are not claimed to be tamper-proof archives. |
| Fairness | Select a job, inspect checks and save observations. | Checks concern process, such as fee confirmation, criteria and evidence reviews. They do not measure demographic fairness. Changes can make observations stale. |
| Support and appeals | Candidate submits a case; admin records a response and status; candidate reads it. | Saved, version-checked case handling. A response is a human review, not an automatic reversal of a hiring decision. |
| Privacy | Candidate downloads their data; optionally deletes a disposable saved draft. | Export contains candidate-visible records. Internal ratings, credentials and other users' data are excluded. Deleting a draft does not delete submitted applications. |
| Account security | Show password-change and session controls without exposing credentials. | Passwords are hashed; sessions can be revoked. Email delivery/recovery needs a configured real sender. |

### Choose two, rather than rushing all seven

For a normal presentation, show an interview and a report after the main hiring flow. Keep support, privacy and session controls available for teacher questions. Do not demonstrate destructive actions against records you need later.

### Backups are an operational feature

**BACKUP_FAIRMATCH.cmd** makes a verified private backup while coordinating service shutdown/restart. **RESTORE_FAIRMATCH.cmd** extracts into a new recovery folder rather than replacing live data. Backups contain private data and keys, are not encrypted by this tool, and do not include the whole source/dependency installation. Follow `BACKUP_AND_RECOVERY_GUIDE.md`; do not rehearse a restore during a short presentation.

<!-- page -->
# 12. Explain the architecture

@architecture

### Responsibility of each layer

| Layer | Why it is here |
| --- | --- |
| Next.js 16, React 19, TypeScript | Pages, forms, state and typed API use. Tailwind 4 and shared Radix/shadcn components support consistent styling. |
| Java 21, Spring Boot 3.5.16 | REST API, validation, permissions, business rules and calculated results. |
| Spring Modulith 1.4.13 | Organizes the Java application into business modules. This is a modular backend, not a separate deployed service per module. |
| MongoDB replica set | Accounts, jobs, applications, reviews and history. Related writes can use transactions. One local node is not high availability. |
| Python 3.12, FastAPI | Bounded PDF processing and local OCR; it does not own hiring decisions. |
| MinIO | S3-compatible private storage for original PDF bytes, separate from database metadata. |

The browser requests `/api/...` on Next.js. `frontend/next.config.ts` forwards those calls to Spring Boot. This gives the browser one application origin. Java uses Spring Data for MongoDB and an authenticated private request for the document worker.

> Say: "React handles interaction, Java enforces the rules, MongoDB stores structured records, and Python reads documents stored in MinIO. An API response connects the saved backend result back to the interface."

Maven manages Java dependencies/builds; npm manages the frontend. The recommended stack is represented in the implementation, but the presence of a library does not by itself prove every planned product feature is finished.

<!-- page -->
# 13. Frontend code tour in VS Code

Start from `C:\Users\HP\Desktop\fairmatch\frontend`. Use **Ctrl+P** to open a file, then **Ctrl+F** to find the named component or function. Read the live path before explaining old prototype files.

| Open this file | What to point at |
| --- | --- |
| src/app/page.tsx | Home renders FairMatchApp inside Suspense. This is the page entry. |
| src/components/fairmatch/fairmatch-app.tsx | Re-exports FullstackApp as the active app. |
| src/components/fairmatch/fullstack-app.tsx | Workspace selection, tab-session tokens, account loading, employer data and save callbacks. Find saveJob and move. |
| src/components/fairmatch/recruiter-workspace.tsx | Employer views and selected UI state: jobs, applications, ranking, pipeline, interviews and reports. |
| src/components/fairmatch/recruiter-dialogs.tsx | Job fields, draft/publish steps and StageDialog. Forms call provided save functions. |
| src/components/fairmatch/candidate-workspace.tsx | Exact linked-job filtering, profile, drafts, application submission and candidate tabs. Find linkedJob. |
| src/components/fairmatch/candidate-ranking.tsx | CandidateRanking, RubricEditor, RankingReview and RankingRows. Separates rubric setup, entered ratings and explanations. |
| src/lib/api.ts; src/lib/platform-api.ts | HTTP requests, typed responses, authentication headers and backend error messages. |
| src/components/ui/; src/components/fairmatch/shared.tsx | Reusable buttons, dialogs, inputs, labels, panels and common layout. |

### Concepts to explain

**Props** pass data and callbacks into components. **useState** stores interactive UI state. **useEffect** loads or refreshes backend data when dependencies change. **TypeScript** checks expected shapes during development; Java still validates incoming requests at runtime. **async/await** waits for saves before displaying the result.

The file named `demo-data.ts` still supplies shared types and utilities to connected code. A filename does not prove the running workspace uses fake data. Trace the live `FullstackApp` and API calls. Older `candidate-portal.tsx` or `admin-workspace.tsx` files are not the main connected candidate/admin screens.

<!-- page -->
# 14. Backend and worker code tour

Java source root: `C:\Users\HP\Desktop\fairmatch\backend\src\main\java\com\fairmatch`.

| File or package | Responsibility and useful symbol |
| --- | --- |
| FairMatchApplication.java | Spring Boot entry point. |
| BackendConfiguration.java | Security routes, BCrypt, JWT validation, persistent signing key and MongoTransactionManager. |
| job/JobController.java, JobService.java | Job endpoints, verified-publication gate, validation and criteria-change events. |
| application/ApplicationController.java, ApplicationService.java | Owned submissions, blind employer response, stage changes, withdrawal and conversations. Find submitOwned, changeStage and blind. |
| application/CriteriaReviewController.java | Per-requirement evidence bands, source quotes, versions and history. |
| application/RankingController.java | Rubrics, assessments, snapshots, validation, weighted totals, ties and reassessment. Find saveRubric, save and board. |
| interview/InterviewService.java | Schedule, reschedule, evaluation, cancellation and reaction to final application outcomes. |
| platform/PlatformService.java | Accounts, organizations, profiles, drafts, notifications and support. |
| platform/OrganizationEvidenceService.java | Private business evidence, hashes, review snapshots and removal queue. |
| document/DocumentController.java | Candidate document access, upload, extraction, confirmation and download. |
| privacy/CandidatePrivacyController.java | Owner-scoped export and stale-protected draft deletion. |
| audit/AuditService.java; common/ApiErrors.java | Recorded events and consistent API errors. |

### How the classes differ

A **controller** accepts a request and returns a response. A **service** enforces business rules. A **repository** reads/writes records; some features use **MongoTemplate** directly for scoped or conditional operations. A **view/DTO** controls outgoing fields. Not every feature has all four separate files: for example, ranking currently combines endpoints and logic in its controller.

Worker root: `document-worker`. Open `app.py` for FastAPI file routes, `extract_text.py` for PDF/section processing and `ocr.py` for Tesseract. Operational code lives in `operations`; test/rehearsal utilities live in `tools`. These utilities are not the user's main application screens.

<!-- page -->
# 15. Trace a saved action end to end

### Main example: moving an application

1. **UI:** `recruiter-workspace.tsx` opens StageDialog from `recruiter-dialogs.tsx`. The recruiter supplies a new stage and reason.
2. **Callback:** `fullstack-app.tsx`, function `move`, calls `api.moveCandidate` and handles the saved result/error.
3. **HTTP:** `api.ts` sends PATCH `/api/employer/applications/{id}/stage` with `stage`, `expectedStage` and `reason`, plus the authorization header.
4. **Security:** `BackendConfiguration.java` checks the token and EMPLOYER role. `ApplicationController.stage` resolves the organization from the signed-in principal.
5. **Business rule:** `ApplicationService.changeStage` validates ownership and the expected current stage. Its conditional database update rejects a stale browser request.
6. **Persistence:** the transaction saves stage, reason and time with the related audit/notification work. Final outcomes also trigger interview cancellation handling.
7. **Response:** Java returns the blind application view. React updates the matching row/card. Reload later reads the same saved record.

Representative request body, using a rehearsal application:

```json
{
  "stage": "Shortlisted",
  "expectedStage": "New",
  "reason": "Relevant project evidence reviewed against the role."
}
```

### Second example: saving a ranking assessment

`RankingReview` collects ratings, source quotes and reasons. POST `/api/employer/jobs/{jobId}/ranking/applications/{id}` sends the source snapshot and expected review version. Java rejects invalid sources, invented quotes, non-integer ratings and stale versions, then calculates and saves the review/history. GET on the job's ranking endpoint returns ranked and pending rows.

> Say: "The important boundary is the server. The browser requests a change; it cannot choose another company, overwrite a newer decision or dictate an arbitrary saved total. A successful response comes after the backend has accepted the operation."

A network error can leave a save outcome uncertain. Refresh saved records before repeating an action; do not assume a missing success message means nothing was written.

<!-- page -->
# 16. Data model and persistence

### The main relationships

An employer account belongs to an organization. An organization owns jobs. A candidate account owns a profile and drafts. A submitted application links a candidate, job and organization. Interviews, reviews and conversations link to applications. Ranking rubrics belong to jobs; ranking reviews belong to an application and stage.

MongoDB uses document references such as `organizationId`, `jobId` and `ownerId`. The Java application enforces ownership and relationship rules; these are not SQL foreign keys.

| Collection/group | What it retains |
| --- | --- |
| accounts, organizations, profiles | Identity, company and reusable candidate profile records |
| jobs, application_drafts, applications | Published/draft jobs and separate draft/submitted application snapshots |
| application_messages, interviews | Conversations and structured interview records |
| criteria_reviews, criteria_review_history | Current evidence-band assessments and older versions |
| ranking_rubrics, ranking_rubric_history | Job criteria, weights, rating definitions and version history |
| ranking_reviews, ranking_review_history | Entered ratings, quotes, reasons, stage, calculated score and history |
| candidate_documents | File ownership and extraction metadata; original bytes are in MinIO |
| notifications, support_cases, fairness_reviews, audit_events | Updates, cases, process observations and recorded actions |

### Why refresh and restart preserve work

React state is temporary, but a successful save writes the record to MongoDB. Original PDFs are stored in MinIO's data directory. The launcher reuses those same persistent locations. Tab session storage helps preserve the current login during reload; it is not the database.

### Explain transactions and concurrency

A transaction groups related changes so they commit together or roll back together. Expected versions/stages prevent an older form from replacing a newer decision. Ranking additionally serializes relevant writes and compares evidence snapshots. These mechanisms solve different problems: atomicity protects a group of writes; concurrency checks protect against competing edits.

> Say: "We store both the latest useful state and a history of reviewed decisions. History makes changes explainable, but ordinary database history is not a cryptographically tamper-proof ledger."

<!-- page -->
# 17. Security and extraction internals

### Authentication is different from authorization

Authentication establishes who signed in. Authorization establishes what that account can do. Spring Security checks JWT signature, issuer, expiry, role and the saved session. Service queries then scope records to the signed-in organization or candidate. Hiding an admin button would not replace those server checks.

Passwords use **BCrypt hashing**, not reversible password encryption. The JWT is signed, not a place to hide secrets. Local signing keys persist across restarts. Sign-out revokes the server session; password changes/sign-out-all revoke all account sessions. Public registration cannot promote an employer into an administrator.

Profile, CV and privacy responses are owner-scoped. Employer application responses omit structured name/contact; free-text identity redaction remains incomplete. Candidate exports exclude internal reviewer ratings/notes and credentials. Source code and demonstration PDFs must not contain private configuration values.

### Follow the PDF through the worker

1. Browser sends the candidate's PDF to Java as a multipart upload.
2. Java checks the account and upload limits and calls the local worker with a private service key.
3. The worker stores/reads original bytes in MinIO. PDF text reading uses pypdf; bounded page rendering and Tesseract support English/Bangla OCR.
4. Section-heading rules produce editable suggestions and page/source offsets. This is deterministic extraction, not a trained candidate-matching model.
5. Java stores owner-linked text, pages, warnings and extraction version. Confirmation saves the candidate-reviewed profile fields.

Limits include 8 MB, ten pages, up to 6,000 extracted characters per page and a 24,000-character overall budget. A disposable parser process has a timeout; warnings expose truncated or unreliable reading. Scanned pages, columns and unfamiliar headings may still require manual entry.

### External delivery status

Email challenges, revocable sessions and an SMTP outbox are implemented. Actual email delivery still requires sender configuration and inbox verification. Payments are unavailable without merchant integration. Do not show a test or mock as evidence of real delivered email or payment processing.

<!-- page -->
# 18. Tests and presentation troubleshooting

### Evidence you can show

The latest complete backend run recorded **46 tests, zero failures and zero errors** in `logs/ranking-full-build.log`. The seven ranking tests passed again after final input-validation fixes in `logs/ranking-final-test.log`. Frontend lint, TypeScript and production build passed. These are verification records from September 10, not a fresh test run every time this guide is opened.

`logs/ranking-ui-result.json` records browser creation of a rubric, a 75/100 completed assessment and a saved incomplete assessment. Their quotes, explanations and history survived browser reload and a packaged backend restart. Desktop and narrow mobile dialog controls were checked. Real applicant ratings were not altered for those checks.

Earlier verification also recorded eleven Python extraction/storage tests and eight backup safety tests. These are separate suites, not part of the 46 Java count. Tests use isolated databases and synthetic fixtures. SMTP mocks test software behavior, not actual inbox delivery.

| If this happens | What to do |
| --- | --- |
| START_FAIRMATCH.cmd is not recognized | In PowerShell use `.\START_FAIRMATCH.cmd` from the project root, or double-click it. |
| mvn is not recognized | Use the supplied launcher. For backend development use `.\mvnw.cmd` from backend; do not depend on global Maven. |
| Port 8080 already in use | A backend may already be running. Use the launcher, which recognizes existing FairMatch services; do not launch a second copy or kill an unknown process. |
| Session missing/expired | Sign into the correct workspace again. Saved records remain. |
| Job missing in candidate view | Check the exact link, Active status, deadline and organization verification. Draft jobs are not public. |
| Candidate has no rank | Configure a current rubric, select the correct job/stage and finish all required ratings. A stale score needs reassessment. |
| Save conflict | Reload the current record, inspect it and reapply the intended edit. |
| PDF reading/upload fails | Check PDF size/pages, worker/MinIO availability and disk space. Try OCR or manual correction. Never delete data to free space. |

For development, the root `REBUILD_FAIRMATCH.ps1` coordinates rebuilding and restarting. Use it before rehearsal, not during the teacher's demonstration.

<!-- page -->
# 19. Likely teacher questions

### "What makes this fullstack?"

The interface calls authenticated REST APIs. Java validates requests and performs business operations. MongoDB stores records; MinIO stores PDF bytes. A saved application, stage or ranking survives refresh and process restart.

### "Why Spring Boot and Python together?"

Spring Boot owns the recruitment rules and security. The Python worker isolates document-processing libraries and OCR. It is a focused supporting service, not a second source of hiring decisions.

### "Why MongoDB, and why a replica set?"

The project stores document-shaped records with explicit references. The local replica set enables multi-document transactions. A single node is useful for a laptop installation but does not provide redundancy or high availability.

### "Is this AI candidate ranking?"

No. CV processing extracts text, and a human applies a job-specific rubric. Java calculates weighted scores from those ratings. The project currently has no trained predictive hiring model or automatic CV-to-score pipeline.

### "How do you handle missing evidence and ties?"

An incomplete assessment stays unranked rather than receiving zero. Equal scores share a competition rank. Essential gaps are explicit flags, and every saved score has an explanation. The recruiter makes the hiring decision separately.

### "Can a user edit a request to access another company?"

The backend derives the company from the signed-in account and scopes the record lookup. Role checks and ownership checks work on the server. Negative integration tests cover forbidden cross-company and candidate access.

### "Does blind review guarantee fairness?"

No. Structured identity/contact fields are omitted, but free text may reveal identity. Rubric choices and human judgments can still introduce bias. Process checks and traceable reasons support review; they do not prove demographic fairness or equal outcomes.

### "How do you prove that it was saved?"

Show the same reference and result after reload, then point to the restart verification and test assertions. Explain the relevant MongoDB document and transaction. Do not use a success toast alone as proof of long-term persistence.

<!-- page -->
# 20. Finish honestly and confidently

### What you can claim

The connected local recruitment journey is implemented: role-based access, organization evidence review, drafts and publishing, exact job links, candidate CV/profile workflows, applications, evidence review, explainable human-rated ranking, recorded stages, interviews, notifications, support, reports and selected privacy/backup controls.

### What you should not claim

- That every part of the original project is finished or that a precise completion percentage has been independently certified.
- That email has been delivered without a configured provider and an actual inbox check, or that payments work without merchant integration.
- That an uploaded business PDF is government-verified, that OCR is always correct, or that a source quote proves a qualification is true.
- That ranking is automatic AI selection, a prediction of performance, or a proof of fairness.

### Remaining engineering work

Remaining work includes real SMTP delivery, recruitment email/SMS, payments, team invitations/permissions, retention/account erasure, extraction quality, identity redaction, external verification and production hardening. Online deployment was not required for the laptop assessment.

### Closing script

> "FairMatch connects the recruitment journey with saved records and explainable human decisions. My demonstration showed a job, a candidate application, its evidence review and a persistent ranking or stage result. The code separates interface, authorization, business rules, storage and document processing. I have also identified the remaining integrations and limitations rather than presenting them as completed."

### Last rehearsal checklist

- I can start the app, sign into each role and follow one application reference across views.
- I can explain extraction, confirmation, evidence review, ranking and a separate hiring decision.
- I can trace an API request and explain transactions, DTOs and stale-save checks.
- I have my short demo route and test evidence ready.

### Source index for further reading

Sources: the code named on pages 12-17, `backend/pom.xml`, `frontend/package.json`, September 10 test logs and `FULLSTACK_PROGRESS.md`. Companion guides cover ranking, requirement review, account security, privacy and backup/recovery. Older guides contain historical status and test counts; use the behavior described here for presentation.
