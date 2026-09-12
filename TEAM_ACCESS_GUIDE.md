# FairMatch team access

The organization owner can create recruiter invitations, revoke unused invitations, suspend a recruiter and restore access. Each recruiter has their own account, with shared access to the organization's hiring work. Candidate and administrator accounts remain separate.

## Invite and join

1. Sign in as the organization's owner.
2. Open **Settings > Team & access** and enter the teammate's email.
3. Click **Create invitation**. Copy the private code and share it directly with that teammate. It is shown once, expires after 48 hours and works once. It is not automatically emailed.
4. The teammate opens the same FairMatch installation, selects **Employer > Join an organization**, and enters the code, invited email, name, new username and password.
5. The new account joins the existing organization as a Recruiter. The owner remains unchanged.

An invitation currently requires an email without an existing FairMatch account. It does not transfer a candidate account or an employer from another organization. The code is a secret authorization from the owner; entering an email does not establish that the recipient owns that inbox. Email verification is a separate feature.

The localhost address works on the computer running FairMatch. A teammate using a separate clone has a separate installation and database; an invitation from your database will not work in theirs. Shared remote access still requires a configured deployment, which is outside the laptop-only setup.

## Permissions

| Action | Owner | Recruiter |
| --- | --- | --- |
| Manage jobs, applications, evidence assessments, ranking and interviews | Yes | Yes |
| Read the organization profile and team member list | Yes | Yes |
| Edit organization details and access business verification files | Yes | No |
| Create/revoke invitations and suspend/restore recruiters | Yes | No |
| Change or suspend the owner | No | No |
| Use administrator or candidate APIs | No | No |

The UI hides unavailable controls and the Java API enforces the same boundaries. The sidebar identifies the signed-in member, not the first name in the team list.

## Suspend, restore and revoke

Select **Suspend access** next to a recruiter, record a reason and confirm. This revokes their saved sessions and blocks new sign-ins. It retains their account, hiring records and audit history. Restoring access permits a fresh sign-in; it never reactivates revoked tokens.

Revoke an unused invitation if it was shared incorrectly or its code was lost. Then create a replacement. A stale form cannot silently overwrite a newer access or invitation decision.

## Code map

- `backend/src/main/java/com/fairmatch/platform/TeamService.java`: invitation hashes, expiry, acceptance, persistent ownership, access changes and audit records.
- `TeamController.java`: authenticated team endpoints and public invitation acceptance. Failed acceptance attempts count toward request limits even when the account-creation transaction rolls back.
- `PlatformService.java`: stable owner assignment, member list, suspended-account checks and owner-only profile editing.
- `AccountSecurityService.java`: JWT session validation checks active membership; suspension revokes stored sessions.
- `OrganizationEvidenceController.java`: owner-only employer access to business files; administrator review remains role-controlled.
- `frontend/src/components/fairmatch/team-access.tsx`: owner controls and invitation acceptance form.
- `fullstack-app.tsx` and `recruiter-workspace.tsx`: login entry, correct member identity and owner-only settings controls.

Collections: `organization_owners`, `team_invitations`, `team_access`, existing `accounts`, `account_sessions`, `notifications` and `audit_events`. Invitation codes are random 256-bit secrets; only SHA-256 hashes are stored. Account creation, invitation consumption and session creation commit together. Team mutations serialize on the organization to protect concurrent operations.

The existing owner's assignment is migrated once from the original employer account when needed. New organizations explicitly save their owner at registration. Joining never grants ownership.

## Verification

`TeamAccessTest.java` uses an isolated database and synthetic accounts. It tests scoped joining, hash-only storage, owner restrictions, invalid/expired/revoked/reused codes, duplicate invitations, suspension and session revocation, concurrency, stable ownership and failed-attempt rate limiting. The complete project regression and browser checks are recorded in the local `logs` folder after validation.
