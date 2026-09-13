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

## CI Deploy Key (`SERVER_SSH_KEY`)

`.github/workflows/deploy.yml` (appleboy/ssh-action) reads three repo secrets on
`narunbabu/chess`: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`.

**State on 2026-09-13:** every run since 2026-02-06 fails in ~14s with
`ssh: handshake failed: ssh: unable to authenticate, attempted methods [none publickey]`.
The last green run was 2025-12-12; the secrets were last set 2025-10-02. So the
secret parses as a valid key, but the VPS no longer accepts it for
`SERVER_USER`: the matching `.pub` left `authorized_keys`, or that user (likely
root) can no longer log in. Deploys since then have been manual SSH as `narun`.

**Owner fix** (keys and GitHub secrets are owner-only; agents must not do this).
The one-command version is `scripts/rotate-ci-deploy-key.sh`. Run it with
`--dry-run` first to see every step. It reuses an existing key file, appends to
`authorized_keys` only if the line is missing, and warns if sudo needs a
password. Git for Windows may not ship `ssh-copy-id`, which the script avoids.
The manual equivalent, from Git Bash on the laptop:

```bash
# 1. Make a dedicated CI key with no passphrase. Do not reuse narun_vps_ed25519.
ssh-keygen -t ed25519 -N "" -C "gha-deploy@chess99" -f ~/.ssh/chess99_gha_deploy

# 2. Authorise it for narun on the VPS (uses your existing key to log in)
ssh-copy-id -i ~/.ssh/chess99_gha_deploy.pub -o IdentityFile=~/.ssh/narun_vps_ed25519 narun@69.62.73.225

# 3. Prove the new key works on its own
ssh -i ~/.ssh/chess99_gha_deploy -o IdentitiesOnly=yes narun@69.62.73.225 'whoami && sudo -n true && echo sudo-ok'

# 4. Replace all three secrets. The key file is piped in whole, BEGIN/END lines included.
gh secret set SERVER_SSH_KEY -R narunbabu/chess < ~/.ssh/chess99_gha_deploy
gh secret set SERVER_USER    -R narunbabu/chess -b narun
gh secret set SERVER_HOST    -R narunbabu/chess -b 69.62.73.225
```

If step 3 prints `sudo: a password is required`, the deploy's `sudo` steps
(chown, crontab, nginx, service restarts) would be skipped silently. Add a
NOPASSWD rule on the VPS for exactly those commands, using
`sudo visudo -f /etc/sudoers.d/chess99-deploy`:

```text
narun ALL=(root) NOPASSWD: /usr/bin/chown -R www-data\:www-data /opt/Chess-Web/chess-backend/storage, /usr/bin/chown -R www-data\:www-data /opt/Chess-Web/chess-backend/bootstrap/cache, /usr/bin/crontab -u www-data -l, /usr/bin/crontab -u www-data -, /usr/sbin/nginx -t, /usr/bin/systemctl restart php8.3-fpm, /usr/bin/systemctl restart chess-reverb, /usr/bin/systemctl reload nginx
```

Do not add wildcards to this rule. In sudoers, `*` also matches spaces, so a
rule like `cp * /etc/nginx/...` lets whoever holds the CI key copy any file as
root. The workflow's nginx step backs up to a timestamped name (`sudo cp`), so it
can't be allowed exactly. That step runs under `set +e`: without a matching rule
it prints a warning and moves on, and nginx config changes stay a manual step.

**Verify without deploying.** The `check_only` input only exists after the
workflow change reaches `master`:

```bash
gh workflow run deploy.yml -R narunbabu/chess --ref master -f check_only=true
gh run watch -R narunbabu/chess $(gh run list -R narunbabu/chess --workflow deploy.yml -L 1 --json databaseId -q '.[0].databaseId')
```

A green run means the login works, `/opt/Chess-Web/.git` and
`/var/www/chess99.com` are writable, and every `sudo` step runs without a
password. If you are done with the old `SERVER_USER` key, remove its line from
that user's `authorized_keys`.

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
