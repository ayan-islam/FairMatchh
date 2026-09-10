param([string]$BackupPath, [string]$Destination)
$ErrorActionPreference = 'Stop'
if (!$BackupPath) { $BackupPath = Read-Host 'Full path of the FairMatch backup ZIP' }
if (!$Destination) { $Destination = Read-Host 'Full path of a NEW recovery folder (existing folders are never overwritten)' }
& (Join-Path $PSScriptRoot 'document-worker\.venv\Scripts\python.exe') (Join-Path $PSScriptRoot 'operations\backup_store.py') restore $BackupPath $Destination
if ($LASTEXITCODE -ne 0) { throw 'Recovery failed. Your running installation was not changed.' }
Write-Host 'Recovery is extracted and checked. Read BACKUP_AND_RECOVERY_GUIDE.md before activating it.' -ForegroundColor Green
