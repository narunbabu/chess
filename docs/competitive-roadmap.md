# Chess99 Competitive Roadmap & TODO

**Created:** 2026-07-06
**Strategy:** Become *"the ChessKid of India"* — kid-safety + parent visibility + academy-grade
training + school tournaments + INR pricing. Do **not** compete with Chess.com on breadth.
**Unique differentiator to lean on:** CCT (Candidate-move Training) — no competitor has it.

> This is a living checklist. Tick items as they ship. Each item notes **effort**, **impact**,
> **what already exists** (so we build on it, not from scratch), and **acceptance criteria**.

---

## Strategic context (why this order)

| Competitor | Price anchor | Weakness we exploit |
|---|---|---|
| Chess.com India | ~₹2,950/yr Platinum | Not kid-safe, general audience, no parent tooling |
| ChessKid | ~$39.99/yr Gold | **No localized India product** (only Anand ambassadorship) |
| Indian academies (Kaabil Kids, Chess Gurukul) | ₹1,000–4,000/mo | Live coaching only — **no software platform** |
| CircleChess | free (Gukesh school league) | Active schools land-grab — **move fast on schools** |

Core insight: **parents pay, kids play.** Today the product only serves the kid. Tier 1 exists to
give the *parent* a reason to buy (safety + report cards), which unlocks the schools/parents pitch
everything else builds on. Our ₹99/mo · ₹999/yr · ₹499/mo · ₹4999/yr tiers are well-placed; the gap
is product justification, not price.

---

## TIER 1 — Do first (highest impact ÷ effort · target ~4–6 weeks)

### [ ] 1. Kid-safety chat layer  · effort: ~1 week · impact: HIGH (unblocks schools/parents pitch)
Free-text, unfiltered in-game chat on a 5–18 platform is the biggest current liability.
- **Exists:** `GameChatMessage` model; in-game `ChatPanel.js` / `GameChat.js`.
- **Build:**
  - [ ] Preset-phrase + emoji-only mode for accounts under an age threshold
        ("Good move!", "Good luck!", "Thanks!", "Well played!").
  - [ ] Profanity/URL filter for older accounts.
  - [ ] Report + block endpoints and a minimal admin moderation queue.
  - [ ] Per-org / per-account "disable social access" toggle (ChessKid parity).
- **Acceptance:** under-age accounts cannot type free text; reports land in an admin view; a school
  admin can disable chat org-wide.

### [~] 2. Parent dashboard + weekly report cards  · effort: ~2 weeks · impact: HIGH (the conversion feature)
The single feature that flips a parent from free → paid. This is what academies charge ₹2,000/mo for.
**Status: core shipped 2026-07-06** (backend + first frontend; 7 passing feature tests).
- **Exists:** `CAP_REPORT_PARENT_WEEKLY` capability (Silver tier); email infra
  (`SendWeeklyDigest`), progress data (`UserTutorialProgress`, `RatingHistory`, game history).
- **Build:**
  - [x] Parent ↔ child account linking (guardian relationship — invite by email, child accepts).
        `guardian_child_relationships` table + `GuardianChildRelationship` model + `/api/parent/*` routes
        (web + mobile api_v1).
  - [x] "My Kids" page (`pages/MyKidsPage.js`, `services/parentDashboardService.js`): rating,
        weekly W/L/D, puzzles solved, lessons completed, learning time, recent games with replay + PGN
        download (guardian access added to `GameController@pgn`). Nav link in Header + `/parent` route.
  - [x] Weekly email report card (`ParentWeeklyReportMail` + Blade view; `SendWeeklyDigest` now also
        queues parent reports for active links) + on-demand "email report card" button.
  - [x] Guardian-gated controls: child display-name + password management (`ManageChildModal`).
  - [ ] Gold/subscription toggle for a child from the parent account (follow-up).
  - [ ] Age-gated auto-linking at signup (child enters guardian email during onboarding) (follow-up).
