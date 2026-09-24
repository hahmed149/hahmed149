#!/usr/bin/env bash
# Build and publish to the gh-pages branch, which GitHub Pages serves at hahmed.dev.
set -euo pipefail
cd "$(dirname "$0")"
npm run build
tmp=$(mktemp -d)
git worktree add -q "$tmp" gh-pages
trap 'git worktree remove --force "$tmp"' EXIT
find "$tmp" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$tmp/"
touch "$tmp/.nojekyll"
git -C "$tmp" add -A
git -C "$tmp" commit -qm "Deploy $(git rev-parse --short HEAD)" || { echo "Nothing to deploy"; exit 0; }
git -C "$tmp" push -q origin gh-pages
echo "Deployed to https://hahmed.dev"
