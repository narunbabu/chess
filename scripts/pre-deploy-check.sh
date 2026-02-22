#!/usr/bin/env bash
#
# Chess-Web Pre-Deploy Quality Gates
# Run this BEFORE deploying to VPS. All gates must pass.
#
# Usage:
#   ./scripts/pre-deploy-check.sh           # Run all gates
#   ./scripts/pre-deploy-check.sh --skip-e2e  # Skip Playwright (faster)
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$REPO_ROOT/chess-frontend"
BACKEND="$REPO_ROOT/chess-backend"
SKIP_E2E=false
FAILED=0
TOTAL=0

for arg in "$@"; do
  case "$arg" in
    --skip-e2e) SKIP_E2E=true ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────

gate_pass() { echo "  [$((++TOTAL))] $1: PASS"; }
gate_fail() { echo "  [$((++TOTAL))] $1: FAIL"; FAILED=$((FAILED + 1)); }

separator() {
  echo ""
  echo "── $1 ──"
}

# ── Gate 1: Frontend Build ───────────────────────────────────────

separator "Gate 1: Frontend Build"
if (cd "$FRONTEND" && pnpm build > /dev/null 2>&1); then
  gate_pass "pnpm build"
else
  gate_fail "pnpm build"
  echo "         Run: cd chess-frontend && pnpm build"
fi

# ── Gate 2: ESLint ───────────────────────────────────────────────

separator "Gate 2: ESLint"
if (cd "$FRONTEND" && npx eslint src/ --max-warnings=0 > /dev/null 2>&1); then
  gate_pass "eslint src/"
else
  # Retry showing count so the dev knows the scale
  LINT_OUT=$(cd "$FRONTEND" && npx eslint src/ 2>&1 || true)
  ERR_COUNT=$(echo "$LINT_OUT" | grep -cE "error|warning" || echo "?")
  gate_fail "eslint src/ ($ERR_COUNT issues)"
  echo "         Run: cd chess-frontend && npx eslint src/"
fi

# ── Gate 3: PHP Backend Tests ────────────────────────────────────

separator "Gate 3: PHP Backend Tests (PHPUnit)"
if (cd "$BACKEND" && php artisan test --no-interaction > /dev/null 2>&1); then
  gate_pass "php artisan test"
else
  gate_fail "php artisan test"
  echo "         Run: cd chess-backend && php artisan test"
fi

# ── Gate 4: Migration Dry-Run ────────────────────────────────────

separator "Gate 4: Laravel Migration Dry-Run"
MIGRATE_OUT=$(cd "$BACKEND" && php artisan migrate --pretend 2>&1)
MIGRATE_RC=$?
if [ $MIGRATE_RC -eq 0 ]; then
  if echo "$MIGRATE_OUT" | grep -qi "nothing to migrate\|no migrations"; then
    gate_pass "migrate --pretend (nothing pending)"
  else
    gate_pass "migrate --pretend (pending migrations listed below)"
    echo "$MIGRATE_OUT" | sed 's/^/         /'
  fi
else
  gate_fail "migrate --pretend"
  echo "$MIGRATE_OUT" | head -10 | sed 's/^/         /'
fi

# ── Gate 5: E2E (optional) ──────────────────────────────────────

if [ "$SKIP_E2E" = false ]; then
  separator "Gate 5: Playwright E2E"
  if (cd "$FRONTEND" && npx playwright test > /dev/null 2>&1); then
    gate_pass "playwright test"
  else
    gate_fail "playwright test"
    echo "         Run: cd chess-frontend && npx playwright test"
  fi
else
  separator "Gate 5: Playwright E2E (SKIPPED via --skip-e2e)"
fi

# ── Summary ──────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  echo "  ALL $TOTAL GATES PASSED — safe to deploy"
  echo "  Next: follow scripts/deploy-notes.md"
  echo "════════════════════════════════════════"
  exit 0
else
  echo "  $FAILED/$TOTAL GATES FAILED — do NOT deploy"
  echo "  Fix the failures above, then re-run."
  echo "════════════════════════════════════════"
  exit 1
fi
