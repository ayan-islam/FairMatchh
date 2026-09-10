# Candidate data export and draft deletion

Open **Candidate > Privacy** after signing in. These features use the real Java backend and MongoDB records. They do not add sample recruitment data.

## Download my data

The button requests a JSON file containing this account's profile, saved drafts, submitted applications, shared conversations, candidate-visible interviews, notifications, support cases and CV metadata/extracted text. The file also identifies the account and the export's start/end time. Download original CV PDFs separately from Documents.

The server derives ownership from the validated sign-in token. It never accepts a caller-supplied owner ID. A field allowlist excludes password hashes, tokens, verification codes, internal interview notes/scores and private review fields. Applications made anonymously before account creation are not automatically linked by matching email.

An export is limited to six requests per account per hour. If any included collection exceeds 1,000 records, the request reports that support is needed rather than silently downloading an incomplete file. Collections are read during the stated time interval; this is not a transactionally frozen database snapshot. The response uses `Cache-Control: no-store, private` and requests a JSON attachment download. Keep downloaded files private.

## Delete a saved draft

Privacy lists the candidate's unfinished application drafts. Choose Delete draft, then confirm the particular draft. Java checks both account ownership and the `updatedAt` timestamp that the candidate saw. If another tab saved a newer version, deletion returns a conflict and the candidate must refresh before trying again.

Deletion and its audit entry use one MongoDB transaction. Removing a draft does not remove the reusable profile or a submitted application. The next time that job's application form is opened, it has no stored draft to restore. CV deletion remains in Documents, and application withdrawal remains in My applications.

## Explain the code

- `frontend/src/components/fairmatch/candidate-privacy.tsx`: displays the export button, draft list, loading/errors and deletion confirmation. The browser requests a download only after the API succeeds.
- `backend/src/main/java/com/fairmatch/privacy/CandidatePrivacyController.java`: candidate-only endpoints, authenticated scope, explicit export projections, export limits, stale-draft protection and audit recording.
- `backend/src/test/java/com/fairmatch/CandidatePrivacyTest.java`: four integration tests for ownership/secrets, role and size limits, stale deletion and preservation, and per-account rate limits.

Endpoints: `GET /api/candidate/privacy/export`, `GET /api/candidate/privacy/drafts`, and `DELETE /api/candidate/privacy/drafts/{jobId}` with `{ "expectedUpdatedAt": "<timestamp from the list>" }`.

The privacy module reads explicit projections of existing collections rather than creating a second copy of recruitment records. Export requests record `CANDIDATE_DATA_EXPORTED`; deletion records `CANDIDATE_DRAFT_DELETED`. These audit details do not include the exported personal data itself.

## What is still pending

This feature is an account-linked data download, not a claim of complete privacy-law compliance. Automatic account erasure, configured retention policies and employer/admin account exports still need implementation. Candidates can already submit a Privacy support case for a human response, but that case does not automatically delete records.
