// Godspark - Gods of the Cosmos: unlock conditions, equipped-god effects,
// the "choose your first god" ritual, and challenge tracking.
//
// One god is equipped per run (state.gods.currentGodId). Its `effects` are
// read from GODS (config.js) by getGodEffects() and consumed at the call
// sites noted in config.js's comments (state.js production/spawn/offline
// formulas, economy.js's merge gem-chance and Big Bang gain).
"use strict";

function getGod(id) { return GODS.find(g => g.id === id); }

// Scales a multiplier-shaped value (something meant to sit around 1.0, e.g.
// 1.15 for +15% or 0.9 for -10%) by amplifying its *deviation* from 1 - this
// works whether the base bonus pushes the value up or down, unlike a flat
// percentage add which would break for sub-1 multipliers.
function scaleDeviation(base, level) { return 1 + (base - 1) * (1 + level * GOD_POWER_SCALING_PER_LEVEL); }

// Reusable for any god (not just the equipped one) so the Gods panel can
// preview each card's real numbers at its own purchased power level.
function effectsForGodAtLevel(god, level) {
  if (!level) return god.effects;
  const scaled = {};
  const growthFactor = 1 + level * GOD_POWER_SCALING_PER_LEVEL;
  for (const key in god.effects) {
    const value = god.effects[key];
    if (key === "tierProdBonus") {
      scaled[key] = { ...value, mult: scaleDeviation(value.mult, level) };
    } else if (key === "prodMult" || key === "gemsMult" || key === "spawnSpeedMult") {
      scaled[key] = scaleDeviation(value, level);
    } else {
      // additive effects (extraStartCells, offlineCapBonusH, gemChanceBonus, bigBangMinEnergy)
      scaled[key] = value * growthFactor;
    }
  }
  return scaled;
}

function getGodEffects(state) {
  if (!state.gods || !state.gods.currentGodId) return {};
  const god = getGod(state.gods.currentGodId);
  if (!god) return {};
  const level = (state.gods.powerLevel && state.gods.powerLevel[god.id]) || 0;
  return effectsForGodAtLevel(god, level);
}

// Human-readable version of a god's *current* (power-level-scaled) bonus -
// this is what actually changes as you spend Gems on power level, since the
// static god.desc text never reflected the live numbers.
function describeGodEffect(god, level) {
  const eff = effectsForGodAtLevel(god, level);
  const pct = (mult) => (mult >= 1 ? "+" : "") + Math.round((mult - 1) * 100) + "%";
  const parts = [];
  if (eff.tierProdBonus) {
    const tierNames = TIERS.slice(eff.tierProdBonus.minTier - 1, eff.tierProdBonus.maxTier).map(t => t.name).join(" et ");
    parts.push(`${pct(eff.tierProdBonus.mult)} production (${tierNames})`);
  }
  if (eff.prodMult) parts.push(`${pct(eff.prodMult)} production globale`);
  if (eff.gemsMult) parts.push(`${pct(eff.gemsMult)} Gems gagnées`);
  if (eff.spawnSpeedMult) parts.push(`${Math.round((1 - eff.spawnSpeedMult) * 100)}% spawn plus rapide`);
  if (eff.extraStartCells) parts.push(`+${eff.extraStartCells.toFixed(1)} case(s) de départ`);
  if (eff.offlineCapBonusH) parts.push(`+${eff.offlineCapBonusH.toFixed(1)}h plafond hors-ligne`);
  if (eff.gemChanceBonus) parts.push(`+${(eff.gemChanceBonus * 100).toFixed(1)}% chance de Gem`);
  if (eff.bigBangMinEnergy) parts.push(`≥${eff.bigBangMinEnergy.toFixed(1)} ⚡ garantis au Big Bang`);
  return parts.join(", ");
}
function isGodUnlocked(state, godId) { return state.gods.unlockedIds.includes(godId); }

// Queues an unlock modal (maybeOpenGodRevealModal, ui.js) shown at the next safe moment.
// `opts.silent` skips it when the caller already has its own reveal (ritual picker, Cosmic Box).
function unlockGod(state, godId, opts) {
  if (isGodUnlocked(state, godId)) return;
  state.gods.unlockedIds.push(godId);
  if (opts && opts.silent) return;
  Sfx.chest();
  Game.pendingGodReveals.push(godId);
}

// Returns null if already unlocked or unknown. The last egg also unlocks the secret god
// Ananké, pushed directly to avoid unlockGod()'s modal (openEggGrandRevealModal has its own).
function unlockEasterEgg(state, id) {
  if (state.easterEggs.unlockedIds.includes(id)) return null;
  const egg = EASTER_EGGS.find(e => e.id === id);
  if (!egg) return null;
  state.easterEggs.unlockedIds.push(id);
  const complete = state.easterEggs.unlockedIds.length >= EASTER_EGGS.length;
  if (complete && !isGodUnlocked(state, "ananke")) state.gods.unlockedIds.push("ananke");
  return { egg, complete };
}

// Milestone-type gods unlock themselves the moment their `check` passes -
// same pattern as achievements. Called after every stat-changing event.
// Also unlocks shop gods whose free `altCheck` condition passes.
function checkGodMilestones(state) {
  GODS.forEach(g => {
    if (isGodUnlocked(state, g.id)) return;
    if (g.unlock.type === "milestone" && g.unlock.check(state)) unlockGod(state, g.id);
    else if (g.unlock.type === "shop" && g.unlock.altCheck && g.unlock.altCheck(state)) unlockGod(state, g.id);
  });
}

