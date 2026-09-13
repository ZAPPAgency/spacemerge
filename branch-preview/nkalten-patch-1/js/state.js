// Godspark - game state: defaults, load/save, migrations, daily helpers
"use strict";

function todayStr(d) {
  d = d || new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysBetween(a, b) {
  const da = new Date(a + "T00:00:00"), db = new Date(b + "T00:00:00");
  return Math.round((db - da) / 86400000);
}

// excludeIds keeps yesterday's 3 quests from being reselected today - with
// no exclusion, a purely random pick from 27 templates has decent odds of
// resurfacing 1-2 of the same ones, which reads as "the quests didn't
// actually reset" even though the reset itself ran correctly (verified:
// ensureDailyQuests fires every frame via updateQuestNotifDot, so the date
// check is never stale for more than a fraction of a second past midnight).
function pickDailyQuests(excludeIds) {
  const pool = QUEST_POOL.filter(q => !excludeIds || !excludeIds.includes(q.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3).map(q => ({ id: q.id, progress: 0, done: false, claimed: false }));
}

function freshGrid(state) {
  const unlocked = new Array(TOTAL).fill(false);
  const godEffects = getGodEffects(state);
  const extra = state.skills.swarm + Math.round(godEffects.extraStartCells || 0);
  const startCells = INITIAL_UNLOCKED.slice();
  // additional starting cells from the Swarm skill: nearest locked neighbours of the initial block
  if (extra > 0) {
    const candidates = [6, 12, 18, 19, 20, 5, 4, 3, 2, 1, 0, 23, 24, 25, 26, 27, 28, 29];
    for (let i = 0; i < extra && i < candidates.length; i++) startCells.push(candidates[i]);
  }
  startCells.forEach(i => { unlocked[i] = true; });
  const grid = new Array(TOTAL).fill(null);
  grid[8] = { tier: 1 };
  grid[9] = { tier: 1 };
  return { grid, unlocked };
}

function defaultState() {
  const state = {
    version: SAVE_VERSION,
    stardust: 0,
    gems: 0,
    cosmicEnergy: 0,
    grid: new Array(TOTAL).fill(null),
    unlocked: new Array(TOTAL).fill(false),
    extraUnlockedCount: 0,
    manualSpawnCount: 0,
    tutorialSeen: false,
    lastSaveTime: Date.now(),

    runStardustEarned: 0,
    maxTierThisRun: 1,
    runStartedAt: Date.now(), // reset at every Big Bang/restart - see performBigBang/restartRun

    lifetime: {
      stardustEarned: 0,
      gemsEarned: 0,
      fusions: 0,
      maxTierEver: 1,
      bigBangCount: 0,
      adsWatched: 0, // rewarded ads actually watched (excludes ones skipped via adsRemoved) - see input.js watchRewardedAd
      bestBigBangMs: null, // fastest time-to-Big-Bang ever recorded, see performBigBang
    },

    dailyStats: { date: null, stardustAtDayStart: 0 }, // see ensureDailyStats() - powers the Stardust info popup's "today" figure

    skills: { prod: 0, swarm: 0, gravity: 0, echo: 0, luck: 0 },
    ownedSkins: ["default", "classic"], // "default" ambiance + "classic" emoji set - the two free starting cosmetics
    equippedAmbiance: "default",
    equippedEmojiSet: "classic",

    dailyLogin: { lastClaimDay: null, streak: 0, cycleDay: 1, streakFreezeCharges: 0 },
    skinFragments: 0,

    quests: { date: null, active: [], bonusAd: { done: false, claimed: false } },
    questsCompletedTotal: 0,

    achievements: { unlockedIds: [] },

    gods: {
      unlockedIds: [],
      currentGodId: null,
      nextGodId: null,
      erebusStreak: 0,             // fusions since the last manual tap bonus (Erebus challenge)
      usedShortcutThisRun: false, // Morgorath challenge requires never using a gem-shop grid shortcut (Sauter une case / Échanger deux cases)
      morgorathChallengeCleared: false,
      usageCount: {}, // { godId: number of Big Bangs completed with that god equipped } - informational only
      powerLevel: {}, // { godId: purchased power level, see godPowerCost() } - actually scales that god's effect
    },
    moonMergesThisRun: 0, // toward MOON_MERGES_TO_CHOOSE_GOD (first-god ritual)

    cooldowns: { freePlanetUntil: 0, prodBoostUntil: 0, prodBoostActiveUntil: 0, unlockCellAdUntil: 0, gemsAdUntil: 0 },
    dailySpin: { date: null, freeUsed: false, bonusUsed: false },

    iap: { removeAds: false, vipUntil: 0, ownedSkinPacks: [], stardustBoost: false, vipLastGemsDay: null },

    settings: { sound: true, music: true, notifications: true },
    firstPlayedDay: todayStr(),
    profile: { name: "Étincelle", emoji: "👨‍🚀", color: "#f7b733" },
  };
  const seeded = freshGrid(state);
  state.grid = seeded.grid;
  state.unlocked = seeded.unlocked;
  return state;
}

function migrateFromV1(old) {
  const fresh = defaultState();
  fresh.stardust = old.stardust || 0;
  fresh.gems = old.gems || 0;
  fresh.grid = old.grid || fresh.grid;
  fresh.unlocked = old.unlocked || fresh.unlocked;
  fresh.extraUnlockedCount = old.extraUnlockedCount || 0;
  fresh.manualSpawnCount = old.manualSpawnCount || 0;
  fresh.tutorialSeen = !!old.tutorialSeen;
  fresh.lastSaveTime = old.lastSaveTime || Date.now();
  return fresh;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    if (!data) return defaultState();
    if (data.version === 1) return migrateFromV1(data);
    if (data.version !== SAVE_VERSION) return defaultState();
    // fill any missing fields added by later updates (defensive against partial saves)
    const fresh = defaultState();
    return deepFill(data, fresh);
  } catch (e) {
    console.warn("Save corrompue, nouvelle partie.", e);
    return defaultState();
  }
}

function deepFill(data, fresh) {
  for (const k in fresh) {
    if (data[k] === undefined) data[k] = fresh[k];
    else if (fresh[k] && typeof fresh[k] === "object" && !Array.isArray(fresh[k]) && typeof data[k] === "object") {
      data[k] = deepFill(data[k], fresh[k]);
    }
  }
  return data;
}

function saveState(state) {
  state.lastSaveTime = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Sauvegarde impossible", e);
  }
}

