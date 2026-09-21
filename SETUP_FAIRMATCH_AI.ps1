$ErrorActionPreference = 'Stop'
$root = 'D:\FairMatch\Ollama'
$models = Join-Path $root 'models'
$app = Join-Path $root 'app'
$installer = Join-Path $root 'OllamaSetup.exe'
New-Item -ItemType Directory -Force -Path $root,$models,$app | Out-Null

[Environment]::SetEnvironmentVariable('OLLAMA_MODELS',$models,'User')
[Environment]::SetEnvironmentVariable('OLLAMA_NO_CLOUD','1','User')
[Environment]::SetEnvironmentVariable('OLLAMA_CONTEXT_LENGTH','8192','User')
$env:OLLAMA_MODELS = $models
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_CONTEXT_LENGTH = '8192'

$ollama = Join-Path $app 'ollama.exe'
if (!(Test-Path -LiteralPath $ollama)) {
  Write-Host 'Downloading the official Ollama Windows installer to D: ...' -ForegroundColor Cyan
  curl.exe -L --fail --output $installer 'https://ollama.com/download/OllamaSetup.exe'
  if ($LASTEXITCODE -ne 0) { throw 'Ollama download failed. Check the internet connection and run this setup again.' }
  Write-Host 'Installing Ollama on D: ...' -ForegroundColor Cyan
  $installProcess = Start-Process -FilePath $installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',"/DIR=$app") -Wait -PassThru
  if ($installProcess.ExitCode -ne 0 -or !(Test-Path -LiteralPath $ollama)) { throw 'Ollama installation did not finish successfully.' }
}
if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }

$listener = Get-NetTCPConnection -State Listen -LocalPort 11434 -ErrorAction SilentlyContinue | Select-Object -First 1
if (!$listener) {
  Start-Process -FilePath $ollama -ArgumentList @('serve') -WorkingDirectory $app -WindowStyle Hidden | Out-Null
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    try { if ((Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2).StatusCode -eq 200) { break } } catch {}
    Start-Sleep -Milliseconds 500
  }
}
if (!(Get-NetTCPConnection -State Listen -LocalPort 11434 -ErrorAction SilentlyContinue)) { throw 'Ollama could not start. Check D:\FairMatch\Ollama and try again.' }

Write-Host 'Downloading Qwen3 4B Instruct to D: (about 2.5 GB) ...' -ForegroundColor Cyan
& $ollama pull qwen3:4b-instruct
if ($LASTEXITCODE -ne 0) { throw 'Qwen download failed. Run this setup again; Ollama will reuse completed layers.' }

$modelsOnDisk = (Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 10).models.name
if ($modelsOnDisk -notcontains 'qwen3:4b-instruct') { throw 'Qwen was not found after the download.' }
Write-Host 'FairMatch local AI is ready. Ollama and Qwen are stored under D:\FairMatch\Ollama.' -ForegroundColor Green
