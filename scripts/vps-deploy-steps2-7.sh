#!/usr/bin/env bash
# vps-deploy-steps2-7.sh - runs deploy-notes steps 2-7 (composer --no-dev,
# migrate --force, cache clears + re-cache, frontend rebuild + rsync, service
# restarts) fail-fast, then the documented post-deploy health checks (both
# URLs 200, chess-reverb/php8.3-fpm/nginx active). Exits 0 only when all pass.
#
# This is a DEPLOY ACTION: agents must not run it. The owner (or a session
# whose rules allow deploys) runs it AFTER scripts/vps-deploy-step1.sh has
# printed "step 1 complete: continue from step 2".
#
# Usage, from the laptop (Git Bash, repo root), after step 1 succeeded:
#   ssh -i ~/.ssh/narun_vps_ed25519 narun@69.62.73.225 'bash -s' < scripts/vps-deploy-steps2-7.sh
#
# Set CHESS99_SKIP_FRONTEND=1 to skip step 6 (the notes mark it "if frontend
# files changed"; the 2026-09-14 push 568e46c..0e18197 changes none).
#
# Differences from pasting the notes' block by hand (all safety, no behavior
# change on success):
# - `set -euo pipefail`: a failed step stops the deploy instead of cascading;
# - `sudo -n`: over 'bash -s' there is no tty, a password prompt would hang;
# - PATH hardening: a non-interactive ssh shell may miss the nvm/corepack
#   paths that make `pnpm` visible in an interactive one, so nvm is sourced
#   and common locations probed, and pnpm is preflight-checked BEFORE step 2
#   (fail fast, before composer touches the vendor tree);
# - the chown matches deploy.yml's PERMISSIONS section (step 1's
#   package:discover and the pulls run as narun; php-fpm needs www-data
#   ownership of storage/ and bootstrap/cache).

set -euo pipefail

REPO_ROOT="${CHESS99_REPO_ROOT:-/opt/Chess-Web}"
BACKEND="$REPO_ROOT/chess-backend"
FRONTEND="$REPO_ROOT/chess-frontend"
UP_URL="${CHESS99_UP_URL:-https://api.chess99.com/up}"
WEB_URL="${CHESS99_WEB_URL:-https://chess99.com/}"
SKIP_FRONTEND="${CHESS99_SKIP_FRONTEND:-0}"

export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"

find_pnpm() {
  command -v pnpm >/dev/null 2>&1 && return 0
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
  command -v pnpm >/dev/null 2>&1 && return 0
  [ -x "$HOME/.local/share/pnpm/pnpm" ] && export PATH="$HOME/.local/share/pnpm:$PATH" && return 0
  return 1
}

for cmd in git composer php curl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "FAIL: $cmd not found on the VPS PATH"; exit 1; }
done
if [ "$SKIP_FRONTEND" != "1" ]; then
  find_pnpm || { echo "FAIL: pnpm not found (non-interactive PATH). Run step 6 by hand in an"; echo "    interactive ssh shell, or re-run this script with CHESS99_SKIP_FRONTEND=1"; exit 1; }
  echo "==> preflight: pnpm at $(command -v pnpm)"
fi

echo "==> step 2: composer install --no-dev (backend at $BACKEND, HEAD $(git -C "$REPO_ROOT" rev-parse --short HEAD))"
cd "$BACKEND"
composer install --no-dev --optimize-autoloader

echo "==> step 3: migrate --force"
php artisan migrate --force

echo "==> step 4: clear caches"
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

echo "==> step 5: re-cache config + routes"
php artisan config:cache
php artisan route:cache

if [ "$SKIP_FRONTEND" != "1" ]; then
  echo "==> step 6: frontend build + rsync to /var/www/chess99.com"
  cd "$FRONTEND"
  pnpm install --frozen-lockfile
  pnpm build
  sudo -n rsync -a --delete build/ /var/www/chess99.com/
else
  echo "==> step 6: skipped (CHESS99_SKIP_FRONTEND=1)"
fi

echo "==> step 7: ownership + service restarts"
sudo -n chown -R www-data:www-data "$BACKEND/storage" "$BACKEND/bootstrap/cache"
sudo -n systemctl restart chess-reverb
sudo -n systemctl reload php8.3-fpm
sudo -n systemctl reload nginx

echo "==> post-deploy checks"
FAILED=0
up_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$UP_URL")"
web_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$WEB_URL")"
echo "    $UP_URL -> HTTP ${up_code:-000}"
echo "    $WEB_URL -> HTTP ${web_code:-000}"
[ "$up_code" = "200" ] || { echo "    NOT 200"; FAILED=1; }
[ "$web_code" = "200" ] || { echo "    NOT 200"; FAILED=1; }
for svc in chess-reverb php8.3-fpm nginx; do
  state="$(systemctl is-active "$svc" 2>/dev/null || true)"
  echo "    $svc: ${state:-unknown}"
  [ "$state" = "active" ] || FAILED=1
done
if [ "$FAILED" != "0" ]; then
  echo "==> DEPLOY INCOMPLETE: a post-deploy check failed. Check services and"
  echo "    /var/log/nginx/chess99-error.log + storage/logs/laravel-\$(date +%F).log"
  exit 1
fi
echo "==> steps 2-7 complete: deploy verified (also see Post-Deploy Health Checks in scripts/deploy-notes.md)"
