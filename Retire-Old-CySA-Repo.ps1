<#
  Turns the superseded stevenlb94/CySA-Study-Hub into a redirect to the
  EZ Exam CySA hub, so it can't be mistaken for the live copy.
  Usage:  powershell -ExecutionPolicy Bypass -File .\Retire-Old-CySA-Repo.ps1
#>

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\lil man\Desktop\Cursor\CySA-Study-Hub'

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  & git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE." -ForegroundColor Red
    Write-Host 'Nothing was published.' -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Set-Location -LiteralPath $repo
Invoke-Git rev-parse --is-inside-work-tree | Out-Null
$branch = (git rev-parse --abbrev-ref HEAD).Trim()

# Drop the stale copies of the hub data — the redirect page is all that stays.
foreach ($f in @('pbq-data.js', 'questions.json', 'acronyms.json', 'commit-study-hub.ps1')) {
  if (Test-Path $f) { git rm --quiet --ignore-unmatch -- $f | Out-Null }
}

Invoke-Git add -A -- index.html README.md

Write-Host 'Staged changes:' -ForegroundColor Cyan
git status --short
if (-not (git diff --cached --name-only)) {
  Write-Host 'Nothing to commit — already retired.' -ForegroundColor Yellow
  exit 0
}

$msg = @'
Retire this repo: redirect to the EZ Exam CySA hub

The CySA+ CS0-003 hub now lives at ez-exams/ez-exams.github.io under
cysa/, alongside the Security+ and AZ-900 hubs. This repository is kept
for history only.

- index.html now redirects to https://ez-exams.github.io/cysa/
- README points at the maintained source
- Removed the stale question bank so it cannot be copied by mistake
'@

$msgFile = Join-Path ([System.IO.Path]::GetTempPath()) "retire-cysa-$PID.txt"
Set-Content -LiteralPath $msgFile -Value $msg -Encoding UTF8
try   { Invoke-Git commit -F $msgFile }
finally { Remove-Item -LiteralPath $msgFile -ErrorAction SilentlyContinue }

Invoke-Git push origin $branch

Write-Host ''
Write-Host "Retired. stevenlb94.github.io/CySA-Study-Hub/ now redirects." -ForegroundColor Green
Write-Host 'Final step (manual): archive the repo on GitHub —' -ForegroundColor Yellow
Write-Host '  Settings -> General -> Danger Zone -> Archive this repository' -ForegroundColor Yellow
