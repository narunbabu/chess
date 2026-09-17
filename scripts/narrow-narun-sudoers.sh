#!/usr/bin/env bash
# narrow-narun-sudoers.sh - OWNER ONLY. Replaces narun's broad
# "(ALL) NOPASSWD: ALL" grant (VPS /etc/sudoers line 54, seen 2026-09-14) with
# the exact-match deploy rule /etc/sudoers.d/chess99-deploy, so whoever holds
# the CI deploy key (SERVER_SSH_KEY) no longer gets instant passwordless root.
#
# Agents must not run this: it edits VPS /etc/sudoers via sudo. See
# scripts/deploy-notes.md "CI Deploy Key" for the background.
#
# PRECONDITION (enforced unless --dry-run): the CI key must already work, i.e.
# GitHub shows a successful "Deploy to Production" run newer than
# CHESS99_SUCCESS_SINCE (default 2026-09-01) - normally the check_only=true
# dispatch after scripts/rotate-ci-deploy-key.sh. Narrowing before that would
# leave CI broken with no proof path.
#
# Usage (Git Bash on the laptop, from the repo root):
#   scripts/narrow-narun-sudoers.sh --dry-run   # read-only: state + the plan
#   scripts/narrow-narun-sudoers.sh             # do it
#
# What it does on the VPS (as narun, via the admin key, all sudo via -n):
#   1. verifies the current state (broad grant active, exact grant lines found);
#   2. validates the rule with `visudo -cf -`, installs it as
#      /etc/sudoers.d/chess99-deploy (0440 root:root, atomic rename, validated
#      again before the rename);
#   3. backs up every file holding a narun `NOPASSWD:ALL` line to
#      $CHESS99_BACKUP_DIR (default /var/backups) and comments exactly those
#      lines (sed line-number anchored), re-validating with `visudo -c`;
#   4. post-checks: `sudo -n -l` shows no NOPASSWD: ALL but the new rule; every
#      deploy sudo command below is allowed by `sudo -n -l <cmd>`; `sudo -n
#      true` now FAILS (proof the narrowing took effect);
#   5. any post-check failure rolls everything back (backups restored, rule
#      removed) and exits nonzero.
# The rule covers deploy.yml's sudo steps AND scripts/vps-deploy-steps2-7.sh's
# exact sudo forms (rsync, the combined two-path chown, `systemctl reload
# php8.3-fpm`). Still outside the rule on purpose: the workflow's timestamped
# `sudo cp` nginx-config backup (cannot be matched exactly; it already runs
# under `set +e` and stays a warned manual step) and everything else - after
# this, `sudo` asks for narun's password (narun stays in the `sudo` group).
# Keep an interactive shell open while it runs. Re-run safe: no-op when already
# narrowed.

set -euo pipefail

HOST="${CHESS99_VPS_HOST:-69.62.73.225}"
USER_NAME="${CHESS99_VPS_USER:-narun}"
REPO="${CHESS99_GH_REPO:-narunbabu/chess}"
ADMIN_KEY="${CHESS99_ADMIN_KEY:-$HOME/.ssh/narun_vps_ed25519}"
CI_KEY="${CHESS99_CI_KEY:-$HOME/.ssh/chess99_gha_deploy}"
SUCCESS_SINCE="${CHESS99_SUCCESS_SINCE:-2026-09-01}"

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

step() { echo; echo "==> $*"; }

step "Settings: ${USER_NAME}@${HOST}, repo ${REPO}, admin key ${ADMIN_KEY}"

step "1/3 Precondition: a successful 'Deploy to Production' run since ${SUCCESS_SINCE} (CI key works)"
gh auth status >/dev/null 2>&1 || { echo "FAIL: gh not authed"; exit 1; }
LATEST_SUCCESS="$(gh run list -R "$REPO" --workflow deploy.yml -L 100 \
  --json conclusion,createdAt \
  --jq '[.[] | select(.conclusion=="success")] | (max_by(.createdAt) // {}).createdAt // "NONE"' 2>/dev/null || echo NONE)"
