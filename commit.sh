#!/bin/sh
git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ] && echo "Nada que commitear." && exit 0
git add .
git commit -m "${1:-Update}"
if [ -n "$2" ]; then
  git tag "$2"
fi
git push
if [ -n "$2" ]; then
  git push origin "$2"
fi