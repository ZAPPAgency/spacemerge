// Godspark - pointer input (drag/tap merge) + all button/action handlers
"use strict";

function localPos(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
function cellIdxAtPoint(x, y) {
  const target = document.elementFromPoint(x, y);
  if (!target) return null;
  const cellEl = target.closest(".cell");
  if (!cellEl) return null;
  return parseInt(cellEl.dataset.idx, 10);
}
function createGhost(tier, x, y) {
  const g = document.createElement("div");
  g.className = "ghostTile";
  g.style.cssText += tierStyle(tier);
  g.appendChild(tierIconNode(tier));
  g.style.left = x + "px"; g.style.top = y + "px";
  document.body.appendChild(g);
  return g;
}

let pointerState = null;
let pointerWatchdog = null;

// A touch fires both pointerdown and touchstart, and webviews can drop up/cancel events.
// Without these guards a tile could stay stuck invisible under an orphaned drag ghost:
// - ignore a new pointerdown while a gesture is tracked
// - clean up on pointercancel/touchcancel
// - a watchdog timeout cancels a gesture that never ends
function onPointerDown(e) {
  if (!dom.panelOverlay.classList.contains("hidden") || !dom.drawerOverlay.classList.contains("hidden")) return;
  if (pointerState) return; // gesture already tracked, see note above
  const pos = localPos(e);
  const idx = cellIdxAtPoint(pos.x, pos.y);
  if (idx === null) return;
  e.preventDefault();
  ensureAudio();

  const state = Game.state;
  if (!state.unlocked[idx]) {
    handleLockedTap(idx);
    return;
  }

  pointerState = { idx, startX: pos.x, startY: pos.y, dragging: false, ghostEl: null };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);
  window.addEventListener("touchcancel", onPointerCancel);
  clearTimeout(pointerWatchdog);
  pointerWatchdog = setTimeout(() => { if (pointerState) onPointerCancel(); }, 6000);
}

function endPointerListeners() {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
  window.removeEventListener("touchmove", onPointerMove);
  window.removeEventListener("touchend", onPointerUp);
  window.removeEventListener("touchcancel", onPointerCancel);
  clearTimeout(pointerWatchdog);
}

// Gesture interrupted (system gesture, focus loss, watchdog). Cleans up without merging.
function onPointerCancel() {
  if (!pointerState) return;
  const { idx, ghostEl } = pointerState;
  endPointerListeners();
  pointerState = null;
  if (ghostEl) ghostEl.remove();
  cellEls[idx].querySelector(".tile")?.classList.remove("dragging");
}

function onPointerMove(e) {
  if (!pointerState) return;
  const pos = localPos(e);
  const dx = pos.x - pointerState.startX, dy = pos.y - pointerState.startY;
  if (!pointerState.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    if (Game.swapArmed || Game.autoClickerArmed) return; // tap-only modes
    const tileData = Game.state.grid[pointerState.idx];
    if (!tileData) return;
    pointerState.dragging = true;
    cellEls[pointerState.idx].querySelector(".tile")?.classList.add("dragging");
    pointerState.ghostEl = createGhost(tileData.tier, pos.x, pos.y);
  }
  if (pointerState.dragging && pointerState.ghostEl) {
    e.preventDefault && e.preventDefault();
    pointerState.ghostEl.style.left = pos.x + "px";
    pointerState.ghostEl.style.top = pos.y + "px";
  }
}

function onPointerUp(e) {
  if (!pointerState) return;
  endPointerListeners();

  const pos = localPos(e);
  const { idx, dragging, ghostEl } = pointerState;
  pointerState = null;
  if (ghostEl) ghostEl.remove();
  cellEls[idx].querySelector(".tile")?.classList.remove("dragging");

  if (dragging) {
    const targetIdx = cellIdxAtPoint(pos.x, pos.y);
    if (targetIdx !== null && targetIdx !== idx && Game.state.unlocked[targetIdx] && Game.state.grid[targetIdx] && areAdjacent(idx, targetIdx)) {
      attemptMerge(idx, targetIdx);
    } else {
      renderCell(idx);
    }
    clearSelection();
    return;
  }
  handleTap(idx);
}

// Two-tap flow for the "Échanger deux cases" shop item: Gems are only
// charged once a second, different, unlocked cell is chosen (see
// buyGemShopItem's "swapCells" case in economy.js) - tapping the first cell
// again cancels the pick rather than charging for a no-op swap with itself.
function handleSwapTap(idx) {
  const state = Game.state;
  if (!state.unlocked[idx]) { toast("Choisis deux cases débloquées."); Sfx.error(); return; }
  if (Game.swapFirstIdx === null) {
    Game.swapFirstIdx = idx;
    selectCell(idx);
    toast("Choisis la seconde case à échanger.");
    return;
  }
  if (Game.swapFirstIdx === idx) {
    Game.swapFirstIdx = null;
    clearSelection();
    toast("Sélection annulée. Choisis une case à échanger.");
    return;
  }
  const idxA = Game.swapFirstIdx, idxB = idx;
  const result = buyGemShopItem(state, "swapCells", { idxA, idxB, free: Game.swapFree });
  Game.swapArmed = false;
  Game.swapFirstIdx = null;
  Game.swapFree = false;
  clearSelection();
  if (result.ok) { Sfx.purchase(); toast("Cases échangées !"); }
  else { Sfx.error(); toast(result.reason === "funds" ? "Pas assez de Gems." : "Échange impossible."); }
  renderAll();
  saveState(state);
}

