@echo off
setlocal EnableExtensions EnableDelayedExpansion
title FairMatch commit and push

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or is not available in PATH.
  pause
  exit /b 1
)

pushd "%~dp0"
git rev-parse --is-inside-work-tree >nul 2>nul
if errorlevel 1 (
  echo This file must stay inside a FairMatch Git clone.
  popd
  pause
  exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
set "ALLOWED="
if "!BRANCH!"=="member-1-accounts-organizations" set "ALLOWED=1"
if "!BRANCH!"=="member-2-job-management" set "ALLOWED=1"
if "!BRANCH!"=="member-3-candidate-journey" set "ALLOWED=1"
if "!BRANCH!"=="member-4-application-review-ranking" set "ALLOWED=1"
if "!BRANCH!"=="member-5-hiring-oversight" set "ALLOWED=1"

if not defined ALLOWED (
  echo Push stopped. Current branch "!BRANCH!" is not an assigned member branch.
  echo Switch to your branch and run this file again. Never commit team work directly to main.
  popd
  pause
  exit /b 1
)

echo.
echo Current branch: !BRANCH!
echo Changed files:
git status --short
for /f %%C in ('git status --porcelain ^| find /c /v ""') do set "CHANGE_COUNT=%%C"
if "!CHANGE_COUNT!"=="0" (
  echo Nothing to commit.
  popd
  pause
  exit /b 0
)

echo.
git diff --stat
echo.
set /p "STAGE=Stage all listed changes for review? Type YES: "
if /i not "!STAGE!"=="YES" (
  echo Cancelled. Nothing was staged or pushed.
  popd
  pause
  exit /b 0
)

git add -A
if errorlevel 1 goto :failed
echo.
echo Staged files:
git diff --cached --name-status
echo.
set /p "CONFIRM=Commit exactly these staged changes? Type YES: "
if /i not "!CONFIRM!"=="YES" (
  git restore --staged .
  echo Cancelled. The files were unstaged.
  popd
  pause
  exit /b 0
)

set /p "MESSAGE=Commit message, for example feat(candidate): explain status: "
if not defined MESSAGE (
  git restore --staged .
  echo A commit message is required. The files were unstaged.
  popd
  pause
  exit /b 1
)

git commit -m "!MESSAGE!"
if errorlevel 1 goto :failed

echo.
echo Updating from GitHub before push...
git fetch origin "+refs/heads/main:refs/remotes/origin/main" "+refs/heads/!BRANCH!:refs/remotes/origin/!BRANCH!"
if errorlevel 1 goto :failed
git rebase "origin/!BRANCH!"
if errorlevel 1 goto :conflict
git rebase origin/main
if errorlevel 1 goto :conflict

git push -u origin "!BRANCH!"
if errorlevel 1 goto :pushfailed

echo.
echo Push completed successfully on !BRANCH!.
echo Open https://github.com/ayan-islam/FairMatchh and create a pull request into main.
popd
pause
exit /b 0

:conflict
echo.
echo Git stopped because a rebase conflict needs manual review.
echo Resolve only files you understand, run git add on them, then run git rebase --continue.
echo Ask the coordinator before changing a file owned by another member.
popd
pause
exit /b 1

:pushfailed
echo.
echo Push failed. Confirm that the repository owner added your GitHub username as a collaborator
echo and that you accepted the invitation. Git may also require you to sign in on this computer.
popd
pause
exit /b 1

:failed
echo.
echo The Git command failed. Read the message above. Nothing else will be pushed.
popd
pause
exit /b 1