// ---- The moon-merge ritual (first god selection) ----
function onFusionForGods(state, newTier) {
  if (newTier === 2) {
    state.moonMergesThisRun += 1;
    // Both ritual gods unlock together so the picker offers a real choice.
    if (state.moonMergesThisRun === MOON_MERGES_TO_CHOOSE_GOD && !state.gods.currentGodId) {
      unlockGod(state, "selena", { silent: true });
      unlockGod(state, "zephar", { silent: true });
      Game.pendingGodRitual = true; // the picker modal is their reveal
    }
  }

  // Erebus challenge: N fusions in a row without using the manual tap bonus.
  if (!isGodUnlocked(state, "erebus")) {
    state.gods.erebusStreak += 1;
    const erebus = getGod("erebus");
    if (state.gods.erebusStreak >= erebus.unlock.target) unlockGod(state, "erebus");
  }

  // Morgorath challenge: reach UNIVERSE_TIER (not the top tier) without using a
  // grid-shortcut shop item this run.
  if (newTier === UNIVERSE_TIER && !state.gods.usedShortcutThisRun) {
    state.gods.morgorathChallengeCleared = true;
  }

  checkGodMilestones(state);
}
function resetErebusStreak(state) { state.gods.erebusStreak = 0; }

// ---- Thanatos challenge: checked once, at the moment Big Bang is confirmed ----
function checkThanatosChallenge(state) {
  if (isGodUnlocked(state, "thanatos")) return;
  if (emptyUnlockedIndices(state).length >= unlockedCount(state) / 2) unlockGod(state, "thanatos");
}

// ---- Choosing / swapping gods ----
// Picking a god applies immediately, even mid-run.
function chooseGod(state, godId) {
  if (!isGodUnlocked(state, godId)) return false;
  state.gods.currentGodId = godId;
  return true;
}
function applyPendingGodAtBigBang(state) {
  if (state.gods.currentGodId) {
    const id = state.gods.currentGodId;
    state.gods.usageCount[id] = (state.gods.usageCount[id] || 0) + 1;
  }
  state.moonMergesThisRun = 0;
  state.gods.erebusStreak = 0;
  state.gods.usedShortcutThisRun = false;
}

function buyGodPowerLevel(state, godId) {
  if (!isGodUnlocked(state, godId)) return { ok: false, reason: "unknown" };
  const level = state.gods.powerLevel[godId] || 0;
  if (level >= GOD_POWER_MAX_LEVEL) return { ok: false, reason: "max" };
  const cost = godPowerCost(level + 1);
  if (state.gems < cost) return { ok: false, reason: "funds", cost };
  state.gems -= cost;
  state.gods.powerLevel[godId] = level + 1;
  return { ok: true, newLevel: level + 1, cost };
}

function buyGodWithGems(state, godId) {
  const god = getGod(godId);
  if (!god || god.unlock.type !== "shop") return { ok: false, reason: "unknown" };
  if (isGodUnlocked(state, godId)) return { ok: false, reason: "owned" };
  if (state.gems < god.unlock.cost) return { ok: false, reason: "funds", cost: god.unlock.cost };
  state.gems -= god.unlock.cost;
  unlockGod(state, godId);
  return { ok: true };
}

// Picks the single most relevant "how close are you" hint for the Big Bang
// summary screen (see ui.js openBigBangSummaryModal): the milestone-type god
// nearest to unlocking, since that's concrete progress the player can
// actually see moving between runs, not just an abstract next step.
function nextGodMilestoneHint(state) {
  const candidates = GODS.filter(g => g.unlock.type === "milestone" && !isGodUnlocked(state, g.id));
  if (candidates.length === 0) return null;
  const progressOf = (g) => {
    switch (g.id) {
      case "astreos": return state.lifetime.fusions / 180;
      case "helios": return state.lifetime.maxTierEver / 7;
      case "chronos": return state.lifetime.bigBangCount / 3;
      case "nyx": return unlockedCount(state) / 20;
      default: return 0;
    }
  };
  const best = candidates.slice().sort((a, b) => progressOf(b) - progressOf(a))[0];
  const pct = Math.min(99, Math.round(progressOf(best) * 100));
  // Locked gods show their portrait as a teaser, not the emoji.
  return `Prochain Dieu en approche : ${godPortraitHtml(best, "inlineTierIcon")} ${best.name} (${pct}% - ${best.unlock.label})`;
}

// Cosmic Box: rolls a god weighted by rarity, whatever its normal unlock path.
// Only unowned gods can drop: the rarity is re-rolled until it has one, which keeps
// BOX_RARITY_WEIGHTS proportional. Once every god is owned, the box grants Gems.
function rollCosmicBox(state) {
  // Secret gods never drop and don't block the switch to Gems.
  const unownedGods = GODS.filter(g => !g.secret && !isGodUnlocked(state, g.id));
  if (unownedGods.length === 0) {
    return { duplicate: false, allGodsOwned: true, gems: rollCosmicBoxGems(state) };
  }
  const total = Object.values(BOX_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let pool = [];
  while (pool.length === 0) {
    let r = Math.random() * total;
    let pickedRarity = "commun";
    for (const rarity of Object.keys(BOX_RARITY_WEIGHTS)) {
      const weight = BOX_RARITY_WEIGHTS[rarity];
      if (r < weight) { pickedRarity = rarity; break; }
      r -= weight;
    }
    pool = unownedGods.filter(g => g.rarity === pickedRarity);
  }
  const god = pool[Math.floor(Math.random() * pool.length)];
  unlockGod(state, god.id, { silent: true }); // openCosmicBoxRevealModal (ui.js) is the reveal
  return { duplicate: false, god };
}

// Squaring Math.random() skews toward small amounts: P(<=100) ~71%, P(>180) ~5%.
function rollCosmicBoxGems(state) {
  const amount = Math.max(10, Math.round(Math.pow(Math.random(), 2) * 200));
  return grantGems(state, amount);
}
