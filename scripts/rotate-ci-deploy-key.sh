#!/usr/bin/env bash
# rotate-ci-deploy-key.sh - OWNER ONLY. Replaces the CI deploy key used by
# .github/workflows/deploy.yml (secrets SERVER_SSH_KEY / SERVER_USER / SERVER_HOST).
#
# Agents must not run this: it creates a private key, edits the VPS
# authorized_keys and sets GitHub secrets. See scripts/deploy-notes.md § CI Deploy Key.
#
# Usage (Git Bash on the laptop, from the repo root):
#   scripts/rotate-ci-deploy-key.sh --dry-run   # print every step, change nothing
#   scripts/rotate-ci-deploy-key.sh             # do it
#
# Safe to re-run: an existing key file is reused and the authorized_keys line is
# only appended if missing.

set -euo pipefail

HOST="${CHESS99_VPS_HOST:-69.62.73.225}"
USER_NAME="${CHESS99_VPS_USER:-narun}"
REPO="${CHESS99_GH_REPO:-narunbabu/chess}"
KEY="${CHESS99_CI_KEY:-$HOME/.ssh/chess99_gha_deploy}"
ADMIN_KEY="${CHESS99_ADMIN_KEY:-$HOME/.ssh/narun_vps_ed25519}"

DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

step() { echo; echo "==> $*"; }
run() {
  if $DRY_RUN; then printf '    [dry-run] %s\n' "$*"; else "$@"; fi
}

step "Settings: ${USER_NAME}@${HOST}, repo ${REPO}, CI key ${KEY}"

step "1/5 Preflight: gh auth and admin SSH login"
run gh auth status
run ssh -i "$ADMIN_KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER_NAME}@${HOST}" true

step "2/5 CI key (ed25519, no passphrase; a CI runner cannot type one)"
if [ -f "$KEY" ]; then
  echo "    reusing existing $KEY"
else
  run ssh-keygen -t ed25519 -N "" -C "gha-deploy@chess99" -f "$KEY"
fi

step "3/5 Authorise ${KEY}.pub for ${USER_NAME} (append only if missing)"
if $DRY_RUN; then
  printf '    [dry-run] ssh %s@%s: append %s.pub to ~/.ssh/authorized_keys unless present\n' "$USER_NAME" "$HOST" "$KEY"
else
  ssh -i "$ADMIN_KEY" -o IdentitiesOnly=yes "${USER_NAME}@${HOST}" \
    'umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; read -r line; grep -qxF "$line" ~/.ssh/authorized_keys || echo "$line" >> ~/.ssh/authorized_keys' \
    < "${KEY}.pub"
fi

step "4/5 Prove the CI key logs in on its own, and check passwordless sudo"
if $DRY_RUN; then
  printf '    [dry-run] ssh -i %s -o IdentitiesOnly=yes %s@%s whoami; sudo -n true\n' "$KEY" "$USER_NAME" "$HOST"
else
  ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER_NAME}@${HOST}" whoami
  if ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes "${USER_NAME}@${HOST}" 'sudo -n true' 2>/dev/null; then
    echo "    sudo-ok"
  else
    echo "    WARNING: sudo needs a password. The deploy's sudo steps will be skipped;"
    echo "    add the exact-match NOPASSWD rule from scripts/deploy-notes.md § CI Deploy Key."
  fi
fi

step "5/5 Replace the three repo secrets"
if $DRY_RUN; then
  printf '    [dry-run] gh secret set SERVER_SSH_KEY -R %s < %s\n' "$REPO" "$KEY"
else
  gh secret set SERVER_SSH_KEY -R "$REPO" < "$KEY"
fi
run gh secret set SERVER_USER -R "$REPO" -b "$USER_NAME"
run gh secret set SERVER_HOST -R "$REPO" -b "$HOST"
run gh secret list -R "$REPO"

step "Done. Verify without deploying (needs the check_only workflow change on master):"
echo "    gh workflow run deploy.yml -R ${REPO} --ref master -f check_only=true"
echo "    gh run watch -R ${REPO} \$(gh run list -R ${REPO} --workflow deploy.yml -L 1 --json databaseId -q '.[0].databaseId')"
