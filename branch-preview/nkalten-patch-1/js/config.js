// Godspark - configuration & pure formulas (no state, no DOM)
"use strict";

const COLS = 6, ROWS = 5, TOTAL = COLS * ROWS;
const SAVE_KEY = "cosmerge_save_v2";
const SAVE_VERSION = 2;
const AUTOSAVE_MS = 5000;
const BASE_AUTO_SPAWN_MS = 8000;
const MIN_AUTO_SPAWN_MS = 3000;
const TAP_COOLDOWN_MS = 1000;
const DRAG_THRESHOLD = 10;
const BASE_OFFLINE_CAP_H = 8;
const MAX_OFFLINE_CAP_H = 24;
const FREE_PLANET_COOLDOWN_MS = 4 * 60 * 60 * 1000;
// Shorter than the free planet's cooldown - a free cell unlock is worth less
// (unlockCost grows 1.5x per cell, so late-run it can hit tens of thousands
// of Stardust) but it's the specific relief valve for the "unlock costs feel
// like a wall" complaint, so it should be more frequently available.
const UNLOCK_CELL_AD_COOLDOWN_MS = 2 * 60 * 60 * 1000;
// Deliberately short and repeatable - this is the "grind toward a specific
// purchase" ad, not a big one-off bonus like the others above.
const GEMS_AD_COOLDOWN_MS = 3 * 60 * 1000;
const GEMS_AD_REWARD = 10; // 5 watches = 50 Gems = exactly the swapCells shop cost, see SHOP_GEM_ITEMS
const VIP_DAILY_GEMS = 50;
// Short + frequent beats long + forgettable for rewarded-ad engagement: a
// 30 min boost gets watched once and ignored, a 10 min one stays felt and
// is worth re-watching for well within a normal play session.
const PROD_BOOST_COOLDOWN_MS = 12 * 60 * 1000;
const PROD_BOOST_DURATION_MS = 10 * 60 * 1000;
const INTERSTITIAL_MIN_GAP_MS = 3 * 60 * 1000;
const INTERSTITIAL_QUIET_START_MS = 60 * 1000;
const MOON_MERGES_TO_CHOOSE_GOD = 4;
// Flat (not scaled like invokeCost) - a cheap, predictable Gems shortcut to
// summon a Meteorite instantly. Doesn't touch manualSpawnCount, so using it
// never makes the Stardust-priced Invoke button more expensive.
const GEMS_INVOKE_COST = 5;

const TIERS = [
  { n: 1, name: "Météorite", emoji: "☄️", from: "#8a8a8a", to: "#2b2b2b" },
  { n: 2, name: "Lune", emoji: "🌙", from: "#e8e8f2", to: "#8a8aa0" },
  { n: 3, name: "Planète naine", emoji: "🪨", from: "#d3ac7a", to: "#7a5c3a" },
  { n: 4, name: "Planète", emoji: "🌍", from: "#63c4ff", to: "#1e5f8c" },
  { n: 5, name: "Géante gazeuse", emoji: "🪐", from: "#f6d365", to: "#b8722e" },
  { n: 6, name: "Étoile", emoji: "⭐", from: "#fff9c4", to: "#ff9800" },
  { n: 7, name: "Étoile à neutrons", emoji: "💫", from: "#e0f7ff", to: "#00b8d4" },
  { n: 8, name: "Trou noir", emoji: "🕳️", from: "#6a2bb8", to: "#000000" },
  { n: 9, name: "Galaxie", emoji: "🌌", from: "#ff7ce8", to: "#4a00e0" },
  { n: 10, name: "Univers", emoji: "✨", from: "#ffffff", to: "#ffd54f" },
];

const INITIAL_UNLOCKED = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17];

