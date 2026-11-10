@echo off
rem Double-click this on Windows to start Video Gen. The first run sets everything up.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  start https://nodejs.org/
  echo Video Gen needs Node.js. Install the LTS version from the page that just opened, then double-click this file again.
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  start https://nodejs.org/
  echo Video Gen needs Node.js 22.13 or newer. Install the LTS version from the page that just opened, then double-click this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Setting up Video Gen. This takes a few minutes the first time.
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo Setup didn't finish. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

call npm start
pause
