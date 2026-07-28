<#
  Commits and pushes the rebuilt CySA Study Hub.
  Usage:  powershell -ExecutionPolicy Bypass -File .\commit-study-hub.ps1
#>

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\lil man\Desktop\Cursor\CySA-Study-Hub'

Set-Location -LiteralPath $repo
git rev-parse --is-inside-work-tree | Out-Null   # fails loudly if not a repo

# One-time identity setup (safe to re-run; only sets what is missing)
if (-not (git config user.name))  { git config user.name  'stevenlb94' }
if (-not (git config user.email)) { git config user.email 'stevenlb94@users.noreply.github.com' }

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Repo:   $repo"
Write-Host "Branch: $branch`n"

git add -- index.html pbq-data.js questions.json

Write-Host 'Staged changes:' -ForegroundColor Cyan
git status --short
$staged = git diff --cached --name-only
if (-not $staged) { Write-Host 'Nothing to commit.' -ForegroundColor Yellow; exit 0 }

$msg = @'
Rebuild question bank and add PBQ practice exam

- Reparse CS0-003 source: 291 -> 485 questions (fixes a regex that
  silently dropped every item using the "Suggested Answer:" label)
- Restore 67 missing exhibit images (packet captures, scan output,
  log tables) that text extraction had dropped
- Tag every question with its official CS0-003 domain (1.0-4.0)
- Add per-answer explanations and an end-of-exam section breakdown
  with a missed-question review
- Fix multi-answer scoring: "choose two" items previously marked a
  single correct pick as fully correct
- Replace corrupt duplicate question #122
- New PBQ Practice Exam tab: 8 performance-based simulations,
  52 sub-answers, partial credit
'@

git commit -m $msg
git push origin $branch

Write-Host "`nPushed to origin/$branch." -ForegroundColor Green
Write-Host 'GitHub Pages usually redeploys within a minute:' -ForegroundColor Green
Write-Host '  https://stevenlb94.github.io/CySA-Study-Hub/'
