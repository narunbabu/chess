# Chess99 Android phone test — 8 September 2026

This is a native Android test build, not a Play release or a certification of complete web parity. It connects to the live Chess99 account/game service. Use Casual games for initial testing; actions on signed-in accounts affect the live service.

## Install

1. Copy `chess99-1.0.0-phone-test-2026-09-08.apk` supplied with the handoff to an Android 8.0+ phone.
2. Open it in Files and allow installation from that source if Android asks. Turn that permission off again afterwards.
3. Keep the existing app/data. If Android reports a conflicting signature, stop and report the message; do not uninstall to work around it because that can erase local data.

A USB-connected phone with USB debugging enabled can be installed with `adb install -r <apk>`. Choose the specific device with `adb -s <serial>` when several devices are connected.

## Test checklist

- Open the app, complete onboarding, and try Play Computer without signing in if the entry flow offers it.
- Play Casual as White, then Black; confirm the computer opens when you choose Black.
- Try Learning, Best move, Undo, resign, and the local game review; close/reopen the app and reopen that saved review.
- Try TalkBack legal-move controls and promotion selection. Check labels at a larger system font size.
- Sign in with your existing account. Test Play / Learn / Compete / You, history, profile, puzzles and lessons.
- Start a Casual online game with a second tester. Test moves, draw/undo, leaving/resuming, and disconnect/reconnect.
- Sign out, restart, and confirm private screens require signing in again.
- Send the screen name, steps, screenshot, phone model/Android version and whether Wi-Fi/mobile data was in use for any issue. Do not include passwords or authentication tokens.

## Known limits to verify before a release

- No physical arm64 phone verification has been completed in this session.
- Native multiplayer live Review coaching and review lifeline/help markers do not yet match web. Broader module parity is not certified.
- Nearby-opponent failure/empty handling and post-login tab Back-stack behavior need follow-up.
- Production Firebase is still a placeholder; push notifications, Crashlytics and Analytics, and the Play release configuration gate are not ready.
- Google OAuth fingerprints, verified App Links and deployed backend parity require owner/release verification. No backend deployment or Play upload was performed for this build.
- Custom/offline computer games are not rated. Rated persona games require successful server creation; failed requests cannot silently become local rated games.

## Build provenance

Command: `./gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:lintDebug -PDEBUG_TARGET=prod --console=plain --max-workers=2`

Bundled move/check/capture/game-end audio reuses this repository's existing `chess-frontend/src/assets/sounds` files; no generated or externally downloaded audio was added. Final gate results and APK checksum are recorded in the dated update report.
