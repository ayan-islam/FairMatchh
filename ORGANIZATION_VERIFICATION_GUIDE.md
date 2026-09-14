# Organization verification and job drafts

This is a human review by a FairMatch platform administrator. Uploading a file does not automatically verify a business, and FairMatch does not contact a government registry or certify a licence's authenticity.

## Your current installation

Open http://127.0.0.1:3000/?workspace=admin or click **Admin** in the top bar. Sign in with the existing local administrator:

- Username: `admin`
- Password: `LocalTestAdmin!2026`

This login was checked on this laptop. It is a retained local project account, not a universal account for other installations. Employer accounts cannot access admin endpoints. New installations use explicit first-admin setup described in ACCOUNT_SECURITY_SETUP.md; public registration cannot create an administrator.

Your organization's current status and saved job drafts are shown in the Employer workspace. Open Jobs > Draft > Edit to continue a draft. Refresh the page after a new build is running; do not discard unsaved form changes you still need.

## Employer steps

1. Sign in as the employer. Open Settings > Organization and save correct company details.
2. Open Settings > Verification documents. Select the supporting document type, describe what it establishes, choose its PDF, and click Upload for verification.
3. Up to five private PDFs are supported, each at most 8 MB and ten pages. Types include trade licence, business registration, tax document or another supporting document. Supply appropriate evidence for the business; these choices are not legal advice about registration requirements.
4. Ask the person acting as platform administrator to review the submission. While Pending, save job drafts; publishing is unavailable.
5. After approval, click Refresh data, open Jobs > Draft > Edit, complete the fields, confirm the no-fee policy and publish.

The organization owner can open Settings > Verification documents and choose **Cancel verification request** while the status is Pending. Confirm the cancellation; the organization and its documents stay saved, but administrators cannot approve that cancelled request. Choose **Request verification again** to return it to Pending. Uploading or removing a supporting document also starts a new Pending review. Only the organization owner can cancel or resubmit; stale version numbers are rejected.

Save as draft does not require business approval, salary, a complete description, requirements or the no-fee confirmation. Choose a job position to identify the draft. The UI keeps the Save as draft control visible, opens the Draft filter after saving, and retains saved records on refresh. Drafts are not visible in the public job listing. Publishing still validates every required field and the organization status on the server.

## Administrator steps

1. Select Admin and sign in using the administrator account.
2. In Organizations, find the organization and select Review organization.
3. Read the current organization details. Select **View in browser** for each supporting PDF; use **Full screen** for a larger view, and **Exit full screen** to return to the review. Download remains optional. Compare the business name and other relevant details with the organization submission. Record any authenticity checks you actually performed; the app does not perform them for you.
4. Check the reviewed checkbox for each viewed or downloaded file, then the overall review confirmation. Enter a meaningful reason of at least 20 characters.
5. Choose Approve organization when the evidence supports your decision, or Request changes and explain what is missing. A change request can be sent when no files have been uploaded.
6. The decision, administrator, date, organization version, document descriptions and SHA-256 fingerprints are saved. The employer receives an in-app notification. Email delivery is not configured.

The Organizations page opens on **Pending review**. Choose **Verified**, **Changes requested** or **Cancelled** to see one status at a time. In Cancelled, **Clear all** asks for confirmation and hides all cancelled requests from the admin list. It does not delete organization accounts, supporting documents or audit events. An owner can resubmit an archived cancelled request; it then reappears under Pending review.

Approval requires at least one current supporting file and acknowledgment of every current file. If the employer changes files or organization details while a review is open, the version check rejects a stale save. Refresh documents and inspect the current evidence again. Adding/removing a file sets the organization back to Pending; renaming it also requires another review. Existing jobs remain stored, but public visibility and new publishing are gated by Verified status.

## Explain the code

- `platform/OrganizationEvidenceController.java` exposes employer upload/list/delete/download and administrator list/download endpoints. Role checks come from Spring Security; company ownership comes from the signed-in account.
- `OrganizationEvidenceService.java` saves metadata, hashes PDF bytes, serializes file changes with the organization version and records review history. PDFs have a separate `business/` prefix in private MinIO storage.
- `common/PrivateBusinessFiles.java` calls the local Python worker with its private service key. Browser requests cannot provide that key or choose arbitrary storage paths.
- `document-worker/app.py` validates bounded PDF uploads and reads/writes private object bytes. No business-document OCR is presented as evidence of authenticity.
- `PlatformService.verify` commits status, review history, audit and notifications together. An incomplete or stale approval rolls back.
- `PlatformService.cancelVerification`, `resubmitVerification` and `clearCancelledOrganizations` enforce owner/admin roles, version checks and recorded audit events. Clearing sets an archive flag rather than deleting organizations.
- Deletion first removes access and queues object removal in MongoDB. A retry worker attempts physical removal every minute. Historical decisions keep descriptions/checksums, not downloadable deleted files.
- `organization-documents.tsx` handles upload, private in-browser PDF viewing, download, cancellation/resubmission and saved history. `pdf-preview.tsx` renders the private PDF with page, zoom and full-screen controls. `platform-admin.tsx` filters review statuses, clears cancelled requests and submits reviewed file IDs with the current organization version.
- `recruiter-dialogs.tsx` keeps the job editor header/footer visible while form contents scroll. It sends Draft separately from Active; `JobController` only requires organization approval for Active jobs.

## Verification evidence and limits

The complete 54-test backend suite passes, including organization/draft tests for evidence requirements, cross-company/role access, stale decisions/removal, invalid uploads, incomplete draft persistence, cancellation, clearing and resubmission. Frontend lint, typecheck and production build pass.

An isolated browser rehearsal saved an incomplete draft, reloaded it, uploaded a synthetic PDF, signed in as a test administrator, reviewed the file, approved the organization, reloaded its history and published the original draft. None of those fixture records were added to the student's organizations.

Automatic government checks, antivirus scanning, document expiry policies and a legal/compliance certification are not provided. The app records a reasoned administrator decision and restricts access; it cannot establish that every uploaded claim is true. Use original trustworthy documents, and make only review statements that reflect the checks performed.
