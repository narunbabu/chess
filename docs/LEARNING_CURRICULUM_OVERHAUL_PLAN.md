# Chess99 Learning Curriculum Overhaul Plan

**Date:** 2026-05-04  
**Scope:** Lessons, training drills, daily challenge  
**Status:** Backend training drill foundation and daily challenge multi-track persistence implemented; lesson content overhaul pending  

## Executive Summary

The current learning area has useful infrastructure, but the product experience still feels like a demo in several places. Lessons have backend models, progression, and subscription gates, while training drills are mostly static frontend data and daily challenge is a single daily puzzle flow. The overhaul should turn these into a structured learning system for distinct player needs and distinct subscription levels.

The core design principle is:

> Skill level decides what a player needs. Subscription tier decides how much depth, personalization, and volume they can access.

This avoids a common mistake: a new player with Gold should not be pushed into advanced material, and a strong Free user should still understand what higher-level tracks exist even when access is limited.

## Current Findings

### Lessons

Strengths:
- Backend module and lesson models already exist.
- Modules already support `skill_tier` and `required_tier`.
- Interactive lesson stages, progress, hints, and move validation already exist.
- API responses expose lock state and upgrade metadata.

Gaps:
- Curriculum shape is not consistently learner-centered.
- Some lessons are technically interactive but not always pedagogically staged.
- There is no explicit path for newcomers, club players, and competitive players.
- Subscription tiers exist technically but do not yet feel like a deliberate product ladder.

### Training Drills

Strengths:
- There is a frontend training page and board interaction.
- Tactical trainer has a more mature progress model than the generic training drills.

Gaps:
- Generic training drills are hard-coded in frontend data.
- Completion is stored in localStorage.
- There is no backend drill catalog, drill progress, recommendation system, or subscription enforcement.
- The current drill list is small and not structured by skill need, chess theme, repetition model, or mastery.

### Daily Challenge

Strengths:
- Daily challenge API, completions, streaks, leaderboard, and XP exist.
- Free-user cap logic exists.

Gaps:
- Only one current challenge is selected for a date.
- Skill tier is accepted as an input but the model does not support multiple parallel daily tracks per date.
- Free, Silver, and Gold users do not receive meaningfully different daily challenge experiences.
- Leaderboard is not separated by skill band or challenge track.

## Target Product Model

The learning system should have three primary surfaces:

1. **Lessons:** teach concepts in a guided sequence.
2. **Training Drills:** build pattern recognition, calculation, and habits through repetition.
3. **Daily Challenge:** create habit, streaks, and lightweight competitive energy.

Each surface should share the same learner profile:

- Skill band
- Subscription tier
- Current path
- Weak themes
- Recent activity
- Recommended next action

## Player Skill Bands

| Skill Band | Approx Rating | Player Need | Product Promise |
| --- | ---: | --- | --- |
| Newcomer | 0-600 | Learn rules, movement, check, mate, confidence | "I can play a legal game." |
| Beginner | 600-1000 | Stop blunders, see simple tactics, finish basic mates | "I can recognize basic threats." |
| Improving Beginner | 1000-1400 | Build opening habits, tactics, and simple endgames | "I know what to look for." |
| Club Player | 1400-1800 | Calculation, plans, pawn structures, conversion | "I can make structured decisions." |
| Advanced | 1800-2200 | Deep calculation, defense, strategic tradeoffs | "I can compete seriously." |
| Professional / Competitive | 2200+ | Preparation, precision, tournament workflows | "I train deliberately for results." |

The existing `current_skill_tier` can remain as a coarse grouping, but the new curriculum should add finer bands in content metadata.

## Subscription Access Model

| Subscription | Role in Learning |
| --- | --- |
| Free | Strong entry path, daily habit, limited drills, previews of higher-value content. |
| Silver | Full beginner and club improvement path, unlimited standard drills, stronger personalization. |
| Gold | Advanced and competitive training, deeper analytics, repertoire/analysis workflows, premium daily tracks. |

### Access Rules

Free:
- Full newcomer path.
- Selected beginner modules.
- One daily challenge track.
- Limited drill attempts per day.
- Basic progress and streaks.
- Locked previews for Silver and Gold modules.

Silver:
- All Free content.
- Full beginner and club-player curriculum.
- Unlimited standard drills.
- Personalized review queue.
- Skill-band daily challenge.
- Expanded leaderboards and progress analytics.

Gold:
- All Silver content.
- Advanced and competitive curriculum.
- High-depth calculation drills.
- Opening repertoire drills.
- Advanced daily challenge track.
- Deep analytics by theme, time, accuracy, and failure mode.

## Lessons Curriculum

