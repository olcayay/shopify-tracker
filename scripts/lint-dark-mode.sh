#!/usr/bin/env bash
# Dark mode CSS antipattern scanner
# Runs the vitest-based scanner for missing dark: variants
#
# Usage: ./scripts/lint-dark-mode.sh
# Exit code: 0 if clean, 1 if violations found

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🔍 Scanning for dark mode CSS antipatterns..."
npx vitest run --reporter=verbose apps/dashboard/src/__tests__/lint/dark-mode-antipatterns.test.ts