function handleTap(idx) {
  if (Game.swapArmed) { handleSwapTap(idx); return; }
  if (Game.autoClickerArmed) { handleAutoClickerPick(idx); return; }
  const state = Game.state;
  const tileHere = state.grid[idx];

  if (tileHere) {
    // Merging is drag-only: tapping a tile always grants the tap bonus.
    grantTapBonus(idx);
    return;
  }
  // Empty cell: tap selects/deselects it as the next invocation's target.
  if (Game.selectedIdx === idx) { clearSelection(); return; }
  selectCell(idx);
}

function handleLockedTap(idx) {
  const state = Game.state;
  if (Game.swapArmed) { toast("Choisis deux cases débloquées pour l'échange."); Sfx.error(); return; }
  if (Game.autoClickerArmed) { toast("Choisis une case débloquée avec une tuile."); Sfx.error(); return; }
  if (Game.skipCellArmed) {
    const result = buyGemShopItem(state, "skipCell", { cellIndex: idx });
    Game.skipCellArmed = false;
    if (result.ok) { Sfx.unlock(); toast("Case débloquée avec des Gems !"); }
    else { Sfx.error(); toast(result.reason === "funds" ? "Pas assez de Gems." : "Impossible de débloquer cette case."); }
    renderAll();
    if (result.ok) {
      renderCell(idx, { justUnlocked: true }); // unlock animation on top of renderAll()
      triggerResonanceIfLucky(state);
      // Résonance raises unlockCost() after renderAll(), so refresh the displayed prices.
      refreshLockedCellPrices();
    }
    saveState(state);
    return;
  }
  tryUnlock(idx);
}

// Merges closer than this count as a streak (raises the combo chime, see Sfx.meteorImpact).
const MERGE_STREAK_WINDOW_MS = 900;

function attemptMerge(fromIdx, toIdx) {
  const state = Game.state;
  const before = state.grid[fromIdx];
  if (!before) return;
  const result = performMerge(state, fromIdx, toIdx);
  if (!result) return;
  const now = performance.now();
  Game.mergeStreak = (now - Game.lastMergeAt < MERGE_STREAK_WINDOW_MS) ? Game.mergeStreak + 1 : 0;
  Game.lastMergeAt = now;
  // Easter egg "La Cascade": rolling window of recent merge times, kept in memory only.
  Game.mergeChainTimes.push(now);
  Game.mergeChainTimes = Game.mergeChainTimes.filter(t => now - t <= EASTER_EGG_CHAIN_MS);
  const chainEggResult = Game.mergeChainTimes.length >= EASTER_EGG_CHAIN_COUNT
    ? unlockEasterEgg(state, "merge_chain") : null;
  renderCell(fromIdx);
  // Keep the old tile visible and delay every reward cue until the impact (~110 ms later).
  renderMergeStandIn(toIdx, before.tier, before.cycle || 0);
  playMeteorMerge(toIdx, () => {
    renderCell(toIdx, { merged: true });
    HapticService.impact(result.newTier >= 8 ? "heavy" : "medium");
    if (result.gemBonus) toast("+1 💎 Gem bonus !");
    if (result.looped) {
      toast(`✨ Nouvelle boucle amorcée - palier ×${result.newCycle} !`);
    } else if (result.newTier === UNIVERSE_TIER) {
      // Univers is the Big Bang milestone, so its toast replays on every loop.
      toast("Univers créé ! 💥");
    } else if (result.newTier === TIERS.length) {
      toast(`${tierName(result.newTier)} atteint(e) - le sommet de la Création ! 🌟`);
    } else {
      toast(tierName(result.newTier) + " " + tierEmoji(result.newTier) + " !");
    }
    maybeOpenGodRitual();
    maybeOpenGodRevealModal();
    if (result.eggResult) revealEasterEgg(result.eggResult);
    if (chainEggResult) revealEasterEgg(chainEggResult);
  }, Game.mergeStreak, result.newTier);
  Sfx.meteorImpact(result.newTier, Game.mergeStreak);
  updateHeader();
  updateFabs();
  saveState(state);
  maybeOpenBigBangPrompt();
  maybeOpenFusionPromo();
}

// A toast alone was easy to miss - a player who reaches the Universe tile
// and doesn't realize Big Bang is how you "start a new game" can end up
// feeling stuck with nothing left to do. This surfaces it unmissably, once
// per run (reset in onBigBangConfirm), a beat after the merge animation.
function maybeOpenBigBangPrompt() {
  if (Game.bigBangPromptShown || !hasUniverseTile(Game.state)) return;
  Game.bigBangPromptShown = true;
  setTimeout(openBigBangModal, 700);
}

// Opens the VIP daily Gems modal queued by grantVipDailyGemsIfDue() (retention.js).
function maybeOpenVipGemsModal() {
  if (Game.pendingVipGems) {
    const amount = Game.pendingVipGems;
    Game.pendingVipGems = null;
    openVipGemsModal(amount);
  }
}

function maybeOpenGodRitual() {
  if (Game.pendingGodRitual) {
    Game.pendingGodRitual = false;
    openGodPickerModal();
  }
}

// Shows one queued god reveal (see unlockGod, gods.js). Waits while the ritual picker is open.
// closeGodUnlockModal (ui.js) and onChooseGod call this again to show the next one.
function maybeOpenGodRevealModal() {
  if (Game.pendingGodReveals.length === 0) return;
  if (!$("godRitualModal").classList.contains("hidden")) return;
  const godId = Game.pendingGodReveals.shift();
  openGodUnlockModal(godId);
}

// Delayed like maybeOpenBigBangPrompt so the merge effect lands first.
function maybeOpenFusionPromo() {
  if (!Game.pendingPromo) return;
  const kind = Game.pendingPromo;
  Game.pendingPromo = null;
  setTimeout(() => openFusionPromoModal(kind), 700);
}