// Ambiance (background gradient) and emoji set (tier icons/names) are two
// independent equip slots - a player can mix e.g. "Nébuleuse rose" with
// "Fruits du Cosmos", not a bundled all-or-nothing skin. See
// state.equippedAmbiance/equippedEmojiSet and ui.js's tierStyle()/
// tierEmoji()/tierName(), which each only look at their own slot.
const AMBIANCES = [
  { id: "default", name: "Nébuleuse par défaut", cost: 0, currency: "gems",
    colors: ["#8a8a8a", "#2b2b2b"] },
  { id: "violet", name: "Nébuleuse violette", cost: 150, currency: "gems",
    colors: ["#c9a6ff", "#7c3aed"] },
  { id: "green", name: "Aurore verte", cost: 150, currency: "gems",
    colors: ["#a7f3c8", "#059669"] },
  { id: "red", name: "Supernova rouge", cost: 150, currency: "gems",
    colors: ["#ffb3a6", "#dc2626"] },
  { id: "pink", name: "Nébuleuse rose", cost: 150, currency: "gems",
    colors: ["#ffb3c6", "#c2185b"] },
  { id: "emerald", name: "Nébuleuse émeraude", cost: 150, currency: "gems",
    colors: ["#a7e8a0", "#2e7d32"] },
];

const EMOJI_SETS = [
  // "classic", not "default" - AMBIANCES also has a "default" entry, and
  // findCosmeticItem() (economy.js) checks AMBIANCES first, so a shared id
  // meant equipping "the base icon set" silently re-equipped the base
  // ambiance instead - the base icon set could never actually be selected.
  { id: "classic", name: "Cases classiques", cost: 0, currency: "gems" },
  // Tier 1 used to be Cerise/Petit Pois - both unrecognizable at tile size
  // (tiny red blob / tiny green blob), swapped for something unmistakable.
  { id: "fruits", name: "Fruits du Cosmos", cost: 300, currency: "gems",
    tierSkin: [
      { emoji: "🍓", name: "Fraise" }, { emoji: "🍒", name: "Cerise" },
      { emoji: "🍇", name: "Raisin" }, { emoji: "🍊", name: "Orange" },
      { emoji: "🍎", name: "Pomme" }, { emoji: "🍍", name: "Ananas" },
      { emoji: "🍉", name: "Pastèque" }, { emoji: "🥥", name: "Noix de Coco" },
      { emoji: "🍈", name: "Melon Géant" }, { emoji: "🍯", name: "Nectar Cosmique" },
    ] },
  { id: "legumes", name: "Légumes de l'Espace", cost: 300, currency: "gems",
    tierSkin: [
      { emoji: "🥕", name: "Carotte" }, { emoji: "🍅", name: "Tomate" },
      { emoji: "🌽", name: "Maïs" }, { emoji: "🫑", name: "Poivron" },
      { emoji: "🍆", name: "Aubergine" }, { emoji: "🥦", name: "Brocoli" },
      { emoji: "🧅", name: "Oignon" }, { emoji: "🫛", name: "Petit Pois" },
      { emoji: "🎃", name: "Citrouille Géante" }, { emoji: "🌻", name: "Fleur Cosmique" },
    ] },
];

// ---- Skill tree (permanent, spent with Cosmic Energy) ----
const SKILL_TREE = {
  prod: { name: "Production Stellaire", desc: "+3% production globale / niveau", maxLevel: 50, base: 1, growth: 1.25 },
  swarm: { name: "Essaim", desc: "+1 case de départ déverrouillée / niveau", maxLevel: 10, base: 2, growth: 1.4 },
  gravity: { name: "Gravité Rapide", desc: "-5% cooldown de spawn auto / niveau (plancher 3s)", maxLevel: 8, base: 1, growth: 1.3 },
  echo: { name: "Écho Temporel", desc: "+2h de plafond hors-ligne / niveau (max 24h)", maxLevel: 8, base: 2, growth: 1.35 },
  luck: { name: "Chance Cosmique", desc: "+1% chance de Gem bonus par fusion / niveau", maxLevel: 20, base: 1, growth: 1.2 },
};

function skillCost(branchKey, nextLevel) {
  const b = SKILL_TREE[branchKey];
  return Math.ceil(b.base * Math.pow(b.growth, nextLevel - 1));
}

