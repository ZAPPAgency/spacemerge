// Spacemerge - prestige (Big Bang), permanent skill tree, shop logic
"use strict";

// Uses a fixed tier (not the top tier) so merging past Univers keeps Big Bang available.
// tileProgressTier() counts looped tiles, whose raw `tier` goes back to 1.
function hasUniverseTile(state) {
  return state.grid.some(t => t && tileProgressTier(t) >= UNIVERSE_TIER);
}
// The run upgrade applies here, not in the pure bigBangGain(), so the preview
// equals what performBigBang() pays.
function previewBigBangGain(state) {
  const base = bigBangGain(state.runStardustEarned, state.grid);
  const surgeMult = 1 + (state.runUpgrades.surge || 0) * 0.05;
  return Math.round(base * surgeMult);
}

function performBigBang(state) {
  checkThanatosChallenge(state); // must run before the grid resets - it checks the current grid's fill state
  // Easter egg "Les Extrêmes": every filled cell is tier 1 or UNIVERSE_TIER.
  // Must read the grid before it resets below.
  const pureExtremes = state.grid.every(t => !t || tileProgressTier(t) === 1 || tileProgressTier(t) === UNIVERSE_TIER);
  const eggResult = pureExtremes ? unlockEasterEgg(state, "pure_extremes") : null;
  const minEnergy = getGodEffects(state).bigBangMinEnergy || 0;
  const gain = Math.max(previewBigBangGain(state), minEnergy);
  state.cosmicEnergy += gain;
  state.lifetime.bigBangCount += 1;

  // Personal-best time-to-Big-Bang, surfaced in the Stardust info popup as a
  // target to beat next run (see ui.js openStardustInfoModal).
  const elapsedMs = Date.now() - state.runStartedAt;
  if (state.lifetime.bestBigBangMs === null || elapsedMs < state.lifetime.bestBigBangMs) {
    state.lifetime.bestBigBangMs = elapsedMs;
  }

  applyPendingGodAtBigBang(state);
  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  state.stardust = 0;
  state.runStardustEarned = 0;
  state.maxTierThisRun = 1;
  state.manualSpawnCount = 0;
  state.extraUnlockedCount = 0;
  state.runStartedAt = Date.now();
  // Run upgrades only last one run.
  for (const key in state.runUpgrades) state.runUpgrades[key] = 0;

  checkAchievements(state);
  return { gain, eggResult };
}

// Voluntary reset, available anytime (unlike Big Bang, which needs a
// Universe tile). No Cosmic Energy is granted and lifetime.bigBangCount is
// NOT incremented - this is giving up on a run, not completing one.
function restartRun(state) {
  state.moonMergesThisRun = 0;
  state.gods.erebusStreak = 0;
  state.gods.usedShortcutThisRun = false;

  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  state.stardust = 0;
  state.runStardustEarned = 0;
  state.maxTierThisRun = 1;
  state.manualSpawnCount = 0;
  state.extraUnlockedCount = 0;
  state.runStartedAt = Date.now();
  for (const key in state.runUpgrades) state.runUpgrades[key] = 0;
}

function buySkill(state, key) {
  const branch = SKILL_TREE[key];
  const level = state.skills[key];
  if (level >= branch.maxLevel) return { ok: false, reason: "max" };
  const cost = skillCost(key, level + 1);
  if (state.cosmicEnergy < cost) return { ok: false, reason: "funds", cost };
  state.cosmicEnergy -= cost;
  state.skills[key] += 1;
  return { ok: true, cost, newLevel: state.skills[key] };
}

// Run upgrades: like buySkill() but paid in Stardust and reset every run.
function buyRunUpgrade(state, key) {
  const branch = RUN_UPGRADE_TREE[key];
  const level = state.runUpgrades[key];
  if (level >= branch.maxLevel) return { ok: false, reason: "max" };
  const cost = runUpgradeCost(key, level + 1);
  if (state.stardust < cost) return { ok: false, reason: "funds", cost };
  spendStardust(state, cost); // also advances spending quests
  state.runUpgrades[key] += 1;
  return { ok: true, cost, newLevel: state.runUpgrades[key] };
}

// "Résonance": chance that an unlock frees one extra random locked cell.
// Called from the 3 gameplay unlock paths (input.js), not the starter pack.
// Returns the bonus cell index, or null.
function maybeTriggerResonance(state) {
  const level = state.runUpgrades.resonance || 0;
  if (level <= 0) return null;
  if (Math.random() >= level * 0.03) return null;
  const locked = [];
  for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
  if (locked.length === 0) return null;
  const idx = locked[Math.floor(Math.random() * locked.length)];
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  return idx;
}

