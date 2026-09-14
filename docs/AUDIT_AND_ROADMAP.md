# Spacemerge — Audit & Roadmap to Publication

**Date:** 2026-08-26
**Scope:** full repo audit (source, config, docs) against App Store Review
Guidelines, plus the two new workstreams requested: **cloud save** and
**English localization**.

---

## Verdict in one paragraph

The game itself is **well written**. ~4,500 lines of vanilla JS across 11
modules with clean layering (`config` → `state` → rules → UI → loop), no
XSS holes, defensive save loading, and comments that explain _why_ rather
than _what_. The `AdService` / `IAPService` abstraction is the right call and
means the native swap touches no game code. The submission docs are unusually
complete.

**But the project has never been built.** There is no `ios/` directory, no
`node_modules`, and one commit. Everything native is verified on paper only —
`docs/BUILD_IOS.md` says so explicitly. The blockers below are almost all in
the native/monetization layer, not in the game.

---

## Priority legend

| Tag    | Meaning                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------ |
| **P0** | Ships → rejected by Apple. Non-negotiable.                                                             |
| **P1** | Not a rejection, but will produce lost saves, lost money, or 1-star reviews. Fix before public launch. |
| **P2** | Materially improves reach or quality. Schedule for launch or v1.1.                                     |
| **P3** | Hygiene. Do it when convenient.                                                                        |

---

# P0 — App Store rejection blockers

## P0-1. "Restore Purchases" does nothing

**Where:** `www/js/input.js:597-601`

```js
async function onRestorePurchases() {
  await IAPService.restorePurchases();
  toast("Achats restaurés (simulation)."); // <-- never restores anything
  refreshCurrentPanel();
}
```

`native-bridge.js` calls `Purchases.restorePurchases()` but discards the
result. Nothing ever reads `customerInfo.entitlements`, so `state.iap.*` is
never repopulated. A reviewer who taps Restore on a fresh install sees a
toast and no entitlements.

**Why it matters:** Guideline 3.1.1 requires a functional restore for
non-consumables and subscriptions. This is an automatic rejection, and it is
usually the _first_ thing a reviewer tests.

**Fix:** Make restore return the customer info and apply entitlements
through a single shared function (see P0-3 — the same function serves both).

```js
// native-bridge.js
window.IAPService.restorePurchases = async function () {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  } catch (e) {
    console.warn("Restore failed", e);
    return null;
  }
};

// input.js
async function onRestorePurchases() {
  const info = await IAPService.restorePurchases();
  if (!info) {
    toast("Restauration impossible, réessayez.");
    return;
  }
  applyEntitlements(Game.state, info);
  saveState(Game.state);
  renderAll();
  refreshCurrentPanel();
  toast("Achats restaurés.");
}
```

**Effort:** 0.5 day (bundled with P0-3).

---

## P0-2. The ad banner is a visible placeholder

**Where:** `www/index.html:75-77`, `www/css/style.css:138-139`,
`www/js/ui.js:190`

```html
<div class="bannerAd hidden" id="bannerAd">
  <span>Bannière publicitaire (placeholder)</span>
</div>
```

Every non-paying user sees a dashed grey box reading _"Bannière publicitaire
(placeholder)"_. `native-bridge.js` implements rewarded and interstitial ads
only — **there is no banner integration at all**.

**Why it matters:** Guideline 2.1 / 4.0 — placeholder content and incomplete
UI. Instant rejection.

**Fix — pick one:**

- **(A) Implement it.** Add `AdMob.showBanner()` in `native-bridge.js`, keep
  the div as a pure spacer with no text so the native banner overlay doesn't
  cover gameplay:

```js
window.AdService.showBanner = async function () {
  if (adsRemoved(Game.state)) return;
  try {
    await AdMob.showBanner({
      adId: AD_UNITS.banner,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
    });
  } catch (e) {
    console.warn("Banner failed", e);
  }
};
window.AdService.hideBanner = () => AdMob.hideBanner().catch(() => {});
```

Call `showBanner()` after the tutorial and `hideBanner()` whenever
`adsRemoved(state)` flips true (purchase of `remove_ads` or VIP).

- **(B) Ship without a banner.** Delete the div, the CSS rule, and
  `ui.js:190`. Rewarded + interstitial already carry the monetization. This
  is the faster, lower-risk path for v1 and costs little revenue on an
  idle/merge game.

**Recommendation:** (B) for launch, (A) in v1.1 once you have real fill-rate
data. Deleting the placeholder removes the blocker in 15 minutes.

**Effort:** (A) 1 day · (B) 15 minutes.

---

## P0-3. Subscription state is faked locally

**Where:** `www/js/input.js:588`, `www/js/state.js:207`

```js
case "vip_monthly": state.iap.vipUntil = Date.now() + 30 * 24 * 3600 * 1000; break;
...
function isVipActive(state) { return state.iap.vipUntil > Date.now(); }
```

VIP is a client-side timestamp. Nothing ever asks RevenueCat whether the
subscription is still live. Consequences:

- Cancelling in iOS Settings → the app keeps granting VIP for up to 30 days.
- Renewal → not honoured; VIP silently expires on day 30 for a paying user.
- Reinstall → VIP is gone (and P0-1 means restore can't bring it back).
- Billing failure / refund → still VIP.
- Changing the device clock → free VIP.

**Why it matters:** Guideline 3.1.2 and 3.1.1. A reviewer testing the
subscription in Sandbox (where a "month" is 5 minutes) will see it not renew.

**Fix:** Make RevenueCat the single source of truth. Add one function and
call it on every entry point.

```js
// state.js — entitlement IDs configured in the RevenueCat dashboard
function applyEntitlements(state, customerInfo) {
  const ent =
    (customerInfo &&
      customerInfo.entitlements &&
      customerInfo.entitlements.active) ||
    {};
  state.iap.removeAds = !!ent["remove_ads"] || !!ent["vip"];
  state.iap.stardustBoost = !!ent["stardust_boost"];
  state.iap.vipUntil = ent["vip"]
    ? Date.parse(ent["vip"].expirationDate || 0)
    : 0;
  // Consumables (gems) are NOT entitlements — they are granted once at
  // purchase time and live in the save. Never re-grant them from here.
}
```

Call `applyEntitlements` in three places:

1. **On boot**, after the native bridge is ready: `Purchases.getCustomerInfo()`.
2. **After every purchase**, from the `customerInfo` that `purchasePackage` returns.
3. **On the RevenueCat listener**, so renewals/cancellations land live:
   `Purchases.addCustomerInfoUpdateListener(info => { applyEntitlements(Game.state, info); saveState(Game.state); renderAll(); })`.

Then delete the `case "vip_monthly"` / `"remove_ads"` / `"stardust_boost"`
branches from `onBuyIAP` — those three become entitlement-driven. Keep the
`gems_*` and `starter_pack` branches (consumables/one-shot grants).

**Effort:** 2 days.

---

## P0-4. Missing subscription disclosure & Terms of Use link

**Where:** `www/js/ui.js:791-792` (only a privacy link exists), the IAP panel
around `ui.js:404`.

Guideline 3.1.2 requires, **visible at the point of purchase, inside the app**:

- Subscription title (✅ "Pass Supernova")
- Length of the subscription period (✅ "/mois")
- Price per period (⚠️ hardcoded — see P0-5)
- A functional link to your **Terms of Use (EULA)** (❌ missing)
- A functional link to your **Privacy Policy** (⚠️ exists in Settings, but
  must also be reachable from the purchase screen)

**Fix:**

1. Either use Apple's standard EULA (link
   `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`) and
   declare it in App Store Connect, or write your own and host it next to
   `docs/privacy-policy.html`.
2. In the IAP panel renderer, append a footer under the subscription card
   with both links plus the auto-renew disclosure text:
   _"L'abonnement se renouvelle automatiquement sauf annulation au moins 24 h
   avant la fin de la période en cours. Gérable dans les réglages de votre
   compte Apple."_
3. Add both URLs to the App Store Connect listing fields as well.

**Effort:** 0.5 day.

---

## P0-5. Hardcoded prices in the wrong currency

**Where:** `www/js/config.js:365-375`

```js
{ id: "remove_ads", ..., price: "3,99 $" },
{ id: "vip_monthly", ..., price: "6,99 $/mois" },
```

Every storefront outside the US sees a wrong price. A French user is shown
`3,99 $` while Apple charges `4,99 €`. Beyond being simply incorrect, a
price mismatch between the UI and the StoreKit sheet is a documented
rejection trigger.

**Fix:** Treat `IAP_CATALOG.price` as a **web-simulation fallback only**. On
native, overwrite it from the store's localized strings at boot:

```js
const offerings = await Purchases.getOfferings();
(offerings.current?.availablePackages || []).forEach((pkg) => {
  const item = IAP_CATALOG.find((p) => p.id === pkg.product.identifier);
  if (item) item.price = pkg.product.priceString; // already localized by StoreKit
});
```

Render the shop **after** that resolves, and show a skeleton/spinner until
offerings load.

**Effort:** 0.5 day.

---

## P0-6. App Tracking Transparency not implemented

**Where:** `package.json` (no ATT plugin), `docs/BUILD_IOS.md` §6 (described
only), `native-bridge.js:76` (`requestTrackingAuthorization: false`).

If AdMob serves **personalized** ads you must present the ATT prompt. Serving
personalized ads without it is a rejection and an Apple policy violation.

**Fix:**

```bash
npm i @capacitor-community/app-tracking-transparency
```

```js
import { AppTrackingTransparency } from "@capacitor-community/app-tracking-transparency";
// AFTER the tutorial completes — never on the first screen (Apple rejects
// prompts shown before the user understands the app).
const { status } = await AppTrackingTransparency.requestPermission();
await AdMob.initialize({ requestTrackingAuthorization: false });
// If status !== "authorized", request non-personalized ads:
//   npa: "1" in the ad request extras.
```

Add `NSUserTrackingUsageDescription` to `Info.plist` (French **and** English
once P2-1 lands — see `InfoPlist.strings`).

**Alternative that removes this blocker entirely:** serve only
non-personalized ads and answer the App Privacy questionnaire accordingly.
Lower eCPM, zero ATT work, zero rejection risk.

**Effort:** 1 day (or 1 hour for the non-personalized route).

---

## P0-7. Test credentials still in the source

**Where:** `www/js/native-bridge.js:71-74, 100`

```js
rewarded: "ca-app-pub-3940256099942544/1712485313",   // Google TEST unit
interstitial: "ca-app-pub-3940256099942544/4411468910", // Google TEST unit
await Purchases.configure({ apiKey: "YOUR_REVENUECAT_PUBLIC_SDK_KEY" });
```

Also `AdMob.initialize({ initializeForTesting: true })` must be `false` for
release.

**Fix:** Move all of these into a `www/js/env.js` that is generated at build
time (gitignored), with a `env.example.js` committed. Add a build-time guard
that fails `npm run build` if any value still starts with `YOUR_` or matches
Google's test publisher ID `3940256099942544`.

**Effort:** 0.5 day.

---

# P1 — Not rejections, but will hurt real users

## P1-1. Cloud save (requested)

