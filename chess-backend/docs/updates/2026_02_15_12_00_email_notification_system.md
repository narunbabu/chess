# Email Notification System

**Date**: 2026-02-15 12:00:00
**Scope**: Email notifications for user re-engagement and communication
**Impact**: Adds CAN-SPAM compliant email system with preference management, batch commands, and 3 email types
**Commit**: `8919526`

## Summary

Implemented a complete email notification system for Chess99 covering re-engagement emails, weekly stat digests, and tournament announcements. The system includes signed-URL unsubscribe/preference flows (CAN-SPAM compliant), per-type opt-in/out, a 3-day marketing email throttle, and scheduled Artisan commands with dry-run support.

## Architecture

### Email Flow
```
Artisan Command (scheduled)
  → Query eligible users (master toggle + per-type pref + throttle)
  → Dispatch Mailable to `emails` queue
  → Mailable renders Blade template (extends base layout)
  → Footer includes signed unsubscribe + preferences URLs
```

### Preference System
- **Master toggle**: `email_notifications_enabled` (boolean, default true)
- **Per-type prefs**: `email_preferences` (JSON, e.g. `{"play_reminder":true,"weekly_digest":false}`)
- **Global unsubscribe**: `email_unsubscribed_at` (timestamp, set on unsubscribe)
- **Throttle**: `last_email_sent_at` (max 1 marketing email per 3 days)

### Access Patterns
- **Signed web routes** (no auth): Unsubscribe link in email footer → one-click unsubscribe
- **Signed web routes** (no auth): Preference center with checkboxes
- **API routes** (Sanctum auth): `GET/PUT /api/v1/email/preferences` for mobile apps

## Files Created (14)

### Migration
| File | Purpose |
|------|---------|
| `database/migrations/2026_02_15_100000_add_email_preferences_to_users_table.php` | Adds 4 columns to `users` table |

### Core Service
| File | Purpose |
|------|---------|
| `app/Services/EmailPreferenceService.php` | `canReceiveEmail()`, `wantsEmailType()`, signed URL generation, throttle enforcement |

### Mailables
| File | Purpose |
|------|---------|
| `app/Mail/PlayReminderMail.php` | Re-engagement email for inactive users |
| `app/Mail/WeeklyDigestMail.php` | Weekly stats digest (games, wins, losses, rating change) |
| `app/Mail/TournamentAnnouncementMail.php` | New tournament announcement with registration CTA |

### Controller
| File | Purpose |
|------|---------|
| `app/Http/Controllers/EmailPreferenceController.php` | Web (signed) + API (Sanctum) endpoints |

### Artisan Commands
| File | Purpose |
|------|---------|
| `app/Console/Commands/SendPlayReminderEmails.php` | `emails:send-play-reminders` — daily re-engagement batch |
| `app/Console/Commands/SendWeeklyDigest.php` | `emails:send-weekly-digest` — weekly stats batch |

### Blade Templates
| File | Purpose |
|------|---------|
| `resources/views/emails/layouts/base.blade.php` | Shared layout: Chess99 branding, inline CSS, responsive, unsubscribe footer |
| `resources/views/emails/play-reminder.blade.php` | "We miss you" template with activity suggestions |
| `resources/views/emails/weekly-digest.blade.php` | Stat cards (games, wins, losses, rating) with contextual messaging |
| `resources/views/emails/tournament-announcement.blade.php` | Tournament details card with registration button |
| `resources/views/emails/preferences.blade.php` | Preference center HTML page with per-type checkboxes |
| `resources/views/emails/unsubscribed.blade.php` | Unsubscribe confirmation page |

## Files Modified (4)

| File | Change |
|------|--------|
| `app/Models/User.php` | Added 4 fields to `$fillable`/`$casts`, added `wantsEmailType()` helper |
| `routes/web.php` | 3 signed routes before catch-all: `GET /email/unsubscribe`, `GET/POST /email/preferences` |
| `routes/api_v1.php` | 2 API routes in auth group: `GET/PUT /api/v1/email/preferences` |
| `bootstrap/app.php` | Scheduled `emails:send-play-reminders` daily@10:00 UTC, `emails:send-weekly-digest` Mon@08:00 UTC |

## Routes Registered

```
GET  /email/unsubscribe          → signed, no auth (CAN-SPAM)
GET  /email/preferences          → signed, no auth
POST /email/preferences          → signed, no auth
GET  /api/v1/email/preferences   → Sanctum auth
PUT  /api/v1/email/preferences   → Sanctum auth
```

## Artisan Commands

### `emails:send-play-reminders`
- **Options**: `--dry-run`, `--inactive-days=7`, `--limit=500`
- **Query**: `email_notifications_enabled=true`, `email IS NOT NULL`, `last_activity_at < 7d ago`, `last_email_sent_at < 3d ago`
- **Schedule**: Daily at 10:00 UTC

### `emails:send-weekly-digest`
- **Options**: `--dry-run`, `--limit=1000`
- **Query**: Users who played 1+ finished games in past 7 days, with digest preference enabled
- **Stats aggregated**: Games played, wins/losses/draws (from `result` column: `1-0`/`0-1`/`1/2-1/2`), estimated rating change
- **Schedule**: Monday at 08:00 UTC

## Dry-Run Verification

```
> php artisan emails:send-play-reminders --dry-run
SendPlayReminderEmails: inactive-days=7, limit=500 [DRY RUN]
Done. Sent: 0, Skipped: 0, Total eligible: 0

> php artisan emails:send-weekly-digest --dry-run
SendWeeklyDigest: limit=1000 [DRY RUN]
  [DRY RUN] Would send to nalamara.arun@gmail.com (ID: 1) — 39 games, 3W/36L, rating -495
  [DRY RUN] Would send to narun.iitb@gmail.com (ID: 2) — 39 games, 36W/3L, rating 495
Done. Sent: 2, Skipped: 1, Total eligible: 3
```

## Schema Note

The `games` table uses:
- `status_id=3` for finished games (not a string `status` column)
- `result` column with values `1-0`, `0-1`, `1/2-1/2` (not `winner_id`)
- `winner_user_id` (not `winner_id`)

The weekly digest `aggregateStats()` method was corrected during implementation to match this schema.

## Risk Assessment

### Mitigated Risks
- **CAN-SPAM compliance**: Signed URLs for one-click unsubscribe, no auth required
- **Email fatigue**: 3-day throttle via `last_email_sent_at`, per-type opt-out
- **Queue safety**: All Mailables use `emails` queue with `ShouldQueue` interface
- **Schema mismatch**: Fixed during dry-run testing — uses correct `result`/`status_id` columns

### Monitoring Required
- Check `emails` queue for failed jobs after first scheduled run
- Monitor `last_email_sent_at` distribution to verify throttle works
- Verify signed URLs expire properly (Laravel default)

## Rollback Plan

1. Run `php artisan migrate:rollback` to remove the 4 columns from `users`
2. Remove scheduled commands from `bootstrap/app.php`
3. Remove routes from `web.php` and `api_v1.php`
4. Delete all 14 new files

**Estimated Rollback Time**: 5 minutes

## Next Steps

- [ ] Configure SMTP/mail driver in production `.env` (`MAIL_MAILER`, `MAIL_HOST`, etc.)
- [ ] Start the queue worker for `emails` queue: `php artisan queue:work --queue=emails`
- [ ] Test with a real email send (remove `--dry-run`)
- [ ] Add email preference toggle to frontend user settings page
- [ ] Add email preference toggle to mobile app settings screens
- [ ] Consider adding a `TournamentAnnouncementMail` Artisan command for ad-hoc sends