function buyGemShopItem(state, itemId, opts) {
  const item = SHOP_GEM_ITEMS.find(i => i.id === itemId);
  if (!item) return { ok: false, reason: "unknown" };
  // opts.free: swap paid with a rewarded ad, no Gems cost.
  const free = opts && opts.free;
  if (!free && state.gems < item.cost) return { ok: false, reason: "funds", cost: item.cost };

  if (itemId === "skipCell") {
    const idx = opts && opts.cellIndex;
    if (idx === undefined || state.unlocked[idx]) return { ok: false, reason: "target" };
    if (!free) state.gems -= item.cost;
    state.unlocked[idx] = true;
    state.extraUnlockedCount += 1;
    state.gods.usedShortcutThisRun = true;
    return { ok: true };
  }
  if (itemId === "swapCells") {
    const idxA = opts && opts.idxA, idxB = opts && opts.idxB;
    if (idxA === undefined || idxB === undefined || idxA === idxB) return { ok: false, reason: "target" };
    if (!state.unlocked[idxA] || !state.unlocked[idxB]) return { ok: false, reason: "target" };
    if (!free) state.gems -= item.cost;
    const tmp = state.grid[idxA];
    state.grid[idxA] = state.grid[idxB];
    state.grid[idxB] = tmp;
    state.gods.usedShortcutThisRun = true;
    return { ok: true, idxA, idxB };
  }
  if (itemId === "streakFreeze") {
    state.gems -= item.cost;
    state.dailyLogin.streakFreezeCharges += 1;
    return { ok: true };
  }
  if (itemId === "cosmicBox") {
    state.gems -= item.cost;
    const result = rollCosmicBox(state);
    return { ok: true, box: result };
  }
  return { ok: false, reason: "unhandled" };
}

// Single pair merge used by tap/drag input.
// Two tiles merge only if tier AND cycle match. Merging two top-tier tiles loops
// back to tier 1 with `cycle` + 1. Older tiles have no `cycle`, hence `|| 0`.
function performMerge(state, fromIdx, toIdx) {
  const a = state.grid[fromIdx], b = state.grid[toIdx];
  if (!a || !b || a.tier !== b.tier || (a.cycle || 0) !== (b.cycle || 0)) return null;
  const looped = a.tier >= TIERS.length;
  const newTier = looped ? 1 : a.tier + 1;
  const newCycle = looped ? (a.cycle || 0) + 1 : (a.cycle || 0);
  state.grid[fromIdx] = null;
  state.grid[toIdx] = { tier: newTier, cycle: newCycle };
  state.lifetime.fusions += 1;
  state.maxTierThisRun = Math.max(state.maxTierThisRun, newTier);
  state.lifetime.maxTierEver = Math.max(state.lifetime.maxTierEver, newTier);

  let gemBonus = 0;
  const luckChance = state.skills.luck * 0.01 + (getGodEffects(state).gemChanceBonus || 0);
  if (Math.random() < luckChance) {
    gemBonus = grantGems(state, 1);
  }

  // Easter egg "Le Second Souffle": first looped tile (cycle 1).
  const eggResult = newCycle >= 1 ? unlockEasterEgg(state, "second_loop") : null;

  trackFusionEvent(state, newTier);
  return { newTier, newCycle, looped, gemBonus, eggResult };
}

function findCosmeticItem(id) {
  return EMOJI_SETS.find(e => e.id === id) || null;
}
function buyCosmeticWithGems(state, id) {
  const item = findCosmeticItem(id);
  if (!item || item.cost === 0) return { ok: false, reason: "unknown" };
  if (isSkinOwned(state, id)) return { ok: false, reason: "owned" };
  if (state.gems < item.cost) return { ok: false, reason: "funds" };
  state.gems -= item.cost;
  state.ownedSkins.push(id);
  return { ok: true };
}
function equipCosmetic(state, id) {
  if (!findCosmeticItem(id) || !isSkinOwned(state, id)) return false;
  state.equippedEmojiSet = id;
  return true;
}

// Starts an auto-clicker window; tickAutoClicker() (input.js) does the tapping.
// Consumes today's free use unless `opts.keepFreeDaily` (paid starter pack).
// `opts.durationMs` overrides AUTO_CLICKER_DURATION_MS.
function activateAutoClicker(state, targetIdx, opts) {
  const durationMs = (opts && opts.durationMs) || AUTO_CLICKER_DURATION_MS;
  state.autoClicker.targetIdx = targetIdx;
  state.autoClicker.activeUntil = Date.now() + durationMs;
  if (!(opts && opts.keepFreeDaily)) state.autoClicker.freeUsedDate = todayStr();
}
function isAutoClickerFreeAvailable(state) {
  return state.autoClicker.freeUsedDate !== todayStr();
}

// First "+20 Gems" claim of the day, no ad needed.
function grantGemsFree(state) {
  state.gemsAdFree.date = todayStr();
  state.gemsAdFree.used = true;
  return grantGems(state, GEMS_AD_REWARD);
}
function isGemsAdFreeAvailable(state) {
  return state.gemsAdFree.date !== todayStr() || !state.gemsAdFree.used;
}
// After the free claim: GEMS_AD_STREAK_SIZE ads in a row, then a GEMS_AD_COOLDOWN_MS pause.
function grantGemsFromAd(state) {
  ensureGemsAdStreak(state);
  const granted = grantGems(state, GEMS_AD_REWARD);
  state.gemsAdStreak.count += 1;
  if (state.gemsAdStreak.count % GEMS_AD_STREAK_SIZE === 0) {
    state.cooldowns.gemsAdUntil = Date.now() + GEMS_AD_COOLDOWN_MS;
  }
  return granted;
}

// Ad-based relief valve for unlockCost's 1.5x-per-cell growth, which is what
// makes the last few cells of a run cost tens of thousands of Stardust.
function grantFreeCellUnlock(state) {
  const locked = [];
  for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
  if (locked.length === 0) return { ok: false, reason: "full" };
  const idx = locked[Math.floor(Math.random() * locked.length)];
  state.unlocked[idx] = true;
  state.extraUnlockedCount += 1;
  state.cooldowns.unlockCellAdUntil = Date.now() + UNLOCK_CELL_AD_COOLDOWN_MS;
  return { ok: true, idx };
}
