# Candidate data export, draft deletion and account erasure

Open **Candidate > Privacy** after signing in. These features use the real Java backend and MongoDB records. They do not add sample recruitment data.

## Download my data

The button requests a JSON file containing this account's profile, saved drafts, submitted applications, shared conversations, candidate-visible interviews, notifications, support cases and CV metadata/extracted text. The file also identifies the account and the export's start/end time. Download original CV PDFs separately from Documents.

The server derives ownership from the validated sign-in token. It never accepts a caller-supplied owner ID. A field allowlist excludes password hashes, tokens, verification codes, internal interview notes/scores and private review fields. Applications made anonymously before account creation are not automatically linked by matching email.

An export is limited to six requests per account per hour. If any included collection exceeds 1,000 records, the request reports that support is needed rather than silently downloading an incomplete file. Collections are read during the stated time interval; this is not a transactionally frozen database snapshot. The response uses `Cache-Control: no-store, private` and requests a JSON attachment download. Keep downloaded files private.

## Delete a saved draft

Privacy lists the candidate's unfinished application drafts. Choose Delete draft, then confirm the particular draft. Java checks both account ownership and the `updatedAt` timestamp that the candidate saw. If another tab saved a newer version, deletion returns a conflict and the candidate must refresh before trying again.

Deletion and its audit entry use one MongoDB transaction. Removing a draft does not remove the reusable profile or a submitted application. The next time that job's application form is opened, it has no stored draft to restore. CV deletion remains in Documents, and application withdrawal remains in My applications.

## Permanently delete a candidate account

The **Delete account and data** panel requires the current password and the exact phrase `DELETE MY ACCOUNT`. The API rate-limits attempts, checks the signed-in candidate and password, deletes private PDF objects through the document worker, then removes account-linked applications, assessments, rankings, interviews, messages, drafts, linked jobs, notifications, support cases, extracted document metadata, email queue entries, verification records and sessions. Job application counts are corrected. A different candidate's records are never selected.

If private document storage is unavailable, deletion stops before account metadata is removed so an inaccessible PDF cannot be silently left behind. After success, the current token no longer authenticates and the browser returns to candidate sign-in. FairMatch retains only an anonymous `CANDIDATE_ACCOUNT_ERASED` receipt without the deleted username, email or account ID.

## Explain the code

- `frontend/src/components/fairmatch/candidate-privacy.tsx`: displays the export button, draft list, loading/errors and deletion confirmation. The browser requests a download only after the API succeeds.
- `backend/src/main/java/com/fairmatch/privacy/CandidatePrivacyController.java`: candidate-only endpoints, authenticated scope, explicit export projections, export limits, stale-draft protection, password-confirmed erasure and anonymous audit recording.
- `ApplicationService.eraseOwnedApplications`: removes each owned application and its conversations, rankings, reviews, interviews, notifications and count contribution.
- `DocumentController.eraseAllForOwner`: removes private MinIO objects before deleting their MongoDB metadata.
- `backend/src/test/java/com/fairmatch/CandidatePrivacyTest.java`: five integration tests for ownership/secrets, role and size limits, stale deletion, rate limits, password confirmation, cross-account isolation and complete record removal.

Endpoints: `GET /api/candidate/privacy/export`, `GET /api/candidate/privacy/drafts`, `DELETE /api/candidate/privacy/drafts/{jobId}` with `{ "expectedUpdatedAt": "<timestamp from the list>" }`, and `DELETE /api/candidate/privacy/account` with the current password and exact confirmation phrase.

The privacy module reads explicit projections of existing collections rather than creating a second copy of recruitment records. Export requests record `CANDIDATE_DATA_EXPORTED`; deletion records `CANDIDATE_DRAFT_DELETED`. These audit details do not include the exported personal data itself.

## Scope boundary

This is a working account-linked privacy workflow, not a legal certification for every jurisdiction. Organization-wide retention schedules and employer/administrator account closure require an approved institutional policy because those records include other users' recruitment decisions and audit obligations. Candidates can submit a Privacy support case for questions that fall outside self-service erasure.
