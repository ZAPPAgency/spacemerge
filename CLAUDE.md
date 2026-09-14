# CLAUDE.md

Loaded into every session: keep it short. Behavioral rules adapted from
forrestchang/andrej-karpathy-skills and drona23/claude-token-efficient.

## 1. Working rules

**Think before coding**
- State assumptions. If a request is ambiguous, ask instead of picking silently.
- If a simpler approach exists, say so.

**Simplicity first**
- Minimum code that solves the request. No speculative features, options or abstractions.
- No error handling for impossible cases. If 200 lines could be 50, rewrite.

**Surgical changes**
- Every changed line must trace back to the request. Match the surrounding style.
- Don't refactor, reformat or "improve" adjacent code. Mention unrelated issues, don't fix them.
- Remove only what YOUR change made unused.

**Goal-driven**
- Turn tasks into verifiable goals ("fix X" = reproduce, fix, confirm).
- Multi-step work: short plan with a check per step.

## 2. Token economy

- Locate before reading: `grep -n "function name"` then Read with `offset`/`limit`.
  `ui.js` (~2200 lines) and `input.js` (~1300) must never be read in full.
- Don't re-read a file you just read or edited.
- Never open unless explicitly asked: `game-full.html`, `cosmerge-v2.html` (200 KB, stale
  single-file builds), `www/assets/**`, `assets/**`, images, `package-lock.json`, `dist-www/`, `ios/`, `android/`.
- `docs/*.md` are App Store submission docs: read only the one relevant to the task.
- Answers: concise, no preamble, no restating the request, no pasting back code you just wrote.
  Thorough in reasoning, brief in output.
- Verify facts (plugin APIs, versions) in code or docs instead of guessing.

## 3. Project

Godspark: merge / idle / prestige space game. Vanilla HTML/CSS/JS in `www/`, shipped as a
native app via Capacitor 8 (iOS set up; Android planned, `@capacitor/android` not installed yet).
UI text is French (`lang="fr"`), English localization is planned.

**Architecture** (`www/js/`, plain `<script>` globals, no bundler on web)
- Load order in `www/index.html` is the dependency graph:
  `config` → `state` → `audio` → `services` → `economy` → `gods` → `retention` → `ui` → `input` → `main`.
  A file may only use globals from files loaded before it (or call later ones at runtime, never at load time).
- `config.js`: constants and pure formulas only (no state, no DOM).
- `state.js`: default state, load/save, migrations. `main.js`: boot, main loop, resume/offline gains.
- `window.Game` holds runtime state; `Game.state` is the persisted part.
- `services.js`: `AdService` / `IAPService` web simulations. `native-bridge.js` (the only ES module)
  replaces them and `saveState`/`loadState`/`HapticService` with Capacitor plugins on native.
  Game code never imports Capacitor or calls a plugin directly: go through a service.

**Commands**
- Local web: `npx vite` (serves `www/`). Syntax check: `node --check www/js/<file>.js`.
- Native: `npm run sync` (Vite build → `dist-www/` → `cap sync ios`), then `npm run open:ios`.
- No test suite: verify by reasoning through the flow and, for UI, in the browser.

**Deploy**
- Push on `main` → GitHub Pages. Other branches / PRs get previews (`.github/workflows/`).
- Bump the cache-buster `?v=N` on every `<script>`/`<link>` in `www/index.html` when shipping
  `www/` changes (own commit: `chore: bump cache-buster to v=N`).

**Invariants (breaking these loses player data or money)**
- Saves: any shape change to `Game.state` needs a default in `defaultState()` AND a migration;
  bump `SAVE_VERSION` only with a migration path. Never change `SAVE_KEY`.
- Anything granted offline or on resume must be idempotent (resume events fire back to back).
- Currency changes go through `grantStardust` / `spendStardust` / `grantGems` (`retention.js`)
  so quests and achievements stay in sync.
- Rewarded ads grant only after the SDK confirms the reward; purchases only after the store confirms.

**Git**
- Commit messages, PR titles and PR descriptions in English, with a conventional prefix:
  `fix: wheel did not refresh the grid`.
- One logical change per commit. Commit/push only when asked.

## 4. Code guidelines

