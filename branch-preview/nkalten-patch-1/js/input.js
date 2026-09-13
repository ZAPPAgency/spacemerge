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
  g.innerHTML = `<span class="emoji">${tierEmoji(tier)}</span>`;
  g.style.left = x + "px"; g.style.top = y + "px";
  document.body.appendChild(g);
  return g;
}

let pointerState = null;

function onPointerDown(e) {
  if (!dom.panelOverlay.classList.contains("hidden") || !dom.drawerOverlay.classList.contains("hidden")) return;
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
  window.addEventListener("touchmove", onPointerMove, { passive: false });
  window.addEventListener("touchend", onPointerUp);
}

function onPointerMove(e) {
  if (!pointerState) return;
  const pos = localPos(e);
  const dx = pos.x - pointerState.startX, dy = pos.y - pointerState.startY;
  if (!pointerState.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    if (Game.swapArmed) return; // swap mode is tap-only, see handleSwapTap
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
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("touchmove", onPointerMove);
  window.removeEventListener("touchend", onPointerUp);

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
  const result = buyGemShopItem(state, "swapCells", { idxA, idxB });
  Game.swapArmed = false;
  Game.swapFirstIdx = null;
  clearSelection();
  if (result.ok) { Sfx.purchase(); toast("Cases échangées !"); }
  else { Sfx.error(); toast(result.reason === "funds" ? "Pas assez de Gems." : "Échange impossible."); }
  renderAll();
  saveState(state);
}

function handleTap(idx) {
  if (Game.swapArmed) { handleSwapTap(idx); return; }
  const state = Game.state;
  const tileHere = state.grid[idx];

  if (Game.selectedIdx !== null && Game.selectedIdx !== idx) {
    const selTile = state.grid[Game.selectedIdx];
    if (selTile && tileHere && areAdjacent(idx, Game.selectedIdx) && selTile.tier === tileHere.tier) {
      attemptMerge(Game.selectedIdx, idx);
      clearSelection();
      return;
    }
  }
  if (Game.selectedIdx === idx) {
    clearSelection();
    if (tileHere) grantTapBonus(idx);
    return;
  }
  selectCell(idx);
  if (tileHere) grantTapBonus(idx);
}

function handleLockedTap(idx) {
  const state = Game.state;
  if (Game.swapArmed) { toast("Choisis deux cases débloquées pour l'échange."); Sfx.error(); return; }
  if (Game.skipCellArmed) {
    const result = buyGemShopItem(state, "skipCell", { cellIndex: idx });
    Game.skipCellArmed = false;
    if (result.ok) { Sfx.unlock(); toast("Case débloquée avec des Gems !"); }
    else { Sfx.error(); toast(result.reason === "funds" ? "Pas assez de Gems." : "Impossible de débloquer cette case."); }
    renderAll();
    saveState(state);
    return;
  }
  tryUnlock(idx);
}

function attemptMerge(fromIdx, toIdx) {
  const state = Game.state;
  const before = state.grid[fromIdx];
  if (before && before.tier >= TIERS.length) { Sfx.error(); toast("L'Univers ne peut pas fusionner davantage."); return; }
  const result = performMerge(state, fromIdx, toIdx);
  if (!result) return;
  renderCell(fromIdx);
  renderCell(toIdx, { merged: true });
  spawnParticles(toIdx);
  Sfx.merge(result.newTier);
  HapticService.impact(result.newTier >= 8 ? "heavy" : "medium");
  if (result.gemBonus) toast("+1 💎 Gem bonus !");
  if (result.newTier === TIERS.length) toast("Univers créé ! 💥");
  else toast(tierName(result.newTier) + " " + tierEmoji(result.newTier) + " !");
  updateHeader();
  updateFabs();
  saveState(state);
  maybeOpenGodRitual();
  maybeOpenBigBangPrompt();
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

function maybeOpenGodRitual() {
  if (Game.pendingGodRitual) {
    Game.pendingGodRitual = false;
    openGodPickerModal();
  }
}

function grantTapBonus(idx) {
  const now = performance.now();
  if (Game.cooldownUntil[idx] > now) return false;
  const state = Game.state;
  const tile = state.grid[idx];
  if (!tile) return false;
  const bonus = 5 * effectiveTileProd(state, tile.tier);
  grantStardust(state, bonus);
  updateQuestProgress(state, "tapBonuses", 1);
  resetErebusStreak(state);
  Game.cooldownUntil[idx] = now + TAP_COOLDOWN_MS;
  Sfx.tap();
  spawnFloatingBonus(idx, bonus);
  updateHeader();
  saveState(state);
  return true;
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
  renderCell(idx);
  refreshLockedCellPrices(); // every other locked cell's price just changed too
  updateHeader();
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
  if (ok && trackRewardedAdWatched(state)) openRemoveAdsPromptModal();
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
  const gain = performBigBang(state);
  Game.bigBangPromptShown = false;
  Sfx.bigBang();
  HapticService.impact("success");
  closeBigBangModal();
  renderAll();
  saveState(state);
  maybeShowInterstitial();
  openBigBangSummaryModal({ ...runRecap, gain });
}

function onRestartConfirm() {
  const state = Game.state;
  restartRun(state);
  Game.bigBangPromptShown = false;
  Sfx.bigBang();
  HapticService.impact("medium");
  closeRestartModal();
  closePanel();
  toast("Nouvelle partie !");
  renderAll();
  saveState(state);
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
function spinVisual(cb) {
  const wheel = $("wheelEl");
  const extra = 1440 + Math.floor(Math.random() * 360);
  wheel.style.transform = `rotate(${extra}deg)`;
  setTimeout(cb, 3500);
}
function onWheelSpinFree() {
  $("wheelSpinFree").disabled = true; $("wheelSpinAd").disabled = true;
  spinVisual(() => {
    const prize = spinWheel(Game.state, false);
    $("wheelResult").textContent = prize ? `Gagné : ${prize.label}` : "Déjà utilisé aujourd'hui.";
    Sfx.chest();
    refreshWheelButtons();
    updateHeader(); updateFabs();
    saveState(Game.state);
  });
}
async function onWheelSpinAd() {
  $("wheelSpinFree").disabled = true; $("wheelSpinAd").disabled = true;
  const ok = await watchRewardedAd(Game.state, "wheel_bonus");
  if (!ok) { refreshWheelButtons(); return; }
  spinVisual(() => {
    const prize = spinWheel(Game.state, true);
    $("wheelResult").textContent = prize ? `Gagné : ${prize.label}` : "Déjà utilisé aujourd'hui.";
    Sfx.chest();
    refreshWheelButtons();
    updateHeader(); updateFabs();
    saveState(Game.state);
  });
}

// ---------------- Free planet fab ----------------
async function onFreePlanet() {
  const state = Game.state;
  if (Date.now() < state.cooldowns.freePlanetUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.freePlanetUntil - Date.now()));
    return;
  }
  if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
  const ok = await watchRewardedAd(state, "free_planet");
  if (!ok) return;
  const result = grantFreePlanet(state);
  if (result.ok) { renderCell(result.idx, { spawned: true }); Sfx.spawn(); toast("🪐 Planète gratuite reçue !"); }
  else { toast("La grille est pleine !"); }
  updateFabs();
  saveState(state);
}

// ---------------- Unlock cell fab (rewarded ad) ----------------
async function onUnlockCellAd() {
  const state = Game.state;
  if (Date.now() < state.cooldowns.unlockCellAdUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.unlockCellAdUntil - Date.now()));
    return;
  }
  if (unlockedCount(state) >= TOTAL) { toast("Toutes les cases sont déjà débloquées !"); return; }
  if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
  const ok = await watchRewardedAd(state, "unlock_cell");
  if (!ok) return;
  const result = grantFreeCellUnlock(state);
  if (result.ok) {
    renderCell(result.idx);
    refreshLockedCellPrices();
    Sfx.unlock();
    toast("🔓 Case débloquée gratuitement !");
  } else {
    toast("Toutes les cases sont déjà débloquées !");
  }
  updateHeader();
  updateFabs();
  saveState(state);
}

