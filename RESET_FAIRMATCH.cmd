@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESET_FAIRMATCH.ps1" %*
pause
