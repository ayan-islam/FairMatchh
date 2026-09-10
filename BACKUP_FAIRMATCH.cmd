@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0BACKUP_FAIRMATCH.ps1" %*
pause