**Current state:** none. Progress lives in `localStorage` on web and in
Capacitor `Preferences` (iOS `UserDefaults`) on native. The only recovery
path is the manual base64 export/import in Settings
(`state.js:170-181`). If the user deletes the app, changes phone, or the
system clears app data, **all progress is lost permanently** — in a game
built around long-term prestige progression, that is the single most
review-score-damaging failure mode there is.

### Recommended architecture

Introduce a `CloudSaveService` abstraction mirroring the existing
`AdService` / `IAPService` pattern, so the backend can change without
touching game code:

```js
// www/js/cloud-save.js  (web stub: no-op / localStorage mirror)
const CloudSaveService = {
  isAvailable() {
    return false;
  },
  async push(state) {},
  async pull() {
    return null;
  }, // returns a state object or null
};
```

`native-bridge.js` replaces it with a real implementation, exactly as it
already does for ads and IAP.

### Backend choice

| Option                                                   | Pros                                                                                                                                               | Cons                                                                                                                                                           | Verdict                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **iCloud Key-Value Store** (`NSUbiquitousKeyValueStore`) | Free, no backend, no accounts, no extra privacy disclosure, syncs across the user's devices automatically. Save JSON is ~2–4 KB vs the 1 MB limit. | iOS/macOS only. Needs a small custom Capacitor plugin (~50 lines of Swift) or a community one.                                                                 | ✅ **Ship this for iOS v1** |
| **Game Center `GKSavedGame`**                            | Already adding Game Center.                                                                                                                        | Clunky API, designed for turn-based games, poor conflict story.                                                                                                | ❌                          |
| **Firebase / Supabase + Sign in with Apple**             | Cross-platform (solves Android too), server-authoritative, enables future features.                                                                | Requires accounts, a backend, App Privacy updates, and — if you offer any third-party login — Apple _requires_ Sign in with Apple alongside it. Weeks of work. | ⏳ v2 / when Android ships  |
| **Google Play Games Saved Games**                        | The Android equivalent of iCloud KVS.                                                                                                              | Android only.                                                                                                                                                  | ✅ For the Android port     |

**Plan:** `CloudSaveService` interface now → iCloud KVS behind it for iOS →
Play Games Saved Games behind the same interface for Android → optionally
Firebase later if you ever want true cross-platform (iOS ↔ Android) sync,
which neither iCloud nor Play Games can give you.

### Sync policy

1. **Push** on the same events that already trigger `saveState`, but
   **throttled to once every 30–60 s** and on `pagehide` / `visibilitychange:hidden`.
   Never on the 1 Hz loop tick (see P1-3).
2. **Pull** once at boot, before `renderAll()`.
3. **Conflict resolution.** Do _not_ auto-pick by timestamp — device clocks
   lie, and silently overwriting a better save is the worst outcome. Compare
   `lifetime.stardustEarned` and `lifetime.bigBangCount`:
   - Cloud strictly ahead on both → adopt cloud silently.
   - Local strictly ahead on both → keep local, push.
   - **Divergent** (each ahead on something) → show a blocking modal:
     _"Sauvegarde cloud trouvée"_ with both summaries (Big Bangs, max tier,
     lifetime Stardust, date) and let the player choose. Idle games all do
     this; players expect it.
4. **Never merge field-by-field.** Whole-save replacement only.

### Implementation sketch

```js
// native-bridge.js
window.CloudSaveService = {
  isAvailable: () => true,
  async push(state) {
    try {
      await ICloudKV.set({ key: SAVE_KEY, value: JSON.stringify(state) });
    } catch (e) {
      console.warn("Cloud push failed", e);
    } // never block gameplay
  },
  async pull() {
    try {
      const { value } = await ICloudKV.get({ key: SAVE_KEY });
      if (!value) return null;
      const data = JSON.parse(value);
      return data && typeof data.version === "number"
        ? deepFill(data, defaultState())
        : null;
    } catch (e) {
      console.warn("Cloud pull failed", e);
      return null;
    }
  },
};
```

**Also add regardless of cloud save:** an explicit "Sauvegarde cloud" status
row in Settings showing last sync time and a manual "Synchroniser maintenant"
button. Players need to _see_ that it works.

**Effort:** 3–4 days for iOS (including the Swift plugin and the conflict
modal). +2 days for the Android side later.

**Priority:** P1, but promote to **P0 in practice** — shipping a prestige
idle game with no cloud save in 2026 generates 1-star "I lost everything"
reviews within the first week, and those are almost impossible to recover
from.

---

## P1-2. Native boot race — returning players can lose their save

**Where:** `www/js/main.js:31-79` vs `www/js/native-bridge.js:58-66`

`native-bridge.js` is `<script type="module">`, therefore **deferred**.
`main.js` is a classic script and runs first. Sequence on a native launch:

1. `main.js` calls `loadState()` → reads **`localStorage`**, which on a fresh
   native install (or after an iOS WebView data clear) is **empty** → returns
   `defaultState()`.
2. It computes offline gains against that empty state, decides the tutorial
   should be shown, and calls `renderAll()`.
3. _Only then_ does the bridge run and `Object.assign(Game.state, migrated)`
   the real save from `Preferences` — with no re-render and no re-computation.

**Observed result for a returning player:** the tutorial reappears, the grid
renders as a new game until something incidentally re-renders it, and the
entire offline-earnings window is silently discarded.

**Fix — the clean version:** make the bridge own the boot order.

```js
// main.js — export the boot function instead of self-invoking
window.bootGame = async function () {
  /* existing IIFE body */
};
// Web: run immediately at the end of main.js if Capacitor is absent.
if (!window.Capacitor) window.bootGame();
```

```js
// native-bridge.js — at the end of bootNative(), after Preferences load
await window.bootGame();
await SplashScreen.hide();
```

This also lets the cloud-save pull (P1-1) and the entitlement sync (P0-3)
complete _before_ the first render, which is exactly where they belong.