// Returns the Stardust granted, or 0 if the cell is empty or on cooldown (usable as a boolean).
// `opts.auto`: tap from the auto-clicker. Same reward, but it must not:
// - reset the Erebus streak (the challenge forbids taps by the player only)
// - play a sound or save at ~7 times per second (the main loop already saves every second)
function grantTapBonus(idx, opts) {
  const now = performance.now();
  if (Game.cooldownUntil[idx] > now) return 0;
  const state = Game.state;
  const tile = state.grid[idx];
  if (!tile) return 0;
  const auto = opts && opts.auto;
  const bonus = 5 * effectiveTileProd(state, tile.tier);
  grantStardust(state, bonus);
  updateQuestProgress(state, "tapBonuses", 1);
  if (!auto) resetErebusStreak(state);
  Game.cooldownUntil[idx] = now + TAP_COOLDOWN_MS;
  if (!auto) Sfx.tap();
  spawnFloatingBonus(idx, bonus);
  updateHeader();
  if (!auto) saveState(state);
  return bonus;
}

// "Résonance" roll after a gameplay unlock. Shared so all 3 unlock paths give the same feedback
// and the bonus cell counts for quests and achievements.
function triggerResonanceIfLucky(state) {
  const idx = maybeTriggerResonance(state);
  if (idx === null) return;
  updateQuestProgress(state, "unlockCells", 1);
  checkAchievements(state);
  Sfx.unlock();
  toast("Résonance ! Une case bonus s'est débloquée ✨");
  renderCell(idx, { justUnlocked: true });
  updateFabs();
}

function tryUnlock(idx) {
  const state = Game.state;
  if (state.unlocked[idx]) return;
  const cost = unlockCost(state.extraUnlockedCount);
  if (state.stardust < cost) { toast("Pas assez de Stardust (" + formatNumber(cost) + "✨ requis)"); Sfx.error(); return; }
  spendStardust(state, cost);
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  updateQuestProgress(state, "unlockCells", 1);
  checkAchievements(state);
  Sfx.unlock();
  toast("Case débloquée !");
  renderCell(idx, { justUnlocked: true });
  triggerResonanceIfLucky(state);
  refreshLockedCellPrices(); // every other locked cell's price just changed too
  updateHeader();
  // Hides the "Case gratuite" fab once the last cell is unlocked.
  updateFabs();
  saveState(state);
}

function doInvoke() {
  const state = Game.state;
  const cost = invokeCost(state.manualSpawnCount);
  if (state.stardust < cost) { toast("Pas assez de Stardust pour invoquer."); Sfx.error(); return; }
  let target = (Game.selectedIdx !== null && state.unlocked[Game.selectedIdx] && !state.grid[Game.selectedIdx]) ? Game.selectedIdx : null;
  if (target === null) {
    const empties = emptyUnlockedIndices(state);
    if (empties.length === 0) { toast("La grille est pleine !"); Sfx.error(); return; }
    target = empties[Math.floor(Math.random() * empties.length)];
  }
  spendStardust(state, cost);
  state.manualSpawnCount += 1;
  state.grid[target] = { tier: 1 };
  renderCell(target, { spawned: true });
  Sfx.spawn();
  updateQuestProgress(state, "invokes", 1);
  clearSelection();
  updateHeader();
  saveState(state);
}

function doInvokeWithGems() {
  const state = Game.state;
  if (state.gems < GEMS_INVOKE_COST) { toast("Pas assez de Gems."); Sfx.error(); return; }
  let target = (Game.selectedIdx !== null && state.unlocked[Game.selectedIdx] && !state.grid[Game.selectedIdx]) ? Game.selectedIdx : null;
  if (target === null) {
    const empties = emptyUnlockedIndices(state);
    if (empties.length === 0) { toast("La grille est pleine !"); Sfx.error(); return; }
    target = empties[Math.floor(Math.random() * empties.length)];
  }
  state.gems -= GEMS_INVOKE_COST;
  state.grid[target] = { tier: 1 };
  renderCell(target, { spawned: true });
  Sfx.spawn();
  updateQuestProgress(state, "invokes", 1);
  clearSelection();
  updateHeader();
  saveState(state);
}

function clearSelection() {
  const prev = Game.selectedIdx;
  Game.selectedIdx = null;
  if (prev !== null) renderCell(prev);
  updateHeader();
}
function selectCell(idx) {
  const prev = Game.selectedIdx;
  Game.selectedIdx = idx;
  if (prev !== null && prev !== idx) renderCell(prev);
  renderCell(idx);
  updateHeader();
}

// ---------------- Auto spawn ----------------
function tickAutoSpawn(now) {
  const state = Game.state;
  const interval = autoSpawnIntervalMs(state);
  if (now - Game.lastAutoSpawn >= interval) {
    Game.lastAutoSpawn = now;
    const empties = emptyUnlockedIndices(state);
    if (empties.length > 0) {
      const idx = empties[Math.floor(Math.random() * empties.length)];
      state.grid[idx] = { tier: 1 };
      renderCell(idx, { spawned: true });
      updateQuestProgress(state, "autoSpawns", 1);
      saveState(state);
    }
  }
}

// Every rewarded-ad-gated bonus in the game should funnel through this
// instead of calling AdService.showRewarded directly: once ads are removed
// (purchase or VIP), the player already paid specifically not to watch ads,
// so the bonus is granted immediately with no video at all. Otherwise it
// behaves like a normal rewarded ad, and also tracks the watch count that
// triggers the one-time "remove ads" soft-prompt (see trackRewardedAdWatched).
async function watchRewardedAd(state, placementId) {
  if (adsRemoved(state)) return true;
  const ok = await AdService.showRewarded(placementId);
  // The remove-ads promo also needs enough fusions and the shared promo gap.
  if (ok && trackRewardedAdWatched(state) && state.lifetime.fusions >= FUSIONS_BEFORE_REMOVE_ADS_PROMO && promoGapElapsed(state)) {
    state.promptsShown.removeAdsPrompt = true;
    markPromoShown(state);
    openRemoveAdsPromptModal();
  }
  return ok;
}

