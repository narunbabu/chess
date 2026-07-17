# Chess99 Android — Play Store Release Plan

> **⛔ UPLOAD ON HOLD (owner directive, 2026-07-14).** Do NOT submit to Play
> until the owner gives an explicit green signal. Release *mechanics* are ready
> (signed AAB, icons, screenshots, FB login), but a QUALITY GATE comes first:
> chess-piece rendering is low quality (Unicode glyphs, not real piece art),
> engine features are broken (no Stockfish binary), and the app must reach
> feature/quality parity with the web version before publishing. See
> `docs/android-quality-parity-plan.md`.

**Date**: 2026-07-14 (updated same day after Phase 1–3 execution)
**Status**: MECHANICS READY, PUBLISH BLOCKED ON QUALITY — decisions D1/D2/D3 made, code fixes done
**Source**: Play-readiness audit (debug APK valid; release AAB was blocked by 5 issues + missing store assets)

---

## Decisions (LOCKED 2026-07-14)

- **D1 — Payments**: Razorpay removed from Android v1. No purchase UI, no
  link-outs (Play anti-steering policy — see note below). Play Billing planned
  for v1.1. Subscriptions bought on web are reflected in-app automatically.
- **D2 — Facebook login**: KEEP — real App ID `1696238708465565` wired
  (same Meta app as web login). Client token still required (see Phase 2).
- **D3 — Target audience**: 13+, store listing targets **parents**, not
  children. Review `PLAY_STORE_LISTING.md` copy against this before submission.

**D1 policy note**: Google Play prohibits directing users to non-Play payment
methods for digital goods (including "buy on our website" links/buttons). The
compliant way to link out in India is the alternative-billing program, which
requires offering Play Billing side-by-side + alternative-billing API
integration — deferred. v1 ships with a neutral "purchases not available in
this app" notice only.

---

## Phase 1 — Code fixes ✅ DONE (2026-07-14)

1. ✅ R8 blocker: `-dontwarn org.slf4j.impl.StaticLoggerBinder` added to
   `proguard-rules.pro` (pusher-java-client / slf4j NOP fallback).
2. ✅ Lint release error gone (0 errors, 59 warnings): real lowercase FB scheme
   `fb1696238708465565` in `strings.xml`; removed redundant FacebookActivity label.
3. ✅ Razorpay fully removed: dependency, proguard rules, `RazorpayCheckout.kt`,
   `PricingScreen.kt` deleted; `PaymentApi`/`PaymentViewModel` trimmed to
   status/cancel/restore; `SubscriptionScreen` is status-only with a neutral
   availability notice; DailyChallenges locked-track card has no upgrade CTA;
   drawer entry is now "My Plan" → Subscription; `/pricing` deep link removed
   (stays in browser).
4. ✅ **NEW BLOCKER FOUND & FIXED**: release `API_BASE_URL`/`WS_HOST` pointed at
   `chess99.com`, which does NOT proxy `/api` (returns SPA HTML). Production
   API + Reverb live on `api.chess99.com`. Both corrected in `build.gradle.kts`.
5. ⬜ Unit tests (non-blocking): add ChessGame/AuthRepository tests post-launch.
6. ⬜ Remaining 59 lint warnings (non-blocking): mostly `GradleDependency`
   version bumps; consider a lint baseline later.

## Phase 2 — Secrets & signed build ✅ MOSTLY DONE

7. ✅ `WS_KEY_RELEASE=anrdh24nppf3obfupvqw` added to
   `C:\Users\ab\.gradle\gradle.properties` (prod Reverb key — same as dev key,
   already public in the web JS bundle).
8. ✅ Signed release artifacts build green with prod endpoints + WS key +
   branded icons: `app/build/outputs/bundle/release/app-release.aab` (9.9 MB)
   and `.../apk/release/app-release.apk` (5.0 MB). Rebuild AFTER the Facebook
   client token lands (step 9) before uploading to Play.
9. ⬜ **USER: Facebook client token** — Meta for Developers →
   app `1696238708465565` → Settings → Advanced → Security → **Client token**;
   paste into `strings.xml` `facebook_client_token`, rebuild.
