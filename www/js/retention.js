// Godspark - retention systems: offline gains, daily login, quests, achievements, wheel
"use strict";

// ---- Central stardust income point (keeps run/lifetime/quest stats in sync) ----
function grantStardust(state, amount) {
  if (amount <= 0) return;
  state.stardust += amount;
  state.runStardustEarned += amount;
  state.lifetime.stardustEarned += amount;
  updateQuestProgress(state, "earnStardust", amount);
  checkAchievements(state);
}
function spendStardust(state, amount) {
  state.stardust -= amount;
  updateQuestProgress(state, "spendStardust", amount);
}

// Central gameplay-earned Gems income point (applies the current god's Gems
// bonus, if any). Purchased Gems (IAP) intentionally bypass this - a
// gameplay multiplier shouldn't inflate real-money purchases.
function grantGems(state, amount) {
  if (amount <= 0) return 0;
  const boosted = Math.round(amount * (getGodEffects(state).gemsMult || 1));
  state.gems += boosted;
  state.lifetime.gemsEarned += boosted;
  return boosted;
}

function trackFusionEvent(state, newTier) {
  updateQuestProgress(state, "fusions", 1);
  updateQuestProgress(state, "reachTier", newTier, true);
  checkAchievements(state);
  onFusionForGods(state, newTier); // moon-merge ritual, Erebus streak, Morgorath challenge - see gods.js (checks some achievements, so must run after checkAchievements above)
  const promo = checkFusionPromo(state);
  if (promo) Game.pendingPromo = promo; // shown by maybeOpenFusionPromo() (input.js)
}

// Minimum real time between two promo popups, on top of each promo's own gate.
const PROMO_MIN_GAP_MS = 3 * 60 * 1000;
const FUSIONS_BEFORE_REMOVE_ADS_PROMO = 70;
function promoGapElapsed(state) {
  return Date.now() - (state.lastPromoShownAt || 0) >= PROMO_MIN_GAP_MS;
}
function markPromoShown(state) { state.lastPromoShownAt = Date.now(); }

// ---- IAP promos on fusion milestones ----
// Shown well after the last fab reveal (FAB_DISCOVERY_FUSIONS, ui.js).
function checkFusionPromo(state) {
  // `>=` rather than `===`: the gap check can delay a promo past its milestone.
  // promptsShown guarantees each promo fires once.
  if (state.lifetime.fusions >= 40 && !state.promptsShown.starterPack && !isOneTimeIapOwned(state, "starter_pack")
    && daysBetween(state.firstPlayedDay, todayStr()) <= 2 && promoGapElapsed(state)) {
    state.promptsShown.starterPack = true;
    markPromoShown(state);
    return "starterPack";
  }
  if (state.lifetime.fusions >= 130 && !state.promptsShown.vipPass && !isVipActive(state) && promoGapElapsed(state)) {
    state.promptsShown.vipPass = true;
    markPromoShown(state);
    return "vipPass";
  }
  return null;
}

// Offline auto-clicker: grantTapBonus pays 5x the tile's production every TAP_COOLDOWN_MS.
// Limited to the time left on the clicker when the app closed, and to the offline cap.
function autoClickerOfflineGain(state, cappedMs) {
  const ac = state.autoClicker;
  if (!ac || ac.targetIdx === null) return 0;
  const activeMsAtClose = ac.activeUntil - state.lastSaveTime;
  if (activeMsAtClose <= 0) return 0; // expired before the app closed
  const activeMs = Math.min(cappedMs, activeMsAtClose);
  const tile = state.grid[ac.targetIdx];
  if (!tile) return 0; // empty target: paused, like online
  return 5 * effectiveTileProd(state, tile) * (activeMs / TAP_COOLDOWN_MS);
}

// ---- Offline gains ----
function computeOfflineGain(state, nowTs) {
  const elapsedMs = Math.max(0, nowTs - state.lastSaveTime);
  const capMs = offlineCapHours(state) * 3600 * 1000;
  const cappedMs = Math.min(elapsedMs, capMs);
  const prod = totalProduction(state);
  const gain = prod * (cappedMs / 1000) * 0.5 + autoClickerOfflineGain(state, cappedMs);
  return { elapsedMs, cappedMs, gain, wasCapped: elapsedMs > capMs };
}

