# Chess99 Subscription, School Concession, And Privilege Plan

Date: 2026-05-05

## 1. Why This Needs A Separate Plan

The current app has Free, Silver, and Gold, but the entitlement story is scattered:

- Pricing cards define fallback feature text in `chess-frontend/src/pages/PricingPage.js`.
- Curriculum gates exist in `chess-frontend/src/constants/learningCurriculum.js`.
- Backend subscription hierarchy exists in `chess-backend/app/Enums/SubscriptionTier.php`.
- Free online games are capped at 5/day in `chess-backend/app/Services/GameRoomService.php`.
- Plans are seeded in `chess-backend/database/migrations/2026_02_21_200000_seed_subscription_plans_if_empty.php`.
- Subscription middleware exists, but not every feature uses one entitlement source.

Before school enrollment, Chess99 needs one clear entitlement matrix and one technical source of truth used by web, Android, and backend.

## 2. Recommended Product Rule

Keep personal subscriptions simple:

- Free = start and build habit.
- Silver = serious student practice.
- Gold = competitive improvement and advanced analysis.

Add school privileges separately:

- School privileges should not simply make every student Gold.
- A school student can be Free/Silver/Gold personally, while also having a School Pass that unlocks school-specific benefits.
- This prevents revenue loss and keeps the parent upsell clean.

Use this model:

`Effective access = personal subscription tier + school/event/admin entitlement grants`

## 3. Personal Subscription Matrix

### Free

Positioning:

"Start chess safely. Play, learn the basics, and join school activities."

Recommended access:

- Play vs computer: unlimited.
- Online human games: 5/day.
- Public lobby/matchmaking: limited by 5/day.
- Friend games: included but counts toward 5/day.
- Public tournaments: view and join free/public events, capped if needed.
- School tournaments: allowed if school/event pass grants access.
- Lessons: Newcomer and Beginner tracks.
- Ebooks: first beginner books, CCT survival basics.
- Training drills: Free drills only, 0-1000 range.
- Tactical trainer: beginner stage and limited daily puzzle quota, or full beginner stage with progress.
- Daily challenge: Daily Starter only.
- CCT panel: basic CCT counts and warnings in unrated/computer practice.
- Game history: recent 10-20 games.
- Game review: basic replay, no deep engine report.
- Analytics: basic stats.
- Board themes: free themes.
- Certificates: earned certificates viewable, limited downloads if desired.
- Parent report: school-generated report viewable if linked to school.

Free should be useful enough for school demos. It should not feel broken after the first activity.

### Silver

Positioning:

"Practice seriously every week."

Recommended access:

- Everything in Free.
- Unlimited online games.
- Unlimited friend games.
- Full game history.
- Full rating/ELO tracking.
- All public tournaments and school tournaments.
- Lessons through Club Player level, roughly 0-1800.
- Training drills through Club Player, roughly 0-1800.
- Daily Starter, Daily Improvement, Daily Endgame.
- Tactical trainer through 1900/2100 depending content supply.
- CCT panel with arrows and structured scan practice.
- More detailed post-game review, without premium AI coach.
- Advanced stats: opening result, time-control performance, puzzle accuracy, streaks.
- Custom board themes except premium Gold themes.
- Unlimited undos in unrated/computer.
- Priority matchmaking.
- Parent weekly report for individual plan.
- Certificates unlimited download/share.

Silver should be the default parent conversion for school students.

### Gold

Positioning:

"Train for tournaments and advanced improvement."

Recommended access:

- Everything in Silver.
- Advanced and Competitive tracks, 1800-2200+.
- Full tactical trainer and master calculation stages.
- Gold daily master challenge.
- Engine-assisted post-game analysis and best-move explanations.
- Opening explorer/repertoire tools.
- Game annotations and coach notes.
- Advanced analytics dashboard.
- Create/manage personal tournaments only if not a school-admin feature.
- Priority support.
- Premium board themes.
- AI/synthetic opponent personalities and advanced difficulty.
- Coach-review credits if you later add human review.

Gold should not be required for normal school participation. It should be for serious students, top performers, and families that want more.

## 4. School Privileges And Concessions

School enrollment should create `School Pass` entitlements, not change every student into paid personal subscribers.

### School Pass - Free Pilot

Use for demo schools and first 30-60 days.

Grant:

