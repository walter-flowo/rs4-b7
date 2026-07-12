#!/bin/zsh
# Publish the site to GitHub Pages (repo: walter-flowo/rs4-b7).
# Called automatically after each pipeline data refresh; safe to run manually.
set -euo pipefail
cd "$(dirname "$0")"
[ -d .git ] || { echo "deploy: site/.git missing — not a repo, skipping"; exit 0; }
git add -A
if git diff --cached --quiet; then
  echo "deploy: no changes to publish"
  exit 0
fi
git commit -q -m "market update $(date +%Y-%m-%d\ %H:%M)"
git push -q origin main
echo "deploy: pushed — live at https://walter-flowo.github.io/rs4-b7/ (~1 min to build)"
