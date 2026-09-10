param([string]$Destination = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'FairMatchBackups'))
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$python = Join-Path $projectRoot 'document-worker\.venv\Scripts\python.exe'
$backupTool = Join-Path $projectRoot 'operations\backup_store.py'
$snapshot = Join-Path $projectRoot 'logs\backup-store-inventory.json'
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'logs') | Out-Null
try { $maintenance = [IO.File]::Open((Join-Path $projectRoot '.fairmatch-maintenance.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw 'Another FairMatch start/backup/rebuild is running. Wait for it to finish.' }
$restart = $false
try {
  & $python -c 'import pymongo'
  if ($LASTEXITCODE -ne 0) { throw 'Backup dependency missing. Install document-worker/requirements.txt first.' }
  $services = @{}
  # Validate every owner before stopping anything. Never stop another project's processes.
  foreach ($port in @(3000,8080,8090,9000,27018)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$listener) { throw "FairMatch service on port $port is not running. Start FairMatch before taking a backup." }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $line = $process.CommandLine
    $marker = switch ($port) { 3000 {'frontend'} 8080 {'fairmatch-backend'} 8090 {'uvicorn app:app'} 9000 {'minio'} 27018 {'fairmatch-rs'} }
    if ($line -notlike "*$projectRoot*" -or $line -notlike "*$marker*") { throw "Port $port belongs to another process. Backup stopped without closing it." }
    $services[$port] = $process
  }
  $extra = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'java.exe' -and $_.CommandLine -like "*$projectRoot*fairmatch-backend*" -and $_.ProcessId -ne $services[8080].ProcessId
  }
  if ($extra) { throw 'An additional FairMatch backend is running (for example a test API). Close it before a consistent backup.' }
  Write-Host 'Pausing FairMatch and checkpointing MongoDB. Keep this window open.'
  $restart = $true
  foreach ($port in @(3000,8080,8090)) { Stop-Process -Id $services[$port].ProcessId; Wait-Process -Id $services[$port].ProcessId -Timeout 20 -ErrorAction SilentlyContinue }
  & $python $backupTool prepare $snapshot
  if ($LASTEXITCODE -ne 0) { throw 'Database checkpoint failed. No backup was created.' }
  Wait-Process -Id $services[27018].ProcessId -Timeout 20 -ErrorAction SilentlyContinue
  Stop-Process -Id $services[9000].ProcessId
  Wait-Process -Id $services[9000].ProcessId -Timeout 20 -ErrorAction SilentlyContinue
  & $python $backupTool create $Destination $snapshot
  if ($LASTEXITCODE -ne 0) { throw 'Backup failed; any .partial file is incomplete. The app will be restarted.' }
} finally {
  $maintenance.Dispose()
  if ($restart) { & (Join-Path $projectRoot 'START_FAIRMATCH.ps1') -NoBrowser }
}