- Class join code.
- School dashboard visibility for teachers/admin.
- School tournament access.
- Assignments from teacher.
- Student progress visible to teacher.
- Parent weekly report for school activity.
- Certificates for school events.
- Online game limit lifted only for school events/assignments, not globally.
- Demo-day first game/puzzle flow.

Do not grant:

- Full Gold analysis.
- Global unlimited online play outside school assignments/events.
- Opening explorer.
- Premium AI coach.

Suggested duration:

- 30 days default.
- 60-90 days for anchor schools if they give strong promotion/testimonials.

### School Silver Pass

Use for paid school program or special concession.

Grant:

- Everything in School Pass.
- Unlimited games for school club activity and assignments.
- Silver learning tracks during school period.
- Daily Improvement/Endgame if assigned by teacher.
- Full class leaderboards.
- Parent reports.
- Certificates.
- School-only tournament entries.

Suggested pricing/concession:

- Retail Silver is INR 199/month or INR 1,999/year.
- School concession could be INR 99-149/month/student or INR 999-1,499/year/student when bought in bulk or collected through school.
- Since B2B payment flow is excluded, implement this as admin-granted school entitlements/coupons for now.

### School Gold Scholarships

Use sparingly for motivation.

Grant:

- Gold access for top performers, school champions, scholarship students, coaches' picks.

Suggested rule:

- Top 5% of a school league get 1-3 months Gold.
- School champion gets 6 months Gold.
- Teachers/coaches/admins get free Gold/Admin access while attached to the school.

### Government/Low-Income Concession

Grant:

- School Silver Pass through admin/manual scholarship.
- Keep personal pricing unchanged for public pages.

Reason:

Changing public pricing for everyone weakens the business. Use concession grants by organization or campaign.

## 5. What Schools Should Get That Retail Users Do Not

School-specific privileges:

- Teacher/class dashboard.
- Class codes and QR onboarding.
- Bulk import.
- Assignments.
- Parent report tied to class/school.
- School certificates.
- School leaderboards.
- Inter-house/team scoring.
- Offline tournament tools.
- Event QR check-in.
- Ambassador enrollment attribution.
- Safety controls and restricted child accounts.

These are not Silver/Gold student features. They belong to organization roles and school entitlements.

## 6. Recommended Public Pricing Message

Public page should say:

Free:

"Learn the rules, play 5 online games/day, solve starter puzzles, join school events."

Silver:

"Unlimited play and guided practice for students."

Gold:

"Advanced analysis and tournament training."

School program:

"Schools get dashboards, class assignments, tournaments, reports, and special student concessions. Contact Chess99."

Avoid publishing complex school discounts on the public pricing page until operations are stable. Give a "School Program" call-to-action instead.

## 7. Entitlement Coding Plan

### Backend source of truth

Add a central entitlement service:

`App\Services\EntitlementService`

Core API:

- `can(User $user, string $capability, ?array $context = []): bool`
- `limits(User $user, string $capability, ?array $context = []): array`
- `effectiveTier(User $user, ?array $context = []): string`
- `entitlementSummary(User $user): array`

Capabilities should be named, not hard-coded by screen:

- `play.computer.unlimited`
- `play.online.daily_limit`
- `play.online.unlimited`
- `tournament.public.join`
- `tournament.school.join`
- `tournament.create`
- `lesson.track.newcomer`
- `lesson.track.beginner`
- `lesson.track.club`
- `lesson.track.advanced`
- `training.drills.free`
- `training.drills.silver`
- `training.drills.gold`
- `tactical.stage.0`
- `tactical.stage.1`
- `tactical.stage.2`
- `tactical.stage.3`
- `tactical.stage.4`
- `daily.starter`
- `daily.improvement`
- `daily.endgame`
- `daily.master`
- `analysis.basic`
- `analysis.engine`
- `analysis.opening_explorer`
- `report.parent.weekly`
- `school.dashboard`
- `school.assignment.manage`
- `school.certificate.issue`
- `school.tournament.manage`
- `child.safe_mode.manage`

### Database

Add:

- `entitlement_grants`
- `school_programs`
- `school_program_members`
- `school_concession_codes` or reuse referral/coupon-like codes if cleaner.

`entitlement_grants` suggested fields:

- `id`
- `user_id` nullable
- `organization_id` nullable
- `school_class_id` nullable
- `event_id` nullable
- `source_type`: subscription, school_program, scholarship, trial, admin, event, coupon
- `source_id` nullable
- `capabilities` JSON
- `tier_overlay`: nullable free/silver/gold
- `starts_at`
- `ends_at`
- `status`
- `created_by`
- timestamps

