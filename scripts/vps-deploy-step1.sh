#!/usr/bin/env bash
# vps-deploy-step1.sh - runs deploy-notes step 1 (VPS bootstrap/cache cleanup +
# git pull) with the recovery fallback, then verifies the documented post-checks:
# `git status --short -- chess-backend/bootstrap/cache` empty and `/up` 200.
# Exits 0 only when both hold; safe to re-run.
#
# This is a DEPLOY ACTION: agents must not run it. The owner (or a session whose
# rules allow deploys) runs it as step 1 of the manual deploy, then continues
# from step 2 (composer install --no-dev) in scripts/deploy-notes.md.
#
# Usage, from the laptop (Git Bash, repo root), AFTER master incl. d48a4b4 is pushed:
#   ssh -i ~/.ssh/narun_vps_ed25519 narun@69.62.73.225 'bash -s' < scripts/vps-deploy-step1.sh
#
# Guards beyond the raw step-1 commands (see the step-1 comment block in
# scripts/deploy-notes.md for the hazards):
# - the checkout's exit code is ignored: once d48a4b4 untracks the manifests it
#   just prints "pathspec did not match" and the pull must still run;
# - if the pull brings nothing (step 1 run before the push), the checkout has
#   restored the dev-provider manifest: the rebuild swaps in the prod manifest so
#   the site keeps working, and the script fails with "cache NOT clean";
# - after a successful pull the manifest is rebuilt once more, so prod never
#   serves the dev-only provider listing in the gap before step 2.

set -uo pipefail

REPO_ROOT="${CHESS99_REPO_ROOT:-/opt/Chess-Web}"
BACKEND="$REPO_ROOT/chess-backend"
UP_URL="${CHESS99_UP_URL:-https://api.chess99.com/up}"

rebuild_manifest() {
  ( cd "$BACKEND" && rm -f bootstrap/cache/packages.php bootstrap/cache/services.php && php artisan package:discover )
}

cd "$REPO_ROOT" || { echo "FAIL: cannot cd to $REPO_ROOT"; exit 1; }

echo "==> step 1: bootstrap/cache cleanup + pull (HEAD was $(git rev-parse --short HEAD))"

git checkout -- chess-backend/bootstrap/cache/packages.php chess-backend/bootstrap/cache/services.php \
  || echo "    checkout: nothing to restore (manifests already untracked) - continuing"

if ! git pull origin master; then
  echo "    pull failed: aborting the merge (if any) and running the recovery fallback"
  if git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
    git merge --abort || true
  fi
  if ! rebuild_manifest; then
    echo "FAIL: recovery failed. If it is permissions, run on the VPS:"
    echo "    cd $BACKEND && sudo rm -f bootstrap/cache/packages.php bootstrap/cache/services.php && sudo -u www-data php artisan package:discover"
    exit 1
  fi
  echo "FAIL: the pull itself failed (manifest recovered, merge aborted). Fix the cause"
  echo "    (check local commits/divergence: git log --oneline master..origin/master),"
  echo "    then re-run step 1 before step 2."
  exit 1
fi

echo "==> HEAD now $(git rev-parse --short HEAD)"

if git ls-files --error-unmatch chess-backend/bootstrap/cache/packages.php chess-backend/bootstrap/cache/services.php >/dev/null 2>&1; then
  echo "    WARNING: the manifests are still git-tracked, so the pull did not bring"
  echo "    the bootstrap/cache untracking (d48a4b4). Run before the push? Rebuilding"
  echo "    the prod manifest now so the site keeps working."
  if ! rebuild_manifest; then
    echo "FAIL: manifest rebuild failed. If it is permissions, run on the VPS:"
    echo "    cd $BACKEND && sudo rm -f bootstrap/cache/packages.php bootstrap/cache/services.php && sudo -u www-data php artisan package:discover"
    exit 1
  fi
else
  rebuild_manifest \
    || echo "    WARNING: manifest rebuild failed; step 2 (composer install --no-dev) regenerates it - do not skip step 2"
fi

echo "==> verify: git status --short -- chess-backend/bootstrap/cache"
cache_status="$(git status --short -- chess-backend/bootstrap/cache)"
if [ -z "$cache_status" ]; then
  echo "    clean"
else
  printf '    %s\n' "$cache_status"
  echo "    cache NOT clean: the deploy has not brought the untracking commit,"
  echo "    or the working tree changed again - resolve before step 2."
fi

up_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$UP_URL")"
echo "==> verify: $UP_URL -> HTTP ${up_code:-000}"
[ "$up_code" = "200" ] || echo "    NOT 200 - check services/logs before step 2"

if [ -z "$cache_status" ] && [ "$up_code" = "200" ]; then
  echo "==> step 1 complete: continue from step 2 (composer install --no-dev)"
  exit 0
fi
exit 1