KEY_PROVEN=true
if [ "$LATEST_SUCCESS" = "NONE" ] || [[ "$LATEST_SUCCESS" < "$SUCCESS_SINCE" ]]; then
  KEY_PROVEN=false
fi
if [ -f "$CI_KEY" ]; then
  echo "    CI key file present: $CI_KEY"
else
  echo "    note: no CI key file at $CI_KEY (fine if it was rotated elsewhere)"
fi
echo "    latest successful deploy.yml run: ${LATEST_SUCCESS}"
if ! $KEY_PROVEN; then
  if $DRY_RUN; then
    echo "    [dry-run] PRECONDITION NOT MET - a real run would stop here. First:"
    echo "        scripts/rotate-ci-deploy-key.sh --dry-run && scripts/rotate-ci-deploy-key.sh"
    echo "        git push origin master        # head has [skip ci], no deploy fires"
    echo "        gh workflow run deploy.yml -R ${REPO} --ref master -f check_only=true"
    echo "        (watch it go green, then re-run this script)"
  else
    echo "FAIL: no successful deploy.yml run since ${SUCCESS_SINCE} (latest: ${LATEST_SUCCESS})."
    echo "      The CI key does not work yet; narrowing now is out of order. Rotate first:"
    echo "        scripts/rotate-ci-deploy-key.sh --dry-run && scripts/rotate-ci-deploy-key.sh"
    echo "        git push origin master"
    echo "        gh workflow run deploy.yml -R ${REPO} --ref master -f check_only=true"
    exit 1
  fi
else
  echo "    precondition met."
fi

step "2/3 Admin SSH login"
ssh -i "$ADMIN_KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER_NAME}@${HOST}" true

step "3/3 Narrow narun's sudoers on ${HOST} (dry-run: ${DRY_RUN})"
# The payload below is plain bash, executed on the VPS via 'bash -s'. The
# ===== marker lines let it be extracted and simulated locally.
ssh -i "$ADMIN_KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER_NAME}@${HOST}" \
  "CHESS99_DRY_RUN=${DRY_RUN} bash -s" <<'CHESS99_REMOTE_PAYLOAD'
# ===== CHESS99 REMOTE PAYLOAD (runs on the VPS as narun) =====
set -uo pipefail

DRY_RUN=false
[ "${CHESS99_DRY_RUN:-false}" = "true" ] && DRY_RUN=true
ETC="${CHESS99_ETC:-/etc}"
BKDIR="${CHESS99_BACKUP_DIR:-/var/backups}"
RULE_FILE="$ETC/sudoers.d/chess99-deploy"
TS="$(date +%Y%m%d-%H%M%S)"
TS_DATE="$(date +%Y-%m-%d)"

RULE='narun ALL=(root) NOPASSWD: /usr/bin/chown -R www-data\:www-data /opt/Chess-Web/chess-backend/storage, /usr/bin/chown -R www-data\:www-data /opt/Chess-Web/chess-backend/bootstrap/cache, /usr/bin/chown -R www-data\:www-data /opt/Chess-Web/chess-backend/storage /opt/Chess-Web/chess-backend/bootstrap/cache, /usr/bin/crontab -u www-data -l, /usr/bin/crontab -u www-data -, /usr/sbin/nginx -t, /usr/bin/systemctl restart php8.3-fpm, /usr/bin/systemctl restart chess-reverb, /usr/bin/systemctl reload php8.3-fpm, /usr/bin/systemctl reload nginx, /usr/bin/rsync -a --delete build/ /var/www/chess99.com/'

CHECK_CMDS=(
  'chown -R www-data:www-data /opt/Chess-Web/chess-backend/storage'
  'chown -R www-data:www-data /opt/Chess-Web/chess-backend/bootstrap/cache'
  'chown -R www-data:www-data /opt/Chess-Web/chess-backend/storage /opt/Chess-Web/chess-backend/bootstrap/cache'
  'crontab -u www-data -l'
  'crontab -u www-data -'
  'nginx -t'
  'systemctl restart php8.3-fpm'
  'systemctl restart chess-reverb'
  'systemctl reload php8.3-fpm'
  'systemctl reload nginx'
  'rsync -a --delete build/ /var/www/chess99.com/'
)

