// Spacemerge - boot sequence & main loop
"use strict";

// Asks for storage access when the game runs inside a cross-origin iframe, where
// iOS Safari may not persist localStorage. No-op on GitHub Pages and native builds.
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
    // The armed swap was paid with an ad: handleSwapTap skips the Gems cost once.
    swapFree: false,
    // Waiting for the player to pick the auto-clicker's target cell.
    autoClickerArmed: false,
    // God ids waiting for their unlock modal (maybeOpenGodRevealModal, ui.js).
    pendingGodReveals: [],
    // Merges chained within MERGE_STREAK_WINDOW_MS; raises the combo chime.
    mergeStreak: 0,
    lastMergeAt: 0,
    // Recent merge timestamps for the "La Cascade" easter egg (EASTER_EGG_CHAIN_*).
    mergeChainTimes: [],
    pendingOfflineGain: null,
    bigBangPromptShown: hasUniverseTile(state), // don't re-prompt on reload if a Universe tile already existed last save
    // Fabs that played their reveal animation. Not saved, so it replays once per launch.
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
  // Save now to refresh lastSaveTime: `pageshow` fires right after load and would
  // otherwise apply the same offline spawns a second time.
  saveState(state);

  renderAll();

  if (!state.tutorialSeen) {
    $("tutOverlay").classList.remove("hidden");
    showTutStep(0);
  } else if (gainInfo.gain >= 1) {
    openOfflineModal(gainInfo, spawnedAtBoot);
  } else {
    // checkGodMilestones() above may have queued a reveal (e.g. imported save).
    maybeOpenGodRevealModal();
  }
  // Outside the branches: only a returning VIP can have pending Gems.
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
  // Also wired to focus/pageshow: WKWebView doesn't always fire visibilitychange.
  // The final saveState() makes a duplicate event compute ~0 elapsed.
  //
  // focus/pageshow also fire without a real absence (after load, after an ad).
  // Gaps under OFFLINE_RESUME_MIN_MS are ignored so the loop's production isn't paid twice.
  const OFFLINE_RESUME_MIN_MS = 10000;
  let resuming = false;
  function handleAppResume() {
    if (resuming) return; // visibilitychange and focus can fire back to back
    resuming = true;
    unmuteAllAudio();
    if (Game.settings.music) MusicService.start();
    ensureDailyStats(Game.state);
    grantVipDailyGemsIfDue(Game.state);
    const info = computeOfflineGain(Game.state, Date.now());
    if (info.elapsedMs >= OFFLINE_RESUME_MIN_MS) {
      const spawned = applyOfflineAutoSpawns(Game.state, info.cappedMs);
      if (spawned > 0) renderAll();
      if (info.gain >= 1) openOfflineModal(info, spawned); // adds to an uncollected gain
    }
    maybeOpenVipGemsModal();
    lastFrame = performance.now();
    saveState(Game.state);
    resuming = false;
  }
  function handleAppHide() {
    saveState(Game.state);
    MusicService.stop();
    muteAllAudio(); // fade out all sounds, otherwise the OS cut makes an audible click
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handleAppHide();
    else handleAppResume();
  });
  window.addEventListener("focus", handleAppResume);
  window.addEventListener("pageshow", handleAppResume);
})();
