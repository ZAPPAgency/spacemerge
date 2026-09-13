// Godspark - boot sequence & main loop
"use strict";

// This page is normally embedded cross-origin (the Claude Artifact iframe,
// e.g. b7a8...frame.claudeusercontent.com inside claude.ai). On iOS Safari,
// a cross-origin iframe only gets persistent localStorage after an explicit
// grant via the Storage Access API - and that grant does not reliably
// survive a full browser/app restart, which is the save-loss bug this is
// working around.
//
// A previous version of this function blocked boot behind a mandatory tap
// that called document.requestStorageAccess(). That call requires the
// embedding iframe's `sandbox` attribute to include
// `allow-storage-access-by-user-activation` - and Claude's artifact iframe
// (sandbox="allow-scripts allow-same-origin allow-forms") does not have
// that flag, so the call always silently fails there. The tap gate was
// therefore pure friction with zero effect, so it's gone. We still fire the
// request in the background (harmless, and it *would* help on any host that
// does grant the flag), but nothing blocks on it, and it is NOT the actual
// fix for save loss - see docs/SAVE_BACKUP.md and the in-app "Sauvegarde
// manuelle" export/import in the Réglages panel for the real mitigation
// available while running inside this specific iframe sandbox.
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
    pendingOfflineGain: null,
    bigBangPromptShown: hasUniverseTile(state), // don't re-prompt on reload if a Universe tile already existed last save
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

  renderAll();

  if (!state.tutorialSeen) {
    $("tutOverlay").classList.remove("hidden");
    showTutStep(0);
  } else if (gainInfo.gain >= 1) {
    openOfflineModal(gainInfo, spawnedAtBoot);
  }

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
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      saveState(Game.state);
      MusicService.stop(); // stop scheduling further chords/sparkles
      muteAllAudio(); // clean fade of EVERYTHING currently sounding (SFX included) instead of the OS abruptly cutting it mid-envelope (the "bizarre"/dull click on close)
      return;
    }
    unmuteAllAudio();
    if (Game.settings.music) MusicService.start();
    ensureDailyStats(Game.state);
    grantVipDailyGemsIfDue(Game.state);
    const info = computeOfflineGain(Game.state, Date.now());
    const spawned = applyOfflineAutoSpawns(Game.state, info.cappedMs);
    if (spawned > 0) renderAll();
    if (info.gain >= 1) openOfflineModal(info, spawned);
    lastFrame = performance.now();
  });
})();