// ---------------- Big Bang / interstitial ----------------
async function maybeShowInterstitial() {
  const state = Game.state;
  if (adsRemoved(state)) return;
  const now = Date.now();
  if (now - Game.sessionStart < INTERSTITIAL_QUIET_START_MS) return;
  if (now - Game.lastInterstitial < INTERSTITIAL_MIN_GAP_MS) return;
  Game.lastInterstitial = now;
  await AdService.showInterstitial();
}

function onBigBangConfirm() {
  const state = Game.state;
  const runRecap = { stardustEarned: state.runStardustEarned, maxTier: state.maxTierThisRun };
  const { gain, eggResult } = performBigBang(state);
  Game.bigBangPromptShown = false;
  Sfx.bigBang();
  HapticService.impact("success");
  closeBigBangModal();
  renderAll();
  saveState(state);
  maybeShowInterstitial();
  openBigBangSummaryModal({ ...runRecap, gain });
  // Shown after the Big Bang summary, not instead of it.
  if (eggResult) revealEasterEgg(eggResult);
  maybeOpenGodRevealModal(); // e.g. Thanatos, unlocked inside performBigBang
}

function onRestartConfirm() {
  const state = Game.state;
  // Easter egg "Le Renoncement": restart while Big Bang is available. Check before the reset.
  const eggResult = hasUniverseTile(state) ? unlockEasterEgg(state, "restart_at_top") : null;
  restartRun(state);
  Game.bigBangPromptShown = false;
  Sfx.bigBang();
  HapticService.impact("medium");
  closeRestartModal();
  closePanel();
  toast("Nouvelle partie !");
  renderAll();
  saveState(state);
  if (eggResult) revealEasterEgg(eggResult);
}

async function onSaveCodeAction() {
  const textarea = $("saveCodeText");
  if (Game.saveCodeMode === "export") {
    textarea.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textarea.value);
        toast("Code copié !");
      } catch (e) {
        toast("Copie automatique indisponible : sélectionne le texte et copie-le à la main.");
      }
    } else {
      toast("Sélectionne le texte ci-dessus et copie-le à la main.");
    }
    return;
  }
  const imported = importSaveCode(textarea.value);
  if (!imported) { Sfx.error(); toast("Code invalide."); return; }
  Object.assign(Game.state, imported);
  Game.displayedStardust = Game.state.stardust;
  saveState(Game.state);
  closeSaveCodeModal();
  renderAll();
  toast("Sauvegarde restaurée !");
}

// ---------------- Offline modal actions ----------------
async function onOfflineCollect() {
  const state = Game.state;
  grantStardust(state, Game.pendingOfflineGain.gain);
  $("offlineModal").classList.add("hidden");
  updateHeader();
  saveState(state);
}
async function onOfflineDouble() {
  const state = Game.state;
  $("offlineCollect").disabled = true; $("offlineDouble").disabled = true;
  const ok = await watchRewardedAd(state, "offline_double");
  grantStardust(state, Game.pendingOfflineGain.gain * (ok ? 2 : 1));
  $("offlineCollect").disabled = false; $("offlineDouble").disabled = false;
  $("offlineModal").classList.add("hidden");
  toast(ok ? "Gains doublés !" : "Publicité non complétée.");
  updateHeader();
  saveState(state);
}

// ---------------- Daily login actions ----------------
function onDailyClaim() {
  const state = Game.state;
  const result = claimDailyLogin(state);
  if (!result) return;
  Sfx.chest();
  toast(`Jour ${result.cycleDay} récupéré : ${result.reward.label}`);
  openDailyModal();
  renderAll(); // an unlockCell/bigReward reward can change the grid or currencies
  saveState(state);
}

// ---------------- Wheel actions ----------------
const WHEEL_SPIN_MS = 3500; // must match .wheel's CSS transition duration (style.css)

// Wheel clicks at a slowing rate, approximating the CSS ease-out.
function scheduleWheelTicks(totalMs) {
  let elapsed = 0;
  let interval = 45;
  const growth = 1.09;
  const maxInterval = 260;
  function tick() {
    if (elapsed >= totalMs) return;
    Sfx.wheelTick();
    interval = Math.min(interval * growth, maxInterval);
    elapsed += interval;
    setTimeout(tick, interval);
  }
  tick();
}
// The prize is picked before the animation; this rotates the wheel so the top pointer
// lands inside that prize's slice (random offset within the middle 60%).
// Rotation accumulates across spins and always moves forward, so a second spin
// in the same modal still turns.
let wheelRotation = 0;
function spinVisual(prizeIndex, cb) {
  const wheel = $("wheelEl");
  const { startDeg, endDeg } = wheelSegmentBounds(prizeIndex);
  const span = endDeg - startDeg;
  const jitter = (Math.random() - 0.5) * span * 0.6;
  const midDeg = (startDeg + endDeg) / 2 + jitter;
  const desiredMod = (360 - midDeg + 360) % 360; // rotation that puts midDeg under the top pointer
  const currentMod = ((wheelRotation % 360) + 360) % 360;
  const forwardDelta = (desiredMod - currentMod + 360) % 360; // forward-only rotation to the target
  const extraSpins = (4 + Math.floor(Math.random() * 2)) * 360;
  wheelRotation += extraSpins + forwardDelta;
  wheel.style.transform = `rotate(${wheelRotation}deg)`;
  scheduleWheelTicks(WHEEL_SPIN_MS);
  setTimeout(cb, WHEEL_SPIN_MS);
}
// renderAll(): the "1 case débloquée" prize changes state.unlocked, so the grid must redraw.
function finishWheelSpin(prize) {
  $("wheelResult").innerHTML = prize ? `Gagné : ${withCurrencyIcons(prize.label)}` : "Déjà utilisé aujourd'hui.";
  Sfx.wheelWin();
  refreshWheelButtons();
  renderAll();
  saveState(Game.state);
}
function onWheelSpinFree() {
  $("wheelSpinFree").disabled = true; $("wheelSpinAd").disabled = true;
  const prize = spinWheel(Game.state, false);
  spinVisual(prize ? WHEEL_PRIZES.indexOf(prize) : 0, () => finishWheelSpin(prize));
}
async function onWheelSpinAd() {
  $("wheelSpinFree").disabled = true; $("wheelSpinAd").disabled = true;
  const ok = await watchRewardedAd(Game.state, "wheel_bonus");
  if (!ok) { refreshWheelButtons(); return; }
  const prize = spinWheel(Game.state, true);
  spinVisual(prize ? WHEEL_PRIZES.indexOf(prize) : 0, () => finishWheelSpin(prize));
}

