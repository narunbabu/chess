# Android phone-test readiness — 8 September 2026

## Scope and verdict

Owner requested a full native app equivalent to web, installable on a phone. This session fixes confirmed core blockers and prepares a production-endpoint **debug test APK**, not a Play release. Full control-level web parity remains incomplete. No production deployment, migrations or Play upload were performed.

## Implemented

- Persona game requests now preserve the explicitly selected White/Black colour.
- Custom/offline computer play cannot start as Rated. The setup explains that a named online opponent is required; a failed rated server request is blocked rather than silently producing an unrecorded local game.
- Local saved review JSON validates required fields inside the decode failure boundary, avoiding crashes on syntactically valid but incomplete records such as `{}`.
- Local computer game sounds now load actual bundled resources and play only after successful SoundPool loading. Assets were reused from the existing web sound directory.
- Multiplayer exposes legal-move accessibility controls through the real onMove callback, gated by turn/connection state.
- Multiplayer actions use readable 14sp labels and at least 48dp height, with a two-row casual layout rather than four compressed buttons.
- The realtime contract test now reads the game-channel events only; it previously threw while iterating presence schemas that have `pusher_events` instead of `events`.

## Verification log

- First resource build failed because sound resources were added after its resource-processing stage; the subsequent run resolved R.raw and compiled.
- First completed unit run: 235 tests, one failure in the contract-test schema traversal (234 passed). Fixed that traversal and added three selected-colour/rated-safety tests; updated the old local-rated undo expectation to the new explicit rejection contract.
- A later build was interrupted with the host task, before packaging. The old August 24 APK was not reused or presented as current.
- Final rerun: `:app:testDebugUnitTest :app:assembleDebug :app:lintDebug -PDEBUG_TARGET=prod --console=plain --max-workers=2` succeeded (exit 0, 16m13s). 238 tests / 0 failures / 0 errors; lint 0 errors, 12 warnings and 69 informational notices.
- Artifact: `chess99-android/chess99-1.0.0-phone-test-2026-09-08.apk`, 29,082,588 bytes. SHA-256 `F34363A0B3FF4E3E344DD04E803F36D4E92624CC4B0071F50E6258499059FC49`. APK signature v2 verifies, debug certificate SHA-1 `D5:DF:BD:6C:3A:08:BB:72:5E:75:AD:FB:90:A1:8B:7A:9C:BD:82:31`. Package `com.chess99.app`, version 1.0.0 (1), min SDK 26, target 36, arm64-v8a/armeabi-v7a/x86_64.
- Actual generated BuildConfig: HTTPS `api.chess99.com/api/v1/`, WebSocket `api.chess99.com:443`, TLS enabled.
- Public backend `/up` and website returned HTTP 200 earlier this session. Synthetic-player endpoint returned 401 without authentication; this is not an authenticated gameplay test.
- Initial Android 36.1 and Android 35 emulator attempts remained offline; tried software and host graphics, cold boot/no snapshot, and a reduced-core configuration. No device wipe. Only test emulator processes launched by this session were stopped. A post-build Android 15 retry came online: `adb install -r` succeeded and cold activity launch returned Status ok, showing the onboarding screen. UI dump retained at `chess99-android/review-artifacts/phone-test-ui.xml`. Native engine and final UI results are below; no physical phone or authenticated/two-client device verification yet.

## Remaining work and release gates

See `chess99-android/PHONE_TEST.md` for the user checklist. Known gaps include live multiplayer Review coaching, review lifeline markers, Nearby-opponent failure/empty handling, and possible post-login tab Back-stack accumulation. Many broader modules remain unaudited at control level.

Production Firebase placeholder, OAuth fingerprints, App Links and deployed backend parity require owner/release coordination. These are not fixed by producing a debug APK. Do not claim FCM, Crashlytics, Analytics, full parity, physical arm64 compatibility or Play readiness from a local build.

## Final exploratory-test gate

- `:app:connectedDebugAndroidTest -PDEBUG_TARGET=prod` passed all 9 native engine tests on Android 15 x86_64 (exit 0, 2m25s). The instrumentation runner removed its test-installed app on completion; the dated APK was reinstalled successfully for the final UI walkthrough.
- Final cold launch: Status ok, 2.4 seconds on this emulator. Onboarding → existing-account login → Play as Guest → choose Black → Start worked. Computer opened e4; accessible controls selected knight b8 then destination c6, applying Nc6; computer replied Nf3. Resign produced the result and Review opened all three moves. UI evidence and launch/review screenshots are under `chess99-android/review-artifacts/phone-test-*`.
- Fresh-context Sana source review found no new P0/P1 in the bounded fixes. Verdict: suitable for owner exploratory test APK only, not production or full-parity certification. Physical phone, live authenticated/two-client flows and release-owner configuration remain open.

MODELS: controller integration/build and critical repairs; same-session gpt-5.6-sol/high independent audit and bounded multiplayer-controls implementation; a separate fresh-context gpt-5.6-sol/high Sana verification after compile/unit gates.
