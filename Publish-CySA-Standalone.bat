@echo off
title Publish standalone CySA Study Hub
cd /d "%~dp0"

rem --- Sync the hub's assets from the Study-Hub folder next door ---
set SRC=..\Study-Hub
robocopy "%SRC%\cysa\static"   "static"   /E >nul
robocopy "%SRC%\cysa\data"     "data"     /E >nul
robocopy "%SRC%\cysa\exhibits" "exhibits" /E >nul
robocopy "%SRC%\assets"        "assets"   /E >nul

where git >nul 2>nul
if errorlevel 1 (
    echo Git is required but was not found. Install it from https://git-scm.com
    pause
    exit /b 1
)

git add -A
git commit -m "Standalone CySA hub: full current build, no cross-hub navigation" || echo Nothing new to commit - pushing anyway...
git push origin master

if errorlevel 1 (
    echo.
    echo Push failed. If a login window appeared, sign in as stevenlb94 and run this again.
) else (
    echo.
    echo Done! https://stevenlb94.github.io/CySA-Study-Hub/ updates within a couple of minutes.
)
pause
