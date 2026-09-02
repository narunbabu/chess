# Community tester and Chess99 promoter programme

## Intake / audit

- Existing Chess99 ambassador/referral flows already provide referral links, QR codes, milestone accounting, and manual payout requests.
- There was no workflow for Ameyem game/app testers to apply, submit a monthly report link, or give an admin a review/payment queue.
- Paid roles remain adult-only through the existing `adult` middleware. This change does not automate transfers and does not pay for ratings or reviews.

## Delivered

- Added `/community-programs` public recruitment page with two roles, Ameyem account CTA, terms, adult gate, and a clear “up to ₹5,000/month” promoter maximum.
- Added tester application and monthly report submission APIs, models, migrations, and an authenticated tester workspace.
- Added admin queue at `/community-programs/admin` to approve/reject tester applications, approve/reject reports, enter a payout amount (up to ₹5,000), and mark approved reports paid.
- Added a server-side 20-seat cap for Chess99 promoter self-enrollment, manual assignment, and application approval; existing referral calculations are preserved.
- Added navigation/footer links and extended the business plan.

## Release notes

- Migration `2026_08_29_100000_create_tester_program_tables.php` is additive and must be reviewed with `php artisan migrate --pretend` before any real migration.
- No production deployment or Play Store submission was performed. The admin queue is manual by design; payment reconciliation remains an owner action.
