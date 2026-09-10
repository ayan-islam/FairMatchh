$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
try { $maintenance = [IO.File]::Open((Join-Path $projectRoot '.fairmatch-maintenance.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw 'Another FairMatch start/backup/rebuild is running. Wait for it to finish.' }
try {
  $services = @{}
  foreach ($port in @(3000,8080,8090,9000,27018)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$listener) { continue }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $marker = switch ($port) { 3000 {'frontend'} 8080 {'fairmatch-backend'} 8090 {'uvicorn app:app'} 9000 {'minio'} 27018 {'fairmatch-rs'} }
    if ($process.CommandLine -notlike "*$projectRoot*" -or $process.CommandLine -notlike "*$marker*") { throw "Port $port belongs to another application. Nothing was stopped." }
    $services[$port] = $process
  }
  $extra = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'java.exe' -and $_.CommandLine -like "*$projectRoot*fairmatch-backend*" -and (!$services.ContainsKey(8080) -or $_.ProcessId -ne $services[8080].ProcessId)
  }
  if ($extra) { throw 'An additional FairMatch backend is running. Close it before stopping shared data services.' }
  foreach ($port in @(3000,8080,8090)) {
    if ($services.ContainsKey($port)) { Stop-Process -Id $services[$port].ProcessId; Wait-Process -Id $services[$port].ProcessId -Timeout 20 -ErrorAction SilentlyContinue }
  }
  if ($services.ContainsKey(27018)) {
    & (Join-Path $projectRoot 'document-worker\.venv\Scripts\python.exe') (Join-Path $projectRoot 'operations\backup_store.py') shutdown
    if ($LASTEXITCODE -ne 0) { throw 'MongoDB did not stop cleanly. Do not move or copy the live data folder.' }
    Wait-Process -Id $services[27018].ProcessId -Timeout 20 -ErrorAction SilentlyContinue
  }
  if ($services.ContainsKey(9000)) { Stop-Process -Id $services[9000].ProcessId; Wait-Process -Id $services[9000].ProcessId -Timeout 20 -ErrorAction SilentlyContinue }
  Write-Host 'FairMatch is stopped. Your saved data is unchanged. Use START_FAIRMATCH.cmd to run it again.' -ForegroundColor Green
} finally { $maintenance.Dispose() }