// ---------------- Unlock cell fab (rewarded ad) ----------------
// Asks before showing an ad. Skipped when ads are removed: the reward is granted instantly.
function confirmThenWatchAd(state, title, text, action) {
  if (adsRemoved(state)) { action(); return; }
  openConfirmModal({ title, text, confirmLabel: "Regarder la pub", onConfirm: action });
}

function onUnlockCellAd() {
  const state = Game.state;
  if (Date.now() < state.cooldowns.unlockCellAdUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.unlockCellAdUntil - Date.now()));
    return;
  }
  if (unlockedCount(state) >= TOTAL) { toast("Toutes les cases sont déjà débloquées !"); return; }
  confirmThenWatchAd(state, "Case gratuite", "Regarder une publicité pour débloquer une case gratuitement ?", async () => {
    if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
    const ok = await watchRewardedAd(state, "unlock_cell");
    if (!ok) return;
    const result = grantFreeCellUnlock(state);
    if (result.ok) {
      renderCell(result.idx, { justUnlocked: true });
      triggerResonanceIfLucky(state);
      refreshLockedCellPrices();
      Sfx.unlock();
      toast("🔓 Case débloquée gratuitement !");
    } else {
      toast("Toutes les cases sont déjà débloquées !");
    }
    updateHeader();
    updateFabs();
    saveState(state);
  });
}

// ---------------- Gems-for-ad (shop + home screen) ----------------
// The first claim of the day is free, then ads with a streak and cooldown (economy.js).
function onWatchGemsAd() {
  const state = Game.state;
  if (isGemsAdFreeAvailable(state)) {
    const granted = grantGemsFree(state);
    Sfx.purchase();
    toast(`+${granted} 💎 offertes aujourd'hui !`);
    refreshCurrentPanel();
    updateHeader();
    updateFabs();
    saveState(state);
    return;
  }
  if (Date.now() < state.cooldowns.gemsAdUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.gemsAdUntil - Date.now()));
    return;
  }
  confirmThenWatchAd(state, "Pub contre Gems", `Regarder une publicité pour recevoir ${GEMS_AD_REWARD} Gems ?`, async () => {
    if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
    const ok = await watchRewardedAd(state, "gems_ad");
    if (!ok) return;
    const granted = grantGemsFromAd(state);
    Sfx.purchase();
    toast(`+${granted} 💎 !`);
    refreshCurrentPanel();
    updateHeader();
    updateFabs();
    saveState(state);
  });
}