// ---- Gods of the Cosmos ----
// One god is equipped per run (chosen the first time you reach
// MOON_MERGES_TO_CHOOSE_GOD, changeable anytime but only takes effect on the
// next Big Bang - see gods.js). Each god's `effects` keys are read by
// gods.js's getGodEffects() and applied at the specific point in the game
// logic named in the comment beside it.
const RARITY = {
  commun: { label: "Commun", color: "#9ca3af" },
  rare: { label: "Rare", color: "#38bdf8" },
  epique: { label: "Épique", color: "#a855f7" },
  legendaire: { label: "Légendaire", color: "#fbbf24" },
};

const GODS = [
  {
    id: "selena", name: "Séléna", title: "Déesse des Lunes", emoji: "🌙",
    rarity: "commun", alignment: "bienveillant",
    desc: "+15% production des Lunes et Planètes naines",
    effects: { tierProdBonus: { minTier: 2, maxTier: 3, mult: 1.15 } }, // used in state.js effectiveTileProd/totalProduction
    unlock: { type: "ritual" }, // granted automatically by the moon-merge ritual, see gods.js
    lore: "La première à avoir répondu à l'appel du rituel des lunes. Séléna veille sur chaque fragment qui tourne encore dans le noir, patiente, et guide la main du fusionneur novice.",
  },
  {
    id: "astreos", name: "Astréos", title: "Gardien des Astéroïdes", emoji: "☄️",
    rarity: "commun", alignment: "bienveillant",
    desc: "Spawn automatique 10% plus rapide",
    effects: { spawnSpeedMult: 0.9 }, // used in state.js autoSpawnIntervalMs
    unlock: { type: "milestone", check: (s) => s.lifetime.fusions >= 180, label: "Réalise 180 fusions à vie" },
    lore: "Il fut le premier corps à se briser lors de la Rupture. Depuis, il pousse inlassablement la poussière vers la lumière, pour que jamais une case ne reste vide trop longtemps.",
  },
  {
    id: "nyx", name: "Nyx", title: "Dame du Vide", emoji: "🌌",
    rarity: "rare", alignment: "bienveillant",
    desc: "+1 case de départ supplémentaire",
    effects: { extraStartCells: 1 }, // used in state.js freshGrid
    unlock: { type: "milestone", check: (s) => s.achievements.unlockedIds.includes("unlocked_20"), label: "Débloque 20 cases en une partie" },
    lore: "Nyx n'a jamais choisi de camp - elle est l'espace lui-même, celui qui reste à conquérir. Ceux qui apprennent à l'apprivoiser trouvent toujours un peu plus de place qu'annoncé.",
  },
  {
    id: "helios", name: "Hélios", title: "Cœur Ardent", emoji: "☀️",
    rarity: "rare", alignment: "bienveillant",
    desc: "+20% production des Étoiles et Étoiles à neutrons",
    effects: { tierProdBonus: { minTier: 6, maxTier: 7, mult: 1.2 } },
    unlock: { type: "milestone", check: (s) => s.lifetime.maxTierEver >= 7, label: "Atteins le palier Étoile à neutrons" },
    lore: "Quand la fusion atteint l'incandescence, Hélios se réveille. Il ne connaît qu'une loi : brûler plus fort, encore, jusqu'à ce que le froid du vide n'ait plus aucune prise.",
  },
  {
    id: "chronos", name: "Chronos", title: "Maître du Temps", emoji: "⏳",
    rarity: "rare", alignment: "bienveillant",
    desc: "+4h de plafond de gains hors-ligne",
    effects: { offlineCapBonusH: 4 }, // used in state.js offlineCapHours
    unlock: { type: "milestone", check: (s) => s.lifetime.bigBangCount >= 3, label: "Déclenche 3 Big Bang" },
    lore: "Chronos a vu trois univers se replier sur eux-mêmes et renaître. Il ne juge plus le temps qui passe - il apprend simplement à en garder un peu plus de côté pour toi.",
  },
  {
    id: "erebus", name: "Erebus", title: "Seigneur du Chaos", emoji: "🌑",
    rarity: "epique", alignment: "dechu",
    desc: "+25% Gems gagnées, mais -10% production globale",
    effects: { gemsMult: 1.25, prodMult: 0.9 },
    unlock: {
      type: "challenge", challengeId: "erebus",
      label: "Défi : fusionne 35 fois d'affilée sans jamais appuyer sur une case pour récupérer son bonus (appuyer remet ce compteur à zéro)",
      target: 35,
    },
    lore: "Erebus fut banni pour avoir préféré le désordre fécond à l'ordre stérile. Le servir a un prix - moins de matière produite - mais il paie grassement en poussière précieuse ceux qui l'acceptent.",
  },
  {
    id: "thanatos", name: "Thanatos", title: "l'Inévitable", emoji: "💀",
    rarity: "epique", alignment: "dechu",
    desc: "Le prochain Big Bang garantit au moins 5 ⚡ Énergie Cosmique",
    effects: { bigBangMinEnergy: 5 }, // used in economy.js performBigBang
    unlock: {
      type: "challenge", challengeId: "thanatos",
      label: "Défi : déclenche un Big Bang alors que moins de la moitié des cases débloquées sont occupées",
      target: 1,
    },
    lore: "Thanatos n'attend jamais que tout soit fini pour mettre un terme aux choses. Il enseigne qu'un cycle interrompu à temps vaut parfois mieux qu'un cycle mené jusqu'à l'épuisement.",
  },
  {
    id: "gaia", name: "Gaïa Suprême", title: "Créatrice", emoji: "🌍",
    rarity: "legendaire", alignment: "bienveillant",
    desc: "+10% à toute la production, +5% chance de Gem bonus par fusion",
    effects: { prodMult: 1.1, gemChanceBonus: 0.05 },
    unlock: { type: "shop", cost: 800, altCheck: (s) => s.lifetime.bigBangCount >= 10, altLabel: "ou 10 Big Bang déclenchés" },
    lore: "Avant la Rupture, Gaïa était le Cosmos tout entier. Ce qu'elle t'offre n'est qu'un souvenir de cette unité - mais même un souvenir de la Création reste un cadeau immense.",
  },
  {
    id: "morgorath", name: "Morgorath", title: "Dévoreur d'Étoiles", emoji: "🕳️",
    rarity: "legendaire", alignment: "dechu",
    desc: "+40% production des Trous noirs, Galaxies et Univers",
    effects: { tierProdBonus: { minTier: 8, maxTier: 10, mult: 1.4 } },
    unlock: {
      type: "shop", cost: 800,
      altCheck: (s) => s.gods.morgorathChallengeCleared, altLabel: "ou atteins l'Univers sans utiliser Sauter une case ni Échanger deux cases dans la partie",
    },
    lore: "Morgorath ne crée rien - il concentre. Chaque étoile qu'il engloutit devient un peu plus dense, un peu plus lourde, jusqu'à ce que la lumière elle-même n'ose plus s'en échapper.",
  },

  // ---- Box-exclusive gods: unlock.type "box" means no story/milestone/shop
  // path exists at all - rollCosmicBox() (gods.js) is the only way in. Kept
  // deliberately non-commun, per design intent: the Cosmic Box should feel
  // worth opening even for a player who's already awakened every story god.
  {
    id: "iris", name: "Iris", title: "Messagère des Fragments", emoji: "🌈",
    rarity: "rare", alignment: "bienveillant",
    desc: "+18% production des Planètes et Géantes gazeuses",
    effects: { tierProdBonus: { minTier: 4, maxTier: 5, mult: 1.18 } },
    unlock: { type: "box" },
    lore: "Iris ne s'éveille jamais d'elle-même - elle apparaît, ou elle n'apparaît pas, au hasard d'une Boîte Cosmique ouverte. Elle porte les messages qu'aucun autre Dieu endormi ne peut plus entendre.",
  },
  {
    id: "eris", name: "Éris", title: "Semeuse de Discorde", emoji: "🔮",
    rarity: "epique", alignment: "dechu",
    desc: "+8% chance de Gem bonus par fusion, mais -7% production globale",
    effects: { gemChanceBonus: 0.08, prodMult: 0.93 },
    unlock: { type: "box" },
    lore: "Éris trouve la Rupture magnifique - un chaos si parfait qu'elle refuse d'y voir un accident. Ceux qui l'invoquent gagnent en fortune ce qu'ils perdent en constance.",
  },
  {
    id: "nemesis", name: "Némésis", title: "la Justicière Cosmique", emoji: "⚖️",
    rarity: "legendaire", alignment: "dechu",
    desc: "+12% production globale et +12% Gems gagnées",
    effects: { prodMult: 1.12, gemsMult: 1.12 },
    unlock: { type: "box" },
    lore: "Némésis ne pardonne à aucun Dieu d'avoir laissé le Cosmos se briser - bienveillant ou déchu, tous lui doivent des comptes. Rare est le fusionneur qu'elle juge digne de son alliance.",
  },
];