abort() { echo "FAIL: $*" >&2; exit 1; }

echo "==> payload: user=$(id -un) host=$(hostname) dry-run=${DRY_RUN}"

[ "$(id -un)" = "${CHESS99_EXPECT_USER:-narun}" ] || abort "expected user narun (got $(id -un))"

echo "==> 1/4 Current state"
LISTING="$(sudo -n -l 2>/dev/null || true)"
if echo "$LISTING" | grep -q 'NOPASSWD: ALL'; then
  echo "    broad grant active: (ALL) NOPASSWD: ALL"
else
  if sudo -n test -f "$RULE_FILE"; then
    echo "    already narrowed (no NOPASSWD: ALL in sudo -l, rule file present). Nothing to do."
    exit 0
  fi
  abort "sudo -l shows no NOPASSWD: ALL but $RULE_FILE is missing - unexpected state (or passwordless sudo is gone entirely); handle manually"
fi

PAT='^narun[[:space:]].*NOPASSWD:[[:space:]]*ALL[[:space:]]*$'
GRANTS_RAW="$(sudo -n sh -c "grep -HnE '$PAT' '$ETC/sudoers' '$ETC/sudoers.d/'* 2>/dev/null" || true)"
[ -n "$GRANTS_RAW" ] || abort "grant visible to sudo -l but no narun NOPASSWD:ALL line found by grep - handle manually"
echo "    narun grants to remove:"
echo "$GRANTS_RAW" | sed 's/^/        /'
echo "    all NOPASSWD lines on the box (only the narun one(s) are touched):"
sudo -n sh -c "grep -Hn NOPASSWD '$ETC/sudoers' '$ETC/sudoers.d/'* 2>/dev/null" | sed 's/^/        /' || true

echo "==> 2/4 Validate the exact-match rule (visudo -cf -)"
printf '%s\n' "$RULE" | sudo -n visudo -cf - >/dev/null || abort "rule text failed visudo validation"

echo "==> 3/4 Install $RULE_FILE"
if $DRY_RUN; then
  echo "    [dry-run] would: tee rule to $ETC/sudoers.d/.chess99-deploy.new, chmod 0440,"
  echo "    [dry-run]        chown root:root, visudo -cf, then rename to $RULE_FILE"
else
  printf '%s\n' "$RULE" | sudo -n tee "$ETC/sudoers.d/.chess99-deploy.new" >/dev/null
  sudo -n chmod 0440 "$ETC/sudoers.d/.chess99-deploy.new"
  sudo -n chown root:root "$ETC/sudoers.d/.chess99-deploy.new"
  sudo -n visudo -cf "$ETC/sudoers.d/.chess99-deploy.new" >/dev/null \
    || { sudo -n rm -f "$ETC/sudoers.d/.chess99-deploy.new"; abort "installed rule failed visudo"; }
  sudo -n mv "$ETC/sudoers.d/.chess99-deploy.new" "$RULE_FILE"
  echo "    installed (0440 root:root, validated)"
fi