// ---------------- Auto-clicker ----------------
// Free once a day, then an ad. The player then picks the target cell (tap-only mode).
function onAutoClickerClick() {
  const state = Game.state;
  if (Game.autoClickerArmed) {
    Game.autoClickerArmed = false;
    toast(Game.autoClickerPaid ? "Sélection annulée. Ta publicité reste acquise." : "Sélection annulée.");
    renderAll();
    return;
  }
  const now = Date.now();
  if (state.autoClicker.activeUntil > now) {
    toast("Clicker déjà actif encore " + formatDuration(state.autoClicker.activeUntil - now));
    return;
  }
  // Game.autoClickerPaid: the watched ad stays earned if the picker is cancelled.
  if (isAutoClickerFreeAvailable(state) || Game.autoClickerPaid) { armAutoClickerPicker(); return; }
  confirmThenWatchAd(state, "Clicker automatique",
    "Ton clicker gratuit du jour est déjà utilisé. Regarde une publicité pour le relancer tout de suite, pour 10 minutes de plus.",
    async () => {
      if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
      const ok = await watchRewardedAd(state, "auto_clicker");
      if (!ok) return;
      Game.autoClickerPaid = true;
      armAutoClickerPicker();
    });
}
function armAutoClickerPicker() {
  Game.autoClickerArmed = true;
  closePanel(); // needed from the Boutique card: the grid must be visible
  toast("🤖 Choisis une case avec une tuile pour le clicker automatique.");
  renderAll();
}
function handleAutoClickerPick(idx) {
  const state = Game.state;
  if (!state.unlocked[idx] || !state.grid[idx]) { toast("Choisis une case débloquée avec une tuile."); Sfx.error(); return; }
  Game.autoClickerArmed = false;
  Game.autoClickerPaid = false; // the watched ad is spent now
  activateAutoClicker(state, idx);
  Sfx.purchase();
  toast("🤖 Clicker automatique activé pour 10 min !");
  renderAll();
  updateFabs();
  saveState(state);
}
// Called every frame. grantTapBonus handles the per-cell cooldown, so no throttling here.
function tickAutoClicker() {
  const state = Game.state;
  const ac = state.autoClicker;
  const idx = ac.targetIdx;
  const isActive = idx !== null && ac.activeUntil > Date.now();
  if (idx !== null && cellEls[idx]) cellEls[idx].classList.toggle("autoClickTarget", isActive);
  if (!isActive || !state.grid[idx]) return; // inactive, or target cell empty (paused)
  if (grantTapBonus(idx, { auto: true })) playAutoClickEffect(idx);
}
// No timer removes the class: it would cut the next pulse short.
function playAutoClickEffect(idx) {
  const cell = cellEls[idx];
  if (!cell) return;
  cell.classList.remove("autoClickPulse");
  void cell.offsetWidth; // force reflow to restart the animation
  cell.classList.add("autoClickPulse");
}
// Home-screen swap button: confirmation with "don't ask again".
// The Boutique card already confirms through buyBtn() (ui.js).
function onSwapCellsClick() {
  const state = Game.state;
  const cost = SHOP_GEM_ITEMS.find(i => i.id === "swapCells").cost;
  // Not enough Gems: offer an ad for a free swap instead.
  if (state.gems < cost) {
    if (Date.now() < state.cooldowns.swapAdUntil) {
      toast("Disponible dans " + formatDuration(state.cooldowns.swapAdUntil - Date.now()));
      return;
    }
    confirmThenWatchAd(state, "Pas assez de Gems",
      `Il te manque des Gems pour échanger deux cases (${cost} ${currencyIconHtml("gems")} nécessaires). Regarder une publicité pour échanger gratuitement à la place ?`,
      async () => {
        if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
        const ok = await watchRewardedAd(state, "swap_cells_free");
        if (!ok) return;
        state.cooldowns.swapAdUntil = Date.now() + SWAP_AD_COOLDOWN_MS;
        Game.swapArmed = true;
        Game.swapFree = true;
        toast("Choisis deux cases à échanger.");
        renderAll();
        saveState(state);
      });
    return;
  }
  if (state.dontAskAgain.swapConfirm) { onBuyGemItem("swapCells"); return; }
  openConfirmModal({
    title: "Échanger deux cases",
    text: `Dépenser ${cost} ${currencyIconHtml("gems")} pour échanger le contenu de deux cases ?`,
    confirmLabel: "Échanger",
    dontAskKey: "swapConfirm",
    onConfirm: () => onBuyGemItem("swapCells"),
  });
}
function onBuyGemItem(itemId) {
  if (itemId === "skipCell") {
    Game.skipCellArmed = true;
    closePanel();
    toast("Tape une case verrouillée à débloquer avec des Gems.");
    renderAll();
    return;
  }
  if (itemId === "swapCells") {
    if (Game.state.gems < SHOP_GEM_ITEMS.find(i => i.id === "swapCells").cost) { Sfx.error(); toast("Pas assez de Gems."); return; }
    Game.swapArmed = true;
    Game.swapFirstIdx = null;
    // Paid swap: clear any leftover free swap from an abandoned ad-earned one.
    Game.swapFree = false;
    closePanel();
    toast("Choisis deux cases à échanger.");
    renderAll();
    return;
  }
  const result = buyGemShopItem(Game.state, itemId);
  if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
  Sfx.purchase();
  if (itemId === "cosmicBox") {
    openCosmicBoxRevealModal(result.box);
  } else if (itemId === "streakFreeze") {
    // No visible change otherwise, so the toast names the effect and the charge count.
    toast("❄️ Gel de série ajouté ! (" + Game.state.dailyLogin.streakFreezeCharges + " en réserve)");
  } else {
    toast("Achat effectué !");
  }
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
  maybeOpenGodRitual();
  maybeOpenBigBangPrompt();
}
function onCosmeticAction(id, owned) {
  const state = Game.state;
  if (owned) {
    equipCosmetic(state, id);
  } else {
    const result = buyCosmeticWithGems(state, id);
    if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
    equipCosmetic(state, id);
    Sfx.purchase();
  }
  renderAll();
  refreshCurrentPanel();
  saveState(state);
}
function onSetIconStyle(style) {
  const state = Game.state;
  if (state.iconStyle === style) return;
  state.iconStyle = style;
  renderAll();
  refreshCurrentPanel();
  saveState(state);
}
async function onBuyIAP(productId) {
  const product = IAP_CATALOG.find(p => p.id === productId);
  const res = await IAPService.purchase(productId);
  if (!res.success) return;
  const state = Game.state;
  switch (productId) {
    case "remove_ads": state.iap.removeAds = true; break;
    case "starter_pack":
      // One-time purchase: never grant twice.
      if (state.iap.starterPack) break;
      state.iap.starterPack = true;
      state.gems += 500; state.lifetime.gemsEarned += 500;
      { const locked = []; for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
        for (let k = 0; k < 3 && locked.length; k++) { const pick = locked.splice(Math.floor(Math.random() * locked.length), 1)[0]; state.unlocked[pick] = true; state.extraUnlockedCount += 1; } }
      // 1h auto-clicker on the highest-tier tile. keepFreeDaily: doesn't consume today's free use.
      { let bestIdx = null, bestTier = 0;
        for (let i = 0; i < TOTAL; i++) { const t = state.grid[i]; if (t && t.tier > bestTier) { bestTier = t.tier; bestIdx = i; } }
        if (bestIdx !== null) activateAutoClicker(state, bestIdx, { durationMs: 3600000, keepFreeDaily: true }); }
      break;
    case "gems_small": case "gems_medium": case "gems_large": case "gems_mega":
      state.gems += product.amount; state.lifetime.gemsEarned += product.amount; break;
    case "vip_monthly": state.iap.vipUntil = Date.now() + 30 * 24 * 3600 * 1000; break;
    case "stardust_boost": state.iap.stardustBoost = true; break;
  }
  Sfx.purchase();
  refreshCurrentPanel();
  renderAll();
  saveState(state);
  openPurchaseConfirmModal(product);
}
async function onRestorePurchases() {
  await IAPService.restorePurchases();
  toast("Achats restaurés.");
  refreshCurrentPanel();
}
function onChooseGod(godId) {
  const state = Game.state;
  chooseGod(state, godId);
  Sfx.purchase();
  toast(`${getGod(godId).name} t'accompagne désormais !`);
  refreshCurrentPanel();
  saveState(state);
}
function onEquipGodFromUnlockModal() {
  if (godUnlockModalGodId) onChooseGod(godUnlockModalGodId);
  closeGodUnlockModal();
}
function onBuyGod(godId) {
  const result = buyGodWithGems(Game.state, godId);
  if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
  maybeOpenGodRevealModal();
}
function onBuyGodPower(godId) {
  const result = buyGodPowerLevel(Game.state, godId);
  if (!result.ok) { Sfx.error(); toast(result.reason === "max" ? "Niveau maximum atteint." : "Pas assez de Gems."); return; }
  Sfx.purchase();
  toast(`${getGod(godId).name} — niveau de pouvoir ${result.newLevel} !`);
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}

