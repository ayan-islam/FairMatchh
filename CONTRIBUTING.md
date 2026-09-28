# Contributing to FairMatch

## Repository and access

Clone the public repository:

```powershell
git clone https://github.com/ayan-islam/FairMatchh.git
Set-Location FairMatchh
```

Anyone can clone the repository. To push directly to its member branches, the owner must add each teammate's GitHub username under **Repository Settings > Collaborators**. Until then, a teammate can fork the public repository and open a pull request from the fork.

Read `TEAM_WORK_DIVISION.md` before editing. Each member has a pre-created branch and a set of owned paths.

## First checkout

Replace the example branch with your assigned branch:

```powershell
git fetch origin
git switch --track origin/member-1-frontend-foundation
git status
```

Branches:

```text
member-1-accounts-organizations
member-2-job-management
member-3-candidate-journey
member-4-application-review-ranking
member-5-hiring-oversight
```

If Git reports that the branch already exists locally, use `git switch <branch-name>`.

## Daily workflow

Start from a clean branch and include the newest accepted work:

```powershell
git switch <your-branch>
git fetch origin
git rebase origin/main
git status
```

After editing, review only your intended changes:

```powershell
git status --short
git diff
```

Stage named files instead of using `git add .`:

```powershell
git add path\to\changed-file path\to\another-file
git diff --staged
git commit -m "feat(candidate): add a clear application status message"
git push -u origin <your-branch>
```

Open a pull request from the member branch into `main`. Never force-push `main`.

## Commit message format

Use this format:

```text
type(area): short action
```

Common types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`.

Examples:

```text
feat(candidate): restore saved application draft
fix(employer): keep pipeline columns scrollable
fix(admin): filter pending verification records
feat(ai): validate cited CV quotation
test(security): cover revoked session access
docs(team): explain MinIO ownership
```

## Checks before pushing

Frontend changes:

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Backend changes, with required services running:

```powershell
Set-Location backend
.\mvnw.cmd test
```

Python document-worker changes:

```powershell
Set-Location document-worker
.\.venv\Scripts\python.exe -m unittest discover -v
```

The member-specific test command in `TEAM_WORK_DIVISION.md` is acceptable while developing. Run the broader suite before merging a large change.

## Pull request checklist

- Explain the problem and the resulting behavior.
- List the changed areas and any shared files coordinated with another member.
- Include the exact validation commands and results.
- Add screenshots for visible interface changes.
- Confirm that no credentials, private records, uploaded documents or generated folders are included.
- Keep unrelated edits in separate commits or pull requests.

## Updating a branch after main changes

```powershell
git fetch origin
git rebase origin/main
# Resolve a conflict in the file, then:
git add path\to\resolved-file
git rebase --continue
git push --force-with-lease origin <your-branch>
```

Use `--force-with-lease` only on your own member branch after a rebase. Ask the coordinator before resolving a conflict in a file owned by another member.

## Files that must stay private

The `.gitignore` already excludes these, but every contributor must check before committing:

```text
data/
logs/
backups/
tmp/
.env and other filled secret files
uploaded CV/business PDFs
node_modules/
.next/
.venv/
target/
tools runtime binaries
```

If a secret is accidentally staged, unstage it immediately with `git restore --staged <file>` and tell the repository owner. Do not merely delete it in a later commit.
