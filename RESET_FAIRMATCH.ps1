param([switch]$ConfirmReset)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot

if (!$ConfirmReset) {
  Write-Host 'This removes every FairMatch account and all dependent application records.' -ForegroundColor Yellow
  Write-Host 'A verified backup will be created first. SMTP settings, source code and installed tools are kept.'
  $answer = Read-Host 'Type RESET to continue'
  if ($answer -cne 'RESET') {
    Write-Host 'Reset cancelled. No data was changed.' -ForegroundColor Cyan
    exit 0
  }
}

Write-Host 'Creating a verified backup before resetting FairMatch...' -ForegroundColor Cyan
& (Join-Path $projectRoot 'BACKUP_FAIRMATCH.ps1')

try { $maintenance = [IO.File]::Open((Join-Path $projectRoot '.fairmatch-maintenance.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw 'FairMatch is being started, rebuilt or backed up. Wait for that operation to finish.' }

$restart = $false
try {
  function Listener([int]$Port) {
    Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  foreach ($service in @(@{Port=8080;Marker='fairmatch-backend'},@{Port=3000;Marker='fairmatch\frontend'})) {
    $listener = Listener $service.Port
    if ($listener) {
      $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
      if ($process.CommandLine -notlike "*$projectRoot*" -or $process.CommandLine -notlike "*$($service.Marker)*") {
        throw "Port $($service.Port) belongs to another application. Reset stopped without closing it."
      }
      Stop-Process -Id $listener.OwningProcess
      Wait-Process -Id $listener.OwningProcess -Timeout 20 -ErrorAction SilentlyContinue
      $restart = $true
    }
  }

  $mongoListener = Listener 27018
  if (!$mongoListener) { throw 'MongoDB is not running. Start FairMatch and try again.' }
  $mongoProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($mongoListener.OwningProcess)"
  if ($mongoProcess.CommandLine -notlike "*$projectRoot*" -or $mongoProcess.CommandLine -notlike '*fairmatch-rs*') {
    throw 'Port 27018 belongs to another MongoDB process. Reset stopped.'
  }
  $mongosh = (Get-Command mongosh.exe -ErrorAction Stop).Source
  $uri = 'mongodb://127.0.0.1:27018/fairmatch?replicaSet=fairmatch-rs'
  $reset = @'
const names = db.getCollectionNames().filter(name => !name.startsWith('system.'));
const session = db.getMongo().startSession();
const txdb = session.getDatabase('fairmatch');
let records = 0;
session.withTransaction(() => {
  for (const name of names) records += txdb.getCollection(name).deleteMany({}).deletedCount;
});
session.endSession();
print(JSON.stringify({ collections: names.length, records }));
'@
  $result = & $mongosh $uri --quiet --eval $reset
  if ($LASTEXITCODE -ne 0) { throw 'MongoDB reset failed. Restore the verified backup if needed.' }

  $verify = @'
const remaining = db.getCollectionNames()
  .filter(name => !name.startsWith('system.'))
  .map(name => ({ name, count: db.getCollection(name).countDocuments({}) }))
  .filter(item => item.count !== 0);
print(JSON.stringify({ accounts: db.accounts.countDocuments({}), remaining }));
'@
  $verification = & $mongosh $uri --quiet --eval $verify
  if ($LASTEXITCODE -ne 0 -or $verification -notmatch '"accounts":0' -or $verification -notmatch '"remaining":\[\]') {
    throw "Reset verification failed: $verification"
  }
  Write-Host "FairMatch database reset completed: $result" -ForegroundColor Green
  Write-Host 'All candidate, employer and administrator accounts were removed.' -ForegroundColor Green
} finally {
  $maintenance.Dispose()
  if ($restart) { & (Join-Path $projectRoot 'START_FAIRMATCH.ps1') -NoBrowser }
}
