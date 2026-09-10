@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESTORE_FAIRMATCH.ps1" %*
pause
