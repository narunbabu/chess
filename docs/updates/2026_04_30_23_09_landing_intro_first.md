# Landing Intro First

## Summary
- Moved the animated Chess99 intro into the first landing viewport as the primary visual.
- Kept the main CTA and new-user framing beside the animation, then left the static play/learn guide below for deeper exploration.
- Added a hero variant for `IntroVideo` so the same component can still render as a full standalone section elsewhere.

## Verification
- `pnpm build` passed in `chess-frontend` after rerunning.
- `http://127.0.0.1:3000/` returned HTTP 200.
- Opened the redesigned landing page in the system browser.

## Note
- The in-app browser plugin could not run because its Node runtime requirement is `>=22.22.0`, while the resolved local runtime is `22.14.0`.