// ---- Lore fragments: progressive story reveal in the Histoire panel ----
// The base story (renderStoryPanel) only tells you THAT the Rupture
// happened, deliberately not why - these fragments are the "why", unlocked
// by real progress so there's always a next piece of the mystery to chase.
const LORE_FRAGMENTS = [
  {
    id: "frag_doubt", title: "Le Premier Doute",
    unlock: (s) => !!s.gods.currentGodId,
    text: "Séléna te le dira, si tu l'écoutes vraiment : elle n'a jamais cru à l'accident. \"Un ordre parfait ne se brise pas tout seul\", murmure-t-elle. Alors quoi - ou qui ?",
  },
  {
    id: "frag_voices", title: "Les Deux Voix",
    unlock: (s) => s.gods.unlockedIds.length >= 3,
    text: "Chaque Dieu se souvient de la Rupture différemment - c'est ça, le vrai clivage entre bienveillants et déchus. Les uns l'ont vécue comme un vol. Les autres, comme une porte enfin ouverte. Aucun des deux souvenirs ne ment.",
  },
  {
    id: "frag_echo", title: "L'Écho du Big Bang",
    unlock: (s) => s.lifetime.bigBangCount >= 1,
    text: "Ce que tu viens de déclencher a un nom ancien. Chaque Big Bang que tu provoques est un écho miniature de LA Rupture originelle - en plus petit, en plus doux, mais un écho tout de même. Toi aussi, tu recommences le monde.",
  },
  {
    id: "frag_name", title: "Le Nom Interdit",
    unlock: (s) => s.gods.unlockedIds.length >= 6,
    text: "Un seul Dieu refuse d'en parler : Némésis. Pas par ignorance - par jugement. Elle seule, dit-on, sait ce qui s'est vraiment passé. Et elle seule a décidé que personne ne le méritait encore.",
  },
  {
    id: "frag_truth", title: "La Vérité",
    unlock: (s) => s.achievements.unlockedIds.length >= ACHIEVEMENTS.length,
    text: "La Rupture n'était pas un accident, ni une attaque. C'était une question - posée par un Cosmos trop parfait pour savoir s'il méritait de durer. Chaque fusion que tu accomplis est une réponse. La tienne, jusqu'ici, a toujours été oui.",
  },
];

