# Android dependency upgrade decision — 2026-08-21

**Module:** `chess99-android`
**Scope of change:** `gradle/libs.versions.toml`, `app/build.gradle.kts` (`lint { }` block only)
**Decision owner:** unattended maintenance run, pending human review

## Summary

`:app:lintDebug` reported **72 warnings / 0 errors**. Sixty-six of those were purely
informational "a newer version is available" notices (63 `GradleDependency`,
3 `AndroidGradlePluginVersion`), which meant the six findings that are actually about
this app's code were invisible. The problem was signal-to-noise, not staleness.

**Three low-risk bumps were taken. Every other upgrade is deferred to after the 1.0
release.** The two upgrade-availability checks are demoted to informational severity so
lint is useful again.

Result: **0 errors, 6 warnings** (from 72). All 6 are real code findings — see
[Newly visible findings](#newly-visible-findings-the-point-of-the-exercise).

The guiding fact: this build is otherwise ready to ship and is blocked only on an
owner-supplied production `google-services.json` (`verifyReleaseConfiguration` in
`app/build.gradle.kts` gates release builds until it lands). Absorbing toolchain risk
into a build that is waiting on a third party buys nothing and can cost the release.

---

## The three-bucket table

Versions are read off `app/build/reports/lint-results-debug.xml`. "Available" is what
lint pointed at on 2026-08-21.

### Bucket 1 — Safe patch/minor, applied now

| Dependency | Pinned | Available | Taken | Reason |
|---|---|---|---|---|
| `androidx.security:security-crypto` | 1.1.0-alpha06 | 1.1.0 | **1.1.0** | Alpha → stable of the *same* version number. `TokenManager.kt` uses only `MasterKey.Builder` + `EncryptedSharedPreferences.create`, whose signatures are identical across the two, and the on-disk encryption format is unchanged so existing installs keep reading their tokens. Shipping an alpha crypto library in a 1.0 release is the larger risk. **Tradeoff, accepted knowingly:** Jetpack Security Crypto is deprecated as of 1.1.0 stable, so this surfaces a new `kotlinc` deprecation warning in `TokenManager.kt:16`. That deprecation is true at every version — the alpha pin was hiding it, not avoiding it. Follow-up TODO logged in `STATUS.md`. |
| `androidx.test.ext:junit` | 1.2.1 | 1.3.0 | **1.3.0** | `androidTest`-only; never linked into the shipped APK, so production risk is zero. Same major, requires compileSdk 35+ (this module is on 36). Verified by compiling `:app:assembleDebugAndroidTest`. |
| `androidx.test.espresso:espresso-core` | 3.6.1 | 3.7.0 | **3.7.0** | Same as above — `androidTest`-only, same major, compiles clean. Moves in lockstep with `androidx.test.ext:junit`. |

### Bucket 2 — Deferred until after the 1.0 release

The rule applied: **AGP, the Gradle wrapper, Kotlin, KSP and the Compose BOM move
together or not at all.** Anything that touches one of them, crosses a major version, or
changes an artifact's module structure lands here.

| Dependency | Pinned | Available | Reason for deferral |
|---|---|---|---|
| `com.android.application` (AGP) | 8.9.1 | 9.3.1 (or 8.9.3) | Major jump drags the Gradle wrapper, the Kotlin plugin and KSP with it. Even the 8.9.3 patch is deferred: AGP is in the coupled set, so it does not move alone. |
| Gradle wrapper | 8.11.1 | — (implied by AGP 9.x) | Only moves as part of the AGP upgrade. Not flagged independently by lint. |
| `androidx.compose:compose-bom` | 2024.12.01 | 2026.08.00 | A BOM bump silently moves dozens of artifact versions at once. Counts as a major move regardless of how its own date-shaped version reads. Also pins the Compose compiler expectations against the Kotlin plugin. |
| `androidx.activity:activity-compose` | 1.9.3 | 1.13.0 | Four minors, and tightly coupled to the Compose BOM and lifecycle. Moves with Compose. |
| `androidx.lifecycle:*` (runtime-ktx, viewmodel-compose, runtime-compose) | 2.8.7 | 2.11.0 | 2.9+ restructured into KMP artifacts and raises the Compose runtime floor. Moves with Compose. |
| `androidx.navigation:navigation-compose` | 2.8.5 | 2.9.8 | 2.9 requires lifecycle 2.9+ and changes type-safe-navigation serialization behaviour. Moves with Compose/lifecycle. |
| `androidx.core:core-ktx` | 1.15.0 | 1.19.0 | Same major and superficially tempting, but it raises the transitive floor for `androidx.core`/annotation/collection across every other AndroidX dependency, which is exactly the interaction the deferred set is meant to contain. Take it with the AndroidX sweep, not before. |
| `androidx.room:*` (runtime, ktx, compiler) | 2.6.1 | 2.8.4 | 2.7+ restructured Room into KMP artifacts (`room-runtime` → platform-split) and changes KSP expectations. A migration, not a bump. |
| `androidx.datastore:datastore-preferences` | 1.1.1 | 1.2.1 | 1.2 moved to a KMP/okio-based artifact layout. Structural, not a patch. |
| `androidx.hilt:hilt-navigation-compose` | 1.2.0 | 1.4.0 | Sits on the Hilt *and* Compose/navigation seams simultaneously. Moves with Compose. |
| `androidx.credentials:credentials` + `:credentials-play-services-auth` | 1.5.0-rc01 | 1.6.0 | Deferred for a different reason than the rest: this is the live Google Sign-In path, and it cannot be verified by any gate available here (needs a real device *and* the production `google-services.json` that the release is already blocked on). It also interacts with the open `CredentialManagerSignInWithGoogle` lint warning — bump and migration should be done together, on a device, in one sitting. **Note for whoever takes it:** an rc pin in a 1.0 release is worth removing; check whether a plain `1.5.0` stable exists as a minimal pre-release hardening step before jumping to 1.6.0. |
| `com.facebook.android:facebook-login` | 17.0.2 | 18.3.0 | Major version. SDK 18 changes the Login API surface and platform requirements. |

### Bucket 3 — Deliberately pinned

| Dependency | Pinned | Available | Purpose of the pin |
|---|---|---|---|
| `com.google.firebase:firebase-bom` | 33.7.0 | 34.18.0 | Held **as a set** with the two plugins below until the production `google-services.json` arrives. That file is generated by the Firebase console and is parsed by the `google-services` plugin; moving the plugin while the config is still a placeholder means debugging two unknowns at once on the day the real file lands. Unpin the whole set *after* a real config is verified working, not before. |
| `com.google.gms.google-services` | 4.4.2 | 4.5.0 | Same set as above. |
| `com.google.firebase.crashlytics` | 3.0.2 | 3.0.8 | Same set as above. A 3.0.x patch in isolation would be harmless, but splitting the set defeats the purpose of the pin. |
| `kotlin` / `ksp` | 2.1.0 / 2.1.0-1.0.29 | not flagged by lint | The KSP version string embeds its Kotlin version. These two are *required* to match exactly and can never move independently. |
| `pusher-java-client`, `retrofit`, `okhttp`, `coil`, `mockk`, `turbine`, `timber`, `kotlinx-coroutines`, `kotlinx-serialization`, `junit`, `googleIdentity` | — | **not flagged** | Lint's `GradleDependency` check only consults a curated set of (mostly AndroidX/Google) coordinates. Lint raised no notice for any of these, so there is nothing to decide here. Their currency is unknown from this report and is *not* asserted by this document. |

---

## What actually changed

`gradle/libs.versions.toml` — three lines:

```diff
-securityCrypto = "1.1.0-alpha06"
+securityCrypto = "1.1.0"
-junitExt = "1.2.1"
+junitExt = "1.3.0"
-espressoCore = "3.6.1"
+espressoCore = "3.7.0"
```

`app/build.gradle.kts` — a new `lint { }` block inside `android { }`:

```kotlin
lint {
    informational += setOf("GradleDependency", "AndroidGradlePluginVersion")
}
```

`abortOnError` is untouched (keeps its default of `true`) and no other check's severity
is altered. The upgrade notices are **demoted, not disabled** — all 57 remain in
`app/build/reports/lint-results-debug.{html,xml}` at `severity="Information"`, so this
table can be regenerated at any time without reverting the block.

`ModifierParameter` and `CredentialManagerSignInWithGoogle` were deliberately left at
warning severity: they are findings about this app's code, not version notices.

### Verification

| Gate | Before | After |
|---|---|---|
| `:app:lintDebug` | 0 errors, **72 warnings** | 0 errors, **6 warnings** |
| `:app:testDebugUnitTest` | 187 tests, 0 failures | **187 tests, 0 failures** |
| `:app:assembleDebug` | success | **success** |
| `:app:assembleDebugAndroidTest` | success | **success** (run because two bumps are androidTest-only) |

---

## Newly visible findings (the point of the exercise)

These six were always present and always drowned out. None is fixed here — this job
changed build configuration and documentation only — but they are now the entire lint
output, so the next new warning will be obvious.

| Check | Location |
|---|---|
| `CredentialManagerSignInWithGoogle` | `presentation/auth/GoogleSignInHelper.kt:57` — uses `:googleid` classes without `GoogleIdTokenCredential`; pairs with the deferred `androidx.credentials` bump |
| `ModifierParameter` | `presentation/common/ChessBoardView.kt:72` |
| `ModifierParameter` | `presentation/common/GameTimerDisplay.kt:79` |
| `ModifierParameter` | `presentation/common/UpgradePromptCard.kt:24` |
| `ModifierParameter` | `presentation/history/GameHistoryScreen.kt:548` |
| `ModifierParameter` | `presentation/history/MoveAnalysisUi.kt:94` |

---

## Trigger that reopens the deferred bucket

> **The first release build shipping to the Play internal track.**

Once a real build is on the internal track there is a rollback path and a tester
audience, so toolchain risk becomes affordable. Until then the deferred bucket stays
shut. Practically this means the deferred work starts only after the owner-supplied
production `google-services.json` lands and `verifyReleaseConfiguration` passes.

When that happens, remove the `lint { }` block from `app/build.gradle.kts` first — it
exists to keep a *shipping* build readable, and during an upgrade sweep the upgrade
notices are exactly what you want to see.

## Sequence for the deferred AGP / Gradle / Kotlin / KSP / Compose upgrade

Do not batch these. Each step is its own commit with green gates, so a bisect points at
one variable. Re-run a configuration-touching task after **every** edit to
`libs.versions.toml` — a typo there fails the configuration phase before any useful
error is printed.

1. **Gradle wrapper first.** `./gradlew wrapper --gradle-version <x>` and run it twice
   (the first run rewrites the wrapper; the second runs *under* the new one). The
   wrapper must satisfy the target AGP's minimum before AGP moves. Gate: `assembleDebug`.
2. **AGP second.** `agp = "…"` in `libs.versions.toml`. Read the AGP upgrade notes for
   removed DSL — this module uses `kotlinOptions`, `packaging.jniLibs.useLegacyPackaging`
   and `buildFeatures.buildConfig`, all of which have moved or been deprecated across
   AGP majors, plus a custom `verifyReleaseConfiguration` task wired via `afterEvaluate`
   into `preReleaseBuild`. Consider AGP's own `AGP Upgrade Assistant` output as advisory
   only. Gate: `assembleDebug` **and** `assembleRelease` if a real `google-services.json`
   is available by then.
3. **Kotlin and KSP together, never apart.** `kotlin = "2.x.y"` and
   `ksp = "2.x.y-1.0.z"` where the KSP prefix *equals* the Kotlin version exactly. A
   mismatch fails at configuration time with a message that does not name the cause.
   Gate: `testDebugUnitTest` (KSP generates Hilt and Room code — a KSP problem shows up
   as missing generated symbols, not as a KSP error).
4. **Compose BOM fourth**, once the Kotlin plugin is settled — the Compose compiler ships
   with the Kotlin plugin (`kotlin-compose`), so the BOM must follow Kotlin, not lead it.
   Gate: `assembleDebug` plus a manual smoke of the board and game screens; BOM moves
   change Material3 defaults in ways no unit test catches.
5. **The rest of AndroidX after that** — `core-ktx`, `lifecycle`, `activity-compose`,
   `navigation-compose`, `hilt-navigation-compose` — in that order, since each later one
   depends on the floors set by the earlier ones.
6. **Room and DataStore separately**, each as its own migration commit; both changed
   artifact structure and neither is a version bump in the ordinary sense.
7. **The Firebase set last and as one commit** — `firebase-bom`, `google-services`,
   `firebase-crashlytics` — and only against a verified real `google-services.json`.
8. **`androidx.credentials` on a physical device**, together with resolving
   `CredentialManagerSignInWithGoogle`. No emulator, no CI gate, covers this path.
9. **Restore or delete the `lint { }` block** depending on how much of the deferred
   bucket was actually taken.
