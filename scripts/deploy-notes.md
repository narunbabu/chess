# Chess-Web VPS Deploy Procedure

**VPS**: 69.62.73.225 (narun)
**Sites**: chess99.com + api.chess99.com
**Backend**: /opt/Chess-Web/chess-backend
**Frontend**: /opt/Chess-Web/chess-frontend → builds to /var/www/chess99.com

---

## Pre-Deploy (local machine)

Run the quality gates script first. All must pass.

```bash
cd /mnt/c/ArunApps/Chess-Web
./scripts/pre-deploy-check.sh
```

If you need to skip E2E (Playwright requires running servers):

```bash
./scripts/pre-deploy-check.sh --skip-e2e
```

---

## Deploy Steps (VPS via SMA)

SSH in, then run these in order:

```bash
# 1. Pull latest code
cd /opt/Chess-Web
git pull origin master

# 2. Backend dependencies
cd /opt/Chess-Web/chess-backend
composer install --no-dev --optimize-autoloader

# 3. Run migrations
php artisan migrate --force

# 4. Clear ALL caches (must clear before re-caching)
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# 5. Re-cache for performance
php artisan config:cache
php artisan route:cache

# 6. Rebuild frontend (if frontend files changed)
cd /opt/Chess-Web/chess-frontend
pnpm install --frozen-lockfile
pnpm build
sudo rsync -a --delete build/ /var/www/chess99.com/

# 7. Restart services
sudo systemctl restart chess-reverb
sudo systemctl reload php8.3-fpm
sudo systemctl reload nginx
```

---

## Post-Deploy Health Checks

Run immediately after deploy:

```bash
# HTTP checks
curl -s -o /dev/null -w "chess99.com: HTTP %{http_code}\n" https://chess99.com/
curl -s -o /dev/null -w "api.chess99.com: HTTP %{http_code}\n" https://api.chess99.com/

# Services
systemctl is-active chess-reverb
systemctl is-active php8.3-fpm
systemctl is-active nginx

# Error logs (look for new errors)
tail -20 /var/log/nginx/chess99-error.log
tail -20 /opt/Chess-Web/chess-backend/storage/logs/laravel-$(date +%Y-%m-%d).log
```

Expected: both URLs return HTTP 200, all three services active, no new errors in logs.

---

## Rollback Procedure

If something breaks after deploy:

```bash
cd /opt/Chess-Web

# 1. Check what was deployed
git log --oneline -5

# 2. Revert the last commit
git revert HEAD --no-edit

# 3. Re-run backend setup
cd chess-backend
composer install --no-dev --optimize-autoloader
php artisan migrate:rollback --step=1   # Only if a migration ran
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache

# 4. Rebuild frontend if it was changed
cd /opt/Chess-Web/chess-frontend
pnpm build
sudo rsync -a --delete build/ /var/www/chess99.com/

# 5. Restart services
sudo systemctl restart chess-reverb
sudo systemctl reload php8.3-fpm
sudo systemctl reload nginx

# 6. Verify
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://chess99.com/
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.chess99.com/
```

---

## Quick Reference

| Item | Value |
|------|-------|
| VPS SSH | `ssh narun@69.62.73.225` (key: ~/.ssh/narun_vps_ed25519) |
| Backend path | /opt/Chess-Web/chess-backend |
| Frontend path | /opt/Chess-Web/chess-frontend |
| Web root | /var/www/chess99.com |
| PHP version | 8.3-fpm |
| WebSocket | chess-reverb (systemd) |
| DB | MySQL 8, database: chess_production |
| Branch | master |
