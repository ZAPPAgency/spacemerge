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
  if (promo) Game.pendingPromo = promo; // consumed by maybeOpenFusionPromo() in input.js, same pattern as Game.pendingGodRitual (gods.js)
}

// Minimum real time between any two promo popups (starter pack, remove-ads,
// Pass Supernova) - Loris: "avec un peu plus de temps entre chaque promo".
// On top of each promo's own fusion-count/ad-count gate below, this is a
// safety net for the case those gates land close together in a single
// active session (e.g. a player binging rewarded ads could hit the
// remove-ads ad-count threshold moments after a fusion-count threshold
// fires another promo).
const PROMO_MIN_GAP_MS = 3 * 60 * 1000;
// Remove-ads promo (openRemoveAdsPromptModal, ui.js) used to fire on the
// ad-watch count alone with no fusion floor at all - between starterPack's
// (40) and vipPass's (130) own thresholds, same "well past the fabs"
// reasoning as both.
const FUSIONS_BEFORE_REMOVE_ADS_PROMO = 70;
function promoGapElapsed(state) {
  return Date.now() - (state.lastPromoShownAt || 0) >= PROMO_MIN_GAP_MS;
}
function markPromoShown(state) { state.lastPromoShownAt = Date.now(); }

// ---- IAP soft-prompts on fusion milestones (Loris) ----
// Timed to real progress rather than a session/day counter: a player who's
// fused enough times has proven they're actually playing (not just poking
// at the tutorial), a fair moment to surface the starter pack; further in
// is a stronger engagement signal, a better moment for the subscription
// pitch. Thresholds were 10/50, then 25/80 - Loris pushed further still:
// "devrait[ent] tous arrivée[s] bien plus tard, au minimum après
// l'apparition des fabs" (the last fab, +10 Gems, only reveals at 15
// fusions - see FAB_DISCOVERY_FUSIONS, ui.js) - now 40/130, both with a
// wide safety margin past that.
// `state.lifetime.fusions` only ever increases, so the `=== N` checks each
// fire at most once per save by construction - the `promptsShown` flags
// exist so a promo whose OTHER condition wasn't met at the exact milestone
// (offer expired / already owned / promo-gap not elapsed) doesn't leave a
// half-triggered state, and so this stays readable as "have we shown this
// yet" rather than relying on the exact-equality trick alone.
function checkFusionPromo(state) {
  // >= instead of the old === N: the promo-gap check below can delay a
  // promo past its own exact milestone fusion, and === would then miss it
  // forever (fusions only ever goes up) - the promptsShown flag is what
  // actually guarantees "fires at most once", so >= just keeps retrying on
  // every fusion until the gap has elapsed too.
  if (state.lifetime.fusions >= 40 && !state.promptsShown.starterPack
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

// Loris: "il faut aussi ajouter que le clicker doit fonctionner offline a
// la manière d'un jeu idle." Same "rate × time" simplification
// computeOfflineGain already uses for regular production below (a single
// snapshot of the current rate, not a real tick-by-tick replay) - grantTapBonus
// (input.js) pays 5×effectiveTileProd per tap on a TAP_COOLDOWN_MS cadence,
// so that's the rate here. Bounded by however much of the auto-clicker's own
// 10-minute window was still left when the app closed (activeUntil is a
// fixed wall-clock deadline, doesn't extend just because the player was
// away) - AND by the same offline cap (cappedMs) everything else respects.
function autoClickerOfflineGain(state, cappedMs) {
  const ac = state.autoClicker;
  if (!ac || ac.targetIdx === null) return 0;
  const activeMsAtClose = ac.activeUntil - state.lastSaveTime;
  if (activeMsAtClose <= 0) return 0; // already expired before the app closed
  const activeMs = Math.min(cappedMs, activeMsAtClose);
  const tile = state.grid[ac.targetIdx];
  if (!tile) return 0; // target cell was empty when closing - paused, same as while online
  return 5 * effectiveTileProd(state, tile.tier) * (activeMs / TAP_COOLDOWN_MS);
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
// with rewarded ads rather than a one-off. `>=` + the promptsShown flag
// instead of `=== 5` (which would fire exactly once, but the caller also
// gates on fusions/promoGapElapsed - if either isn't true yet right at the
// 5th ad, an exact-equality check would miss the promo forever since the
// counter never comes back down to 5).
function trackRewardedAdWatched(state) {
  state.lifetime.adsWatched += 1;
  return state.lifetime.adsWatched >= 5 && !state.promptsShown.removeAdsPrompt;
}

// ---- VIP daily Gems (Pass Supernova perk) ----
// Loris: "il faudrait que l'utilisateur voit chaque jour qu'il reçoit 100
// gemmes" - the grant itself already ran silently every day (gated by
// vipLastGemsDay), it just never told the player. toast() here rather than
// at each call site (boot + app-resume in main.js) so both paths - and any
// future one - get the notification for free, same convention as gods.js's
// unlockGod() owning its own toast instead of leaving it to callers.
function grantVipDailyGemsIfDue(state) {
  if (!isVipActive(state)) return 0;
  if (state.iap.vipLastGemsDay === todayStr()) return 0;
  state.iap.vipLastGemsDay = todayStr();
  const granted = grantGems(state, VIP_DAILY_GEMS);
  // Loris: "j'aimerais que ce soit bien un pop up qui apparaisse devant
  // l'écran [...] pas simplement une petite bannière" - was a toast() call
  // right here; queued instead (same "set now, show at the next safe
  // moment" pattern as Game.pendingGodRitual/pendingGodReveals) since this
  // runs very early in boot/handleAppResume, before the tutorial/offline-gain
  // modal decision - see maybeOpenVipGemsModal() (ui.js), called from both
  // call sites in main.js right after that decision.
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
    // Loris: "dans la roue la récompense 'fragment de skin' ne donne rien"
    // - real bug, not just a perception issue: EMOJI_SETS only ever had 2
    // paid sets (Fruits/Légumes) to unlock this way, so any player who
    // already owned both (easy - either bought outright, or from 6 total
    // fragments across earlier spins/logins) got nothing from every single
    // "Fragment de skin" afterward, forever, with the fragment counter
    // just climbing uselessly past SKIN_FRAGMENTS_REQUIRED in the
    // background. Same reward type backed the daily-login day-6 slot
    // (config.js DAILY_REWARDS) - replaced there too rather than leaving
    // an identical dead end half-fixed. See streakFreeze below for its
    // replacement.
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
  // Loris: "la récompense 'fragment de skin' ne donne rien, on ferait mieux
  // de remplacer ça" - see the case "streakFreeze" comment in
  // applyDailyReward above for why it was actually broken, not just a
  // weak prize. A free cell unlock instead - concrete, immediate, and (like
  // WHEEL_PRIZES' other slots) reuses an existing, already-correct code path.
  { type: "unlockCell", amount: 1, weight: 10, label: "1 case débloquée" },
  { type: "cosmicEnergy", amount: 1, weight: 5, label: "1 ⚡" },
  { type: "stardust", amount: 1500, weight: 5, label: "1500 ✨" },
];
// Cumulative angular bounds (degrees, matching buildWheelSegments'
// conic-gradient convention: 0deg = 12 o'clock, clockwise) for WHEEL_PRIZES[
// index] - shared by the wheel's rendering (buildWheelSegments, ui.js) and
// its landing-spin math (spinVisual, input.js), which used to each compute
// this independently, or - before this fix - not at all in spinVisual's
// case (see the bug note there). One shared source of the real boundaries
// means the two can't drift apart.
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
// Same date-keyed reset pattern as ensureDailySpin above - see
// state.gemsAdStreak (state.js) and grantGemsFromAd() (economy.js).
function ensureGemsAdStreak(state) {
  if (state.gemsAdStreak.date !== todayStr()) {
    state.gemsAdStreak = { date: todayStr(), count: 0 };
  }
}
// "1 case débloquée" is left out of the draw once every cell is already
// unlocked - applyDailyReward's unlockCell case has nothing to open then, so
// late-run players landing on it (10% odds) got nothing at all, the exact
// dead-end complaint that got "Fragment de skin" removed from this wheel.
// Excluding it here rather than paying a fallback also keeps the animation
// honest: spinVisual only ever lands on the prize actually awarded.
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