// ---- Daily login cycle (7 days) ----
const DAILY_REWARDS = [
  { day: 1, type: "stardust", amount: 100, label: "100 ✨" },
  { day: 2, type: "gems", amount: 20, label: "20 💎" },
  { day: 3, type: "unlockCell", amount: 1, label: "1 case débloquée" },
  { day: 4, type: "stardust", amount: 300, label: "300 ✨" },
  { day: 5, type: "gems", amount: 40, label: "40 💎" },
  { day: 6, type: "skinFragment", amount: 1, label: "Fragment de skin" },
  { day: 7, type: "bigReward", amount: 1, label: "1 ⚡ Énergie Cosmique + gros lot ✨" },
];
const SKIN_FRAGMENTS_REQUIRED = 3;

// ---- Daily quest pool (templates); 3 drawn per day + 1 bonus "watch ad" ----
const QUEST_POOL = [
  { id: "fuse15", desc: "Fusionne 15 fois", type: "fusions", target: 15, reward: 10 },
  { id: "fuse30", desc: "Fusionne 30 fois", type: "fusions", target: 30, reward: 15 },
  { id: "reachStar", desc: "Atteins le palier Étoile", type: "reachTier", target: 6, reward: 15 },
  { id: "reachPlanet", desc: "Atteins le palier Planète", type: "reachTier", target: 4, reward: 8 },
  { id: "reachBlackHole", desc: "Atteins le palier Trou noir", type: "reachTier", target: 8, reward: 20 },
  { id: "earn5000", desc: "Gagne 5000 Stardust", type: "earnStardust", target: 5000, reward: 10 },
  { id: "earn20000", desc: "Gagne 20000 Stardust", type: "earnStardust", target: 20000, reward: 18 },
  { id: "unlock1", desc: "Débloque 1 case", type: "unlockCells", target: 1, reward: 8 },
  { id: "unlock3", desc: "Débloque 3 cases", type: "unlockCells", target: 3, reward: 16 },
  { id: "spend500", desc: "Dépense 500 Stardust", type: "spendStardust", target: 500, reward: 8 },
  { id: "invoke5", desc: "Invoque 5 Météorites", type: "invokes", target: 5, reward: 10 },
  { id: "tapBonus10", desc: "Récupère 10 bonus manuels", type: "tapBonuses", target: 10, reward: 8 },
  { id: "spawnAuto5", desc: "Laisse apparaître 5 Météorites automatiques", type: "autoSpawns", target: 5, reward: 6 },
  { id: "fuse5tier5", desc: "Fusionne jusqu'à Géante gazeuse", type: "reachTier", target: 5, reward: 12 },
  { id: "fuse50", desc: "Fusionne 50 fois", type: "fusions", target: 50, reward: 22 },
  { id: "fuse8", desc: "Fusionne 8 fois", type: "fusions", target: 8, reward: 6 },
  { id: "reachGalaxy", desc: "Atteins le palier Galaxie", type: "reachTier", target: 9, reward: 25 },
  { id: "reachNeutronStar", desc: "Atteins le palier Étoile à neutrons", type: "reachTier", target: 7, reward: 17 },
  { id: "earn100000", desc: "Gagne 100 000 Stardust", type: "earnStardust", target: 100000, reward: 25 },
  { id: "earn1500", desc: "Gagne 1500 Stardust", type: "earnStardust", target: 1500, reward: 6 },
  { id: "unlock5", desc: "Débloque 5 cases", type: "unlockCells", target: 5, reward: 20 },
  { id: "spend2000", desc: "Dépense 2000 Stardust", type: "spendStardust", target: 2000, reward: 15 },
  { id: "invoke10", desc: "Invoque 10 Météorites", type: "invokes", target: 10, reward: 15 },
  { id: "invoke3", desc: "Invoque 3 Météorites", type: "invokes", target: 3, reward: 6 },
  { id: "tapBonus20", desc: "Récupère 20 bonus manuels", type: "tapBonuses", target: 20, reward: 14 },
  { id: "tapBonus5", desc: "Récupère 5 bonus manuels", type: "tapBonuses", target: 5, reward: 5 },
  { id: "spawnAuto10", desc: "Laisse apparaître 10 Météorites automatiques", type: "autoSpawns", target: 10, reward: 10 },
];
const BONUS_AD_QUEST = { id: "watchAd", desc: "Regarde une publicité", reward: 15 };