function onProfileSave() {
  const state = Game.state;
  const name = $("profileNameInput").value.trim();
  state.profile.name = name || "Joueur";
  state.profile.emoji = profileDraft.emoji;
  state.profile.color = profileDraft.color;
  Sfx.purchase();
  toast("Profil enregistré !");
  closeProfileModal();
  saveState(state);
}

function onBuySkill(key) {
  const result = buySkill(Game.state, key);
  if (!result.ok) { Sfx.error(); toast(result.reason === "max" ? "Niveau maximum atteint." : "Pas assez d'Énergie Cosmique."); return; }
  Sfx.purchase();
  toast(SKILL_TREE[key].name + " amélioré !");
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
function onBuyRunUpgrade(key) {
  const result = buyRunUpgrade(Game.state, key);
  if (!result.ok) { Sfx.error(); toast(result.reason === "max" ? "Niveau maximum atteint." : "Pas assez de Stardust."); return; }
  Sfx.purchase();
  toast(RUN_UPGRADE_TREE[key].name + " amélioré !");
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
function onClaimQuest(id) {
  const reward = claimQuest(Game.state, id);
  if (reward === null) return;
  Sfx.quest();
  toast(`Quête réclamée : +${reward} 💎`);
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
}
async function onBonusAdQuest() {
  const state = Game.state;
  if (state.quests.bonusAd.claimed) return;
  if (!state.quests.bonusAd.done) {
    const ok = await watchRewardedAd(state, "quest_ad");
    if (!ok) return;
    markBonusAdQuestDone(state);
    // Ads removed: there's no separate "watch" step for the player to see,
    // so go straight on to claiming instead of leaving a second tap behind.
    if (!adsRemoved(state)) { refreshCurrentPanel(); saveState(state); return; }
  }
  const reward = claimBonusAdQuest(state);
  if (reward) { Sfx.quest(); toast(`Quête bonus réclamée : +${reward} 💎`); refreshCurrentPanel(); updateHeader(); saveState(state); }
}

// ---------------- Wiring ----------------
// A single delegated listener covers every chrome button (menu, tabs, panel
// close, switches, fabs...) instead of wiring a click sound at each call
// site. Buttons that already play their own distinct sound synchronously on
// click (Invoquer, Big Bang confirm) either stop propagation or are excluded
// by id below, so this never doubles up with them.
const SILENT_CLICK_IDS = new Set(["bigBangConfirm", "invokeBtnStardust", "invokeBtnGems"]);
function wireClickSound() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".btn, .drawerItem, .iconBtn, .fab, .switch, .tabBtn");
    if (!el || el.disabled || SILENT_CLICK_IDS.has(el.id)) return;
    Sfx.click();
  });
}

// Tapping the dark backdrop closes whichever modal is open, same as its own
// close/cancel button, by calling its close handler when it has one (it clears pending state).
// Never closable from the backdrop:
// - godRitualModal: mandatory choice
// - offlineModal: only its buttons pay out the offline gain
const MODAL_BACKDROP_LOCKED = new Set(["godRitualModal", "offlineModal"]);
function wireModalBackdropClose() {
  const closeHandlers = {
    godUnlockModal: closeGodUnlockModal,
    confirmActionModal: closeConfirmModal,
    fusionPromoModal: closeFusionPromoModal,
    eggFinaleModal: closeEggFinaleModal,
  };
  document.addEventListener("click", (e) => {
    const overlay = e.target;
    if (!overlay.classList.contains("modalOverlay") || MODAL_BACKDROP_LOCKED.has(overlay.id)) return;
    const close = closeHandlers[overlay.id];
    if (close) close();
    else overlay.classList.add("hidden");
  });
}

