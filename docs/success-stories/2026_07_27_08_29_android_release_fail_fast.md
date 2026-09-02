# Android 1.0: turning silent production failures into release gates

## Symptom

The minified release APK built successfully even though Firebase was a
placeholder and Google Sign-In had no server client ID. Those failures would
only appear at runtime, after FCM, Crashlytics, Analytics and the first-screen
Google button had already failed users or a Play reviewer.

Native email registration had a second hidden boundary mismatch: the Android
client cannot execute the web reCAPTCHA widget, but the shared controller
required its token for both web and native routes.

## Root cause

The build validated file syntax, not production semantics. Google Sign-In used
reflection and an empty-string fallback, so the compiler could not reveal the
missing field. The registration controller did not distinguish its
rate-limited native endpoint from the browser endpoint.

## Fix

- Added typed Google OAuth BuildConfig fields and hid the button when the
  feature is not configured.
- Made every release build depend on a preflight that rejects placeholder
  Firebase data, the wrong package, missing OAuth ID and missing Reverb key.
- Kept reCAPTCHA mandatory on `/api/auth/register`, while allowing the
  separately throttled `/api/v1/auth/register` endpoint to omit it.
- Added Laravel feature tests for the web/native boundary.

## Verification

Android debug compilation, eight JVM tests, lint and APK assembly passed.
The release preflight failed only for the unavailable production Firebase file;
the existing production web OAuth client ID was found and wired.
The complete Laravel suite passed 315 tests with 4,055 assertions, and the
migration dry-run was clean.

## Prevention

Production credentials are no longer a checklist-only convention: the build
cannot generate a release bundle until they are present and structurally
valid. Web and native registration requirements are covered independently so a
future validation refactor cannot silently break one platform.