- **Acceptance:** ✅ a parent logs in, links a child, sees each child's week at a glance, downloads PGNs,
  and receives/queues a weekly email. Remaining: manage a child's subscription from the parent view.

### [ ] 3. Puzzle Rush + Puzzle Duel  · effort: ~2 weeks · impact: HIGH (best engagement/effort in industry)
- **Exists:** rated puzzles, `TacticalRatingService`, Reverb WebSockets, 5-category leaderboard page.
- **Build:**
  - [ ] **Puzzle Rush** — timed solo (3-min + survival), score = streak before 3 misses.
  - [ ] **Puzzle Duel** — real-time head-to-head race (same puzzles/order, power meter). Thin
        real-time layer over existing puzzle + WebSocket infra.
  - [ ] Leaderboards for both (slot into existing leaderboard page).
- **Depends on / pairs with:** #6 (Lichess puzzle import) for volume.
- **Acceptance:** a user can play a 3-min Rush and a live Duel vs. a friend; scores hit a leaderboard.

### [ ] 4. Make streaks visible  · effort: ~3 days · impact: HIGH (Chess.com's top retention lever, nearly free here)
- **Exists:** `current_streak_days` / `longest_streak_days` already tracked in DB.
- **Build:**
  - [ ] Flame icon + count in the header.
  - [ ] Streak calendar view + one grace day.
  - [ ] Count *any* activity (game, puzzle, lesson) toward the streak.
- **Acceptance:** streak flame shows in header; missing one day with a grace day intact keeps streak.

### [ ] 5. Surface the game review we already compute  · effort: ~1–2 weeks · impact: HIGH
Engine analysis is computed but never shown; accuracy isn't even in the UI.
- **Exists:** `GameAnalysis` (accuracy %, ACPL, per-move classification), review/replay components,
  CCT analysis utilities.