Important:

- Subscription remains the normal personal plan.
- Entitlement grants add context-specific access.
- School Pass should usually be scoped to organization/class/event.

### API endpoints

Backend:

- `GET /api/v1/entitlements/me`
- `GET /api/v1/entitlements/user/{id}` for admin/teacher scoped view
- `POST /api/v1/admin/entitlement-grants`
- `DELETE /api/v1/admin/entitlement-grants/{id}`
- `POST /api/v1/schools/{id}/program`
- `POST /api/v1/schools/{id}/grant-pilot`
- `POST /api/v1/schools/{id}/grant-silver-pass`
- `POST /api/v1/schools/{id}/grant-gold-scholarship`

### Frontend

Add:

- `EntitlementContext`
- `useCan(capability, context)`
- `FeatureGate` component
- Pricing/tier matrix page driven by backend entitlements.
- School program admin page to grant pilot/Silver/Gold scholarship.
- Clear locked states showing what unlocks the feature: Silver, Gold, or School Pass.

Replace scattered checks:

- `currentTier === 'gold'`
- `canAccessTier(...)`
- hard-coded pricing feature text
- one-off route locks

with entitlement checks.

### Android

Add:

- `EntitlementApi`
- `EntitlementRepository`
- `EntitlementViewModel` or app-wide state.
- `CapabilityGate` composable.
- Same capability names as backend/web.
- Locked-state UI that says "Included in Silver", "Included in Gold", or "Available through your school".

Android should never guess entitlement logic locally except for cached display. Backend is authoritative.

## 8. UI Changes Needed

### Pricing page

Add clear rows:

- Play vs computer.
- Online games/day.
- Lessons.
- Training drills.
- Tactical trainer stages.
- Daily challenge tracks.
- Game review.
- Engine/AI analysis.
- Opening explorer.
- Tournaments.
- School participation.
- Parent reports.
- Certificates.
- Teacher dashboards.

Include a fourth non-purchasable column:

`School Pass`

This column should say "Through participating school" rather than showing a public payment button.

### School admin

Add:

- Program status: Pilot, School Silver, Expired, Scholarship active.
- Students covered.
- Entitlement expiry.
- Grant/revoke controls for platform admin.

### Student/parent

Show:

- Personal plan: Free/Silver/Gold.
- School access: e.g. "School Silver Pass active until 30 Jun 2026".
- What is unlocked by each.

## 9. Operational Policy

Recommended concession policy for sales:

- First demo day: Free.
- First 30 days after school activation: School Pass Free Pilot.
- If school gives 100+ students: extend pilot to 60 days.
- If school runs monthly activity: School Silver Pass concession.
- Top 5% students: Gold scholarships.
- Teachers/coaches: Free Gold/Admin while active.
- Ambassadors should not promise permanent Gold or permanent unlimited access.

Suggested language for BDEs:

"Every student can start free. Schools get special program access for class assignments, competitions, reports, and certificates. Serious students can upgrade to Silver or Gold, and top school performers may receive Gold scholarships."

## 10. Implementation Order

1. Define capability registry and entitlement service in backend.
2. Add entitlement grants table and API summary endpoint.
3. Update existing subscription checks to use entitlement service for online-game limits and learning gates.
4. Add frontend EntitlementContext and pricing matrix.
5. Add Android EntitlementRepository and CapabilityGate.
6. Add School Pass grant model.
7. Update school dashboard roadmap to consume School Pass.
8. Add admin controls for pilot/Silver/Gold scholarship grants.

This should be done before broad school rollout, because otherwise salespeople and ambassadors will sell inconsistent benefits.

## 11. External Context

Competitors make entitlement clarity important:

- ChessKid publicly highlights school/group features such as organizing students, assignments, report cards, guided lesson plans, leaderboards, global matches, and special group pricing: https://support.chesskid.com/en/articles/8864339-coach-school-what-are-the-special-features-available-to-schools-groups
- Chess.com distinguishes free basic access from premium learning/analysis/puzzle/video benefits: https://support.chess.com/en/articles/8609242-why-should-i-become-a-member-at-chess-com-does-it-cost-anything
- Lichess offers all features free, which means Chess99 must justify paid tiers through guided learning, school operations, parent reports, concessions, and local service rather than generic chess access: https://lichess.org/features
