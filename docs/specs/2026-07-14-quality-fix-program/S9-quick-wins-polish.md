# S9 — Quick-wins polish bundle (P1/P2, Android)

18 small, independent fixes. Each cites the review finding + exact location.
Verify line numbers before editing. Items 6–8 reuse S3's empty-state/error
patterns if S3 is merged; otherwise implement standalone. Work top to bottom.

## Items

### 1. Birthday: format + DatePicker (P1 — safety-relevant field)
`presentation/profile/ProfileScreen.kt:249`. Today renders raw
`1981-06-06T18:30:00.000000Z` in a free-text field labeled "(YYYY-MM-DD)" —
and this field gates chat kid-safety. Fix: parse ISO (`Instant.parse` →
device zone), display "6 Jun 1981"; replace the text field with a read-only
field that opens `DatePickerDialog` (M3); submit as `yyyy-MM-dd`. Reject
future dates.

### 2. Raw enum leak: "Format: swiss_only" (P1)
`presentation/championship/ChampionshipInvitationsScreen.kt:105`. Add
`fun formatLabel(raw: String): String` mapping `swiss_only`→"Swiss",
`round_robin`→"Round Robin", `knockout`→"Knockout", else
`raw.replace('_',' ').replaceFirstChar { it.uppercase() }`.

### 3. Dangling "Invited by " (P1)
Same file, line 111. Hide the row entirely when the inviter name is
null/blank.

### 4. "Class / Grade (1-12)" shows "Working Professional" (P2)
`ProfileScreen.kt` — the class/grade dropdown's option list or value mapping is
crossed with an occupation list. Find the field, fix the option source so
label and values agree (grades 1–12 + "Other").

### 5. Remove the red "0 online" badge (P1)
`presentation/lobby/LobbyScreen.kt` title area. Delete the online-count badge
entirely (never advertise liquidity). Keep the presence subscription code —
S10 reuses it.

### 6. Lobby Players empty state → rescue CTA (P1)
Same screen, Players tab empty state: icon + "No players online right now" +
two buttons: "Solve a puzzle" → `Screen.TacticalTrainer.route`, "Play the
computer" → `Screen.PlayComputer.route`.

### 7. Organizations empty state (P2)
`presentation/profile/OrganizationsScreen.kt`: icon (Icons.Default.Groups) +
"Find your school or chess club" + keep search focused. Also fix the wrapping
search placeholder (shorten to "Search organizations").

### 8. Friends empty state invite CTA (P2)
Lobby Friends tab: add "Invite a friend" button reusing the share intent the
Leaderboard invite CTA uses (find it in `presentation/leaderboard/`).

### 9. Referral link: wrong path + code-less render (P1)
`presentation/referral/ReferralViewModel.kt:~50`: builds
`https://chess99.com/join/$code` — the canonical web route is
**`https://chess99.com/r/$code`** (`chess-frontend/src/App.js:178`). Fix the
path. Ambassador screen (`presentation/referral/` or `presentation/ambassador/`
— find where "Your referral link" renders as bare `https://chess99.com`,
screenshot `14`): never render the link row until the code is non-null; disable
Copy/Share while null.

### 10. Adult-gate the Ambassador program (P1 — kids app policy)
A commission-earning program must not be surfaced to children. Gate: hide the
"Ambassador" drawer entry unless the account is an adult (birthday ≥18y —
reuse the profile birthday; if birthday missing/unparseable → hide) OR
`ambassadorStatus != null` (already-enrolled users keep access). Apply the
same guard inside `AmbassadorDashboardScreen` in case of deep links (show
"Ask a parent to visit chess99.com/ambassador" instead).

### 11. Transparent logo asset (P2)
The hero/auth logo renders as an opaque dark square tile (screenshots `01`,
`51`). Regenerate with alpha: extend `chess99-android/scripts/gen_play_assets.py`
(run via `powershell.exe -Command "conda run -n torch128 python …"`) to export
`app/src/main/res/drawable-nodpi/logo_transparent.png` from the source logo
(`Promotions/images/logo.png`) — if the source has no alpha, mask the dark
chessboard background to transparent (it's a flat dark color; chroma-key it).
Swap `HomeScreen.kt` hero + drawer header + `LoginScreen.kt` to the new asset;
also add end-padding so the hero tagline no longer touches the image.

### 12. Leaderboard: own-row highlight + tab clipping (P2)
`presentation/leaderboard/LeaderboardScreen.kt`: (a) highlight the signed-in
user's row (`primaryContainer` background + "You" chip) — compare row user id
with the session user id; (b) the 4th tab clips at the edge → use
`ScrollableTabRow` or shorten labels.

### 13. Daily locked-track selection mismatch (P1)
`presentation/daily/DailyChallengesScreen.kt`: tapping a locked track
highlights the tab but content still shows Daily Starter (screenshot `09`).
Make locked tabs non-selectable; on tap show a snackbar: "Solve 5 Starter
challenges to unlock." (pull the real unlock rule from the API response if
present — `available_tracks` in the daily-challenge payload).

### 14. Championships default view rescue (P1)
`presentation/championship/ChampionshipListScreen.kt`: "All" shows "No
tournaments found" on prod while an invitation exists (screenshots `05`/`06`).
(a) Include invited/recently-finished events in the default query if the API
supports a status param (check `ChampionshipApi`); (b) enrich the empty state:
"No open tournaments right now — try today's Daily Challenge" + button.

### 15. Stage-card text truncation (P2)
`presentation/learn/tactical/TacticalTrainerDashboardScreen.kt`: descriptions
cut mid-word ("and re…"). Set `maxLines = 2, overflow = TextOverflow.Ellipsis`
(or 3) on the description Text.

### 16. Back from puzzle skips the Tactical dashboard (P2)
Review §3.21: system back from a puzzle exits to Learn, skipping the
dashboard. Make back from puzzle-solving return to the Tactical dashboard
(pop within the trainer's internal phase state instead of popping the route —
see how `TacticalTrainerViewModel` models phases).

### 17. Explore/board naming dedupe (P2)
Home Explore tile "Puzzles" routes to Tactical Trainer while Learn→Training
lists "Tactics Trainer" (after S5's merge). Rename the Explore tile label to
**"Tactics"** or "Puzzles" consistently with S5's chosen name — one name
app-wide.

### 18. WebView chrome (SKIP if S4 merged)
Only if S4 hasn't landed: hide site header/footer inside WebViews via injected
CSS. Prefer letting S4 remove the WebViews entirely.

## Acceptance criteria

Per item: the described behavior verified on the RELEASE build with a
screenshot `review-artifacts/fix-S9-<item#>.png`. Bundle gate:
`gradlew.bat compileReleaseKotlin lintRelease` green (0 errors), and a summary
table item# → done/skipped(reason) in the completion report.
