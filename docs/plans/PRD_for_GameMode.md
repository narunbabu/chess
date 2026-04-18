
# 📘 Product Requirement Document (PRD)

## Product Name



**Chess99 – Game Modes, Rating & Draw System**

## Version

**v1.0**

## Status

Approved for implementation

## Owner

Chess99 Product Team

## Target Users

* Primary: Kids & youth (6–18 years)
* Secondary: Casual & competitive adult players
* Tertiary: Tournament participants

---

## 1. Purpose & Vision

Chess99 aims to create a **safe, educational, and competitive chess environment** where:

* Improvement matters more than just winning
* Good play is rewarded even in losses
* Decision-making (fight vs draw) is consciously learned
* Kids are encouraged, not demoralized

This PRD defines:

* Game modes
* Rating logic
* Performance-based scoring
* Strategic draw mechanics
* Scope for computer and multiplayer games

---

## 2. Goals & Success Metrics

### Business Goals

* Increase daily active users (DAU)
* Improve retention of beginner players
* Encourage repeat play vs computer
* Prepare robust foundation for tournaments

### Product Success Metrics

* ≥70% completion rate for computer games
* ≥60% users replay within 7 days
* Reduced rage-quit/resign frequency
* Positive parent feedback on fairness & learning

---

## 3. Game Modes Overview

Chess99 supports **two primary modes** across **two contexts**.

### Contexts

1. Play vs Computer
2. Multiplayer (Peer vs Peer)

### Modes Matrix

| Mode   | Computer | Multiplayer |
| ------ | -------- | ----------- |
| Rated  | ✅ Yes    | ✅ Phase-2   |
| Casual | ✅ Yes    | ✅ Yes       |

---

## 4. Mode Definitions

### 4.1 Rated Mode (Competitive)

**Objective:**
Measure player strength using **result + quality of play**, not just outcome.

**Key Characteristics**

* Rating changes enabled
* Performance-based adjustment
* Draw outcomes are asymmetric (risk/reward)

**User Visibility**

* Rating change (+ / −)
* Accuracy %
* Blunders & mistakes
* Performance feedback message

---

### 4.2 Casual Mode (Practice)

**Objective:**
Allow experimentation and learning without fear.

**Rules**

* No rating change
* XP & achievements allowed
* Draw/resign always permitted
* Analysis always available

**UI Label**

> “Practice Mode – No Rating Impact”

---

## 5. Performance Evaluation System

### 5.1 Core Philosophy

* A **good loss** should feel rewarding
* A **careless win** should not inflate rating
* Encourage thinking, not grinding

---

### 5.2 Performance Metrics

#### Engine-Based (Primary)

| Metric            | Description                    |
| ----------------- | ------------------------------ |
| Move Accuracy (%) | Closeness to engine best moves |
| Blunders          | Evaluation drop > 2.0          |
| Mistakes          | Evaluation drop 0.7–2.0        |
| Inaccuracies      | Evaluation drop 0.3–0.7        |
| ACPL              | Average centipawn loss         |

#### Time Management (Secondary)

* Time trouble errors (light penalty)
* Flag loss (partial penalty only)

> Time must **never dominate quality** scoring.

---

## 6. Performance Score (PS)

Each game produces a **Performance Score (0–100)**.

### Formula

```
PS =
(Accuracy × 0.55)
+ (100 − Blunders × 15)
+ (100 − Mistakes × 7)
+ (TimeScore × 0.10)
```

### Interpretation

| PS     | Meaning           |
| ------ | ----------------- |
| 85–100 | Excellent         |
| 70–84  | Strong            |
| 50–69  | Average           |
| <50    | Needs improvement |

---

## 7. Rating Calculation Logic

### 7.1 Base Rating Change

Uses Elo-style expectation:

```
BaseDelta = K × (Result − ExpectedScore)
```

| Player Rating | K Factor |
| ------------- | -------- |
| <1000         | 32       |
| 1000–1600     | 24       |
| >1600         | 16       |

---

### 7.2 Performance Modifier

```
FinalRatingChange = BaseDelta × (0.5 + PS / 100)
```

**Effect**

* Strong play amplifies gain or softens loss
* Weak play limits gain even after win

---

## 8. Draw Button – Strategic Risk/Reward

### 8.1 Design Intent

Teach:

* When to push for a win
* When a draw is success
* Strategic decision-making

This is a **differentiator for Chess99**.

---

### 8.2 Position Evaluation

Primary:

* Engine evaluation (centipawns)

Fallback:

* Material balance
* King safety
* Pawn structure

| Eval         | Meaning          |
| ------------ | ---------------- |
| > +1.0       | Player is better |
| −1.0 to +1.0 | Equal            |
| < −1.0       | Player is worse  |

---

### 8.3 Draw Outcome Rules (Rated Mode)

| Situation                    | Effect         |
| ---------------------------- | -------------- |
| Better position accepts draw | Rating penalty |
| Worse position accepts draw  | Rating gain    |
| Equal position               | Minor ±        |
| Draw declined                | No effect      |

---

## 9. Scope by Context

### 9.1 Play vs Computer (Phase-1)

| Feature             | Status |
| ------------------- | ------ |
| Rated games         | ✅      |
| Casual games        | ✅      |
| Performance scoring | ✅ Full |
| Draw logic          | ✅      |
| Abuse risk          | Low    |

**This is the primary onboarding mode for kids.**

---

### 9.2 Multiplayer (Phase-2)

| Feature             | Handling          |
| ------------------- | ----------------- |
| Rated multiplayer   | Limited           |
| Casual multiplayer  | Always allowed    |
| Draw                | Mutual acceptance |
| Performance scoring | Simplified        |
| Anti-abuse          | Mandatory         |

**Safeguards**

* Minimum moves before draw
* Daily rating cap
* Reduced gain vs repeated opponents
* IP/device similarity checks
* Tournament-specific overrides

---

## 10. Additional Computer Game Modes (Roadmap)

### Competitive

* Bullet / Blitz / Rapid

### Learning

* Puzzle Rush
* Best-Move Challenge
* Mistake Finder

### Structured Practice

* Opening Trainer
* Endgame Scenarios
* “Win from this position”

---

## 11. UX & Messaging Guidelines

### Prohibited Language

❌ “You played badly”
❌ “Heavy loss”

### Encouraged Messaging

✅ “Great defense under pressure”
✅ “Accuracy improved from last game”
✅ “Good draw from a difficult position”

**Tone:** Supportive, encouraging, educational

---

## 12. Data & Analytics

### New / Extended Tables

* `game_performance`
* `rating_changes`
* `engine_evaluations`
* `draw_events`

Each game stores:

* Accuracy
* Mistakes
* PS
* Rating delta
* Draw decision context

---

## 13. Rollout Plan

### Phase 1 (Immediate)

* Rated vs Computer
* Casual vs Computer
* Performance-based rating
* Strategic draw logic

### Phase 2

* Rated multiplayer (limited)
* Safeguards active
* Parent controls

### Phase 3

* Tournament-specific rating rules
* AI-driven learning feedback

---

## 14. Risks & Mitigation

| Risk                  | Mitigation                  |
| --------------------- | --------------------------- |
| Rating abuse          | Caps & repetition dampening |
| Kids frustration      | Soft penalties & feedback   |
| Engine cost           | Cached analysis             |
| Multiplayer collusion | IP/device heuristics        |

---

## 15. Out of Scope (v1)

* Money-based wagering
* Public chat moderation
* Coach marketplace



============================================