// Auto-spawn (tickAutoSpawn) only runs while the game loop is ticking, i.e.
// while the app is actually open - so unlike production, it doesn't cover
// time spent away at all by default. This replays it at the same cadence
// over the (capped) offline duration, filling empty unlocked cells exactly
// like it would have if the app had stayed open. Applied immediately
// (not gated behind the offline-gain modal's "collect" button) because
// tickAutoSpawn itself is passive/automatic, not something the player claims.
function applyOfflineAutoSpawns(state, cappedMs) {
  const interval = autoSpawnIntervalMs(state);
  let remaining = Math.floor(cappedMs / interval);
  let spawned = 0;
  while (remaining > 0) {
    const empties = emptyUnlockedIndices(state);
    if (empties.length === 0) break;
    const idx = empties[Math.floor(Math.random() * empties.length)];
    state.grid[idx] = { tier: 1 };
    updateQuestProgress(state, "autoSpawns", 1);
    spawned++;
    remaining--;
  }
  return spawned;
}

// ---- Rewarded ad tracking ----
// Counts ads actually watched (adsRemoved players never call this - see
// input.js watchRewardedAd) and flags the one moment a soft paywall for
// "Suppression des pubs" should interrupt: the very first time the count
// reaches 5, an amount high enough to mean the player is actually engaging
// with rewarded ads. `>=` rather than `===`: the promo can be delayed by other gates.
function trackRewardedAdWatched(state) {
  state.lifetime.adsWatched += 1;
  return state.lifetime.adsWatched >= 5 && !state.promptsShown.removeAdsPrompt;
}

// ---- VIP daily Gems (Pass Supernova perk) ----
function grantVipDailyGemsIfDue(state) {
  if (!isVipActive(state)) return 0;
  if (state.iap.vipLastGemsDay === todayStr()) return 0;
  state.iap.vipLastGemsDay = todayStr();
  const granted = grantGems(state, VIP_DAILY_GEMS);
  // Too early in boot/resume to open a modal: maybeOpenVipGemsModal() (ui.js) shows it.
  Game.pendingVipGems = granted;
  return granted;
}

// ---- Daily login ----
function isDailyLoginAvailable(state) {
  return state.dailyLogin.lastClaimDay !== todayStr();
}
function claimDailyLogin(state) {
  if (!isDailyLoginAvailable(state)) return null;
  const today = todayStr();
  const dl = state.dailyLogin;
  if (dl.lastClaimDay) {
    const gap = daysBetween(dl.lastClaimDay, today);
    if (gap === 1) {
      dl.cycleDay = (dl.cycleDay % 7) + 1;
    } else if (gap === 2 && dl.streakFreezeCharges > 0) {
      dl.streakFreezeCharges -= 1;
      dl.cycleDay = (dl.cycleDay % 7) + 1;
    } else {
      dl.streak = 0;
      dl.cycleDay = 1;
    }
  }
  dl.streak += 1;
  dl.lastClaimDay = today;

  const reward = DAILY_REWARDS[dl.cycleDay - 1];
  applyDailyReward(state, reward);
  checkAchievements(state);
  return { reward, cycleDay: dl.cycleDay, streak: dl.streak };
}
function applyDailyReward(state, reward) {
  switch (reward.type) {
    case "stardust": grantStardust(state, reward.amount); break;
    case "gems": grantGems(state, reward.amount); break;
    case "unlockCell": {
      const locked = [];
      for (let i = 0; i < TOTAL; i++) if (!state.unlocked[i]) locked.push(i);
      if (locked.length) state.unlocked[locked[Math.floor(Math.random() * locked.length)]] = true;
      break;
    }
    case "streakFreeze":
      state.dailyLogin.streakFreezeCharges += 1;
      break;
    case "bigReward":
      state.cosmicEnergy += 1;
      grantStardust(state, 500);
      break;
  }
}

// ---- Daily quests ----
function ensureDailyQuests(state) {
  if (state.quests.date !== todayStr()) {
    const previousIds = (state.quests.active || []).map(q => q.id);
    state.quests = { date: todayStr(), active: pickDailyQuests(previousIds), bonusAd: { done: false, claimed: false } };
  }
}
function updateQuestProgress(state, type, value, isMax) {
  let anyDone = false;
  state.quests.active.forEach(q => {
    if (q.done) return;
    const template = QUEST_POOL.find(t => t.id === q.id);
    if (!template || template.type !== type) return;
    q.progress = isMax ? Math.max(q.progress, value) : Math.min(template.target, q.progress + value);
    if (q.progress >= template.target) { q.done = true; anyDone = true; }
  });
  return anyDone;
}
function claimQuest(state, questId) {
  const q = state.quests.active.find(x => x.id === questId);
  if (!q || !q.done || q.claimed) return null;
  const template = QUEST_POOL.find(t => t.id === questId);
  q.claimed = true;
  const granted = grantGems(state, template.reward);
  state.questsCompletedTotal += 1;
  checkAchievements(state);
  return granted;
}
function markBonusAdQuestDone(state) {
  if (!state.quests.bonusAd.done) state.quests.bonusAd.done = true;
}
function claimBonusAdQuest(state) {
  if (!state.quests.bonusAd.done || state.quests.bonusAd.claimed) return null;
  state.quests.bonusAd.claimed = true;
  const granted = grantGems(state, BONUS_AD_QUEST.reward);
  state.questsCompletedTotal += 1;
  checkAchievements(state);
  return granted;
}

