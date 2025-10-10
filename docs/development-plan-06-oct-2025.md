Awesome—here’s a **coordinated, execution-ready plan** that fuses your Auth-Gated Multiplayer policy with the actual codebase layout and routing defined in your Developer Guide (routes, contexts, services, and components). 

---

# Objectives (measurable)

1. **Gate all Human vs Human behind auth** while keeping **Play vs Computer** instant for guests.
2. **Time-to-Play**: Guest → Computer in **1 click**; Registered → Human in **≤2 clicks** (Lobby → Challenge/Quick Match).
3. **Header is always visible** (sticky, top z-index); **overlays via portals**; no overlap bugs.
4. **Consistent IA** (Header/Footer nav), **predictable controls** on play pages, and **Resume** surface everywhere.
5. **Instrumentation** to track conversion at auth gates and time-to-play.

---

# Deliverables (what we’ll ship)

1. **Auth Gate System**

   * `AuthGateModal.jsx` (Login / Signup / “Play Computer as Guest”).
   * Route guards for **/lobby** and **/play/multiplayer/:gameId**.
2. **Navigation & IA**

   * Header: Logo / Play / Lobby / Dashboard (Right: Login/Signup or Avatar).
   * Footer (mobile): Home · Play · Lobby · Dashboard.
   * Global **Resume** button (if `activeGameId`).
3. **Page Redesigns**

   * **Landing**: Primary “Play Computer Now”; secondary Login/Signup; “Play with Friends (Login required)”.
   * **Lobby (auth-only)**: Tabs = Players | Invitations | Active Games; one-click **ChallengePopover**.
   * **Dashboard**: Primary card changes by auth (Guest → “Play Computer”, Registered → “Resume/Quick Match”).
   * **Play**: `PlayShell.jsx` consolidates controls; overlays via portal; Undo hidden in multiplayer.
4. **CSS/Structure**

   * Sticky header (z-index 1100), overlays < 1100 via portals.
   * Feature-scoped CSS modules (kill accidental stacking contexts).
   * `theme.css` tokens for spacing/typography/elevation.
5. **Telemetry**

   * Events: `auth_gate_view`, `auth_gate_action`, `start_computer_game`, `start_human_game`, `resume_click`, `challenge_sent`.
   * KPIs: guest→signup conversion, time-to-play, lobby engagement, CLS.

---

# File-Level Working Plan (what to add/change)

> Below uses your current structure and names from the guide: routes in `App.js`, auth in `contexts/AuthContext.js`, realtime in `services/echoSingleton.js` / `WebSocketGameService.js`, pages/components under `src/`. 

## A) Routing & Guards

* **Create** `src/utils/guards.js`

  * `export function requireAuth(element, reason) { /* if !isAuthenticated -> return <AuthGateModal reason={reason}/>; else return element */ }`
* **Update** `src/App.js`

  * `/lobby` → `requireAuth(<LobbyPage/>, 'multiplayer')`
  * `/play/multiplayer/:gameId?` → `requireAuth(<PlayMultiplayer/>, 'multiplayer')`
  * Keep `/play` (computer) **public**.
* **Plumb location-aware gate**: On blocked navigation, keep current URL; let user choose:

  * Login → continue to requested route on success
  * Signup → same
  * “Play Computer as Guest” → route to `/play`

## B) Auth Gate Modal & Resume

* **Create** `src/components/layout/AuthGateModal.jsx`

  * Props: `reason`, optional `onClose` (dismissable only when launched from teasers, not for protected routes).
  * Buttons: Continue with Google / Sign up with email / Play Computer as Guest.
* **Header Resume Button**

  * **Modify** `src/components/layout/Layout.js` (or Header container):

    * Compute `activeGameId` from a new hook `useActiveGame()` (see D).
    * If present: show “Resume” → route to `/play/multiplayer/${id}` or `/play/computer` (if computer autosave exists).

## C) Landing, Lobby, Dashboard, Play

