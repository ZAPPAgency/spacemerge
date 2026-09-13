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
    // Run upgrades (RUN_UPGRADE_TREE, config.js) - Stardust-priced, reset to
    // 0 at every Big Bang (performBigBang, economy.js), unlike `skills`
    // above which is permanent.
    runUpgrades: { catalyst: 0, resonance: 0, surge: 0, cadence: 0 },
    ownedSkins: ["classic"], // "classic" emoji set - the free starting cosmetic (the ambiance/color-skin slot was removed entirely)
    equippedEmojiSet: "classic",
    // Independent of which set (classic/fruits/legumes) is equipped above -
    // this picks whether that set's tiles show its custom illustrated
    // artwork or the plain emoji glyph, see tierIconNode() in ui.js. A set
    // with no artwork for a given tier yet (Fruits/Légumes, for now) just
    // falls back to emoji regardless of this setting - no special-casing
    // needed once the art exists later, it starts working automatically.
    iconStyle: "illustrated", // "illustrated" | "emoji"

    // One-time IAP soft-prompts triggered by real progress (fusion count),
    // not a timer - see checkFusionPromo() in retention.js. Each flag
    // guarantees its popup fires at most once ever, ever if the exact
    // fusion count that would trigger it is somehow reached twice (it
    // can't be, lifetime.fusions only grows, but the flag is the actual
    // guarantee either way).
    promptsShown: { starterPack: false, vipPass: false, removeAdsPrompt: false },
    // Generic "don't ask again" flags, opted into per confirm-modal key via
    // openConfirmModal({dontAskKey}) (ui.js) - starts empty, keys get added
    // here as a player actually checks the box for that specific action
    // (currently just "swapConfirm", the Échanger button).
    dontAskAgain: {},
    // Secret 4-egg challenge (Loris) - unlockedIds only ever grows, ids
    // from EASTER_EGGS (config.js). The counter widget (fabSecrets,
    // ui.js) stays hidden until this has its first entry.
    easterEggs: { unlockedIds: [] },
    // Loris: promos (starter pack, suppression des pubs, Pass Supernova)
    // "devrait[ent] tous arrivée[s] bien plus tard [...] avec un peu plus
    // de temps entre chaque promo" - a real-time floor between any two
    // promo popups, on top of their own individual fusion-count gates
    // (checkFusionPromo, retention.js) and the ad-watch-count gate
    // (trackRewardedAdWatched) - see PROMO_MIN_GAP_MS, retention.js.
    lastPromoShownAt: 0,

    dailyLogin: { lastClaimDay: null, streak: 0, cycleDay: 1, streakFreezeCharges: 0 },

    quests: { date: null, active: [], bonusAd: { done: false, claimed: false } },
    questsCompletedTotal: 0,

    achievements: { unlockedIds: [] },

    gods: {
      unlockedIds: [],
      currentGodId: null,
      erebusStreak: 0,             // fusions since the last manual tap bonus (Erebus challenge)
      usedShortcutThisRun: false, // Morgorath challenge requires never using a gem-shop grid shortcut (Sauter une case / Échanger deux cases)
      morgorathChallengeCleared: false,
      usageCount: {}, // { godId: number of Big Bangs completed with that god equipped } - informational only
      powerLevel: {}, // { godId: purchased power level, see godPowerCost() } - actually scales that god's effect
    },
    moonMergesThisRun: 0, // toward MOON_MERGES_TO_CHOOSE_GOD (first-god ritual)

    cooldowns: { unlockCellAdUntil: 0, swapAdUntil: 0, gemsAdUntil: 0 },
    dailySpin: { date: null, freeUsed: false, bonusUsed: false },
    // Loris: "+20 gemmes une fois par jour [...] gratuit [...] (reset à
    // minuit)" - date string, matches todayStr(); the free daily claim is
    // spent once this equals today - see grantGemsFree() (economy.js).
    gemsAdFree: { date: null, used: false },
    // Beyond the free daily claim above: up to GEMS_AD_STREAK_SIZE ad
    // watches in a row (each granting GEMS_AD_REWARD), then
    // cooldowns.gemsAdUntil forces a GEMS_AD_COOLDOWN_MS pause before the
    // next salvo - same shape as the original streak system, count resets
    // to 0 each new day (ensureGemsAdStreak, retention.js) independently of
    // the cooldown itself. See grantGemsFromAd() (economy.js).
    gemsAdStreak: { date: null, count: 0 },
    // "Clicker automatique" (Loris) - replaces the old Boost x2 fab.
    // targetIdx: the grid cell it auto-taps (grantTapBonus, input.js),
    // chosen by the player at activation (handleAutoClickerPick, input.js) -
    // kept even if that cell empties out, so it silently resumes on its own
    // the moment something occupies that index again, rather than losing
    // the pick. activeUntil: 0 or in the past = inactive. freeUsedDate: same
    // once-free-then-ad-gated pattern as gemsAdFree above. tutorialShown:
    // persisted (unlike the one-shot fab-reveal pop, Game.fabRevealed in
    // main.js, which is intentionally session-only) - the explainer modal
    // (openAutoClickerIntroModal, ui.js) must only ever play once, ever.
    autoClicker: { targetIdx: null, activeUntil: 0, freeUsedDate: null, tutorialShown: false },

    // starterPack: owned flag for the one-time starter_pack (IAP_CATALOG, type
    // "nonconsumable") - without it neither the shop nor the 40-fusion promo
    // could tell it had already been bought. See isOneTimeIapOwned() below.
    iap: { removeAds: false, vipUntil: 0, ownedSkinPacks: [], stardustBoost: false, starterPack: false, vipLastGemsDay: null },

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
    return migrateRetiredFields(deepFill(data, fresh));
  } catch (e) {
    console.warn("Save corrompue, nouvelle partie.", e);
    return defaultState();
  }
}