// ---- Achievements ----
function achievementValue(state, cat) {
  switch (cat) {
    case "fusions": return state.lifetime.fusions;
    case "maxTier": return state.lifetime.maxTierEver;
    case "bigBangs": return state.lifetime.bigBangCount;
    case "lifetimeStardust": return state.lifetime.stardustEarned;
    case "streak": return state.dailyLogin.streak;
    case "questsCompleted": return state.questsCompletedTotal;
    case "cellsUnlocked": return unlockedCount(state);
    case "lifetimeGems": return state.lifetime.gemsEarned;
    default: return 0;
  }
}
function checkAchievements(state) {
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements.unlockedIds.includes(a.id)) continue;
    if (achievementValue(state, a.cat) >= a.target) {
      state.achievements.unlockedIds.push(a.id);
      grantGems(state, a.reward);
      newly.push(a);
    }
  }
  // Game Center sync is a no-op on web; native-bridge.js defines
  // window.GameCenterService once running inside Capacitor (see docs/BUILD_IOS.md
  // for the leaderboard/achievement IDs these calls expect in App Store Connect).
  if (window.GameCenterService) {
    newly.forEach(a => window.GameCenterService.unlockAchievement(a.id, 100));
    window.GameCenterService.submitScore("maxTier", state.lifetime.maxTierEver);
    window.GameCenterService.submitScore("cosmicEnergy", state.cosmicEnergy);
    window.GameCenterService.submitScore("bigBangCount", state.lifetime.bigBangCount);
  }
  return newly;
}

// ---- Daily wheel ----
const WHEEL_PRIZES = [
  { type: "stardust", amount: 200, weight: 30, label: "200 ✨" },
  { type: "stardust", amount: 500, weight: 20, label: "500 ✨" },
  { type: "gems", amount: 10, weight: 20, label: "10 💎" },
  { type: "gems", amount: 25, weight: 10, label: "25 💎" },
  { type: "unlockCell", amount: 1, weight: 10, label: "1 case débloquée" },
  { type: "cosmicEnergy", amount: 1, weight: 5, label: "1 ⚡" },
  { type: "stardust", amount: 1500, weight: 5, label: "1500 ✨" },
];
// Angular bounds of WHEEL_PRIZES[index], in degrees clockwise from 12 o'clock.
// Shared by the wheel drawing (ui.js) and the landing spin (input.js) so they match.
function wheelSegmentBounds(index) {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0);
  let acc = 0;
  for (let i = 0; i < index; i++) acc += WHEEL_PRIZES[i].weight;
  const startDeg = (acc / total) * 360;
  const endDeg = ((acc + WHEEL_PRIZES[index].weight) / total) * 360;
  return { startDeg, endDeg };
}
function ensureDailySpin(state) {
  if (state.dailySpin.date !== todayStr()) {
    state.dailySpin = { date: todayStr(), freeUsed: false, bonusUsed: false };
  }
}
function ensureGemsAdStreak(state) {
  if (state.gemsAdStreak.date !== todayStr()) {
    state.gemsAdStreak = { date: todayStr(), count: 0 };
  }
}
// "1 case débloquée" is removed from the draw when the grid is full,
// so every prize the wheel lands on actually gives something.
function pickWheelPrize(state) {
  const gridFull = unlockedCount(state) >= TOTAL;
  const pool = WHEEL_PRIZES.filter(p => !(gridFull && p.type === "unlockCell"));
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of pool) { if (r < p.weight) return p; r -= p.weight; }
  return pool[0];
}
function spinWheel(state, isBonus) {
  ensureDailySpin(state);
  if (isBonus && state.dailySpin.bonusUsed) return null;
  if (!isBonus && state.dailySpin.freeUsed) return null;
  const prize = pickWheelPrize(state);
  if (prize.type === "stardust") grantStardust(state, prize.amount);
  else if (prize.type === "gems") grantGems(state, prize.amount);
  else if (prize.type === "unlockCell") applyDailyReward(state, { type: "unlockCell" });
  else if (prize.type === "cosmicEnergy") state.cosmicEnergy += prize.amount;
  if (isBonus) state.dailySpin.bonusUsed = true; else state.dailySpin.freeUsed = true;
  checkAchievements(state);
  return prize;
}