// Manual backup, independent of localStorage: lets the player copy their
// progress as a short text code and paste it back in later. This exists
// because this page runs inside a sandboxed cross-origin iframe (the Claude
// Artifact viewer) that does not grant the permission needed for the
// Storage Access API to work, so automatic persistence can fail after a
// full browser restart with no client-side fix available - see main.js.
function exportSaveCode(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}
function importSaveCode(code) {
  try {
    const json = decodeURIComponent(escape(atob(code.trim())));
    const data = JSON.parse(json);
    if (!data || typeof data.version !== "number") return null;
    if (data.version === 1) return migrateFromV1(data);
    return deepFill(data, defaultState());
  } catch (e) {
    return null;
  }
}

function productionMultiplier(state) {
  const skillMult = 1 + state.skills.prod * 0.03;
  const vipMult = isVipActive(state) ? 2 : 1;
  const boostMult = (state.cooldowns.prodBoostActiveUntil > Date.now()) ? 2 : 1;
  const godMult = getGodEffects(state).prodMult || 1;
  const iapBoostMult = state.iap.stardustBoost ? 1.5 : 1;
  return skillMult * vipMult * boostMult * godMult * iapBoostMult;
}
function tierGodMultiplier(state, tier) {
  const bonus = getGodEffects(state).tierProdBonus;
  return (bonus && tier >= bonus.minTier && tier <= bonus.maxTier) ? bonus.mult : 1;
}
function effectiveTileProd(state, tier) { return tierProd(tier) * tierGodMultiplier(state, tier) * productionMultiplier(state); }
function totalProduction(state) {
  let p = 0;
  for (let i = 0; i < TOTAL; i++) {
    const t = state.grid[i];
    if (t) p += tierProd(t.tier) * tierGodMultiplier(state, t.tier);
  }
  return p * productionMultiplier(state);
}

function isVipActive(state) { return state.iap.vipUntil > Date.now(); }
function adsRemoved(state) { return state.iap.removeAds || isVipActive(state); }
// VIP's "débloque tous les skins" perk is a subscription benefit, not a
// permanent grant - it must stop working the moment vipUntil lapses, so it's
// checked here rather than pushed into ownedSkins (which never expires).
function isSkinOwned(state, skinId) { return state.ownedSkins.includes(skinId) || isVipActive(state); }

// ---- Daily stats (Stardust info popup's "aujourd'hui" figure) ----
function ensureDailyStats(state) {
  if (state.dailyStats.date !== todayStr()) {
    state.dailyStats = { date: todayStr(), stardustAtDayStart: state.lifetime.stardustEarned };
  }
}

function offlineCapHours(state) {
  const godBonus = getGodEffects(state).offlineCapBonusH || 0;
  const base = BASE_OFFLINE_CAP_H + state.skills.echo * 2 + godBonus;
  const capped = Math.min(base, MAX_OFFLINE_CAP_H);
  return isVipActive(state) ? Math.min(capped * 2, 48) : capped;
}

function autoSpawnIntervalMs(state) {
  const reduction = Math.min(state.skills.gravity * 0.05, 0.4);
  const godMult = getGodEffects(state).spawnSpeedMult || 1;
  return Math.max(MIN_AUTO_SPAWN_MS, BASE_AUTO_SPAWN_MS * (1 - reduction) * godMult);
}

function emptyUnlockedIndices(state) {
  const out = [];
  for (let i = 0; i < TOTAL; i++) if (state.unlocked[i] && !state.grid[i]) out.push(i);
  return out;
}
function unlockedCount(state) { return state.unlocked.reduce((a, b) => a + (b ? 1 : 0), 0); }