- Code, identifiers and comments in English. Player-facing strings in French.
- `"use strict"`, `const`/`let` (no `var`), `===`, early returns, small functions with explicit names.
- No magic numbers: named constant in `config.js` with a unit suffix (`_MS`, `_H`).
- DOM: `textContent` for dynamic text. `innerHTML` only with static templates, never with
  player input or imported save data (profile name, save codes).
- No new dependency without asking.

**Comments** (production-ready, written for a junior developer)
- English only, in every file type (JS, CSS, HTML, YAML). Player-facing strings stay French.
- Concise: short plain sentences, no narrative, no filler ("deliberately", "exactly", "genuinely").
  Point to the related code (`fn()` in `file.js`) instead of re-explaining it.
- Trailing comments: a few words (`// must match .wheel's CSS transition duration`).
- Explain WHY or a non-obvious rule, never WHAT the code already says.
- Comment: business rules, formulas, magic thresholds, platform quirks, ordering constraints, invariants.
- Don't comment: obvious code, getters, one-line helpers.
- Forbidden: people's names or quotes, bug-report narratives, history ("was 1000ms", "used to",
  "previous version"), ticket/session/step references, TODO without context, commented-out code.
- One or two lines by default. A longer block only for a real trap (e.g. a WKWebView lifecycle quirk).
- Existing code still has legacy comments with names and history: when you edit a function,
  rewrite the comments in the lines you touch to these rules; don't mass-rewrite other files.

```js
// Bad:  Loris reported the swap was free, so we check gems here (was missing before v117)
// Good: A swap bought with an ad skips the gem cost exactly once.

// Bad:  Merges landing within this window of each other count as a "streak" - scales the
//       impact effect and raises the reward chime's pitch a step each time, so fast merge
//       chains feel increasingly rewarding. Resets the moment the player pauses.
// Good: Merges closer than this count as a streak (raises the combo chime, see Sfx.meteorImpact).
```

## 5. Mobile / Capacitor best practices (iOS + Android)

**Web layer inside a WebView**
- Touch first: no hover-only UI, `pointer`/`touch` events, `{ passive: true }` on scroll/touch listeners.
- Touch targets ≥ 44pt (iOS HIG) / 48dp (Material).
- Safe areas: `viewport-fit=cover` + `env(safe-area-inset-*)`. Android 15+ is edge-to-edge:
  test notch, Dynamic Island and gesture navigation.
- Animate only `transform` and `opacity`. Batch DOM reads before writes; in the rAF loop,
  write to the DOM only when a value changed.
- Timers and rAF are throttled in background: compute from timestamps (`Date.now()`), never count ticks.
- Audio needs a user gesture to start and must stop on hide.

**Lifecycle and storage**
- On native, persist with `@capacitor/preferences`, not `localStorage` (the OS can purge WebView storage).
- Save on hide, and handle resume from `visibilitychange`, `pageshow`, `focus` and
  `App.addListener("appStateChange")`; guard against double firing.
- Android: handle the hardware back button (`App.addListener("backButton")`) by closing the
  top modal first, then exiting.

**Native plugins**
- Every plugin call is async and can fail: `try/catch`, degrade gracefully, never block boot.
- Guard native code with `Capacitor.isNativePlatform()`; the web build must keep working.
- After adding/updating a plugin or changing `capacitor.config.ts`: `npx cap sync`.
- `ios/` and `android/` are generated (gitignored): native config changes (Info.plist, entitlements,
  AndroidManifest) must be documented in `docs/BUILD_IOS.md` so they survive regeneration.
- Keep all Capacitor packages on the same major version.

**Store compliance**
- AdMob: App ID in Info.plist (`GADApplicationIdentifier`) and AndroidManifest; UMP consent (GDPR)
  before loading ads; App Tracking Transparency prompt on iOS before personalized ads.
- RevenueCat: configure once at boot, check entitlements (not local flags) for VIP/no-ads;
  a working "Restore purchases" button is mandatory on iOS.
- Local notifications: ask permission in context, not at launch (Android 13+ needs `POST_NOTIFICATIONS`).
- Keep `docs/APP_PRIVACY_ANSWERS.md` (and the future Play Data safety form) in sync with any new SDK or data collected.
