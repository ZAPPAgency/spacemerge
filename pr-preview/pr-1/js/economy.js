// Godspark - prestige (Big Bang), permanent skill tree, shop logic
"use strict";

// Was `t.tier === TIERS.length` - broke the moment TIERS grew past Univers
// (tier 10, UNIVERSE_TIER in config.js): merging two Univers tiles into a
// Multivers removes every tier-10 tile from the grid, which would silently
// revoke Big Bang eligibility a player had already earned. UNIVERSE_TIER is
// a fixed reference instead of "whatever the current ceiling is" - reaching
// Univers or anything higher keeps Big Bang available for the rest of the
// run, however far past it the player pushes.
//
// Compared against tileProgressTier() (config.js), not the raw t.tier: the
// infinite loop added by performMerge() below sends a tile's tier back to 1
// while bumping `cycle`, so a player whose only high tiles were two Genèse
// (tier 14) saw the Big Bang button vanish the moment they merged them - the
// exact already-earned-eligibility revocation described above, reappearing
// at the loop boundary.
function hasUniverseTile(state) {
  return state.grid.some(t => t && tileProgressTier(t) >= UNIVERSE_TIER);
}
// "Surcharge du Big Bang" run upgrade (RUN_UPGRADE_TREE, config.js) applies
// here rather than inside the pure bigBangGain() formula (config.js) so
// that stays a plain function of (stardust, tier) with no state coupling -
// this is also what performBigBang() below actually calls to grant the
// real gain, so the number shown in the pre-Big-Bang preview (Loris:
// openBigBangModal, ui.js) is always exactly what gets paid out.
function previewBigBangGain(state) {
  // Was state.maxTierThisRun (a single number) - bigBangGain() now sums a
  // weight per actual tier-10+ tile on the grid (Loris: "ça augmentera
  // selon le nombre de cases de niveau 10 et plus"), so it needs the real
  // grid, not just the highest tier ever reached this run.
  const base = bigBangGain(state.runStardustEarned, state.grid);
  const surgeMult = 1 + (state.runUpgrades.surge || 0) * 0.05;
  return Math.round(base * surgeMult);
}

function performBigBang(state) {
  checkThanatosChallenge(state); // must run before the grid resets - it checks the current grid's fill state
  // Easter egg "Les Extrêmes" (Loris) - every filled cell is tier 1 or
  // UNIVERSE_TIER, nothing in between. Must read the grid before freshGrid()
  // replaces it below. Compared on tileProgressTier() for the same reason
  // hasUniverseTile() above is: a looped tile reads as `tier: 1` while really
  // sitting above Genèse, so on raw tier it would pass as a "commencement"
  // and hand out the egg for a grid that is not extremes-only at all.
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
  // Run upgrades (RUN_UPGRADE_TREE) are scoped to the grid that just ended -
  // reset alongside every other per-run field above, same lifecycle as
  // moonMergesThisRun/usedShortcutThisRun.
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

// Run-scoped upgrade tree (RUN_UPGRADE_TREE, config.js), Stardust-priced,
// mirrors buySkill() above but spends state.stardust instead of
// state.cosmicEnergy and resets to 0 on every Big Bang/restart (see the
// resets in performBigBang/restartRun above).
function buyRunUpgrade(state, key) {
  const branch = RUN_UPGRADE_TREE[key];
  const level = state.runUpgrades[key];
  if (level >= branch.maxLevel) return { ok: false, reason: "max" };
  const cost = runUpgradeCost(key, level + 1);
  if (state.stardust < cost) return { ok: false, reason: "funds", cost };
  spendStardust(state, cost); // not a bare `-=`: spendStardust also feeds the "Dépense N Stardust" daily quests
  state.runUpgrades[key] += 1;
  return { ok: true, cost, newLevel: state.runUpgrades[key] };
}

// "Résonance" run upgrade: each level adds a flat chance that unlocking a
// cell (by tap, ad, or Gems shortcut) resonates and frees one extra random
// locked cell for free. Called from the 3 real unlock paths in input.js
// (tryUnlock, onUnlockCellAd, the skipCell gem-shop purchase) - NOT from the
// starter-pack bulk 3-cell grant, which is a store-bought convenience, not
// gameplay progress. Returns the bonus cell's index, or null if it didn't
// trigger / there was nothing left to unlock.
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
  // Loris: offer a rewarded ad instead of a dead-end "Pas assez de Gems."
  // when clicking Échanger without enough Gems (onSwapCellsClick, input.js)
  // - opts.free skips the cost check/deduction entirely for that one swap,
  // everything else (target validation, usedShortcutThisRun) stays identical
  // to a normal paid swap.
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
// Loris: "a partir du niveau 14, si on fusionne deux cases de niveau 14
// elles redeviennent des cases de niveau 1 [...] on pourrait reproduire
// cela à l'infini avec des couleurs différentes" - merging two tiles at
// the true top tier (TIERS.length) used to just be refused; now it loops
// back to tier 1 with `cycle` (a fresh field on the tile, defaults to 0/
// unset for every tile from before this feature - see `|| 0` below) bumped
// by one instead. Two tiles can only merge if both their tier AND their
// cycle match - merging across cycles isn't meaningful (what color would
// the result even be?). maxTierThisRun/maxTierEver (below) stay correct
// with no special-casing: Math.max against a fresh tier-1 tile never
// lowers them, so they keep reflecting the true historical peak (still
// capped at TIERS.length) even as individual tiles keep looping.
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

  // Easter egg "Le Second Souffle" (Loris: "atteindre le tier 2 (deux case
  // de niveau 14 du tier de base qui fusionne)" - his own "tier" here means
  // this loop counter, `cycle`, not TIERS 1-14) - reaching a second loop
  // for the first time. Loris counts loops from 1 ("tier de base" = his
  // tier 1 = cycle 0), so his "tier 2" is exactly what merging two base
  // Genèse produces: cycle 1. `>= 2` was off by one, and cycle 2 needs two
  // cycle-1 Genèse, ~2^28 meteorites in a single run on a 30-cell grid -
  // which made this egg, and the 4-egg challenge behind it, unreachable.
  const eggResult = newCycle >= 1 ? unlockEasterEgg(state, "second_loop") : null;

  trackFusionEvent(state, newTier);
  return { newTier, newCycle, looped, gemBonus, eggResult };
}