// deepFill() only ADDS fields; a field a later update stopped reading just
// sits in the save doing nothing. This carries over the meaning of those
// retired fields instead of silently dropping it. Run on every load path -
// loadState() above and the native Preferences load (native-bridge.js).
function migrateRetiredFields(state) {
  // gods.nextGodId: a god picked mid-run used to wait here and only become
  // current at the next Big Bang/restart. Picks now apply immediately and
  // nothing reads this any more, so a player who had one queued would have
  // kept their old god after that Big Bang, with no message. Apply it now.
  const gods = state.gods;
  if (gods && gods.nextGodId !== undefined) {
    if (gods.nextGodId && gods.unlockedIds.includes(gods.nextGodId)) gods.currentGodId = gods.nextGodId;
    delete gods.nextGodId;
  }
  return state;
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
// progress as a short text code and paste it back in later. Originally
// added because an early Claude-Artifact-hosted version of this game ran
// inside a sandboxed cross-origin iframe that could not reliably persist
// localStorage, with no client-side fix available - see main.js and
// docs/SAVE_BACKUP.md for that history. Kept now as a genuinely useful,
// storage-mechanism-independent way for a player to move their save
// between devices or recover it after clearing site data - not only a
// workaround for that original bug.
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
  const godMult = getGodEffects(state).prodMult || 1;
  const iapBoostMult = state.iap.stardustBoost ? 1.5 : 1;
  // "Catalyseur Stellaire" run upgrade (RUN_UPGRADE_TREE, config.js) - resets
  // to 0 at every Big Bang, unlike every other factor here.
  const runUpgradeMult = 1 + (state.runUpgrades.catalyst || 0) * 0.04;
  return skillMult * vipMult * godMult * iapBoostMult * runUpgradeMult;
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
// One-time purchases the player already owns, so they are neither shown in
// the shop nor pitched again by a promo (and a repeat purchase can't
// re-grant them). Consumables (Gems packs) and the subscription are not
// one-time and always return false here.
function isOneTimeIapOwned(state, productId) {
  switch (productId) {
    case "remove_ads": return state.iap.removeAds;
    case "stardust_boost": return state.iap.stardustBoost;
    case "starter_pack": return state.iap.starterPack;
    default: return false;
  }
}
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
  // "Cadence Stellaire" run upgrade (RUN_UPGRADE_TREE, config.js) - a
  // separate multiplier rather than folded into `reduction`'s own 0.4 cap,
  // same pattern as godMult - MIN_AUTO_SPAWN_MS is still the real floor
  // regardless of how many speed sources stack.
  const runUpgradeMult = Math.max(0.4, 1 - (state.runUpgrades.cadence || 0) * 0.04);
  return Math.max(MIN_AUTO_SPAWN_MS, BASE_AUTO_SPAWN_MS * (1 - reduction) * godMult * runUpgradeMult);
}

function emptyUnlockedIndices(state) {
  const out = [];
  for (let i = 0; i < TOTAL; i++) if (state.unlocked[i] && !state.grid[i]) out.push(i);
  return out;
}
function unlockedCount(state) { return state.unlocked.reduce((a, b) => a + (b ? 1 : 0), 0); }