**Effort:** 0.5 day. **Do this before P1-1 and P0-3** — both depend on it.

---

## P1-3. `saveState` fires every second, over the native bridge

**Where:** `www/js/main.js:96`

```js
if (ticked) saveState(Game.state); // once per second, forever
```

On web that is a synchronous `localStorage.setItem` of the full state —
already wasteful. On native it becomes an **async Capacitor bridge call to
`UserDefaults` every second**, serializing the whole save each time. Expect
measurable battery drain and periodic jank on older devices, and it makes
cloud-save throttling harder to reason about.

**Fix:** Keep the 1 Hz _economy_ tick, decouple the _persistence_:

```js
let dirty = false,
  lastPersist = 0;
// in frame(): if (ticked) dirty = true;
if (dirty && now - lastPersist > 10000) {
  saveState(Game.state);
  dirty = false;
  lastPersist = now;
}
```

Keep the existing immediate `saveState` on `pagehide` / `blur` /
`visibilitychange:hidden` — those are what actually protect against data
loss, and they already exist (`main.js:110-112`). A 10 s interval plus those
hooks loses at most a few seconds of idle income in a genuine crash, which is
invisible in this genre.

**Effort:** 0.5 day.

---

## P1-4. Bumping `SAVE_VERSION` wipes every player

**Where:** `www/js/state.js:135`

```js
if (data.version !== SAVE_VERSION) return defaultState(); // silent total wipe
```

`deepFill` already handles _additive_ schema changes gracefully, so this
branch only fires when you deliberately bump the constant — at which point
**100% of your live players lose everything, with no warning and no undo.**
Right now that is a footgun with the safety off.

**Fix:**

1. Write down the policy in `docs/`: **never bump `SAVE_VERSION` for additive
   changes** — add the field to `defaultState()` and let `deepFill` handle it.
2. Replace the wipe with a migration chain:

```js
const MIGRATIONS = { 1: migrateFromV1, 2: migrateV2toV3 /* ... */ };
function loadState() {
  // ...
  let data = JSON.parse(raw);
  while (data.version < SAVE_VERSION && MIGRATIONS[data.version]) {
    data = MIGRATIONS[data.version](data);
  }
  if (data.version !== SAVE_VERSION) {
    // Truly unmigratable: archive the old save rather than destroying it,
    // so support can recover it and the player can be compensated.
    localStorage.setItem(SAVE_KEY + "_orphan_" + Date.now(), raw);
    return defaultState();
  }
  return deepFill(data, defaultState());
}
```

**Effort:** 0.5 day. Cheap insurance; do it before the first public build.

---

## P1-5. Game Center leaderboards are write-only

**Where:** `www/js/retention.js:209-213` submits scores;
`native-bridge.js:132-135` defines `showLeaderboard` — **nothing ever calls it.**

You submit to `maxTier`, `cosmicEnergy` and `bigBangCount` but the player has
no way to view any of them. Declaring the Game Center capability and shipping
no visible leaderboard is a wasted retention feature and looks unfinished to
a reviewer.

**Fix:** Add a "Classements" row in the drawer/Settings panel calling
`GameCenterService.showLeaderboard("maxTier")`, plus an entry point to the
Game Center achievements dashboard. Hide the row when
`window.GameCenterService` is undefined (web build).

**Effort:** 0.5 day.

---

## P1-6. `importSaveCode` accepts arbitrary state

**Where:** `www/js/state.js:173-182`

Any base64 blob with a numeric `version` becomes the live game state — a
player can hand themselves unlimited Gems, all skins, and every entitlement
flag (`iap.removeAds`, `iap.vipUntil`).

This is a **single-player game**, so it is not a security issue and not worth
blocking launch over. But it does let a user grant themselves paid
entitlements, and once P0-3 lands, RevenueCat will overwrite `iap.*` on the
next sync anyway — which will look like a bug to that user.

**Fix:** Strip `iap` from imported saves (`delete data.iap`) and re-derive it
from `applyEntitlements` immediately after import. Optionally sanity-clamp
`gems` / `cosmicEnergy` against `lifetime` totals.

**Effort:** 1 hour.

---

# P2 — Reach & quality

## P2-1. English localization (requested)

**Current state:** the game is **100% French, fully hardcoded.** `<html lang="fr">`,
all UI copy, all 90 achievements, all gods, all quests, all toasts, and the
two local-notification bodies in `native-bridge.js`.

**Measured scope:**

| Source                                                                              | Approx. translatable strings |
| ----------------------------------------------------------------------------------- | ---------------------------- |
| `www/js/config.js` (gods, achievements, quests, skills, IAP, ambiances, emoji sets) | ~350                         |
| `www/js/ui.js` (panel prose, template literals)                                     | ~200                         |
| `www/js/input.js` (60 `toast()` calls + modal copy)                                 | ~120                         |
| `www/index.html` (static markup, tutorial)                                          | ~85                          |
| `www/js/services.js`, `state.js`, `economy.js`, `gods.js`                           | ~20                          |
| `native-bridge.js` (notification titles/bodies)                                     | 4                            |
| **Total**                                                                           | **≈ 700–800**                |

Note that a lot of this is _narrative prose_ (the Gods' lore, the "Rupture"
story, the road-map panel), not UI chrome. That is the part machine
translation handles worst and where the game's personality lives — budget
real review time for it.

### Recommended approach — no framework

The codebase is deliberately build-step-free for the web target. Keep it
that way:

