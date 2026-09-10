# FairMatch account security: setup and explanation

Updated 9 September 2026. These changes are installed in the Desktop project.

## What works

- Sign-in creates a signed JWT and a MongoDB session. Every protected request checks the signature, expiry, role and saved session.
- Sign out revokes the current session. Sign out all sessions and changing a password revoke every session for that account.
- Password changes require the current password. Passwords use BCrypt; the API never returns password hashes.
- Verification and recovery use random six-digit codes, ten-minute expiry, a five-attempt limit and single-use consumption. Recovery gives the same public response for known and unknown accounts.
- Login, registration, recovery and verification requests have server-side attempt limits.
- Email uses a durable MongoDB outbox and real SMTP with TLS. The worker retries delivery up to five attempts, and clears message bodies after success, expiry or final failure. Outbox records expire after one day.
- The email challenge and outbox record are committed together. A crash after the SMTP server accepts a message but before its saved acknowledgement may produce a repeated email; a consumed code still cannot be reused.

## What still needs an external account

No SMTP credentials have been supplied. Email verification is therefore disabled, and password recovery reports that delivery is unavailable. There is no local mailbox, hard-coded OTP or simulated successful email. Tests mock SMTP only inside test code; they do not prove actual inbox delivery.

An email provider is the service that sends FairMatch's outgoing email. The owner must obtain a sender account and its SMTP host, port, username, password and authorized From address. Provider-specific setup is outside the application. Do not paste passwords into chat.

1. Copy `integrations.properties.example` to `data/integrations.properties`.
2. Fill in the SMTP settings locally using values from the provider. Keep port 587 and SSL false for STARTTLS unless the provider specifies otherwise; port 465 typically uses SSL true.
3. Keep the private settings file out of source control. The entire data directory is already ignored.
4. Restart the FairMatch backend so it reads the settings. Configuration presence enables the controls; it does not prove credentials or delivery are valid.
5. With a real candidate account, request verification and check the actual inbox/spam folder. Confirm the code, then request a second code and verify that reuse and expiry are rejected.

Email settings are Java properties: a literal backslash must be written as two backslashes. Use the provider's application-specific password or SMTP credential where required. No credentials are supplied in the example file.

Payments remain unavailable because no merchant account has been configured. An SMTP account does not activate payments.

## First administrator and retained data

New installations do not seed sample jobs, employer accounts or administrator passwords. For a fresh empty database, fill the first-admin settings in the private configuration file and enable `fairmatch.bootstrap.admin-enabled` for the first startup. Disable it and remove the initial password afterward. Bootstrap never resets an existing administrator or promotes an existing candidate/employer.

Existing classroom records and accounts are preserved. Use Account security to change their earlier classroom passwords before broader use. Earlier accounts with a `.local` email address cannot receive real Internet email; use an account registered with your real address for email verification. There is currently no self-service email-address change workflow.

HTTP Basic authentication is disabled by default. Existing integration tests explicitly enable their legacy authentication fixture where needed. Public registration accepts only candidate and employer roles.

## Code map for your teacher

| File | Responsibility |
| --- | --- |
| `frontend/src/components/fairmatch/account-security.tsx` | Security dialog, verification code and password-recovery forms |
| `frontend/src/components/fairmatch/fullstack-app.tsx` | Opens the dialog and revokes the server session before clearing browser state |
| `backend/src/main/java/com/fairmatch/platform/AccountSecurityController.java` | HTTP endpoints and request validation |
| `AccountSecurityService.java` in the same folder | Sessions, rate limits, challenge hashing, password updates and transactional code consumption |
| `EmailQueue.java` and `MailDelivery.java` | Persisted delivery queue, retry leases and TLS SMTP |
| `AdminBootstrap.java` | Explicit first-install administrator setup |
| `backend/src/main/java/com/fairmatch/BackendConfiguration.java` | JWT signature, issuer, expiry, saved-session and role validation |

Collections: `account_sessions`, `account_challenges`, `account_verifications`, `security_limits` and `email_outbox`. MongoDB TTL indexes clean expired transient records; request-time expiry checks apply immediately rather than waiting for cleanup.

Explain recovery like this: "The browser asks for a code. Java saves a hashed challenge and queues an email in one database transaction. The worker sends through SMTP. When the user submits the code and new password, Java checks expiry and attempts, consumes the challenge, updates the password and revokes all sessions. The browser never receives the stored password hash or OTP in an API response."

## Verification evidence

The backend has 27 passing tests: 15 recruitment/platform tests, eight account-security tests and four first-admin tests. The interview tests initially ran before MongoDB was started and then passed on rerun. SMTP is mocked in tests, so no external messages were sent.

Logs: `logs/security-backend-check.log`, `logs/security-interview-check.log`, `logs/security-bootstrap-check.log`, `logs/security-frontend-build.log`, `logs/fullstack-restart-result.json`.

## Remaining whole-project work

This update completes the account-security increment, not the whole application. Scanned/Bangla OCR, structured source-linked extraction, organization documents, team permissions/invitations, advanced matching/fairness, privacy automation and payment integration remain on the project checklist. Actual email delivery requires the owner-supplied provider configuration described above.