- **Build:**
  - [ ] Accuracy score on game-end card (shareable — "I played at 87%!").
  - [ ] "Learn from your mistakes" mode — replay your blunders, find the better move (Lichess-style).
  - [ ] Template-based explanations per classification ("This drops your knight to a fork").
        (LLM enrichment later — see #12.)
- **Acceptance:** after any game, user sees accuracy + can step through their mistakes with feedback.

---

## TIER 2 — Strategic builds (next 2–3 months)

### [ ] 6. Import the Lichess puzzle database  · effort: ~1 week · impact: HIGH (closes the volume gap free)
~5M CC0 puzzles with themes/ratings/popularity. Keep curated 2,500 stages; add the rest for
Rush/Duel/themed practice at zero content cost.
- **Build:**
  - [ ] Import pipeline (FEN, moves, themes, rating, popularity) into a puzzles table.
  - [ ] Theme filters + rating-band selection in the puzzle UI.
- **Acceptance:** themed + rated puzzle practice draws from millions of puzzles.

### [ ] 7. Schools & coach program  · effort: ~3–4 weeks · impact: HIGH (the distribution channel)
Orgs/org-tournaments/admin exist; the **classroom layer** is missing. ChessKid's playbook: free for
schools, parents convert individually. Directly serves `long_term_goal.md` #5. Urgent vs. CircleChess.
- **Exists:** `Organization`, org tournaments, `OrganizationInvitation`, admin dashboard.
- **Build:**
  - [ ] Coach role with student roster.
  - [ ] Assign lesson/drill sets as homework; per-class progress view.
  - [ ] Bulk account creation (CSV import — schools won't sign up one-by-one).
  - [ ] Org/class leaderboards.
  - [ ] Package as **free for schools** tier.
- **Acceptance:** a coach imports a class, assigns a drill set, and sees who completed it.

### [ ] 8. Weekly leagues  · effort: ~2–3 weeks · impact: HIGH (biggest retention gap vs Chess.com; unserved in kids/India)
- **Exists:** ratings, leaderboards, cron infra.
- **Build:**
  - [ ] Weekly 20–50 player divisions (Wood→…→Legend), promotion + trophies, no relegation below earned tier.
  - [ ] Pair with school groups ("your class is a division").
- **Acceptance:** users are placed in a weekly division, earn trophies, and get promoted.

### [ ] 9. Openings + endgame courses with spaced repetition  · effort: ~3–4 weeks · impact: MED-HIGH
Fills the two biggest curriculum holes; creates a daily "reviews due" hook.
- **Exists:** `TrainingDrill` / `TrainingDrillSet` with mastery thresholds (~60% of a Chessable MoveTrainer).
- **Build:**
  - [ ] SM2-style review scheduler (due dates, expanding intervals) over drills.
  - [ ] Author 2–3 beginner opening repertoires + essential endgames (K+P, K+R).
  - [ ] "Reviews due today" surface on dashboard.
- **Acceptance:** a user studies an opening line, it reappears for review on schedule.

### [ ] 10. Per-time-control ratings  · effort: ~1 week · impact: MED (esp. for kids)
A blitz loss tanking your "real" rating feels bad. Tactical rating is already separate.
- **Build:**
  - [ ] Split rapid/blitz/bullet ratings (Elo + existing K-factor table; skip Glicko-2 for now).
  - [ ] Show all three on profile.
- **Acceptance:** playing blitz only moves the blitz rating.

---

## TIER 3 — Differentiators (3–6 months out)

### [ ] 11. Adventure / quest wrapper for the lesson path  · effort: LARGE (art-heavy) · impact: HIGH (kid acquisition)
ChessKid Adventure is the strongest kid-acquisition device in the market. **Validate Tier 1/2
retention before investing.**
- **Build:** "boss battles" vs. named synthetic players, star rewards on lessons, visual map over
  existing module progression.

### [ ] 12. LLM coach in Telugu / Hindi / English  · effort: MED · impact: HIGH (defensible India moat)
Nobody has a regional-language chess coach. LLM layer over existing CCT + `GameAnalysis` data.
Gate to Gold.
- **Build:** natural-language move explanations in EN/HI/TE; hook into review (#5) and CCT.

### [ ] 13. Spectator mode for school tournaments  · effort: MED · impact: MED (retention + viral)
Parents watching their kid's board live = retention + viral loop.
- **Exists:** `PublicGameViewer`.
- **Build:** live WebSocket subscription + tournament wall-board view.

### [ ] 14. Animated game-replay share links  · effort: SMALL-MED · impact: MED (acquisition surface)
`long_term_goal.md` #6. Share cards don't link to a playable replay today. WhatsApp is our
distribution channel — every shared game should be an acquisition surface.
- **Exists:** `SharedResult`, replay component.
- **Build:** WhatsApp share opens an auto-playing game replay.

### [ ] 15. Basic fair-play detection  · effort: MED · impact: MED (needed before prize $ scales)
Currently zero anti-cheat.
- **Exists:** ACPL/accuracy computed per game (`GameAnalysis`).
- **Build:** engine-correlation flagging on tournament games → admin review queue (not full Proctor,
  but must exist before prize-money tournaments scale).

---

## Suggested first month

1. **Week 1–2:** #1 Safety chat + #4 Streak visibility (small, ships fast, de-risks schools pitch).
2. **Week 2–4:** #2 Parent dashboard + report cards (the conversion feature).
3. **Week 4–6:** #3 Puzzle Rush → Duel.
4. **In parallel:** start #6 Lichess puzzle import (feeds Rush/Duel).

Recommended starting pair: **#1 + #2** — together they unlock the schools/parents pitch.

---

## Cross-references
- Growth/marketing + structural asks: `long_term_goal.md` (items #5 schools/orgs, #6 game-share replay)
- Positioning & funnel: landing conversion work (kids-academy positioning)
- Ambassador/referral program: `project_ambassador_program` (see project memory)