// ---------------- Gems-for-ad (shop + home screen) ----------------
async function onWatchGemsAd() {
  const state = Game.state;
  if (Date.now() < state.cooldowns.gemsAdUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.gemsAdUntil - Date.now()));
    return;
  }
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
}

// ---------------- Shop / IAP / skills / quests handlers ----------------
async function onWatchProdBoostAd() {
  const state = Game.state;
  const boostActive = state.cooldowns.prodBoostActiveUntil > Date.now();
  if (boostActive) { toast("Boost déjà actif encore " + formatDuration(state.cooldowns.prodBoostActiveUntil - Date.now())); return; }
  if (Date.now() < state.cooldowns.prodBoostUntil) {
    toast("Disponible dans " + formatDuration(state.cooldowns.prodBoostUntil - Date.now()));
    return;
  }
  if (!adsRemoved(state)) toast("📺 Chargement de la publicité...");
  const ok = await watchRewardedAd(state, "prod_boost");
  if (!ok) return;
  activateProdBoost(state);
  Sfx.purchase();
  toast("🚀 Boost x2 production activé pour 10 min !");
  refreshCurrentPanel();
  updateHeader();
  updateFabs();
  saveState(state);
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
async function onBuyIAP(productId) {
  const product = IAP_CATALOG.find(p => p.id === productId);
  const res = await IAPService.purchase(productId);
  if (!res.success) return;
  const state = Game.state;
  switch (productId) {
    case "remove_ads": state.iap.removeAds = true; break;
    case "starter_pack":
      state.gems += 500; state.lifetime.gemsEarned += 500;
      { const locked = []; for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
        for (let k = 0; k < 3 && locked.length; k++) { const pick = locked.splice(Math.floor(Math.random() * locked.length), 1)[0]; state.unlocked[pick] = true; state.extraUnlockedCount += 1; } }
      state.cooldowns.prodBoostActiveUntil = Date.now() + 3600000;
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
  toast("Achats restaurés (simulation).");
  refreshCurrentPanel();
}
function onChooseGod(godId) {
  const state = Game.state;
  const hadCurrent = !!state.gods.currentGodId;
  const wasQueued = state.gods.nextGodId;
  chooseGod(state, godId);
  Sfx.purchase();
  if (!hadCurrent) toast(`${getGod(godId).name} t'accompagne désormais !`);
  else if (wasQueued && !state.gods.nextGodId) toast("Choix annulé.");
  else toast(`${getGod(godId).name} choisi pour le prochain Big Bang.`);
  refreshCurrentPanel();
  saveState(state);
}
function onBuyGod(godId) {
  const result = buyGodWithGems(Game.state, godId);
  if (!result.ok) { Sfx.error(); toast("Pas assez de Gems."); return; }
  refreshCurrentPanel();
  updateHeader();
  saveState(Game.state);
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
const SILENT_CLICK_IDS = new Set(["bigBangConfirm", "invokeChoiceStardust", "invokeChoiceGems"]);
function wireClickSound() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest(".btn, .drawerItem, .iconBtn, .fab, .switch, .tabBtn");
    if (!el || el.disabled || SILENT_CLICK_IDS.has(el.id)) return;
    Sfx.click();
  });
}