// ---- Achievements (permanent, never reset) ----
const ACHIEVEMENTS = [
  { id: "fuse_10", cat: "fusions", target: 10, name: "Premières fusions", reward: 10 },
  { id: "fuse_100", cat: "fusions", target: 100, name: "Artisan cosmique", reward: 25 },
  { id: "fuse_500", cat: "fusions", target: 500, name: "Maître fusionneur", reward: 60 },
  { id: "fuse_2000", cat: "fusions", target: 2000, name: "Légende de la fusion", reward: 150 },
  { id: "tier_4", cat: "maxTier", target: 4, name: "Formation planétaire", reward: 10 },
  { id: "tier_6", cat: "maxTier", target: 6, name: "Naissance d'une étoile", reward: 20 },
  { id: "tier_8", cat: "maxTier", target: 8, name: "Horizon des événements", reward: 40 },
  { id: "tier_9", cat: "maxTier", target: 9, name: "Voie lactée", reward: 70 },
  { id: "tier_10", cat: "maxTier", target: 10, name: "Créateur d'univers", reward: 120 },
  { id: "bigbang_1", cat: "bigBangs", target: 1, name: "Premier Big Bang", reward: 30 },
  { id: "bigbang_5", cat: "bigBangs", target: 5, name: "Cycle cosmique", reward: 80 },
  { id: "bigbang_20", cat: "bigBangs", target: 20, name: "Éternel recommencement", reward: 200 },
  { id: "lifetime_10k", cat: "lifetimeStardust", target: 10000, name: "Petit collectionneur", reward: 10 },
  { id: "lifetime_100k", cat: "lifetimeStardust", target: 100000, name: "Riche en poussière d'étoiles", reward: 30 },
  { id: "lifetime_1m", cat: "lifetimeStardust", target: 1000000, name: "Millionnaire stellaire", reward: 70 },
  { id: "lifetime_100m", cat: "lifetimeStardust", target: 100000000, name: "Magnat de la galaxie", reward: 180 },
  { id: "streak_3", cat: "streak", target: 3, name: "Habitué·e", reward: 10 },
  { id: "streak_7", cat: "streak", target: 7, name: "Semaine complète", reward: 25 },
  { id: "streak_30", cat: "streak", target: 30, name: "Fidèle des étoiles", reward: 100 },
  { id: "quests_10", cat: "questsCompleted", target: 10, name: "Chasseur de quêtes", reward: 15 },
  { id: "quests_100", cat: "questsCompleted", target: 100, name: "Expert en missions", reward: 60 },
  { id: "unlocked_20", cat: "cellsUnlocked", target: 20, name: "Grande expansion", reward: 25 },
  { id: "unlocked_all", cat: "cellsUnlocked", target: 30, name: "Grille complète", reward: 50 },
  { id: "gems_1000", cat: "lifetimeGems", target: 1000, name: "Trésor de Gems", reward: 20 },
];

