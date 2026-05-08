# Chess99 Product And Competitor Audit

Date: 2026-05-05

## 1. Executive View

Chess99 is strongest as an India-ready chess participation platform: play, practice, track progress, run tournaments, and recruit through ambassadors/referrals. It is not yet a complete chess academy operating system. The product can win locally if it is positioned as "school chess activation plus home practice", not as a direct replacement for Chess.com, Lichess, Upstep, or ChessKid.

The best commercial wedge is:

1. Schools get a structured chess activity program, tournaments, leaderboards, and progress visibility.
2. Students get a first game quickly, then daily puzzles, tactics, training drills, and rated play.
3. Parents get a visible habit and improvement story.
4. Ambassadors and business developers get QR/referral links, payout tracking, and a simple demo flow.

## 2. Product Evidence From The Codebase

Core surfaces found in the app:

- Public play, puzzles, learn redirect, pricing, join/referral links, result sharing, leaderboard, system health, and game replay are routed in `chess-frontend/src/App.js`.
- Authenticated areas include multiplayer, tutorial, daily challenges, lobby, profile, friends, dashboard, training, game review, referrals, ambassador dashboard, organizations, subscriptions, and championships in `chess-frontend/src/App.js`.
- Pricing has Free, Silver, and Gold tiers. Static fallback prices are Free, Silver monthly INR 199/yearly INR 1,999, Gold monthly INR 499/yearly INR 4,999 in `chess-frontend/src/pages/PricingPage.js`.
- Ambassador flow supports applications, QR links, WhatsApp templates, printable posters, milestone earnings, referral-user progress, and payout requests in `chess-frontend/src/pages/BecomeAmbassador.js` and `chess-frontend/src/pages/AmbassadorDashboard.js`.
- Referral flow supports multiple codes, labels such as school name, earnings, payouts, WhatsApp/email sharing, and referred user tracking in `chess-frontend/src/pages/ReferralDashboard.js`.
- Organizations support schools/clubs/federations/companies/communities, invitations, members, and admin creation in `chess-frontend/src/pages/OrganizationDashboard.js`.
- Training curriculum spans Newcomer through Competitive, rating bands 0-600 to 2200+, and gates drills by Free/Silver/Gold in `chess-frontend/src/constants/learningCurriculum.js`.
- Tactical progression has five stages from 800 to 2200+, 500 puzzles per stage, CCT scoring, rating deltas, unlocks, server sync, badges, and leaderboard endpoints in `chess-frontend/src/components/tactical/tacticalStages.js` and `chess-backend/app/Http/Controllers/TacticalProgressController.php`.
- CCT panel teaches Checks, Captures, Threats scanning and can show Stockfish top moves in unrated contexts in `chess-frontend/src/components/game/CCTPanel.jsx`.
- Backend API routes cover games, ratings, progress, tutorial modules, daily challenges, training drills, WebSockets, championships, organizations, ambassadors, referrals, subscriptions, locations, and admin dashboards in `chess-backend/routes/api.php` and `chess-backend/routes/api_v1.php`.

## 3. What Chess99 Best Offers

### India-local business mechanics

Chess99 already has mechanics most chess apps do not expose locally:

- Ambassador application and approval.
- QR-based joins and printable posters.
- Milestone rewards for signup, first activity, and 100 games/puzzles.
- Recurring commission percentages for subscription revenue.
- UPI/bank payout request flow.
- Organization/school grouping.
- Indian pricing and Razorpay subscription/payment plumbing.
- Location endpoints for countries, states, districts, mandals, and villages.

This is a major advantage for offline sales in India. Chess.com and Lichess are better products at global scale, but they do not give a local school visitor a branded QR, commission dashboard, school code, and payout workflow inside your own platform.

### A strong "first chess habit" loop

Chess99 can already support:

- First game against computer.
- First online game or rated game.
- Puzzle and tactical trainer.
- Daily challenge.
- Rating and leaderboard.
- Game history/replay/review.
- Progress charts.
- Social result sharing.

That is enough for a school activation program where the goal is not to produce titled players immediately, but to get many children playing, returning, and improving.

### Tournament readiness

The championship system is deeper than a simple bracket:

- Swiss, elimination, hybrid formats.
- Registration and paid registration.
- Pairings, standings, tiebreakers, matches, invitations, scheduling, result reporting, and tournament admin tools.
- Public championship listing and instructions.

