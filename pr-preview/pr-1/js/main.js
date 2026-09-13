// Godspark - boot sequence & main loop
"use strict";

// Legacy defensive code: early in this project's life the game was
// prototyped as a Claude Artifact, embedded cross-origin inside claude.ai's
// own iframe. On iOS Safari, a cross-origin iframe only gets persistent
// localStorage after an explicit grant via the Storage Access API - and that
// grant does not reliably survive a full browser/app restart, which caused
// real save loss in that context. The real fix, since then, is that the
// game no longer needs that context at all: it's hosted top-level on GitHub
// Pages (see README.md) and, going forward, ships as a Capacitor native app
// (native-bridge.js) using @capacitor/preferences instead of localStorage
// entirely - neither has this problem, since `window.self === window.top`
// on GitHub Pages and there is no iframe/ITP model on native at all.
//
// This function is kept as a harmless no-op safety net (the `embedded`
// check below is false in both of today's real deployments, so it returns
// immediately) rather than removed outright, in case the game is ever
// re-embedded in some other cross-origin host later. A previous version
// blocked boot behind a mandatory tap that called
// document.requestStorageAccess() - removed because that call's actual
// requirements (the embedding iframe's `sandbox` attribute needing
// `allow-storage-access-by-user-activation`) were never under this game's
// control anyway, so the tap gate was pure friction with zero guaranteed
// effect. See docs/SAVE_BACKUP.md and the in-app "Sauvegarde manuelle"
// export/import in the Réglages panel for the manual-backup mitigation that
// was actually needed during the Artifact-prototype period.
function requestStorageAccessBestEffort() {
  const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  if (!embedded || !document.hasStorageAccess || !document.requestStorageAccess) return;
  document.hasStorageAccess().then((has) => {
    if (!has) return document.requestStorageAccess().catch(() => {});
  }).catch(() => {});
}