10. ⬜ **USER: Facebook console Android platform** — Meta for Developers →
    Settings → Basic → Add Platform → Android:
    - Package name: `com.chess99.app`
    - Class name: `com.chess99.presentation.MainActivity`
    - Key hashes (add BOTH):
      - Release/upload key: `OYclIzYa6HVPhLR7i55AaUzNG8c=`
      - Debug key: `1d+9bDoIu3Jeda37kKGLepy9gjE=`
    - Enable "Single Sign On". Later add the **Play App Signing** key hash
      (Play Console → App integrity → convert SHA-1 to base64) after enrollment.

## Phase 3 — App Links / assetlinks.json 🔶 FILE READY, DEPLOY PENDING

11. ✅ Created `chess-frontend/public/.well-known/assetlinks.json` with the
    upload-key fingerprint
    `72:B3:BB:F1:81:72:6D:08:C7:CC:00:AE:0B:54:E1:C5:A8:53:53:EC:C3:96:EB:E1:72:3B:AF:A6:E0:F5:C6:1F`.
12. ⬜ **SMA: deploy frontend** (build copies `public/` → `/var/www/chess99.com/`).
    Verify: `curl -sI https://chess99.com/.well-known/assetlinks.json` →
    200 + `application/json`. Check the nginx vhost for `location ~ /\.` deny
    rules; add an allow for `/.well-known/` if needed.
13. ⬜ After Play App Signing enrollment: append the Play signing SHA-256 to
    `assetlinks.json` and redeploy. Also add Play signing SHA-1/SHA-256 to
    **Firebase project settings** (else Google Sign-In breaks for
    Play-delivered builds) and the key hash to Facebook console (see step 10).

## Phase 4 — Store assets 🔶 MOSTLY DONE

14. ✅ 512×512 icon: `chess99-android/play-store-assets/icon-512.png` (from
    `Promotions/images/logo.png`, the knight-shield brand tile).
15. ✅ 1024×500 feature graphic: `play-store-assets/feature-1024x500.png`
    (serviceable; replace with designer art when available).
16. ✅ BONUS: in-app launcher icon rebranded — the placeholder vector was a
    generic white glyph; now emblem foreground PNGs (mdpi–xxxhdpi) on navy
    `#1F2932` adaptive background. Generator: `chess99-android/scripts/gen_play_assets.py`.
17. ⬜ 3× 1080×1920 real screenshots (lobby, live game, learn/tactics) from
    emulator or device.

## Phase 5 — Play Console ⬜ USER + ASSISTED

17. User signs into Play Console; create app `com.chess99.app`; enroll in
    Play App Signing; upload AAB to Internal testing.
18. Declarations: Data Safety (email, name, user IDs, Firebase
    Analytics/Crashlytics device+crash data, Facebook login), content rating
    (chess, users can interact via chat), target audience 13+, app access
    (provide test creds), "no in-app purchases".
19. Optional for repeat uploads: Publisher API service account
    (`chess99-play-uploader`), JSON key at `C:\ArunApps\_credentials\`.

## Phase 6 — Verification & rollout ⬜ TODO

20. Install from Internal testing on a real device: email + Google + Facebook
    login, guest play, multiplayer over `api.chess99.com` WebSockets, deep
    links (`adb shell pm verify-app-links --re-verify com.chess99.app`), push
    notifications, subscription status for a premium account.
21. Internal → Closed testing (new personal Play accounts may require
    12 testers / 14 days) → Production.

---

## Key values reference

| Item | Value |
|------|-------|
| Package | `com.chess99.app` |
| Upload keystore | `C:/ArunApps/_keystores/chess99-upload.jks`, alias `chess99-upload` |
| Upload key SHA-1 | `39:87:25:23:36:1A:E8:75:4F:84:B4:7B:8B:9E:40:69:4C:CD:1B:C7` |
| Upload key SHA-256 | `72:B3:BB:F1:81:72:6D:08:C7:CC:00:AE:0B:54:E1:C5:A8:53:53:EC:C3:96:EB:E1:72:3B:AF:A6:E0:F5:C6:1F` |
| FB key hash (release) | `OYclIzYa6HVPhLR7i55AaUzNG8c=` |
| FB key hash (debug) | `1d+9bDoIu3Jeda37kKGLepy9gjE=` |
| Facebook App ID | `1696238708465565` |
| Prod API base | `https://api.chess99.com/api/v1/` |
| Prod WS | `api.chess99.com:443` TLS, key `anrdh24nppf3obfupvqw` |

## Estimated remaining timeline
Client token + store assets + Play Console setup: **~2 working days** to a
Production submission (excluding Google review and any closed-testing period).
