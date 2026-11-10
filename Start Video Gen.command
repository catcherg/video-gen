#!/bin/bash
# Double-click this on a Mac to start Video Gen. The first run sets everything up.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

give_up() {
  echo
  echo "$1"
  echo
  read -r -p "Press Enter to close this window."
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  open "https://nodejs.org/"
  give_up "Video Gen needs Node.js. Install the LTS version from the page that just opened, then double-click this file again."
fi

if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)'; then
  open "https://nodejs.org/"
  give_up "Video Gen needs Node.js 22.13 or newer, and this computer has $(node --version). Install the LTS version from the page that just opened, then double-click this file again."
fi

if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "Setting up Video Gen. This takes a few minutes the first time."
  npm install --no-fund --no-audit || give_up "Setup didn't finish. Check your internet connection and try again."
fi

npm start
