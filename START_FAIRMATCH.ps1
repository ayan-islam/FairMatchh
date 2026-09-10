param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
try { $maintenance = [IO.File]::Open((Join-Path $projectRoot '.fairmatch-maintenance.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { throw 'FairMatch is being started, rebuilt or backed up. Wait for that operation to finish.' }
try {
$logs = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
function Listening([int]$Port) {
  return Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
}
function Assert-Owner([int]$Port, [string]$Expected) {
  $listener = Listening $Port
  if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if ($process.CommandLine -notlike "*$Expected*") { throw "Port $Port is used by another application. Close that application or change FairMatch's ports." }
    return $true
  }
  return $false
}
function Wait-Url([string]$Url) {
  for ($attempt=0; $attempt -lt 60; $attempt++) {
    try { if ((Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2).StatusCode -eq 200) { return } } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "Could not start $Url. Read the files in $logs."
}
$java = Join-Path $projectRoot 'tools\jdk-21.0.8+9\bin\java.exe'
$mongo = Join-Path $env:LOCALAPPDATA 'Programs\MongoDB\Server\8.0\bin\mongod.exe'
$node = (Get-Command node.exe).Source
foreach ($runtime in @($java,$mongo)) { if (!(Test-Path -LiteralPath $runtime)) { throw "Required runtime missing: $runtime" } }
$dbPath = Join-Path $projectRoot 'data\mongo'
New-Item -ItemType Directory -Force -Path $dbPath | Out-Null
if (!(Assert-Owner 27018 'fairmatch-rs')) {
  Start-Process -FilePath $mongo -ArgumentList @('--bind_ip','127.0.0.1','--port','27018','--replSet','fairmatch-rs','--dbpath',"`"$dbPath`"",'--logpath',"`"$logs\mongo.log`"",'--logappend') -WindowStyle Hidden | Out-Null
}
# The supplied database is already initialized as a single-node replica set.
# Keep data/mongo when moving or restarting this classroom installation.
& (Join-Path $projectRoot 'START_DOCUMENT_SERVICES.ps1')
Wait-Url 'http://127.0.0.1:8090/health'
if (!(Assert-Owner 8080 'fairmatch-backend')) {
  $jar = Join-Path $projectRoot 'backend\target\fairmatch-backend-0.1.0.jar'
  if (!(Test-Path -LiteralPath $jar)) { throw 'Backend JAR is missing. Follow the rebuild instructions in README.md.' }
  Start-Process -FilePath $java -ArgumentList @('-jar',"`"$jar`"") -WorkingDirectory (Join-Path $projectRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput "$logs\backend.log" -RedirectStandardError "$logs\backend-error.log" | Out-Null
}
Wait-Url 'http://127.0.0.1:8080/actuator/health'
if (!(Assert-Owner 3000 'fairmatch\frontend')) {
  $next = Join-Path $projectRoot 'frontend\node_modules\next\dist\bin\next'
  Start-Process -FilePath $node -ArgumentList @("`"$next`"",'start','--hostname','127.0.0.1','--port','3000') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput "$logs\frontend.log" -RedirectStandardError "$logs\frontend-error.log" | Out-Null
}
Wait-Url 'http://127.0.0.1:3000/api/public/jobs'
Write-Host 'FairMatch is ready: http://127.0.0.1:3000/?workspace=employer' -ForegroundColor Green
Write-Host 'Sign in with your account, or register an employer/candidate account in the app.'
if (!$NoBrowser) { Start-Process 'http://127.0.0.1:3000/?workspace=employer' }
} finally { $maintenance.Dispose() }