// ---- Shop catalog (soft currency: stardust / gems) ----
const SHOP_GEM_ITEMS = [
  { id: "skipCell", name: "Sauter une case", desc: "Débloque instantanément une case verrouillée", cost: 25 },
  { id: "swapCells", name: "Échanger deux cases", desc: "Permute le contenu de deux cases au choix", cost: 50 },
  { id: "streakFreeze", name: "Gel de série", desc: "Protège ta série de connexion pendant 1 jour manqué", cost: 20 },
  // Odds spelled out in the description itself (not just BOX_RARITY_WEIGHTS
  // in code) because Gems are directly purchasable with real money - Apple
  // requires disclosed odds for any randomized reward reachable that way
  // (App Review Guideline 3.1.1). Keep this string's percentages in sync
  // with BOX_RARITY_WEIGHTS below by hand if those ever change.
  { id: "cosmicBox", name: "Boîte Cosmique", desc: "Un Dieu au hasard - Commun 50% · Rare 30% · Épique 15% · Légendaire 5% (un doublon se change en Gems)", cost: 120 },
];

// Cosmic Box odds: Commun is the most likely roll, Légendaire the rarest.
// Rolling a god you already have converts to Gems instead (scaled by the
// rarity rolled, so bad luck still feels worth something).
const BOX_RARITY_WEIGHTS = { commun: 50, rare: 30, epique: 15, legendaire: 5 };
const BOX_DUPLICATE_GEMS = { commun: 10, rare: 20, epique: 40, legendaire: 80 };