function wireEvents() {
  wireClickSound();
  wireModalBackdropClose();
  document.addEventListener("pointerdown", onPointerDown, { passive: false });
  document.addEventListener("touchstart", onPointerDown, { passive: false });

  dom.invokeBtnStardust.addEventListener("click", () => { ensureAudio(); doInvoke(); });
  dom.invokeBtnGems.addEventListener("click", () => { ensureAudio(); doInvokeWithGems(); });
  dom.bigBangBtn.addEventListener("click", () => openBigBangModal());
  dom.menuBtn.addEventListener("click", () => openDrawer());
  dom.drawerClose.addEventListener("click", closeDrawer);
  $("drawerHeadEdit").addEventListener("click", (e) => { e.stopPropagation(); closeDrawer(); openProfileModal(); });
  $("profileCancel").addEventListener("click", closeProfileModal);
  $("profileSave").addEventListener("click", onProfileSave);
  dom.drawerOverlay.addEventListener("click", (e) => { if (e.target === dom.drawerOverlay) closeDrawer(); });
  document.querySelectorAll(".drawerItem[data-panel]").forEach(b => b.addEventListener("click", () => openPanel(b.dataset.panel)));
  dom.panelClose.addEventListener("click", closePanel);

  $("fabShop").addEventListener("click", () => openPanel("shop"));
  $("fabRunUpgrades").addEventListener("click", () => openPanel("runUpgrades"));
  dom.fabDailyLogin.addEventListener("click", openDailyModal);
  dom.fabWheel.addEventListener("click", openWheelModal);
  $("fabAutoClicker").addEventListener("click", onAutoClickerClick);
  $("autoClickerIntroPick").addEventListener("click", () => {
    $("autoClickerIntroModal").classList.add("hidden");
    // Through onAutoClickerClick: today's free use may already be spent from the Boutique.
    onAutoClickerClick();
  });
  $("fabUnlockCellAd").addEventListener("click", onUnlockCellAd);
  dom.fabSwapCells.addEventListener("click", onSwapCellsClick);
  $("fabCurrentGod").addEventListener("click", () => openPanel("gods"));
  $("fabRestart").addEventListener("click", openRestartModal);
  $("fabGemsAd").addEventListener("click", onWatchGemsAd);
  $("fabSkins").addEventListener("click", openSkinManagerModal);
  $("skinManagerClose").addEventListener("click", closeSkinManagerModal);
  $("skinPreviewClose").addEventListener("click", closeSkinPreviewModal);
  $("cosmicBoxClose").addEventListener("click", closeCosmicBoxModal);
  $("purchaseConfirmClose").addEventListener("click", closePurchaseConfirmModal);

  $("fabSecrets").addEventListener("click", openSecretsModal);
  $("secretsClose").addEventListener("click", closeSecretsModal);
  $("eggFoundClose").addEventListener("click", closeEggFoundModal);
  $("eggFinaleClose").addEventListener("click", closeEggFinaleModal);
  $("godUnlockClose").addEventListener("click", closeGodUnlockModal);
  $("godUnlockEquip").addEventListener("click", onEquipGodFromUnlockModal);
  $("vipGemsClose").addEventListener("click", closeVipGemsModal);

  dom.energyPill.addEventListener("click", () => openPanel("skills"));
  $("gemsPill").addEventListener("click", openGemsMenuModal);
  $("stardustPill").addEventListener("click", openStardustInfoModal);
  $("stardustInfoClose").addEventListener("click", closeStardustInfoModal);
  $("gemsMenuShop").addEventListener("click", () => { closeGemsMenuModal(); openPanel("shop"); });
  $("gemsMenuGods").addEventListener("click", () => { closeGemsMenuModal(); openPanel("gods"); });
  $("gemsMenuClose").addEventListener("click", closeGemsMenuModal);

  $("tutNext").addEventListener("click", () => { tutIndex++; if (tutIndex >= TUT_STEPS.length) endTutorial(); else showTutStep(tutIndex); });
  $("tutSkip").addEventListener("click", () => endTutorial());

  $("offlineCollect").addEventListener("click", onOfflineCollect);
  $("offlineDouble").addEventListener("click", onOfflineDouble);

  $("dailyClaim").addEventListener("click", onDailyClaim);
  $("dailyClose").addEventListener("click", closeDailyModal);

  $("wheelSpinFree").addEventListener("click", onWheelSpinFree);
  $("wheelSpinAd").addEventListener("click", onWheelSpinAd);
  $("wheelClose").addEventListener("click", closeWheelModal);

  $("bigBangConfirm").addEventListener("click", onBigBangConfirm);
  $("bigBangCancel").addEventListener("click", closeBigBangModal);
  $("restartCancel").addEventListener("click", closeRestartModal);
  $("restartConfirm").addEventListener("click", onRestartConfirm);

  $("confirmActionCancel").addEventListener("click", closeConfirmModal);
  $("confirmActionConfirm").addEventListener("click", onConfirmActionConfirm);

  $("saveCodeCancel").addEventListener("click", closeSaveCodeModal);
  $("saveCodeAction").addEventListener("click", onSaveCodeAction);

  $("bbSummaryClose").addEventListener("click", closeBigBangSummaryModal);

  $("removeAdsPromptLater").addEventListener("click", closeRemoveAdsPromptModal);
  $("removeAdsPromptBuy").addEventListener("click", () => {
    closeRemoveAdsPromptModal();
    const product = IAP_CATALOG.find(p => p.id === "remove_ads");
    openConfirmModal({
      title: product.name,
      text: `${product.desc} — ${product.price}`,
      confirmLabel: "Acheter",
      onConfirm: () => onBuyIAP("remove_ads"),
    });
  });

  $("fusionPromoLater").addEventListener("click", closeFusionPromoModal);
  $("fusionPromoBuy").addEventListener("click", () => {
    const id = fusionPromoProductId;
    closeFusionPromoModal();
    const product = id && IAP_CATALOG.find(p => p.id === id);
    if (!product) return;
    openConfirmModal({
      title: product.name,
      text: `${product.desc || ""} — ${product.price}`,
      confirmLabel: product.type === "subscription" ? "S'abonner" : "Acheter",
      onConfirm: () => onBuyIAP(id),
    });
  });
}
