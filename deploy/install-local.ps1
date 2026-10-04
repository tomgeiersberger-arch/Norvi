$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> NORVI Local AI Setup (Windows)"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "==> Installiere Bun"
  irm https://bun.sh/install.ps1 | iex
  $env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
}

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Ollama fehlt und winget ist nicht verfügbar. Installiere Ollama von https://ollama.com/download/windows und starte das Setup erneut."
  }
  Write-Host "==> Installiere Ollama"
  winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
  $env:Path = "$env:LOCALAPPDATA\Programs\Ollama;$env:Path"
}

try {
  Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 2 | Out-Null
} catch {
  Write-Host "==> Starte Ollama"
  Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
}

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 2 | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) { throw "Ollama API ist nicht erreichbar." }

& bun deploy/setup-local.ts @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