// ---- IAP catalog (simulated at this stage) ----
const IAP_CATALOG = [
  { id: "remove_ads", type: "nonconsumable", name: "Suppression des pubs", price: "3,99 $", desc: "Retire toutes les publicités définitivement, et débloque instantanément tous les bonus normalement obtenus en pub (boost, planète gratuite, quête bonus)." },
  { id: "vip_monthly", type: "subscription", name: "Pass Supernova", price: "6,99 $/mois",
    desc: "✅ Aucune publicité, jamais\n✅ +100% de production de Stardust\n✅ Débloque tous les skins (ambiances et sets d'icônes)\n✅ Double la durée maximale de gains hors-ligne (jusqu'à 48h d'absence couverte au lieu de 24h)\n✅ 50 Gems offertes chaque jour" },
  { id: "stardust_boost", type: "nonconsumable", name: "Multiplicateur Stardust", price: "4,99 $", desc: "+50% de production de Stardust, en permanence, cumulable avec tous les autres bonus." },
  { id: "starter_pack", type: "nonconsumable", name: "Pack de démarrage", price: "1,99 $", desc: "500 Gems + 3 cases + boost 1h.", startersOnly: true },
  { id: "gems_small", type: "consumable", name: "100 Gems", price: "0,99 $", amount: 100 },
  { id: "gems_medium", type: "consumable", name: "550 Gems (+10%)", price: "4,99 $", amount: 550 },
  { id: "gems_large", type: "consumable", name: "1200 Gems (+20%)", price: "9,99 $", amount: 1200 },
  { id: "gems_mega", type: "consumable", name: "3000 Gems (+35%)", price: "19,99 $", amount: 3000 },
];

// ---- Formulas ----
function tierProd(tier) { return 0.5 * Math.pow(2, tier - 1); }
function unlockCost(n) { return Math.round(50 * Math.pow(1.5, n)); }
function invokeCost(k) { return Math.round(15 * Math.pow(1.12, k)); }

function bigBangGain(stardustEarnedThisRun, maxTierReached) {
  const base = Math.floor(Math.sqrt(stardustEarnedThisRun / 500000));
  const bonus = Math.max(0, (maxTierReached - 5) * 3);
  return Math.max(1, base + bonus);
}

function formatNumber(n) {
  const sign = n < 0 ? "-" : "";
  n = Math.abs(n);
  if (n < 1000) return sign + Math.floor(n).toString();
  const units = ["K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "De"];
  let u = -1, num = n;
  while (num >= 1000 && u < units.length - 1) { num /= 1000; u++; }
  const digits = num < 10 ? 2 : (num < 100 ? 1 : 0);
  return sign + num.toFixed(digits) + units[u];
}

function formatDuration(ms) {
  if (ms <= 0) return "0s";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function rowOf(i) { return Math.floor(i / COLS); }
function colOf(i) { return i % COLS; }
function areAdjacent(a, b) {
  const ra = rowOf(a), ca = colOf(a), rb = rowOf(b), cb = colOf(b);
  return (ra === rb && Math.abs(ca - cb) === 1) || (ca === cb && Math.abs(ra - rb) === 1);
}

// ---- Player profile (drawer header identity) ----
const PROFILE_EMOJI_CHOICES = ["👨‍🚀", "👩‍🚀", "🧑‍🚀", "👧", "👦", "🧑", "✨", "🪐", "🌙", "⭐", "☄️", "🌌", "🔥", "⚡", "🌍", "💫", "🕳️", "👑", "🦄", "🎯", "💎", "🚀"];
const PROFILE_COLOR_CHOICES = ["#f7b733", "#8b5cf6", "#22d3ee", "#f472b6", "#34d399", "#f87171", "#60a5fa", "#fbbf24"];

// ---- God power level (per-god upgrade paid in Gems, scales that god's own effect) ----
const GOD_POWER_MAX_LEVEL = 10;
function godPowerCost(nextLevel) { return Math.ceil(15 * Math.pow(1.35, nextLevel - 1)); }
// How much stronger a god's effect gets per power level - applied as a
// multiplier on the *deviation from neutral* so it works for both >1 and <1
// base multipliers (see gods.js scaleGodEffects).
const GOD_POWER_SCALING_PER_LEVEL = 0.15;