```js
// www/js/i18n.js  — loaded FIRST, before config.js
const STRINGS = {
  fr: {
    "toast.merge_ok": "Fusion réussie !",
    "god.erebus.title": "le Voilé" /* ... */,
  },
  en: {
    "toast.merge_ok": "Merged!",
    "god.erebus.title": "the Veiled" /* ... */,
  },
};
let LANG = "fr";
function setLang(l) {
  LANG = STRINGS[l] ? l : "fr";
}
function t(key, vars) {
  let s = (STRINGS[LANG] && STRINGS[LANG][key]) || STRINGS.fr[key] || key;
  if (vars) for (const k in vars) s = s.replaceAll("{" + k + "}", vars[k]);
  return s;
}
```

### Migration in four waves

1. **`config.js` data.** Replace `name:` / `desc:` literals with keys
   (`nameKey: "god.erebus.name"`) and resolve them at render time. This is
   the biggest single chunk but it is mechanical and low-risk.
2. **`index.html`.** Add `data-i18n="key"` attributes to static text nodes,
   then one pass at boot:
   `document.querySelectorAll("[data-i18n]").forEach(e => e.textContent = t(e.dataset.i18n))`.
3. **`ui.js` / `input.js` runtime strings.** Wrap in `t()`. Watch the
   template literals with interpolation — those need the `{var}` placeholder
   form, not JS interpolation, or the two languages can't share word order.
4. **`native-bridge.js` notifications.** Route through `t()` and re-schedule
   when the language changes.

### Language selection

- Detect once on first launch: `navigator.language.startsWith("fr") ? "fr" : "en"`.
- Persist in `state.settings.lang` (additive field — `deepFill` handles it,
  **no `SAVE_VERSION` bump**, see P1-4).
- Add a language row in the Settings panel; re-run `renderAll()` on change.
- Set `<html lang>` dynamically to match.

### Things that are easy to miss

- `formatNumber` suffixes (`K/M/B/T/Qa…`) are already English-ish and can
  stay, but French convention differs — decide and be consistent.
- `formatDuration` returns `"4h 30m"` — fine in both, but check `"j"` vs `"d"`
  for days if you add it.
- **`InfoPlist.strings`** must be localized too: the ATT prompt
  (`NSUserTrackingUsageDescription`) and any permission strings. Add
  `CFBundleLocalizations = ["fr", "en"]`.
- **App Store Connect** needs a full English localization: name, subtitle,
  description, keywords, what's new, **and English screenshots**. This is
  separate work from the in-app strings and is frequently forgotten.
- The default profile name `"Étincelle"` and emoji (`state.js:107`) should
  become `"Spark"` in English — but only for _new_ saves, never retroactively.

**Effort:** extraction 1.5 days · translation + review 1.5 days · wiring
1.5 days · QA both languages 1 day = **5–6 days**.

**Why P2 and not P1:** French-only is perfectly acceptable to Apple and the
game ships without it. But English roughly multiplies the addressable market
for an idle game, and doing it _after_ launch means re-screenshotting and
re-submitting everything. **If you can afford the 5–6 days, do it before
launch** — it is far cheaper now than in v1.1.

---

## P2-2. Repo hygiene — 430 KB of dead duplicates

- `game-full.html` and `cosmerge-v2.html` are **byte-identical** (same MD5,
  204,460 bytes each).
- `game.html` (27 KB) is a stale pre-refactor version of the game.
- `assets/ios-icons/` predates the logo redesign — `docs/QA_CHECKLIST.md` §5
  already flags it as needing regeneration, not reuse.
- `assets/screenshots/` predates several UI redesigns.

