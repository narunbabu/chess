# Android phone-test readiness

Owner request: check whether the full Android app equivalent to web is ready to install and test on a mobile; fix gaps blocking that outcome.

Routing: controller owns integration/build/APK and narrowly scoped critical repairs; independent Sol/high A-plan audit uses the same-session lane. CLI probe timed out after 40 seconds; it is not evidence that the same-session lane is unavailable. Quota snapshot: Codex weekly 48% used. Z.AI HTTP-200/body-404 result is invalid quota evidence. AppProduction protocol and prior approved experience delta-spec apply.

Must: complete Android compile/unit/lint; repair failures; build a signed installable debug APK with DEBUG_TARGET=prod (not emulator loopback); inspect package, SDK, ABIs, signature and actual compiled endpoints; exercise local startup/game/review on an available emulator; provide exact artifact and phone test checklist. Preserve dirty user work, existing accounts and devices. Never wipe a device or uninstall its existing app to bypass signing conflicts.

Should: close demonstrable core-control parity gaps and current critical lifecycle regressions. Audit controls, not just route presence. Distinguish working native features, web-only features, unverified flows and owner/backend configuration dependencies.

Won't: publish to Play, deploy production/backend, change account credentials, charge payments, run migrations, replace Firebase/OAuth configuration without verified owner configuration, or claim complete web parity from build success.

Verification: capture actual task exit codes, fresh APK metadata/hash, emulator install/launch and engine results if available. Physical arm64, notifications, Google OAuth and two-client multiplayer need actual device/backend validation; an unsigned/stale/emulator-only APK is not a phone-ready deliverable. Update STATUS and record any remaining blocker rather than mislabel the APK full parity.
