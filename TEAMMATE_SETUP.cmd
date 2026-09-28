@echo off
setlocal EnableExtensions
title FairMatch teammate setup

where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed or is not available in PATH.
  echo Install Git for Windows from https://git-scm.com/download/win and run this file again.
  pause
  exit /b 1
)

echo.
echo FairMatch member branches
echo   1 - Accounts and organizations
echo   2 - Job management
echo   3 - Candidate journey
echo   4 - Application review and ranking
echo   5 - Hiring and oversight
echo.
set /p "MEMBER=Enter your member number (1-5): "

if "%MEMBER%"=="1" set "BRANCH=member-1-accounts-organizations"
if "%MEMBER%"=="2" set "BRANCH=member-2-job-management"
if "%MEMBER%"=="3" set "BRANCH=member-3-candidate-journey"
if "%MEMBER%"=="4" set "BRANCH=member-4-application-review-ranking"
if "%MEMBER%"=="5" set "BRANCH=member-5-hiring-oversight"

if not defined BRANCH (
  echo Invalid member number. Nothing was changed.
  pause
  exit /b 1
)

set "REPOSITORY=https://github.com/ayan-islam/FairMatchh.git"
set "TARGET=%USERPROFILE%\Desktop\FairMatchh-Member-%MEMBER%"

if exist "%TARGET%\.git" (
  echo Existing clone found at "%TARGET%".
  git -C "%TARGET%" fetch origin
  if errorlevel 1 goto :failed
  git -C "%TARGET%" switch "%BRANCH%" 2>nul || git -C "%TARGET%" switch --track "origin/%BRANCH%"
  if errorlevel 1 goto :failed
) else (
  if exist "%TARGET%" (
    echo The target folder exists but is not a Git repository:
    echo %TARGET%
    echo Rename or remove that folder, then run this setup again.
    pause
    exit /b 1
  )
  echo Cloning %BRANCH% to "%TARGET%"...
  git clone --branch "%BRANCH%" --single-branch "%REPOSITORY%" "%TARGET%"
  if errorlevel 1 goto :failed
)

echo.
set /p "AUTHOR_NAME=Your name for Git commits (leave blank to keep the current setting): "
if defined AUTHOR_NAME git -C "%TARGET%" config user.name "%AUTHOR_NAME%"
set /p "AUTHOR_EMAIL=Your GitHub email for commits (leave blank to keep the current setting): "
if defined AUTHOR_EMAIL git -C "%TARGET%" config user.email "%AUTHOR_EMAIL%"

echo.
git -C "%TARGET%" status --short --branch
echo.
echo Setup complete.
echo Project: %TARGET%
echo Branch:  %BRANCH%
echo Read TEAMMATE_GIT_GUIDE.md and TEAM_WORK_DIVISION.md before editing.
echo The repository owner must add your GitHub username as a collaborator before you can push.
pause
exit /b 0

:failed
echo.
echo Setup failed. Read the Git error above.
echo Confirm that the internet works and that the repository URL is available.
pause
exit /b 1