(async function () {
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {}); // best-effort: ask the browser not to evict our save under storage pressure
  }
  requestStorageAccessBestEffort();

  const state = loadState();

  Object.assign(window.Game, {
    state,
    settings: state.settings,
    selectedIdx: null,
    cooldownUntil: new Array(TOTAL).fill(0),
    displayedStardust: state.stardust,
    lastAutoSpawn: performance.now(),
    tickAccumulator: 0,
    sessionStart: Date.now(),
    lastInterstitial: 0,
    skipCellArmed: false,
    swapArmed: false,
    swapFirstIdx: null,
    // Set when the current armed swap was earned by watching an ad (Loris:
    // offer that instead of a dead-end "Pas assez de Gems." when clicking
    // Échanger without enough Gems) - handleSwapTap (input.js) reads this to
    // skip the Gems cost entirely for this one swap.
    swapFree: false,
    // "Choisis une case" mode for the auto-clicker's target pick
    // (armAutoClickerPicker/handleAutoClickerPick, input.js) - same
    // in-memory, tap-only-mode pattern as swapArmed/skipCellArmed above.
    autoClickerArmed: false,
    // An ad was watched for the next auto-clicker activation but no cell has
    // been picked yet (onAutoClickerClick, input.js) - lets a cancelled picker
    // be reopened without watching another ad.
    autoClickerPaid: false,
    // Queued god ids awaiting their unlock-reveal modal (Loris: "il n'y a
    // pas de pop up quand on débloque un nouveau dieu hormis pour les deux
    // premiers") - unlockGod() (gods.js) pushes here, maybeOpenGodRevealModal()
    // (ui.js) consumes one at the next safe moment, same pattern as
    // Game.pendingGodRitual/pendingPromo below.
    pendingGodReveals: [],
    // How many merges have landed within MERGE_STREAK_WINDOW_MS of each
    // other (see attemptMerge in input.js) - scales the impact effect and
    // raises the reward chime's pitch a step each time, so chaining merges
    // fast feels increasingly rewarding rather than just repetitive.
    mergeStreak: 0,
    lastMergeAt: 0,
    // Rolling window of recent merge timestamps for the "La Cascade" easter
    // egg (EASTER_EGG_CHAIN_COUNT/MS, config.js) - in-memory only, unrelated
    // to mergeStreak above (that one's about the *visual* streak effect,
    // this one's a real detection window pruned in attemptMerge).
    mergeChainTimes: [],
    pendingOfflineGain: null,
    bigBangPromptShown: hasUniverseTile(state), // don't re-prompt on reload if a Universe tile already existed last save
    // Which fabs have already played their one-shot discovery pop
    // animation this session (revealFab/FAB_DISCOVERY_FUSIONS, ui.js) -
    // intentionally in-memory only, not saved: a returning player whose
    // fusions count already clears every threshold just sees them all pop
    // in once on this load, rather than the animation never playing again.
    fabRevealed: new Set(),
  });

  buildStars();
  buildGridDom();
  wireEvents();

  ensureDailyQuests(state);
  ensureDailySpin(state);
  ensureDailyStats(state);
  grantVipDailyGemsIfDue(state);
  checkAchievements(state);
  checkGodMilestones(state);

  const gainInfo = computeOfflineGain(state, Date.now());
  const spawnedAtBoot = applyOfflineAutoSpawns(state, gainInfo.cappedMs);
  // Claim the offline window immediately by refreshing lastSaveTime, BEFORE
  // any resume event can run. `pageshow` always fires right after load and is
  // wired to handleAppResume() below - without this, that guaranteed first
  // resume recomputed the exact same elapsed span (nothing had saved yet: the
  // tick-save needs ~1s, the autosave 5s) and applied it a second time.
  // applyOfflineAutoSpawns() is not idempotent, so that meant double
  // meteorites and double "autoSpawns" quest progress on every cold start
  // after an absence. The `resuming` flag below can't catch it - it guards
  // simultaneous events, not a sequential boot-then-pageshow pair.
  saveState(state);

  renderAll();

  if (!state.tutorialSeen) {
    $("tutOverlay").classList.remove("hidden");
    showTutStep(0);
  } else if (gainInfo.gain >= 1) {
    openOfflineModal(gainInfo, spawnedAtBoot);
  } else {
    // Safety net: checkGodMilestones(state) above could in principle have
    // just queued a reveal (e.g. an imported save code that already clears
    // a milestone) - in the ordinary case (unlocks happen mid-merge/mid-run)
    // this is a no-op, the queue is still empty at boot.
    maybeOpenGodRevealModal();
  }
  // Loris: "j'aimerais que ce soit bien un pop up qui apparaisse devant
  // l'écran [...] pas simplement une petite bannière en bas" - unconditional
  // (not nested above): a brand new player on the tutorial branch can never
  // have Game.pendingVipGems set anyway (no VIP before ever finishing the
  // tutorial), so this only ever does something for a returning VIP player.
  maybeOpenVipGemsModal();

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.25);
    lastFrame = now;

    Game.tickAccumulator += dt;
    let ticked = false;
    while (Game.tickAccumulator >= 1) {
      Game.tickAccumulator -= 1;
      grantStardust(Game.state, totalProduction(Game.state));
      ticked = true;
    }
    // Flush to storage on every tick (≈ once/second while the game is open),
    // instead of relying on a longer interval or an unload/visibility event.
    // Those events are not guaranteed to fire before the page is torn down
    // in every hosting context (e.g. an embedded webview), so the safest
    // guarantee is: never be more than ~1s of progress away from disk.
    if (ticked) saveState(Game.state);

    Game.displayedStardust += (Game.state.stardust - Game.displayedStardust) * Math.min(1, dt * 8);
    if (Math.abs(Game.state.stardust - Game.displayedStardust) < 0.05) Game.displayedStardust = Game.state.stardust;

    tickAutoSpawn(now);
    tickAutoClicker();

    updateHeader();
    updateFabs();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  setInterval(() => saveState(Game.state), AUTOSAVE_MS);
  window.addEventListener("pagehide", () => saveState(Game.state));
  window.addEventListener("beforeunload", () => saveState(Game.state));
  window.addEventListener("blur", () => saveState(Game.state));
  // Offline gains were only ever computed once, at the very first page load.
  // Backgrounding the tab/app (switching apps, locking the phone) without a
  // full reload never re-ran that check - and the main loop's frame() clamps
  // dt to 0.25s specifically to survive a brief pause without a huge single
  // tick, which as a side effect silently discarded any longer time spent
  // away instead of crediting it. This computes the catch-up on resume too,
  // and resets lastFrame so the next tick doesn't also try to claim that gap.
  //
  // Wired to BOTH visibilitychange AND focus/pageshow (not just
  // visibilitychange alone): mobile Safari/WKWebView don't reliably fire
  // visibilitychange on every "switched to another app, then back" cycle -
  // this was reported as auto-spawns simply not resuming after a
  // backgrounding that didn't fully close the app. saveState() at the end
  // makes repeat calls safe (lastSaveTime is current by the time a second,
  // redundant event fires, so it computes ~0 elapsed and no-ops).
  //
  // Only a real absence counts as "offline". focus/pageshow also fire when
  // nothing was ever paused - pageshow right after every load, focus after
  // any desktop blur, or when a native rewarded ad hands focus back - and
  // while the main loop runs it tick-saves every second, so lastSaveTime is
  // at most ~1s old there. Treating that sliver as an absence popped an
  // offline modal reading "Temps écoulé : 1s +N" for any player past ~2
  // Stardust/s (Loris' "1sec - 1 stardust" report), and on desktop re-paid
  // production the loop had already granted. Below this threshold the gap
  // is simply left alone; a backgrounding that short loses a few seconds of
  // half-rate production at most.
  const OFFLINE_RESUME_MIN_MS = 10000;
  let resuming = false;
  function handleAppResume() {
    if (resuming) return; // re-entrancy guard - visibilitychange+focus can fire back to back
    resuming = true;
    unmuteAllAudio();
    if (Game.settings.music) MusicService.start();
    ensureDailyStats(Game.state);
    grantVipDailyGemsIfDue(Game.state);
    const info = computeOfflineGain(Game.state, Date.now());
    if (info.elapsedMs >= OFFLINE_RESUME_MIN_MS) {
      const spawned = applyOfflineAutoSpawns(Game.state, info.cappedMs);
      if (spawned > 0) renderAll();
      if (info.gain >= 1) openOfflineModal(info, spawned); // adds to a still-uncollected gain rather than replacing it - see openOfflineModal
    }
    maybeOpenVipGemsModal();
    lastFrame = performance.now();
    saveState(Game.state); // refreshes lastSaveTime so a redundant resume event is a no-op
    resuming = false;
  }
  function handleAppHide() {
    saveState(Game.state);
    MusicService.stop(); // stop scheduling further chords/sparkles
    muteAllAudio(); // clean fade of EVERYTHING currently sounding (SFX included) instead of the OS abruptly cutting it mid-envelope (the "bizarre"/dull click on close)
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handleAppHide();
    else handleAppResume();
  });
  window.addEventListener("focus", handleAppResume);
  window.addEventListener("pageshow", handleAppResume);
})();