### Landing (`src/pages/LandingPage.js`)

* Primary CTA → `/play` (computer) directly.
* Secondary Login/Signup buttons.
* “Play with Friends (Login required)” → **opens** `AuthGateModal` for guests.
* Add trust row microcopy (no backend changes).

### Lobby (`src/pages/LobbyPage.js`)

* Wrap content in guard; for guests show **full-screen** `AuthGateModal` + **teaser** (blurred player list; disabled actions).
* **Refactor structure** (new components):

  * `src/components/lobby/LobbyTabs.jsx`
  * `src/components/lobby/PlayersList.jsx`
  * `src/components/lobby/InvitationsList.jsx`
  * `src/components/lobby/ActiveGamesList.jsx`
  * `src/components/lobby/ChallengePopover.jsx`
* Players default sort: Online → Busy → In game.
* Challenge flow: click “Challenge” → popover (Color: Auto/White/Black; Time Control presets) → **Start** (single confirm).
* Preserve presence & polling (existing `presenceService.js` & intervals). 

### Dashboard (`src/components/Dashboard.js`)

* **Top strip**: Avatar/Username/Rating or “Guest”.
* **Primary card**:

  * Registered: **Resume Game** (if any) otherwise **Quick Match (Human)** (same presets popover).
  * Guest: **Play Computer Now** + CTA “Create account to play humans”.
* Secondary cards conditional by auth (guest shows recent local games only).

### Play

* **Create** `src/components/play/PlayShell.jsx`

  * Grid: left controls (New/Draw/Resign/Flip; hide Undo in multiplayer), center Board, right sidepanel (Moves/Captures/Opponent).
  * **Portal** for `PreGameModal` to `#modal-root`.
  * **No transforms/overflow** on page wrappers.
* **Refactor** `PlayComputer.js` and `PlayMultiplayer.js`

  * Render inside `PlayShell` slots (board, controls, sidepanel injects).
  * In multiplayer, route is guarded; in computer, last settings auto-apply.
* **CSS**:

  * `src/components/play/play.css` (module): `.play-grid{display:grid;grid-template-columns:280px minmax(520px,1fr) 320px;gap:16px}`
  * Sticky header: `position: sticky; top:0; z-index:1100;`
  * Overlays: `z-index:1000` (portal), avoid parent transforms.

## D) State, Hooks, and Services

* **Hook** `src/hooks/useActiveGame.js`

  * Reads `/games/active` (cached via `AppDataContext`) to expose `{activeGameId, mode}` for global use (header, dashboard). 
* **AuthContext integration**: On login/logout, invalidate caches in `AppDataContext` to refresh dashboard/lobby instantly. 
* **WebSocket lifecycle** unchanged; ensure `echoSingleton` only initializes after auth to avoid private channel failures. 

## E) CSS/Theme

* **Create** `src/theme.css`

  * `--space-4/8/16/24/32`, font sizes `12/14/16/20/24/32`, shadows `--elev-sm/md`.
* **Replace** ad-hoc styles in `index.css` with feature-scoped modules:

  * `pages/lobby/lobby.module.css`
  * `components/play/play.module.css`
* **Header precedence**: Keep header in its own stacking context; remove `transform` and `overflow:hidden` on top-level wrappers to prevent overlap bugs.

## F) Telemetry

* **Add** `src/utils/analytics.js`

  * `track(event, payload)`; wire to your provider (or temporary `console.info`).
* Fire events at:

  * Modal view & choices (`auth_gate_*`)
  * Start computer/human
  * Resume click
  * Challenge sent / accepted
* Measure **time-to-play** (stamp at page view → start event).

---

# PR Slices (safe rollout)

1. **PR-1: Header & Layout Base**

   * Sticky header, z-index fix, portal mount (`#modal-root` in `public/index.html`), theme tokens, play grid shell.
   * **DoD**: Header never obscured; CLS ok.