// Tapping the dark backdrop closes whichever modal is open, same as its own
// close/cancel button - except the first-god ritual, which is a mandatory
// one-time choice with no close button at all by design.
function wireModalBackdropClose() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modalOverlay") && e.target.id !== "godRitualModal") {
      e.target.classList.add("hidden");
    }
  });
}

function wireEvents() {
  wireClickSound();
  wireModalBackdropClose();
  document.addEventListener("pointerdown", onPointerDown, { passive: false });
  document.addEventListener("touchstart", onPointerDown, { passive: false });

  dom.invokeBtn.addEventListener("click", () => { ensureAudio(); openInvokeChoiceModal(); });
  $("invokeChoiceStardust").addEventListener("click", () => { doInvoke(); closeInvokeChoiceModal(); });
  $("invokeChoiceGems").addEventListener("click", () => { doInvokeWithGems(); closeInvokeChoiceModal(); });
  $("invokeChoiceClose").addEventListener("click", closeInvokeChoiceModal);
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
  dom.fabDailyLogin.addEventListener("click", openDailyModal);
  dom.fabWheel.addEventListener("click", openWheelModal);
  dom.fabFreePlanet.addEventListener("click", onFreePlanet);
  $("fabBoost").addEventListener("click", onWatchProdBoostAd);
  $("fabUnlockCellAd").addEventListener("click", onUnlockCellAd);
  $("fabCurrentGod").addEventListener("click", () => openPanel("gods"));
  $("fabRestart").addEventListener("click", openRestartModal);
  $("fabGemsAd").addEventListener("click", onWatchGemsAd);
  $("fabSkins").addEventListener("click", openSkinManagerModal);
  $("skinManagerClose").addEventListener("click", closeSkinManagerModal);
  $("cosmicBoxClose").addEventListener("click", closeCosmicBoxModal);
  $("purchaseConfirmClose").addEventListener("click", closePurchaseConfirmModal);

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

  $("saveCodeCancel").addEventListener("click", closeSaveCodeModal);
  $("saveCodeAction").addEventListener("click", onSaveCodeAction);

  $("bbSummaryClose").addEventListener("click", closeBigBangSummaryModal);

  $("removeAdsPromptLater").addEventListener("click", closeRemoveAdsPromptModal);
  $("removeAdsPromptBuy").addEventListener("click", async () => {
    closeRemoveAdsPromptModal();
    await onBuyIAP("remove_ads");
  });
}