This is useful for school competitions, inter-school leagues, holiday events, and city-level online qualifiers.

### Differentiated learning idea: CCT

The Checks-Captures-Threats panel is commercially valuable because it is easy to explain to parents and beginners:

"Before every move, scan checks, captures, and threats."

That is more teachable in a demo than a generic engine evaluation. It can become Chess99's signature learning method if turned into lesson plans, worksheets, and coach scripts.

## 4. Competitive Comparison

### Global competitors

Chess.com is the global benchmark for all-in-one chess. Its help center lists play, bots, puzzles, lessons, game review, friends, forums, ChessTV, and sharing/community functions. Source: https://support.chess.com/en/articles/8615318-welcome-to-chess-com

Lichess is the strongest free competitor. It offers unlimited arena and Swiss tournaments, Stockfish analysis, learn-from-mistakes, studies, insights, puzzles, puzzle streak/storm/racer, opening explorer, tablebase, PGN upload/download, teams, messaging, and 140+ languages, all free. Source: https://lichess.org/features

ChessKid is the school/kid safety benchmark. It emphasizes kid-safe navigation, no outside links/ads/social networking between kids and adults, parent/coach control, group organization, assignments, report cards, guided lesson plans, leaderboards, global class matches, and special group pricing. Sources: https://support.chesskid.com/en/articles/8858305-what-s-the-difference-between-chesskid-and-chess-com and https://support.chesskid.com/en/articles/8864339-coach-school-what-are-the-special-features-available-to-schools-groups

Chessable is the serious self-study benchmark. It is strongest in structured courses, opening/endgame/tactics study, spaced repetition, MoveTrainer, offline mode, and a large course catalog. Source: https://apps.apple.com/us/app/chessable-study-chess-smarter/id1523279049

### India competitors

Upstep Academy is a strong India/global online academy competitor. Its public messaging emphasizes GM Viswanathan Anand certification/inspiration, live personalized classes, structured curriculum, expert coaches, dedicated relationship managers, and a multi-level pathway from beginner to master/pro master. Source: https://www.upstepacademy.com/

Upstep's platform claims activity-based curriculum, 2,500+ interactive activities, 150+ lessons, five learning levels, online tournaments, quizzes, interactive classroom, bots/friends, blindfold chess, and daily/weekly/monthly student reports. Source: https://online.upstepacademy.com/

CircleChess is a direct India school/tournament competitor. Its tournament manager messaging covers online and offline tournaments, Lichess integration, event publishing, player upload/withdrawal, pairing generation, standings/results, score upload, prize categories, and winners list. Source: https://circlechess.com/blog/empowering-tournament-organizers-creating-and-managing-chess-tournaments-in-india-with-circlechess-manager/

CircleChess/Caissa also sells coaching credibility with large student counts and GM/IM coach supply on its pages. Source: same CircleChess page.

## 5. Gaps Against Competitors

### Product gaps for schools

Highest priority gaps:

- Teacher dashboard for classroom sections, assignments, homework, weekly lesson plans, and student report cards.
- Parent dashboard with safe child account controls, activity visibility, and WhatsApp-friendly progress summaries.
- Bulk student import, class codes, roll numbers, school/grade/section fields, and school-year promotion.
- Attendance tracking for offline and online classes.
- Certificate generation after level completion and tournament participation.
- School invoice, receipt, GST, and B2B payment flow.
- Coach mode with a shared demo board, lecture board, position broadcast, and simultaneous student puzzle launch.
- School admin reports: active students, lessons completed, games played, puzzles solved, tournament standings, top improvers, inactive students.

### Learning content gaps

Chess99 has the skeleton, but Upstep/ChessKid/Chessable are stronger in content depth and pedagogy:

- More beginner lessons for ages 5-8 with visual mini-games.
- Grade-wise and age-wise curriculum maps.
- Worksheets and offline classroom activities.
- Video library in Indian languages.
- Spaced repetition scheduling like Chessable.
- Opening explorer and repertoire builder.
- Endgame tablebase or structured endgame module.
- Coach-reviewed assignments and annotations.
- Skill assessment that generates a recommended path and parent-facing report.

### Safety and trust gaps

For schools and parents, this is a serious buying criterion:

- Child account mode with restricted chat/social contact.
- Parent consent and guardian linking.
- Adult-child interaction restrictions.
- Moderation logs and abuse reporting.
- Clear privacy page for minors.
- School safety policy one-pager.
- Teacher/coach verification badges.
- Background verification process for field ambassadors and coaches.

ChessKid explicitly leads on this with parent/coach control and no adult-child social networking. Chess99 should not enter schools without a safety document and a child-safe operating mode.

### Tournament gaps

Chess99 has online championship depth, but CircleChess appears stronger for offline tournament organizers:

- Offline OTB tournament mode.
- Manual score upload by board.
- FIDE-style pairing export/import.
- Arbiter dashboard.
- Printable pairings, standings, certificates, and prize list.
- Age/rating category prize management.
- School house/team scoring.
- QR check-in at venue.
- WhatsApp result submission fallback.

### Brand gaps

Upstep and CircleChess sell credibility through named champions, titled coaches, large student numbers, school movement language, and visible outcomes. Chess99 currently needs:

- Founder story and mission sharpened for schools.
- Advisory coach or titled player panel.
- Testimonials from schools/parents.
- Demo day photos/videos.
- Case studies.
- Public roadmap for school chess.
- Clear "Why Chess99 instead of free Lichess?" answer.

## 6. Best Positioning

Do not position Chess99 as "better than Chess.com" or "better than Lichess". That invites an impossible comparison.

Position it as:

"An India-first school chess activation platform: conduct competitions, enroll students, give them a guided daily chess habit, and let parents/schools see progress."

Three proof points:

1. Local execution: school visits, competitions, WhatsApp onboarding, QR referrals, Indian payments.
2. Learning method: CCT scan plus tactical progression.
3. Community: school leaderboards, inter-school events, ambassadors, and city leagues.

## 7. Priority Product Roadmap For Market Fit

### Build before scaling to many schools

1. School demo mode: one URL/QR that lets a child play a first game without friction and then asks for parent phone consent.
2. Class dashboard: school, grade, section, student list, active/inactive status, games, puzzles, rating, lessons.
3. Assignment engine: assign 5 puzzles, 1 lesson, 1 game per week.
4. Parent report: WhatsApp shareable weekly progress image/PDF.
5. Certificate generator: first game, 7-day streak, tournament participation, level completion.
6. Offline tournament support: manual pairings/results, printable standings, certificates.
7. Ambassador mobile workflow: lead capture, QR scan, first-game checklist, parent consent, callback status.

### Build after first 10-20 schools

1. Live classroom board.
2. Coach marketplace.
3. Multilingual content packs: Telugu, Hindi, English first.
4. Curriculum mapped to 12-week beginner, 24-week club, and 48-week competitive paths.
5. Student placement test with recommended path.
6. School subscription management and invoicing.

## 8. Sources

Local code references:

- `C:\ArunApps\Chess-Web\chess-frontend\src\App.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\pages\PricingPage.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\pages\BecomeAmbassador.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\pages\AmbassadorDashboard.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\pages\ReferralDashboard.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\pages\OrganizationDashboard.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\constants\learningCurriculum.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\components\tactical\tacticalStages.js`
- `C:\ArunApps\Chess-Web\chess-frontend\src\components\game\CCTPanel.jsx`
- `C:\ArunApps\Chess-Web\chess-backend\routes\api.php`
- `C:\ArunApps\Chess-Web\chess-backend\routes\api_v1.php`
- `C:\ArunApps\Chess-Web\chess-backend\app\Http\Controllers\TacticalProgressController.php`

External references:

- Chess.com features: https://support.chess.com/en/articles/8615318-welcome-to-chess-com
- Lichess features: https://lichess.org/features
- ChessKid safety: https://support.chesskid.com/en/articles/8858305-what-s-the-difference-between-chesskid-and-chess-com
- ChessKid schools/groups: https://support.chesskid.com/en/articles/8864339-coach-school-what-are-the-special-features-available-to-schools-groups
- Upstep Academy: https://www.upstepacademy.com/
- Upstep platform: https://online.upstepacademy.com/
- CircleChess tournament manager: https://circlechess.com/blog/empowering-tournament-organizers-creating-and-managing-chess-tournaments-in-india-with-circlechess-manager/
- Chessable app: https://apps.apple.com/us/app/chessable-study-chess-smarter/id1523279049