2. **PR-2: Auth Gate & Guards**

   * `AuthGateModal.jsx`, `utils/guards.js`, route updates in `App.js`.
   * **DoD**: `/lobby` & multiplayer are blocked for guests but offer “Play Computer”.

3. **PR-3: Landing CTA Refresh**

   * Primary button to `/play` (computer), secondary login/signup, “Play with Friends” triggers modal for guests.
   * **DoD**: Guest → computer game in 1 click.

4. **PR-4: PlayShell Integration**

   * Wrap `PlayComputer`/`PlayMultiplayer` in `PlayShell` + portal overlays; remove stray transforms/overflows.
   * **DoD**: Controls consolidated; Undo hidden in multiplayer.

5. **PR-5: Lobby Tabs & ChallengePopover**

   * Split lists, status chips, one-click challenge.
   * **DoD**: Registered user starts match in ≤2 clicks.

6. **PR-6: Dashboard Primary Card & Resume**

   * Auth-aware primary card; global Resume button; `useActiveGame`.
   * **DoD**: Resume visible across pages when activeGameId exists.

7. **PR-7: Telemetry**

   * Add events and basic dashboard (temporary console or lightweight provider).
   * **DoD**: Events emitted for key funnels.

---

# Acceptance Criteria (per page)

* **Landing**

  * [ ] Guest: clicking **Play Computer Now** starts a game immediately.
  * [ ] “Play with Friends” (guest) shows AuthGate; Login lets user continue to Lobby.

* **Lobby**

  * [ ] Guest: sees full-screen AuthGate; lists are teaser/disabled.
  * [ ] Registered: Players/Invitations/Active tabs function; **Challenge** → popover → **Start** begins a game.

* **Dashboard**

  * [ ] Guest: Primary = “Play Computer”, plus CTA to create account.
  * [ ] Registered: Primary = **Resume** (if active) else **Quick Match** modal.

* **Play**

  * [ ] Header is never obscured; overlays never sit above header.
  * [ ] Controls consolidated; Undo hidden for multiplayer.

* **Global**

  * [ ] Resume button visible anywhere if active game exists.
  * [ ] Telemetry events emitted; time-to-play captured.

---

# Risks & Mitigations

* **Private channel auth** (Echo) before login → connect only after token present; disconnect on logout. 
* **Over-aggressive CSS resets** → ship in slices; verify on mobile small widths.
* **Polling fallback** timing with guards → guards run before establishing WS; fallback unaffected. 

---

# Two-Sprint Timeline (10 working days)

* **Days 1–2**: PR-1 (header/portals/theme) + PR-2 (guards & modal).
* **Day 3**: PR-3 (landing CTA) + smoke test.
* **Days 4–5**: PR-4 (PlayShell refactor).
* **Days 6–7**: PR-5 (Lobby tabs + ChallengePopover).
* **Day 8**: PR-6 (Dashboard + Resume).
* **Days 9–10**: PR-7 (Telemetry) + cross-browser + mobile QA.

---

# Developer To-Dos (copy/paste checklist)

* [ ] Add `#modal-root` to `public/index.html`.
* [ ] Implement `AuthGateModal.jsx`.
* [ ] Add `utils/guards.js` and wrap protected routes in `App.js`.
* [ ] Create `PlayShell.jsx` and move overlays to portal.
* [ ] Split Lobby into tabbed components; add `ChallengePopover`.
* [ ] Update Dashboard primary card + global Resume button.
* [ ] Create `useActiveGame.js` and wire `AppDataContext` invalidation.
* [ ] Introduce `theme.css`; migrate high-risk styles to modules.
* [ ] Emit analytics events at all funnel points.

---

If you want, I can draft the **exact code diffs** for `App.js`, `AuthGateModal.jsx`, `guards.js`, and `PlayShell.jsx` next so your team can drop them in without guesswork.


Medical References:
1. None — DOI: file-PiMfcMFqN1dF7VftKVstUw