$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$configPath = Join-Path $projectRoot 'data\document-worker.properties'
if (!(Test-Path -LiteralPath $configPath)) {
  $values = @('access=fairmatchlocal')
  foreach ($name in @('secret','key')) {
    $bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $generator.Dispose()
    $values += "$name=$([Convert]::ToBase64String($bytes))"
  }
  [IO.File]::WriteAllLines($configPath, $values)
}
$documentConfig = @{}
Get-Content -LiteralPath $configPath | ForEach-Object { $pair = $_.Split('=',2); $documentConfig[$pair[0]] = $pair[1] }
$existingMinio = Get-NetTCPConnection -State Listen -LocalPort 9000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingMinio) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($existingMinio.OwningProcess)"
  if ($owner.CommandLine -notlike "*$projectRoot*minio*") { throw 'Port 9000 belongs to another application.' }
} else {
  $oldAccess = $env:MINIO_ROOT_USER; $oldSecret = $env:MINIO_ROOT_PASSWORD
  try {
    $env:MINIO_ROOT_USER = $documentConfig['access']; $env:MINIO_ROOT_PASSWORD = $documentConfig['secret']
    Start-Process -FilePath (Join-Path $projectRoot 'tools\minio.exe') -ArgumentList @('server',"`"$projectRoot\data\minio`"",'--address','127.0.0.1:9000','--console-address','127.0.0.1:9001') -WindowStyle Hidden -RedirectStandardOutput "$projectRoot\logs\minio.log" -RedirectStandardError "$projectRoot\logs\minio-error.log" | Out-Null
  } finally { $env:MINIO_ROOT_USER = $oldAccess; $env:MINIO_ROOT_PASSWORD = $oldSecret }
}
$existingWorker = Get-NetTCPConnection -State Listen -LocalPort 8090 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existingWorker) {
  $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($existingWorker.OwningProcess)"
  $parentWorker = Get-CimInstance Win32_Process -Filter "ProcessId=$($owner.ParentProcessId)"
  $ownedWorker = ($owner.CommandLine -like '*uvicorn app:app*') -and (($owner.CommandLine -like "*$projectRoot\document-worker*") -or ($parentWorker.CommandLine -like "*$projectRoot\document-worker*"))
  if (!$ownedWorker) { throw 'Port 8090 belongs to another application.' }
} else {
  Start-Process -FilePath "$projectRoot\document-worker\.venv\Scripts\python.exe" -ArgumentList @('-m','uvicorn','app:app','--app-dir',"`"$projectRoot\document-worker`"",'--host','127.0.0.1','--port','8090') -WorkingDirectory "$projectRoot\document-worker" -WindowStyle Hidden -RedirectStandardOutput "$projectRoot\logs\document-worker.log" -RedirectStandardError "$projectRoot\logs\document-worker-error.log" | Out-Null
}