// Was shared between two cosmetic slots (ambiance/background + emoji-set),
// now just emoji-set - the ambiance color skins were removed entirely per
// Loris' request, EMOJI_SETS (Fruits/Légumes) stays.
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

// "Clicker automatique" (Loris) - replaces the old Boost x2. Targets a
// specific grid cell instead of a flat production multiplier; the actual
// per-frame auto-tap loop is tickAutoClicker() (input.js), this just starts
// the window. Setting freeUsedDate here (not only at the free-activation
// call site) means both the free and the ad-gated reactivation path can
// call this one function - by the time either reaches here, today's free
// use is spent either way.
//
// `opts.keepFreeDaily` opts out of that, for the one caller where the
// assumption doesn't hold: the paid starter pack (onBuyIAP, input.js), which
// grants a clicker window as part of the purchase. Consuming the day's free
// activation there meant a player who bought the pack before using it lost
// it outright - once the paid hour expired they were told to watch an ad for
// a free daily use they had never had.
// `opts.durationMs` likewise lets that purchase grant its own longer window
// instead of overwriting activeUntil right after this call.
function activateAutoClicker(state, targetIdx, opts) {
  const durationMs = (opts && opts.durationMs) || AUTO_CLICKER_DURATION_MS;
  state.autoClicker.targetIdx = targetIdx;
  state.autoClicker.activeUntil = Date.now() + durationMs;
  if (!(opts && opts.keepFreeDaily)) state.autoClicker.freeUsedDate = todayStr();
}
function isAutoClickerFreeAvailable(state) {
  return state.autoClicker.freeUsedDate !== todayStr();
}

// Gems source, home-screen "+20 Gems" fab. Loris: "le bouton +20 gemmes une
// fois par jour il devrait être gratuit aussi (reset à minuit)" - the day's
// very first claim, no ad at all (onWatchGemsAd, input.js).
function grantGemsFree(state) {
  state.gemsAdFree.date = todayStr();
  state.gemsAdFree.used = true;
  return grantGems(state, GEMS_AD_REWARD);
}
function isGemsAdFreeAvailable(state) {
  return state.gemsAdFree.date !== todayStr() || !state.gemsAdFree.used;
}
// Beyond that free daily claim: Loris explicitly asked to keep the original
// "up to GEMS_AD_STREAK_SIZE ad watches in a row, then a cooldown" streak
// system rather than drop it, only with the free claim added in front of it
// and the cooldown lengthened (3 min -> GEMS_AD_COOLDOWN_MS, now 5 min).
// The streak's own count resets at midnight (ensureGemsAdStreak,
// retention.js) independently of the cooldown itself.
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