echo "==> 4/4 Back up + comment the broad grant, then verify"
declare -A FILE_LINES=()
mapfile -t GRANT_LINES <<< "$GRANTS_RAW"
for g in "${GRANT_LINES[@]}"; do
  [ -n "$g" ] || continue
  f="${g%%:*}"; rest="${g#*:}"; ln="${rest%%:*}"
  case "$f" in
    "$ETC/sudoers"|"$ETC/sudoers.d"/*) ;;
    *) abort "grant found in unexpected file $f - handle manually" ;;
  esac
  FILE_LINES["$f"]="${FILE_LINES["$f"]:+${FILE_LINES["$f"]} }${ln}"
done

NARROWED=0
rollback() {
  echo "!! post-check failed - rolling back" >&2
  for f in "${!FILE_LINES[@]}"; do
    sudo -n cp -p "$BKDIR/$(basename "$f").narun-narrow.bak-$TS" "$f"
  done
  sudo -n rm -f "$RULE_FILE" "$ETC/sudoers.d/.chess99-deploy.new"
  sudo -n visudo -c >/dev/null 2>&1 \
    || echo "!! visudo -c failing after rollback - restore manually from $BKDIR" >&2
  echo "FAIL: rolled back (backups kept in $BKDIR/*narun-narrow.bak-$TS)" >&2
  exit 1
}

for f in "${!FILE_LINES[@]}"; do
  if $DRY_RUN; then
    echo "    [dry-run] would: cp -p $f $BKDIR/$(basename "$f").narun-narrow.bak-$TS"
    for ln in ${FILE_LINES["$f"]}; do
      echo "    [dry-run] would: sed -i '${ln}s|^|# chess99-narrowed ${TS_DATE} # |' $f"
    done
    continue
  fi
  sudo -n mkdir -p "$BKDIR"
  sudo -n cp -p "$f" "$BKDIR/$(basename "$f").narun-narrow.bak-$TS"
  SED_ARGS=()
  for ln in ${FILE_LINES["$f"]}; do
    SED_ARGS+=(-e "${ln}s|^|# chess99-narrowed ${TS_DATE} # |")
  done
  sudo -n sed -i "${SED_ARGS[@]}" "$f"
  sudo -n visudo -c >/dev/null 2>&1 \
    || { echo "FAIL: visudo -c failed after commenting in $f" >&2
         sudo -n cp -p "$BKDIR/$(basename "$f").narun-narrow.bak-$TS" "$f"
         sudo -n rm -f "$RULE_FILE"
         abort "reverted $f and removed the rule (backup in $BKDIR)" ; }
done
[ "$DRY_RUN" = true ] && { echo "==> dry-run complete: nothing was changed"; exit 0; }
NARROWED=1

FAILED=""
sudo -n visudo -c >/dev/null 2>&1 || FAILED="visudo -c; $FAILED"
LISTING="$(sudo -n -l 2>/dev/null || true)"
echo "$LISTING" | grep -q 'NOPASSWD: ALL' && FAILED="NOPASSWD: ALL still in sudo -l; $FAILED"
echo "$LISTING" | grep -q '(root) NOPASSWD:' || FAILED="rule missing from sudo -l; $FAILED"
for cmd in "${CHECK_CMDS[@]}"; do
  if sudo -n -l $cmd >/dev/null 2>&1; then
    echo "    ok: sudo -n $cmd"
  else
    echo "    DENIED: sudo -n $cmd"
    FAILED="sudo -l denied '$cmd'; $FAILED"
  fi
done
if sudo -n true 2>/dev/null; then
  echo "    WARNING: sudo -n true still succeeds - another passwordless grant remains"
  FAILED="sudo -n true still succeeds; $FAILED"
else
  echo "    ok: sudo -n true now fails (narrowing took effect)"
fi
[ -n "$FAILED" ] && { echo "post-check failures: $FAILED" >&2; [ "$NARROWED" = 1 ] && rollback || exit 1; }

echo "==> narrowed successfully. narun now has passwordless sudo for exactly the"
echo "    deploy commands above; everything else asks for narun's password"
echo "    (narun stays in the 'sudo' group). Backups: $BKDIR/*narun-narrow.bak-$TS"
echo "==> owner follow-up: prove CI still green:"
echo "    gh workflow run deploy.yml -R narunbabu/chess --ref master -f check_only=true"
echo "    gh run watch -R narunbabu/chess \$(gh run list -R narunbabu/chess --workflow deploy.yml -L 1 --json databaseId -q '.[0].databaseId')"
# ===== END CHESS99 REMOTE PAYLOAD =====
CHESS99_REMOTE_PAYLOAD

step "Done (dry-run: ${DRY_RUN})."
