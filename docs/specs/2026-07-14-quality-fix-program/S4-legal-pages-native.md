# S4 — Native legal pages + E-Book removal (P0, Android)

## Problem

The drawer's Privacy Policy, Terms, and E-Book open `WebViewScreen`
(`presentation/common/WebViewScreen.kt`, 72 lines; JS + DOM storage enabled)
pointed at `https://chess99.com/privacy`, `/terms`, `/ebook`
(`NavGraph.kt:435-455`). Those URLs return the React SPA shell; inside the
WebView the SPA fails to render its content — **Privacy and Terms show
footer-only (zero legal text)** and E-Book shows the site's error page with a
Refresh loop (review §3.12, screenshots `15`, `17`, `18`). For a kids app
rated 13+, unreachable in-app legal pages are a Play-review liability.
Compliance surfaces must never depend on a remote SPA rendering in a WebView.

## Source of truth for the legal text

Both web pages are **self-contained JSX with the full legal text embedded** —
port the text verbatim (headings + paragraphs + lists), do not paraphrase:

- `chess-frontend/src/pages/PrivacyPolicy.js` — 219 lines, "Last reviewed:
  June 24, 2026", 12 sections (Who We Are … Contact Us), contact
  `support@chess99.com`.
- `chess-frontend/src/pages/TermsOfService.js` — 197 lines, 14 numbered
  sections (Acceptance … Contact Us).

## Tasks

### T1 — Native legal screens

Create `presentation/legal/LegalScreens.kt`:

- A shared scaffold composable:
  ```kotlin
  @Composable
  fun LegalScreen(title: String, sections: List<LegalSection>, onNavigateBack: () -> Unit)
  data class LegalSection(val heading: String, val paragraphs: List<String>, val bullets: List<String> = emptyList())
  ```
  Rendering: `LazyColumn`, title style `titleLarge`, heading `titleMedium`
  (semi-bold, primary color), body `bodyMedium` with 12.dp paragraph spacing,
  bullets prefixed "•  ". Use MaterialTheme roles only. TopAppBar with back arrow.
- Two content objects, `PrivacyPolicyContent` and `TermsOfServiceContent`,
  holding the ported text as `List<LegalSection>`. Include the "Last reviewed:
  June 24, 2026" line at top and the contact section at bottom, exactly as web.
- Keep the text in Kotlin (not assets/HTML) — it's ~400 short paragraphs max,
  and grep-ability matters for future legal edits.

### T2 — Rewire navigation

In `NavGraph.kt` (lines ~435–455): `Screen.Privacy.route` and
`Screen.Terms.route` now render the native screens. Remove the two
`WebViewScreen(url = "https://chess99.com/privacy|terms", …)` blocks.

### T3 — Remove E-Book from v1

- Delete the `Screen.Ebook.route` composable block from NavGraph and the
  "E-Book: 0 to 1000" `DrawerEntry` from `HomeScreen.kt` (`AppDrawer`).
- Keep `Screen.Ebook` defined in `Screen.kt` with a `// post-v1: native reader`
  comment so deep links don't break compilation elsewhere — check
  `DeepLinkHandler.kt` for an `/ebook` mapping and remove/guard it too.
- If nothing else uses `WebViewScreen` after this, delete the file; if
  something does, leave it.

(Post-v1 note, not this spec: the e-book data is already bundled at
`chess-frontend/src/data/ebooks/v2/` — a native reader is queued in the
master-plan backlog.)

### T4 — Registration/consent links

Grep for other in-app uses of the web privacy/terms URLs
(`grep -rn "chess99.com/privacy\|chess99.com/terms" app/src/main/java app/src/main/res`).
Point any (e.g., Register screen consent text) at the native routes instead.

## Acceptance criteria (RELEASE build)

1. Drawer → Privacy Policy: full legal text renders offline-safe (airplane
   mode still works). Same for Terms.
2. Section count matches the web source (12 / 14). Spot-check three paragraphs
   verbatim against the JSX.
3. E-Book gone from the drawer; no dead route reachable.
4. No WebView involved in any compliance surface
   (`grep -rn "WebViewScreen" app/src/main/java` shows no privacy/terms usage).
5. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S4-privacy.png`, `fix-S4-terms.png`.