### Newcomer Path

Goal: turn a non-player into someone who can play a legal complete game.

Modules:
- Board and coordinates
- Piece movement
- Captures and legal moves
- Check and escaping check
- Checkmate and stalemate
- Castling, promotion, en passant
- First complete guided game

Lesson format:
- Concept
- Visual board demo
- Guided move
- Independent move
- Mistake explanation
- Mini review

Subscription: Free.

### Beginner Path

Goal: reduce immediate blunders and teach basic winning patterns.

Modules:
- One-move threats
- Mate in one and mate in two
- Hanging pieces
- Forks, pins, skewers
- King safety
- Opening principles
- Basic queen/rook mates
- Simple pawn endings

Subscription:
- Core modules Free.
- Full path Silver.

### Club Player Path

Goal: teach structured thinking, calculation, and practical game improvement.

Modules:
- Candidate moves
- Calculation discipline
- Forcing moves
- Tactical motif families
- Pawn structures
- Open files and outposts
- Good bishop vs bad bishop
- Rook endings
- Converting advantages
- Defending worse positions

Subscription: Silver.

### Advanced Path

Goal: deepen calculation and decision quality.

Modules:
- Multi-branch calculation
- Defensive resources
- Positional sacrifices
- Exchange sacrifices
- Prophylaxis
- Complex rook endings
- Minor-piece endings
- Strategic planning from model games
- Practical time-pressure decisions

Subscription: Gold.

### Competitive / Professional Path

Goal: support serious preparation and tournament performance.

Modules:
- Opening repertoire maintenance
- Model game preparation
- Opponent-style preparation
- Calculation under time controls
- Conversion technique
- Save/draw defensive technique
- Post-game self-review workflows
- Tournament readiness checklist

Subscription: Gold.

## Training Drills Redesign

Training drills should become a backend-managed system, not static frontend data.

### Drill Types

| Drill Type | Purpose | Examples |
| --- | --- | --- |
| Pattern Drill | Fast recognition | forks, pins, back rank, loose pieces |
| Calculation Drill | Find a sequence | mate in 2, forcing line, defensive resource |
| Habit Drill | Build decision discipline | checks-captures-threats, blunder check |
| Endgame Drill | Technique repetition | king opposition, rook activity, Lucena basics |
| Opening Drill | Recall and plans | first 8 moves, typical pawn breaks |
| Review Drill | Personalized repair | missed theme from games or prior puzzles |

### Drill Metadata

Every drill should define:
- `slug`
- `title`
- `description`
- `skill_band`
- `required_tier`
- `theme`
- `subtheme`
- `position_fen`
- `solution`
- `accepted_alternatives`
- `explanation`
- `hints`
- `time_target_seconds`
- `mastery_threshold`
- `source`
- `is_active`

### Drill Progress

Track per user:
- attempts
- solved count
- first try solves
- average time
- hint usage
- last attempted
- mastery status
- recurring review due date
- common failure reason

### Drill Access

Free:
- Daily limited standard drills.
- Newcomer and selected beginner drills.

Silver:
- Unlimited beginner and club drills.
- Personalized review queue.

Gold:
- Advanced/pro drill sets.
- Opening and deep calculation drills.
- Failure-mode analytics.

## Daily Challenge Redesign

Daily challenge should move from one global challenge to multiple daily tracks.

### Daily Tracks

| Track | Audience | Access |
| --- | --- | --- |
| Daily Starter | Newcomers and beginners | Free |
| Daily Improvement | Beginner to club players | Silver |
| Daily Calculation | Club to advanced players | Silver |
| Daily Master | Advanced and competitive players | Gold |
| Daily Endgame | Rotating technique track | Silver/Gold depending difficulty |

### Track Selection

Default challenge should be selected by:
- user skill band
- subscription tier
- recent performance
- untrained themes
- challenge availability

Users may switch to easier tracks. Harder locked tracks should show preview and upgrade prompt.

### Leaderboards

Leaderboards should be separated by:
- date
- track
- skill band
- optionally subscription tier

This prevents newcomers from being ranked against advanced users on the same puzzle and makes competition feel fair.

## Information Architecture

Replace the current learning surfaces with a unified Learn dashboard:

1. **My Path**
   - next lesson
   - next drill
   - daily challenge
   - current streak
   - weak theme

2. **Lessons**
   - curriculum map by skill band
   - locked previews by subscription
   - clear prerequisites

3. **Drills**
   - theme library
   - recommended set
   - timed mode
   - review queue

4. **Daily Challenge**
   - today’s assigned track
   - alternate tracks
   - streak and leaderboard

