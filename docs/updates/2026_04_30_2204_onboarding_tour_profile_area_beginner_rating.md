# Onboarding Tour, Profile Area, And Beginner Rating

## Summary
- Updated the landing intro and first-login lobby tour to accurately describe login, profile setup, quick match, CCT, Best moves, Companion, Tactical Progression, Training Drills, Interactive Lessons, and Daily Challenges.
- Added profile area selection with state, district, mandal, and village dropdowns backed by new Laravel location endpoints.
- Changed beginner matchmaking fallbacks toward 800-1000 ELO and added beginner synthetic players.
- Added local migrations for beginner default rating, beginner synthetic-player seeding, location tables, and user area fields.

## Verification
- `php artisan migrate --pretend`
- `php artisan migrate`
- `php artisan route:list --path=locations`
- `pnpm build`
- Authenticated smoke test for `/api/locations/states`
