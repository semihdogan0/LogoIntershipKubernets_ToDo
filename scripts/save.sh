#!/usr/bin/env bash
# Kullanım: ./scripts/save.sh "commit mesajı"
# Değişiklikleri stage'ler, commit eder ve push eder. Değişiklik yoksa sessizce çıkar.
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Kullanım: ./scripts/save.sh \"commit mesajı\""
  exit 1
fi

git add -A

if git diff --cached --quiet; then
  echo "Commit edilecek değişiklik yok."
  exit 0
fi

git commit -m "$1"
git push
echo "Push tamamlandı: $1"
