# Account deletion request and privacy reconciliation

## Outcome

Implemented a local, support-assisted account-and-data deletion request path:
`chess-frontend/public/delete-account.html` and Android Home menu → Request account
deletion. The web page works without JavaScript, authentication or an installed app.
Android renders instructions natively, opens an ACTION_SENDTO email draft, and
retains selectable address/subject with a fallback message when no email app exists.
Neither path sends a message automatically or claims that composition erases data.
No backend schema, accounts, credentials or server state were changed.

The page identifies Chess99: Play & Learn Chess and AMEYEM, specifies ownership
verification, parental requests, data scope, loss of progress, 30-day target,
retention exceptions and partial/Facebook-only requests. The privacy policy and
shared website footer link to it. Its production URL is
https://chess99.com/delete-account.html; deployment/live serving is **not verified**.

Web and native privacy copies now disclose DOB/avatar/mobile, referral/ambassador
UPI and financial records, chat/report/block data, Firebase/Meta collection and
public/referrer visibility. Removed the unsupported profile-settings deletion claim
and “social login only” provider restriction. The legacy privacy-policy.html was
Markdown masquerading as HTML with unsupported instant erasure, India-only storage,
end-to-end encryption and certification claims; it now redirects to the maintained
policy and provides ordinary fallback links.

Updated PLAY_STORE_LISTING.md and added DATA_SAFETY_REVIEW.md with evidence paths,
per-type purposes/optionality, sharing-exception guidance, SDK uncertainties and
the owner's existing younger-children/no-rewards answers. Existing Console action
remains closed; actual saved selections were not inspected or modified. No claim
that this alone establishes Families compliance or that no-purchases means no UPI
collection. Debug merged manifest includes AD_ID and ACCESS_ADSERVICES_AD_ID.

## Verification

- `pnpm build`: passed; copies the static deletion and legacy privacy files into build.
- `pnpm test --watchAll=false --runInBand --silent --runTestsByPath src/pages/PrivacyPolicy.test.js`:
  1 passed; guest deletion link and current disclosures rendered.
- `pnpm lint`: passed, 0 errors / 302 existing warnings.
- `testing/verify-deletion-web.ps1`: existing `pnpm test:e2e` command, 2 passed
  (Chromium and Mobile Chrome). Actual public HTML fulfilled locally, JavaScript
  disabled, verifies email target/subject/body, fallback, scope, timing, link and
  overflow. This is not live hosting or mail-delivery verification.
- Mobile full-page screenshot inspected: readable text, clear action, no horizontal
  clipping. Screenshots are under chess-frontend/test-results/account-deletion-*.
- `testing/verify-deletion-android.ps1`: offline `:app:compileDebugKotlin
  :app:testDebugUnitTest`, BUILD SUCCESSFUL: 324 tests in 37 suites, zero failures,
  errors or skips. Uses project-local Gradle/user home,
  shared read-only cache, in-process Kotlin and `--no-daemon`.
- `git diff --check`: passed. No backend changes, full deployment gates, release
  AAB, device walkthrough, mail send or account deletion were performed.
- All started commands completed; no server/emulator/watcher was started.

## Support fulfillment checklist (operational handoff, not executed)

1. Accept requests at the existing support address, including lost-email and
   parent/guardian requests. Verify ownership through the account's existing trusted
   channel; do not delete an account merely because someone knows its email. Do not
   solicit passwords, OTPs or UPI PINs. Explain verification delays and the target date.
2. Inventory records by verified user ID before erasure. Include User/profile/social
   provider links and avatar files; Sanctum/session/device tokens and cached presence;
   Game/GameHistory/GameMove/GameAnalysis/shared results; tutorial/puzzle/achievement
   progress; tournament participation; GameChatMessage, ChatMessageReport and UserBlock;
   AmbassadorApplication, ReferralCode/ReferralEarning/ReferralPayout; subscriptions,
   payment records and uploaded files. Review actual deployed schema and foreign keys.
   Deleting only a User row or setting a disabled flag is not sufficient.
3. For each legal/tax/security exception, record a specific reason, access restriction
   and expiry/review period and disclose it in the response. Do not retain all chat
   or all payment data indefinitely under a blanket exception. Remove personal
   identifiers from any retained public game/results and referral display.
4. An authorized operator must execute reviewed deletion/anonymization against the
   verified account, revoke access and notification tokens, invalidate relevant
   caches, remove files, and request applicable processor deletion. No unreviewed
   production DELETE SQL is supplied here. Verify foreign-key and counterpart data
   handling using an authorized disposable account first.
5. Check SDK/provider identifiers and retention settings separately; do not promise
   immediate backup erasure. Track backup expiry and prevent restored backups from
   resurrecting erased accounts. Explain applicable timing to the requester.
6. Verify login is revoked, profile/email/UPI/chat personal data are removed or
   appropriately anonymized, counterpart games remain coherent, and outstanding
   exceptions have deadlines. Send completion confirmation only after verification.
   Store a minimal, access-controlled request/verification/completion audit record.

Support mailbox reachability, actual fulfillment/retention settings and end-to-end
deletion remain operational release checks, not results invented by this task. They
require the existing authorized release/support workflow; this session explicitly
forbids messages and account changes. No new owner decision is requested.

## Remaining release work

Use existing WTM/SMA routing and candidate gates to deploy the web changes, then
verify the public URL anonymously. On the fresh configured Android candidate, verify
menu navigation/email fallback and collection against the refreshed matrix, and
compare saved Console values. The existing Firebase, Families/no-rewards reconciliation,
reviewer access and physical-device gates remain open. This engineering item is
complete locally; publishing and actual support fulfillment are separate checks.

Policy references: [Google account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111),
[Play data definitions](https://support.google.com/googleplay/android-developer/answer/10787469),
[Firebase disclosures](https://firebase.google.com/docs/android/play-data-disclosure).
