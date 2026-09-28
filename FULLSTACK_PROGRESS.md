# FairMatch - implementation status

Updated 28 September 2026. FairMatch's complete local assessment scope is implemented. Online deployment was not requested. Provider-dependent production integrations are listed separately because they require third-party accounts, approved data sources, or policy decisions.

## Implemented local scope

- **Identity and security:** candidate, employer and administrator accounts; BCrypt passwords; revocable JWT sessions; password change and recovery; email verification codes; rate limits; account-session controls.
- **Organizations and teams:** organization profiles, private supporting documents, administrator review decisions, publishing gates, owners, recruiters, one-use invitations, suspension and restoration.
- **Jobs:** draft, edit, publish and close flows; academic departments; department-specific and custom positions; requirements, salary, deadline and no-fee validation; link-scoped candidate access.
- **Candidate applications:** reusable profile, CV upload and confirmation, application drafts, clear required/optional fields, validation messages, consent, immutable submission snapshots, withdrawal removal, status milestones and private exports.
- **CV processing:** private MinIO storage; PDF text extraction; English/Bangla OCR for scanned pages; page-linked evidence; editable compact skills, courses and project highlights; optional local Qwen/Ollama review.
- **Explainable ranking:** job-specific weighted rubrics; automatic term-based comparison of confirmed submitted evidence; matched terms and source excerpts; separate optional human assessments; versioned histories; invalidation after criteria changes.
- **Recruitment workflow:** blind review, evidence conversations, hiring-stage movement with recorded reasons, interviews, notifications and support cases.
- **Administration and fairness:** filtered organization queues, in-browser document review, cancellation history and clearing controls, saved audit activity, no-fee and criteria checks.
- **Privacy:** data export, draft deletion and password-confirmed candidate account erasure. Erasure removes the candidate's documents, applications, drafts, visits, conversations, notifications, support records, profile, sessions and account while preserving only an anonymous compliance receipt.
- **Operations:** Windows start, stop, backup and account-reset launchers; persistent local MongoDB, MinIO and signing keys; restart-safe saved data; documented codebase and demonstration guides.

## Verified acceptance state

- Java backend: **60 tests passed**, with zero failures or errors.
- Python document worker: **12 tests passed**, including extraction, OCR and storage errors.
- Frontend: TypeScript check, ESLint and production build passed.
- Live browser verification covered candidate privacy and permanent account deletion; the deleted session was rejected afterward.
- Backup, restore, persistent-session, stored-PDF and restart flows were verified in earlier project acceptance runs.
- Test fixtures use isolated databases and do not replace the active project database.

## External production boundaries

These items cannot be completed honestly inside the laptop project without services or decisions from their owners:

- **Payments:** requires an SSLCOMMERZ or other merchant account and credentials.
- **SMS:** requires an SMS provider account.
- **Government verification:** requires an approved registry or official verification API.
- **Online access:** requires a deployment host, domain and production secrets; online deployment was not required.
- **Demographic fairness statistics:** requires a lawful dataset, consent basis and an approved fairness policy.

FairMatch does not show simulated success for these integrations. SMTP delivery works when a valid sender configuration is supplied, and all recruitment and team email paths use the saved outbound queue with retry handling.

## Optional future enhancements

These are product extensions rather than missing local assessment features: semantic embedding models for broader skill synonyms, calendar-provider synchronization, organization closure/retention policy, multi-server scaling, larger analytics and CI/CD.