**Fix:** delete `game.html`; keep **one** single-file export (pick a name,
document how it's regenerated, or better — add an `npm run bundle` script so
it's reproducible rather than committed); regenerate icons from
`www/icon-512.png` upscaled to a true 1024×1024 (no alpha, no rounded
corners); retake all screenshots after the UI is final.

**Effort:** 0.5 day (plus screenshot time).

---

## P2-3. No automated tests, no CI, one commit

`docs/QA_CHECKLIST.md` is a good manual checklist, but every economy formula
(`bigBangGain`, `unlockCost`, `tierProd`, `productionMultiplier`,
`offlineCapHours`, `computeOfflineGain`) is pure and trivially testable —
and these are exactly the functions where a silent regression destroys the
game balance for everyone.

**Fix:** add Vitest and ~30 unit tests over `config.js` + `economy.js` +
`state.js` (migrations especially). Add a GitHub Action running
`npm run build` + tests on push. Start committing in meaningful increments.

**Effort:** 1.5 days. Pays for itself the first time you touch the economy.

---

# P3 — Hygiene

- **`appId` is still `com.example.spacemerge`** (`capacitor.config.ts:5`).
  Trivial, but it blocks `cap add ios` from being correct — do it first.
- **Cache-busting `?v=20` is manual** on all 10 script tags
  (`index.html:324-333`). Vite hashes filenames on the native build, so this
  only matters for the web deploy — but it _will_ be forgotten at some point.
  Automate or drop it.
- **`README.md` still refers to `nebula-merge`** in `docs/BUILD_IOS.md:22`
  (`cd nebula-merge`) — stale project name.
- **Error reporting.** Every native failure is a silent `console.warn`. Once
  live you have zero visibility. Add Sentry (or equivalent) with a
  privacy-safe config, and disclose it in the App Privacy answers.

---

# S — Project structure

Assessed separately from the defect list above, because the question
"should this be restructured before shipping?" has a different answer than
"what is broken?".

## S-0. Verdict

**The module layer is clean and should not be restructured before launch.**
What is broken is the _build boundary_ and the _repository topology_, not the
code organisation. Those are ~2 days of work; a full restructure would be
weeks and would invalidate the manual QA already recorded in
`docs/QA_CHECKLIST.md`.

### What holds up under inspection

- **Layering is real and respected.** `config` (data/formulas) → `state`
  (persistence/derived) → `economy`/`gods`/`retention` (rules) →
  `ui`/`input` (presentation) → `main` (loop). Every non-UI module was
  grepped for DOM access; only **two** violations exist:
  `gods.js:72` calls `toast()`, and `services.js` builds DOM directly
  (defensible — it is the web ad simulation).
- **No dangling DOM references.** 121 unique `$("id")` lookups across
  `ui.js`/`input.js`/`main.js` vs 123 ids in `index.html`, **zero
  mismatches**. Only `drawer` and `fabStack` are unreferenced from JS (CSS
  and selector targets). For hand-written vanilla DOM with no compiler
  checking it, that is disciplined.
- **Rules functions take `state` as a parameter** rather than reaching for
  the `Game` global, which is why the economy is unit-testable today with
  zero refactoring (see P2-3).

### Latent fragility

`state.js` calls `getGodEffects()` from `gods.js`, which loads **four script
tags later** (`index.html:325` vs `:329`). It works only because the call is
runtime-deferred, never at load time. Script order in `index.html` is
load-bearing and undocumented. Add a comment block there stating the required
order and why, or the next person to "tidy" those tags will break boot.

---

## S-1. `www/` is three things at once — the root cause of several P0s

`www/` is simultaneously the **source tree**, the **web deploy artifact**
(rsynced to a separate repo, see S-3), and the **iOS bundle input**. This
single ambiguity produces:

- **~1 MB of web-only assets shipped inside the native app**:
  `social-share.png` (754 KB), `icon-512.png` (276 KB), `favicon.png`
  (2 KB), `apple-touch-icon.png` (37 KB), `privacy.html` (10 KB). None of
  these serve any purpose in a native build — `social-share.png` exists
  purely for link-preview crawlers.
- **`native-bridge.js` is not in `index.html`.** `docs/BUILD_IOS.md` §3
  instructs you to hand-edit the script tag in before building. A manual,
  unversioned, forgettable step stands between the repo and every native
  feature — and it is the structural reason P0-7 (test credentials) and
  P1-2 (boot race) were never caught.
- **No home for non-shipping files.** Tests, i18n source catalogues, and
  tooling have nowhere to live that is not also the app bundle.

### Fix — one real entry point (do this first)

1. Add `<script type="module" src="js/native-bridge.js"></script>` to
   `index.html` **permanently**. It already no-ops when `window.Capacitor`
   is undefined, so the web build is unaffected. Delete §3 from
   `BUILD_IOS.md`.
2. Move web-only assets to `www/web-only/` and exclude that directory from
   the native build (Vite `build.rollupOptions.external`, or a post-build
   prune step in `npm run sync`). Keep the `og:`/`twitter:` meta tags
   pointing at absolute URLs — they must be absolute anyway (see the
   existing comment at `index.html:17-19`).
3. Add the build-time credential guard from P0-7 to the same script, so
   "can this ship?" is one command.

**Effort:** 0.5–1 day. **Required** — several P0/P1 items depend on it.

---

## S-2. God files by accretion

| File        | Lines | Functions | Doing                                                                                                                            |
| ----------- | ----- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ui.js`     | 1,031 | 67        | board rendering + panel system + **22 hand-rolled `openXModal`/`closeXModal` pairs** (41 raw `classList.toggle("hidden")` calls) |
| `input.js`  | 772   | 46        | pointer gestures + business handlers (`onBuyIAP`, `onChooseGod`) + ad orchestration + event wiring                               |
| `config.js` | 427   | —         | tuning constants + **~350 strings of content** (90 achievements, gods, quests, lore) + formulas                                  |

None of this blocks shipping. Two of the three are worth splitting, and the
**timing differs**:

- **`config.js` → split before i18n, not after.** English localization
  (P2-1) touches ~350 strings _inside this file_. Splitting content out
  first (`balance.js` for constants + formulas, `content/gods.js`,
  `content/achievements.js`, `content/quests.js`, `content/lore.js`) turns
  the i18n migration into "swap one content module for a keyed one" instead
  of surgery through a file that also holds your balance constants. In the
  wrong order you pay for it twice. **1 day, scheduled immediately before
  Sprint 6.**
- **`ui.js` → split after launch.** `render.js` / `panels.js` / `modals.js`,
  with a single `Modal.open(id)` / `Modal.close(id)` helper replacing the 22
  pairs (~150 lines removed). Real maintainability win, zero shipping
  benefit. **2 days, post-launch.**
- **`input.js` → leave alone.** The gesture code and the handler code are
  both cohesive internally; splitting adds files without reducing coupling.

---

## S-3. One repository for web + iOS + Android — yes, consolidate

### Current topology

| Repo                                                    | Visibility | Role                                                        | Commits                                         |
| ------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ----------------------------------------------- |
| `ZAPPAgency/godspark` (remote still `godspark-app.git`) | **Public** | full project, `ios/` gitignored                             | **1** ("Initial commit: full Godspark project") |
| `ZAPPAgency/Cosmerge`                                   | **Public** | GitHub Pages web deploy, receives an `rsync` copy of `www/` | **5+**, with real messages                      |

### Why the split should go

1. **The stated reason does not apply.** A source/deploy split is usually
   justified by keeping source private while the deploy is public. **Both
   repos are public.** There is nothing being protected.
2. **The history is in the wrong repo.** `Cosmerge` holds the actual
   development history — _"Disclose Cosmic Box odds in the shop card (Apple
   Guideline 3.1.1)"_, _"Split skins into ambiance + emoji set"_, _"Rename
   to Godspark; remove Fusion Express"_. The "real" repo has a single
   squashed commit. Design rationale that would answer _"why is it like
   this?"_ in six months lives in the repo you are treating as
   disposable output.
3. **`rsync -a --delete` is not a deployment.** It is a manual copy with no
   provenance, no CI, no build step, and no way to detect drift. Today the
   trees happen to match; nothing enforces that, and nothing will tell you
   when they stop.
4. **Capacitor is explicitly built for one codebase → many platforms.**
   Adding Android means a third target. Three repos synced by hand is not a
   structure, it is a habit.

### Target topology

**One repo. One source tree. Three build targets.**

```
godspark/
├─ www/                  # single source of truth (unchanged)
│  ├─ index.html         # includes native-bridge.js permanently (S-1)
│  ├─ css/  js/  content/
│  └─ web-only/          # excluded from native builds (S-1)
├─ ios/                  # COMMITTED (see below)
├─ android/              # COMMITTED, added later
├─ dist-www/             # build output, gitignored
├─ assets/               # source assets + generators
├─ docs/
├─ tests/
└─ .github/workflows/
   ├─ web-deploy.yml     # replaces the rsync
   └─ ci.yml             # build + unit tests on push (P2-3)
```

### Commit `ios/` and `android/` — remove `ios/` from `.gitignore`

This is the single highest-value change in this section, and the current
`.gitignore:3` gets it backwards.

Capacitor's own guidance is to treat the native projects as **source, not
build output**, because you edit them by hand and `cap sync` does **not**
regenerate them. On this project specifically, all of the following will
live in `ios/` and are currently unversioned:

- `Info.plist` — `GADApplicationIdentifier`, the ~100-entry
  `SKAdNetworkItems` array, `NSUserTrackingUsageDescription` (P0-6),
  `CFBundleLocalizations` (P2-1)
- `App.entitlements` — **iCloud Key-Value Store** (required by the cloud
  save in P1-1) and Game Center
- Signing team, capability toggles, `AppDelegate` changes for the custom
  iCloud plugin
- `InfoPlist.strings` for the French/English permission prompts (P2-1)

If `ios/` stays ignored, every one of those is a manual step that exists
only on your machine, is invisible in review, and is lost on a fresh clone
or a new laptop. Losing an entitlements file after configuring cloud save is
a genuinely painful failure.

Replace `.gitignore`'s blanket `ios/` with:

```gitignore
node_modules/
dist-www/
.DS_Store
*.log

# iOS — commit the project, ignore only generated/build artefacts
ios/App/Pods/
ios/App/build/
ios/App/App/public/        # the synced web build; regenerated by `cap sync`
ios/App/Podfile.lock       # optional: commit this if you want reproducible pods
DerivedData/
*.xcuserstate
xcuserdata/

# Android — same principle
android/app/build/
android/build/
android/.gradle/
android/local.properties
android/app/src/main/assets/public/   # synced web build
```

> Note: committing `Podfile.lock` is the safer default for a solo shipper —
> it pins the AdMob/RevenueCat pod versions so a rebuild months later does
> not silently pick up a new major.

### Migration plan

1. **Preserve the real history first.** Do not discard `Cosmerge`:
   ```bash
   git remote add web-history git@github.com:ZAPPAgency/Cosmerge.git
   git fetch web-history
   git merge web-history/main --allow-unrelated-histories -m "Graft web deploy history"
   # resolve in favour of the current www/ (the trees already match)
   ```
   Or, if a merge is more trouble than it is worth, keep the branch
   unmerged for the record: `git checkout -b history/web web-history/main`.
2. **Replace the rsync with CI.** A GitHub Action on push to `main`:
   `npm ci && npm run build`, then publish `dist-www/` to GitHub Pages. The
   web build now goes through the _same_ Vite build as the app, so the two
   can no longer diverge — which also means the web version finally exercises
   the `native-bridge.js` no-op path that ships in the app.
3. **Keep the public URL alive.** `https://zappagency.github.io/Cosmerge/`
   is presumably shared somewhere. Either enable Pages on the main repo and
   have CI push the built output to `Cosmerge` (repo becomes a dumb,
   CI-only deploy target that no human commits to), or leave a redirect
   `index.html` there pointing at the new URL. Do **not** leave it as a
   hand-synced source copy.
4. **Fix the remote name.** The repo has been renamed to `ZAPPAgency/godspark`
   but `origin` still points at `godspark-app.git` (working only via
   GitHub's redirect). `git remote set-url origin git@github.com:ZAPPAgency/godspark.git`.
5. **Then** `npx cap add ios` and commit the result.

**Effort:** 1 day total (history graft + Action + gitignore + remote).

### The one real counter-argument

If you later want the game source **closed** while the web demo stays
public, you would want the split back. Handle that when it happens by making
the deploy repo CI-written-only (step 3 above) — that structure works
whether the source repo is public or private, and costs nothing now.

---

## Structural work, sequenced

| #    | Item                                                                 | Priority          | Effort  | When                                   |
| ---- | -------------------------------------------------------------------- | ----------------- | ------- | -------------------------------------- |
| S-1  | One real entry point; web-only assets out of the native bundle       | **P1 (do first)** | 0.5–1 d | Sprint 1                               |
| S-3  | Consolidate to one repo; commit `ios/`; CI web deploy; graft history | **P1**            | 1 d     | Sprint 1                               |
| S-0  | Document the load-bearing script order in `index.html`               | P3                | 15 min  | Sprint 1                               |
| S-2a | Split `config.js` into `balance.js` + `content/`                     | P2                | 1 d     | **Immediately before Sprint 6 (i18n)** |
| S-2b | Split `ui.js`; unify the 22 modal pairs behind `Modal.open/close`    | P3                | 2 d     | Post-launch                            |

---

# Consolidated priority table

| #    | Item                                                           | Priority             | Effort        | Blocks launch                           |
| ---- | -------------------------------------------------------------- | -------------------- | ------------- | --------------------------------------- |
| S-3  | **Consolidate to one repo**; commit `ios/`; CI web deploy      | **P1 (do first)**    | 1 d           | Blocks Android, cloud-save entitlements |
| S-1  | One real entry point; web-only assets out of the native bundle | **P1 (do first)**    | 0.5–1 d       | Blocks P0-7, P1-2                       |
| P1-2 | Fix native boot race                                           | **P1 (do first)**    | 0.5 d         | Blocks P0-3, P1-1                       |
| P3   | Set real `appId` + fix `origin` remote URL                     | P3                   | 10 min        | Blocks `cap add ios`                    |
| P0-2 | Remove/implement ad banner placeholder                         | **P0**               | 15 min – 1 d  | ✅                                      |
| P0-3 | RevenueCat entitlements as source of truth                     | **P0**               | 2 d           | ✅                                      |
| P0-1 | Working Restore Purchases                                      | **P0**               | 0.5 d         | ✅                                      |
| P0-5 | Store-fetched localized prices                                 | **P0**               | 0.5 d         | ✅                                      |
| P0-4 | EULA + privacy links at point of purchase                      | **P0**               | 0.5 d         | ✅                                      |
| P0-6 | ATT flow (or go non-personalized)                              | **P0**               | 1 d / 1 h     | ✅                                      |
| P0-7 | Real AdMob + RevenueCat credentials, env guard                 | **P0**               | 0.5 d         | ✅                                      |
| P1-1 | **Cloud save (iCloud KVS)**                                    | **P1 → treat as P0** | 3–4 d         | Strongly advised                        |
| P1-4 | Save migration chain, no silent wipe                           | P1                   | 0.5 d         | Advised                                 |
| P1-3 | Throttle persistence to 10 s                                   | P1                   | 0.5 d         | Advised                                 |
| P1-5 | Leaderboard UI entry point                                     | P1                   | 0.5 d         | –                                       |
| P1-6 | Sanitize `importSaveCode`                                      | P1                   | 1 h           | –                                       |
| S-2a | Split `config.js` into `balance.js` + `content/`               | P2                   | 1 d           | Do **before** P2-1                      |
| P2-1 | **English localization**                                       | P2                   | 5–6 d         | Recommended pre-launch                  |
| P2-2 | Repo cleanup, regenerate icons & screenshots                   | P2                   | 0.5 d + shoot | Icons ✅                                |
| P2-3 | Unit tests + CI                                                | P2                   | 1.5 d         | –                                       |
| S-2b | Split `ui.js`; unify the 22 modal pairs                        | P3                   | 2 d           | Post-launch                             |
| S-0  | Document load-bearing script order in `index.html`             | P3                   | 15 min        | –                                       |
| P3   | Sentry, cache-busting, stale docs                              | P3                   | 0.5 d         | –                                       |

---

# Suggested sequence

**Sprint 0 — fix the structure (2 days)**
S-3 consolidate the repos (graft `Cosmerge` history, replace the rsync with a
GitHub Action, rewrite `.gitignore` so `ios/` is committed, fix the `origin`
URL) → S-1 one real entry point (`native-bridge.js` permanently in
`index.html`, web-only assets excluded from the native bundle) → S-0 document
the script order. Doing this _before_ `cap add ios` means the native project
is version-controlled from its very first commit, which is the whole point.

**Sprint 1 — make it build (2–3 days)**
`appId` → `npm install` → `cap add ios` → **commit `ios/`** → fix
community-plugin API drift → first run on a real device. Nothing else matters
until this works, and `docs/BUILD_IOS.md` warns the plugin APIs may have
shifted.

**Sprint 2 — foundations (2 days)**
P1-2 boot race, P1-4 migrations, P1-3 persistence throttle. Everything below
sits on top of these.

**Sprint 3 — monetization correctness (4 days)**
P0-3 entitlements → P0-1 restore → P0-5 prices → P0-4 disclosure. Test the
whole loop in StoreKit Sandbox.

**Sprint 4 — remaining blockers (2 days)**
P0-2 banner, P0-6 ATT, P0-7 credentials, P1-5 leaderboards.

**Sprint 5 — cloud save (3–4 days)**
P1-1 end to end, including the conflict modal and the Settings sync status.

**Sprint 6 — English (6–7 days)**
S-2a split `config.js` first, then P2-1 in-app strings + App Store Connect English listing + English screenshots.

**Sprint 7 — ship (3–5 days)**
Assets, full `docs/QA_CHECKLIST.md` pass on real devices, TestFlight, submit.

**Totals**

| Scope                             | Focused working days | Solo part-time calendar |
| --------------------------------- | -------------------- | ----------------------- |
| Structural fixes only (Sprint 0)  | 2                    | 3–4 days                |
| Minimum shippable (Sprint 0 + P0) | 13–16                | 5–6 weeks               |
| **+ cloud save** (recommended)    | 17–20                | 6–7 weeks               |
| **+ English** (recommended)       | 23–27                | 8–10 weeks              |

Add **1–3 days** for Apple review, and budget for **one rejection round** —
with monetization this extensive, first-pass approval is optimistic.

**Android port afterwards: +5–8 days**, and Sprint 0 is what makes that
number achievable — `npx cap add android` into the same repo, behind the same
`CloudSaveService` / `AdService` / `IAPService` interfaces, with no third tree
to keep in sync. The web layer ports for free; you
redo AdMob Android, Google Play Billing through RevenueCat, Play Games
Services instead of Game Center, Play Games Saved Games behind the same
`CloudSaveService` interface, the Play Console data-safety form, and the
14-day closed-testing period now required for new personal developer
accounts.
