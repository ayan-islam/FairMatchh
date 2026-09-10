param([switch]$SkipTests)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
try { $maintenance = [IO.File]::Open((Join-Path $projectRoot '.fairmatch-maintenance.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw 'Another FairMatch start/backup/rebuild is running. Wait for it to finish.' }
try {
foreach ($service in @(@{Port=8080;Marker='fairmatch-backend'},@{Port=3000;Marker='fairmatch\frontend'})) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if ($process.CommandLine -notlike "*$($service.Marker)*") { throw "Port $($service.Port) belongs to another application; rebuild stopped." }
    Stop-Process -Id $listener.OwningProcess
  }
}
try {
  Push-Location (Join-Path $projectRoot 'backend')
  if (!$SkipTests) {
    & .\mvnw.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed. Inspect logs before rebuilding.' }
  }
  & .\mvnw.cmd -DskipTests package
  if ($LASTEXITCODE -ne 0) { throw 'Backend packaging failed.' }
} finally { Pop-Location }
try {
  Push-Location (Join-Path $projectRoot 'frontend')
  & npm.cmd run lint
  if ($LASTEXITCODE -ne 0) { throw 'Frontend lint failed.' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
} finally { Pop-Location }
} finally { $maintenance.Dispose() }
& (Join-Path $projectRoot 'START_FAIRMATCH.ps1') -NoBrowser
