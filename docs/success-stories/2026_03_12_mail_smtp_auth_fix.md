# Mail Server SMTP Auth Fix — ab@ameyem.com

**Date**: 2026-03-12
**Severity**: High (sending email completely broken)
**Affected**: All Roundcube webmail users on mail.ameyem.com

## Symptoms

1. Sending email from Roundcube (mail.ameyem.com) failed with `SMTP Error(): Authentication failed`
2. After initial fix attempt, error changed to `SMTP Error(): Connection to server failed`
3. Receiving email (IMAP) worked fine throughout

## Root Causes (Two Issues)

### Issue 1: Roundcube SMTP not using STARTTLS

Roundcube config had `smtp_host = "localhost:587"` (plaintext connection).
Postfix requires `smtpd_tls_auth_only = yes`, meaning AUTH commands are only accepted after STARTTLS.
Roundcube never issued STARTTLS, so Postfix never advertised AUTH capabilities.

**Fix**: Changed `smtp_host` to `tls://localhost:587` to enable STARTTLS.

### Issue 2: TLS certificate hostname mismatch

After enabling STARTTLS, PHP's OpenSSL rejected the connection because the Postfix TLS certificate is issued for `mail.sambandhalu.com`, not `localhost`. The STARTTLS handshake succeeded at the SMTP level but PHP refused the cert.

**Fix**: Added `smtp_conn_options` to skip peer verification for the localhost-only connection:

```php
$config["smtp_conn_options"] = [
    "ssl" => [
        "verify_peer" => false,
        "verify_peer_name" => false,
        "allow_self_signed" => true,
    ],
];
```

This is safe since the SMTP connection is loopback (127.0.0.1) — no network interception possible. TLS encryption still applies.

### Bonus: fail2ban was down for 3 weeks

`/etc/fail2ban/jail.local` had a malformed config (bare `ignoreip` without `[DEFAULT]` section), causing fail2ban to crash on Feb 19. IP `45.144.212.227` was brute-forcing SASL auth for `ab@ameyem.com` during this time.

**Fix**: Rewrote `jail.local` with proper INI sections (`[postfix-sasl]`, `[dovecot]`, `[sshd]`). Restarted fail2ban. Blocked attacker IP via iptables + fail2ban.

## Files Modified on VPS

- `/var/www/roundcube/config/config.inc.php` — SMTP host + conn_options
- `/etc/fail2ban/jail.local` — Proper section headers and jail config

## Verification

- `swaks` test email to nalamara.arun@gmail.com: successfully queued
- User confirmed sending works from Roundcube
- fail2ban running with 3 active jails

## Lessons Learned

- When Postfix has `smtpd_tls_auth_only=yes`, any SMTP client (including webmail on localhost) MUST use STARTTLS before AUTH
- Localhost TLS connections still validate certificate hostnames by default — must explicitly disable for loopback connections where the cert is issued for a different hostname
- fail2ban configs require proper INI section headers — a bare directive crashes the service silently