5. **Progress**
   - lessons completed
   - drill mastery
   - theme accuracy
   - time trend
   - recommended focus

## Backend Implementation Plan

### Phase 1: Content Contract

No schema changes yet.

Deliverables:
- Confirm curriculum map.
- Define canonical skill bands.
- Define JSON contracts for lessons, drills, and daily tracks.
- Audit existing lesson seeders against this contract.

### Phase 2: Drill Catalog and Progress

Requires migration approval.

Proposed tables:
- `training_drill_sets`
- `training_drills`
- `user_training_drill_progress`
- `user_training_drill_attempts`

API:
- `GET /api/v1/training/drills`
- `GET /api/v1/training/drills/recommended`
- `GET /api/v1/training/drills/{id}`
- `POST /api/v1/training/drills/{id}/attempt`
- `GET /api/v1/training/progress`

### Phase 3: Daily Challenge Tracks

Requires migration approval.

Options:
- Add `track`, `required_tier`, and unique key `(date, track)` to `daily_challenges`.
- Or create `daily_challenge_tracks` and attach challenges to tracks.

Recommended: add a track model/table for clean future expansion.

API:
- `GET /api/v1/daily-challenges/today`
- `GET /api/v1/daily-challenges/tracks`
- `POST /api/v1/daily-challenges/{challenge}/submit`
- `GET /api/v1/daily-challenges/{challenge}/leaderboard`

### Phase 4: Recommendation Service

Create a service that uses:
- lesson progress
- drill attempts
- daily challenge results
- tactical trainer progress
- user skill band
- subscription tier

Output:
- next lesson
- next drill set
- daily challenge track
- weak theme
- upgrade preview

### Phase 5: Frontend Rebuild

Replace:
- `TrainingHub.js`
- `TrainingExercise.js`
- `trainingExercises.js`

With:
- `LearningDashboard`
- `LessonPath`
- `TrainingDrillHub`
- `TrainingDrillPlayer`
- `DailyChallengeTracks`
- shared gated content cards

## Content Migration Plan

1. Keep existing lessons live.
2. Add canonical metadata to seeders.
3. Mark demo-like lessons as draft or beginner/free sample.
4. Convert existing frontend training exercises into backend drills.
5. Preserve existing tactical trainer as a specialized advanced drill area, then gradually fold its progress into the unified dashboard.
6. Keep old routes as compatibility redirects until new pages are stable.

## Measurement

Track:
- lesson starts
- lesson completions
- drop-off by stage
- drill attempts
- drill solve rate
- hint usage
- daily challenge streak
- upgrade prompt views
- upgrade conversion from locked learning content
- theme-level improvement over time

## Quality Gates

Backend:
- Feature tests for tier access.
- Feature tests for drill attempts.
- Feature tests for daily challenge track selection.
- Migration dry-run before any schema change.

Frontend:
- Build.
- Targeted component tests for gated cards and drill player.
- E2E tests for Free, Silver, and Gold access paths.
- E2E tests for daily challenge track behavior.

Mandatory project gates still apply before deployment:
- `pnpm build`
- `pnpm test:e2e`
- `php artisan test`
- `php artisan migrate --pretend`

## Rollout Plan

### Milestone 1: Planning and Contracts

Deliver:
- curriculum map
- content metadata contract
- API design
- migration proposal

### Milestone 2: Backend Drill MVP

Deliver:
- drill catalog
- drill player API
- attempt/progress tracking
- Free/Silver/Gold access enforcement

### Milestone 3: Frontend Drill MVP

Deliver:
- backend-driven drill hub
- drill player
- progress summary
- gated content previews

### Milestone 4: Daily Challenge Tracks

Deliver:
- multiple daily tracks
- per-track leaderboards
- personalized default track
- tier-aware access

### Milestone 5: Unified Learning Dashboard

Deliver:
- My Path
- Lessons
- Drills
- Daily Challenge
- Progress

## Open Decisions

1. Should professional content be a Gold-only track or a future higher tier?
2. Should Free users have a fixed daily drill count or a weekly pool?
3. Should the tactical trainer remain separate visually or become the first Gold/advanced drill track?
4. Should daily challenges be selected by current skill band or by a separate daily challenge rating?
5. Should lesson content be fully database-seeded or managed later through an admin CMS?

## Recommended Next Step

Implement Milestone 1 in code-adjacent form:

1. Add formal skill-band constants on the backend.
2. Draft migration for backend training drill catalog and progress.
3. Build seed data for 10-15 high-quality MVP drills across Newcomer, Beginner, and Club Player.
4. Replace the frontend hard-coded training list with backend-driven data.

This gives Chess99 a visible improvement quickly while laying the foundation for the full learning system.
