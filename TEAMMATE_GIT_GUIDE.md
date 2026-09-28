# FairMatch teammate Git guide

## Repository

Public repository: <https://github.com/ayan-islam/FairMatchh>

Anyone can view and clone this repository. Direct pushes require collaborator access. The repository owner must open:

1. `https://github.com/ayan-islam/FairMatchh/settings/access`
2. Select **Add people**.
3. Add each teammate's exact GitHub username.
4. Ask each teammate to accept the GitHub invitation.

Never share a GitHub password or access token. Each teammate signs in to Git on their own computer.

## Member branches

| Member | Feature area | Branch |
| --- | --- | --- |
| 1 | Accounts and organizations | `member-1-accounts-organizations` |
| 2 | Job management | `member-2-job-management` |
| 3 | Candidate journey | `member-3-candidate-journey` |
| 4 | Application review and ranking | `member-4-application-review-ranking` |
| 5 | Hiring and oversight | `member-5-hiring-oversight` |

Read `TEAM_WORK_DIVISION.md` for the owned files, shared references and demonstration responsibility of each member.

## Easiest Windows setup

Download `TEAMMATE_SETUP.cmd`, double-click it, and enter your member number. It clones the complete repository to `Desktop\FairMatchh-Member-N`, checks out the correct branch and optionally saves your Git author name and email in that clone.

If Windows SmartScreen appears, inspect the file with Notepad first. It contains ordinary Git commands and does not request a password or token.

## Manual setup

Install Git, then open PowerShell:

```powershell
Set-Location "$HOME\Desktop"
git clone https://github.com/ayan-islam/FairMatchh.git FairMatchh-Member-1
Set-Location FairMatchh-Member-1
git switch --track origin/member-1-accounts-organizations
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
git status
```

Replace the folder and branch with the member's assigned values.

## Before starting work each day

```powershell
git switch <your-member-branch>
git fetch origin
git pull --rebase origin <your-member-branch>
git rebase origin/main
git status
```

If Git reports a conflict, do not delete another member's work. Ask the team coordinator before resolving a shared file.

## Commit and push

The easiest option is to double-click `TEAMMATE_COMMIT_PUSH.cmd` inside the cloned project. It:

1. Refuses to push from `main` or an unknown branch.
2. Shows the changed files.
3. Stages changes and asks for confirmation.
4. Creates the commit using your message.
5. rebases against the remote member branch and `origin/main`.
6. Pushes only the current member branch.

Manual commands:

```powershell
git status --short
git diff
git add path\to\changed-file
git diff --staged
git commit -m "feat(candidate): explain the change clearly"
git fetch origin
git rebase origin/<your-member-branch>
git rebase origin/main
git push -u origin <your-member-branch>
```

Use commit messages in this format:

```text
type(area): short action
```

Examples:

```text
feat(accounts): improve recruiter invitation
fix(jobs): preserve custom job position
feat(candidate): restore an application draft
fix(ranking): explain matched evidence
feat(interviews): record evaluation outcome
```

## Pull request

After pushing, open the repository on GitHub. GitHub normally shows **Compare & pull request**. Create a pull request with:

- **base:** `main`
- **compare:** your member branch

Explain what changed, list the checks performed and add screenshots for visible interface work. Another member should review the pull request before it is merged.

## Common errors

### Permission denied or HTTP 403

The owner has not added the GitHub username as a collaborator, the invitation was not accepted, or Git is signed into another account.

### Remote branch already exists locally

```powershell
git switch <your-member-branch>
```

### Push rejected because the remote changed

```powershell
git fetch origin
git rebase origin/<your-member-branch>
git push origin <your-member-branch>
```

### Accidentally worked on `main`

Do not push. Create or switch to the assigned branch before committing. If work is already committed, ask the coordinator to move the commit safely.

### Secret or private document was staged

```powershell
git restore --staged path\to\file
```

Never commit SMTP passwords, tokens, database data, logs, backups, CVs, business documents, `node_modules`, `.next`, `.venv` or `target`.
