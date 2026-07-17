# Chess99 — Google Play Store Submission Pack

**Prepared:** 2026-07-10 · **Package:** `com.chess99.app` · **Target audience:** Ages 13+
**Signed AAB:** `app/build/outputs/bundle/release/app-release.aab` (built with the upload key;
Play App Signing will re-sign with Google's app key).

> This is everything needed to fill the Play Console. Items marked **[you provide]** need
> assets/decisions from you; everything else is ready to paste.

---

## 1. App details

| Field | Value |
|---|---|
| App name | **Chess99: Play & Learn Chess** (30 char max — adjust if you prefer) |
| Default language | English (India) — `en-IN` |
| App or game | **Game** → Category **Board** |
| Package name | `com.chess99.app` |
| Contact email | `support@chess99.com` |
| Website | `https://chess99.com` |
| Privacy policy URL | `https://chess99.com/privacy` |
| Terms URL | `https://chess99.com/terms` |

## 2. Short description (80 char max)

```
Play online chess, solve puzzles, join tournaments, and improve with real analysis.
```
(79 chars — tweak freely.)

## 3. Full description (4000 char max)

```
Chess99 is a complete online chess platform for players of every level — from first-move
beginners to seasoned competitors.

PLAY
• Real-time multiplayer chess against players around the world
• Play the computer at adjustable difficulty, from gentle to expert
• Casual and rated games with an Elo rating that grows as you improve

LEARN & IMPROVE
• Guided lessons and an interactive tutorial path
• Thousands of tactical puzzles across skill stages
• Candidate-move training (CCT) — a unique way to learn how to find the best move
• Game review with accuracy scores and move-by-move analysis

COMPETE
• Tournaments and championships with live standings
• Leaderboards for ratings, wins, and puzzle streaks
• Daily challenges and activity streaks to keep you sharp

SAFE & FRIENDLY
• Kid-safe chat controls with preset phrases for younger players
• Report and block tools
• Parents can link a child account and see weekly progress report cards

Create a free account with email, Google, or Facebook and start playing in seconds.

Play at chess99.com or on the go with the app — your rating, games, and progress stay in sync.
```

## 4. Graphics

| Asset | Spec | Status |
|---|---|---|
| App icon | 512×512 PNG, 32-bit | ✅ `play-store-assets/icon-512.png` (generated 2026-07-14) |
| Feature graphic | 1024×500 PNG/JPG | ✅ `play-store-assets/feature-1024x500.png` |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | **[you provide]** — capture from the app, see below |
| 7-inch tablet screenshots | optional but recommended | Improves tablet ranking |

The in-app launcher icon was also rebranded 2026-07-14 (knight-shield emblem,
adaptive icon, navy `#1F2932` background) — matches the Play icon.

**Suggested screenshots (capture on an emulator/device from the debug build):**
1. Live game board mid-play, 2. Puzzle/tactics screen, 3. Lessons/Learn hub,
4. Tournaments/leaderboard, 5. Game review with accuracy, 6. Parent/"My Kids" or profile.

## 5. Content rating questionnaire (IARC)

Answer the questionnaire as follows (chess app, moderated chat, no mature content):

- Violence / scary content / sexual content / profanity / drugs / gambling: **No** to all.
- **Does the app let users interact or exchange content?** **Yes** — in-game chat (moderated,
  with kid-safe preset mode, report & block).
- **Can users share their location with other users?** **No.**
- **Digital purchases?** **No** — the app contains no in-app purchases as of v1
  (Razorpay was removed 2026-07-14 for Play policy compliance; Play Billing planned v1.1).
- Expected rating: **Everyone / PEGI 3** with an "Users interact" interactive-elements label.

## 6. Data Safety form

**Data collected & linked to the user:**
- **Personal info:** Name, Email address, Phone number (optional — tournaments). Purpose:
  App functionality, Account management.
- **App activity:** In-app actions (games, puzzles, lessons), search history within app.
  Purpose: App functionality, Analytics.
- **App info & performance:** Crash logs, diagnostics (Firebase Crashlytics / Sentry).
  Purpose: App functionality, Analytics.
- **Device or other IDs:** Purpose: Analytics (Firebase Analytics / Google Analytics) and
  login (Facebook Login SDK collects device identifiers when used).

(No Financial info — the app contains no in-app purchases in v1.)

**Answers to the standard questions:**
- Is all collected data **encrypted in transit**? **Yes** (HTTPS / secure WebSocket).
- Do you provide a way for users to **request data deletion**? **Yes** — in-app account
  deletion and/or email `support@chess99.com`.
- Is data **shared** with third parties? **Yes** — Google (analytics/crash), Meta
  (Facebook Login SDK). Only as needed for those functions.

**Contains ads?** **No** (the app shows no in-app advertising; the Meta Pixel runs only on
the website, not in the app).

## 7. Target audience & content

- **Target age group:** 13–15, 16–17, 18+ (i.e. **13 and over**).
- **Appeals to children?** No (declared 13+). This keeps the app out of the Play Families
  program for now — revisit "Designed for Families" once P0-3 age/consent is fully in prod.
- **Ads suitable for children?** N/A (no ads in app).

## 8. App access (for review)

Google's reviewers need to reach logged-in features. Provide a **demo account**:
- Email: `ab@ameyem.com` / password: (the test password) — or create a dedicated
  `playreview@chess99.com` reviewer account. Add it under **App access → All functionality
  is restricted → add credentials** so reviewers don't get stuck at login.

## 9. Release notes (What's new)

```
First release of the Chess99 app: online multiplayer, play vs computer, tactics puzzles,
lessons, tournaments, game review, and parent progress reports.
```

---

## 10. Upload runbook

1. **Play Console → Create app** → name, default language `en-IN`, App = Game, Free.
2. Accept declarations (Developer Program Policies, US export laws).
3. **Set up → App content:** fill Privacy policy, Data safety (§6), Content rating (§5),
   Target audience (§7), Ads (No), News app (No), plus Government/Health (No).
4. **Enroll in Play App Signing** (default for new apps) — Google holds the app signing key;
   our keystore is only the *upload* key (resettable if ever lost). Recommended: keep it on.
5. **Testing → Internal testing → Create release** → upload `app-release.aab` → add yourself +
   1–2 testers → roll out. Install via the opt-in link; smoke-test login, a game, a puzzle,
   the My Plan (subscription status) screen.
6. After a clean internal test, promote to **Closed testing** (optional) then **Production**.
7. Production review typically takes a few days for a first submission.

## 11. Keystore — CRITICAL

- Upload key: `C:\ArunApps\_keystores\chess99-upload.jks`, alias `chess99-upload`.
- **Back it up off-machine** (password manager + encrypted cloud). With Play App Signing the
  upload key is resettable via Google support, but treat it as irreplaceable.
- Password is stored in the gitignored `chess99-android/keystore.properties` (never committed).
- To bump versions for future releases: raise `versionCode` (and `versionName`) in
  `app/build.gradle.kts`, then rebuild with `gradlew :app:bundleRelease`
  (`WS_KEY_RELEASE` is already set in `C:\Users\ab\.gradle\gradle.properties`).
