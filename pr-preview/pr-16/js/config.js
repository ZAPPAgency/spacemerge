// Spacemerge - configuration & pure formulas (no state, no DOM)
"use strict";

const COLS = 6, ROWS = 5, TOTAL = COLS * ROWS;
const SAVE_KEY = "cosmerge_save_v2";
const SAVE_VERSION = 2;
const AUTOSAVE_MS = 5000;
const BASE_AUTO_SPAWN_MS = 8000;
const MIN_AUTO_SPAWN_MS = 3000;
// Per-cell cooldown between tap-bonus taps (grantTapBonus, input.js). Short so taps chain.
const TAP_COOLDOWN_MS = 150;
const DRAG_THRESHOLD = 10;
const BASE_OFFLINE_CAP_H = 8;
const MAX_OFFLINE_CAP_H = 24;
// Frequent on purpose: helps with unlock costs that grow fast late in a run.
const UNLOCK_CELL_AD_COOLDOWN_MS = 2 * 60 * 60 * 1000;
// Rewarded ad offered when swapping without enough Gems. Without a cooldown,
// staying at 0 Gems would make swaps free forever.
const SWAP_AD_COOLDOWN_MS = UNLOCK_CELL_AD_COOLDOWN_MS;
// "+20 Gems": first claim of the day is free, then GEMS_AD_STREAK_SIZE ads in a row,
// then a GEMS_AD_COOLDOWN_MS pause. See grantGemsFree()/grantGemsFromAd() (economy.js).
const GEMS_AD_REWARD = 20;
const GEMS_AD_STREAK_SIZE = 5;
const GEMS_AD_COOLDOWN_MS = 5 * 60 * 1000;
const VIP_DAILY_GEMS = 100;
// Auto-clicker: one free activation per day, then an ad. Taps the chosen cell
// (tickAutoClicker, input.js) for this long.
const AUTO_CLICKER_DURATION_MS = 10 * 60 * 1000;
const INTERSTITIAL_MIN_GAP_MS = 3 * 60 * 1000;
const INTERSTITIAL_QUIET_START_MS = 60 * 1000;
const MOON_MERGES_TO_CHOOSE_GOD = 4;
// Flat (not scaled like invokeCost) - a cheap, predictable Gems shortcut to
// summon a Meteorite instantly. Doesn't touch manualSpawnCount, so using it
// never makes the Stardust-priced Invoke button more expensive.
const GEMS_INVOKE_COST = 5;

const TIERS = [
  // `icon` (optional): artwork file in assets/tiles/, used instead of the emoji (tierIconNode, ui.js).
  // `iconScale` (optional): enlarges art that looks small (non-square source or thin subject).
  // Tile colors are dark enough for pale artwork to stand out.
  // Images have no cache-buster: replace artwork with a new filename (e.g. -v2), never overwrite.
  { n: 1, name: "Météorite", emoji: "☄️", icon: "tier-1-meteorite.png", from: "#3a3550", to: "#0c0a18" },
  { n: 2, name: "Lune", emoji: "🌙", icon: "tier-2-lune.png", from: "#2d3561", to: "#080a1c" },
  { n: 3, name: "Planète naine", emoji: "🪨", icon: "tier-3-planete-naine.png", from: "#d3ac7a", to: "#7a5c3a" },
  { n: 4, name: "Planète", emoji: "🌍", icon: "tier-4-planete.png", from: "#63c4ff", to: "#1e5f8c" },
  { n: 5, name: "Géante gazeuse", emoji: "🪐", icon: "tier-5-geante-gazeuse.png", from: "#f6d365", to: "#b8722e" },
  { n: 6, name: "Étoile", emoji: "⭐", icon: "tier-6-etoile.png", from: "#4a3a12", to: "#1a1406" },
  { n: 7, name: "Étoile à neutrons", emoji: "💫", icon: "tier-7-etoile-neutrons.png", from: "#0e3d45", to: "#020a0c", iconScale: 1.3 },
  { n: 8, name: "Trou noir", emoji: "🕳️", icon: "tier-8-trou-noir.png", from: "#6a2bb8", to: "#000000", iconScale: 1.15 },
  { n: 9, name: "Galaxie", emoji: "🌌", icon: "tier-9-galaxie-v2.png", from: "#ff7ce8", to: "#4a00e0" },
  { n: 10, name: "Univers", emoji: "✨", icon: "tier-10-univers.png", from: "#1e1a32", to: "#05040a" },
  // Tiers 11-14 extend a run past Univers.
  { n: 11, name: "Multivers", emoji: "🌀", icon: "tier-11-multivers.png", from: "#2e1065", to: "#0a0118" },
  { n: 12, name: "Singularité", emoji: "⚛️", icon: "tier-12-singularite.png", from: "#4c0519", to: "#0a0005", iconScale: 1.15 },
  { n: 13, name: "Infini", emoji: "♾️", icon: "tier-13-infini.png", from: "#052e2b", to: "#000a08" },
  { n: 14, name: "Genèse", emoji: "🌟", icon: "tier-14-genese.png", from: "#1a1a2e", to: "#000000" },
];
// Fixed reference for "reached Univers": Big Bang eligibility (hasUniverseTile),
// the Morgorath challenge and the Progression roadmap. Tiers above it still count.
const UNIVERSE_TIER = 10;

const INITIAL_UNLOCKED = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17];

const EMOJI_SETS = [
  { id: "classic", name: "Cases classiques", cost: 0, currency: "gems" },
  // Tier 1 used to be Cerise/Petit Pois - both unrecognizable at tile size
  // (tiny red blob / tiny green blob), swapped for something unmistakable.
  // `icon`, `iconScale`: same fields as TIERS, per tierSkin entry.
  { id: "fruits", name: "Fruits du Cosmos", cost: 300, currency: "gems",
    tierSkin: [
      { emoji: "🍓", name: "Fraise", icon: "fruit-1-fraise.png" },
      { emoji: "🍒", name: "Cerise", icon: "fruit-2-cerise.png" },
      { emoji: "🍇", name: "Raisin", icon: "fruit-3-raisin.png" },
      { emoji: "🍊", name: "Orange", icon: "fruit-4-orange.png" },
      { emoji: "🍎", name: "Pomme", icon: "fruit-5-pomme.png" },
      { emoji: "🍍", name: "Ananas", icon: "fruit-6-ananas.png" },
      { emoji: "🍉", name: "Pastèque", icon: "fruit-7-pasteque.png" },
      { emoji: "🥥", name: "Noix de Coco", icon: "fruit-8-coco.png" },
      { emoji: "🍈", name: "Melon Géant", icon: "fruit-9-melon.png" },
      { emoji: "🍯", name: "Nectar Cosmique", icon: "fruit-10-nectar.png" },
      { emoji: "🥭", name: "Mangue Cosmique", icon: "fruit-11-mangue.png" },
      { emoji: "🍑", name: "Pêche Stellaire", icon: "fruit-12-peche.png", iconScale: 1.15 },
      { emoji: "🫐", name: "Myrtille Infinie", icon: "fruit-13-myrtille.png" },
      { emoji: "🥝", name: "Kiwi Primordial", icon: "fruit-14-kiwi.png" },
    ] },
  { id: "legumes", name: "Légumes de l'Espace", cost: 300, currency: "gems",
    tierSkin: [
      { emoji: "🥕", name: "Carotte", icon: "legume-1-carotte.png", iconScale: 1.3 },
      { emoji: "🍅", name: "Tomate", icon: "legume-2-tomate.png" },
      { emoji: "🌽", name: "Maïs", icon: "legume-3-mais.png" },
      { emoji: "🫑", name: "Poivron", icon: "legume-4-poivron.png" },
      { emoji: "🍆", name: "Aubergine", icon: "legume-5-aubergine.png" },
      { emoji: "🥦", name: "Brocoli", icon: "legume-6-brocoli.png" },
      { emoji: "🧅", name: "Oignon", icon: "legume-7-oignon-v2.png" },
      { emoji: "🫛", name: "Petit Pois", icon: "legume-8-pois.png" },
      { emoji: "🎃", name: "Citrouille Géante", icon: "legume-9-citrouille.png" },
      { emoji: "🌻", name: "Fleur Cosmique", icon: "legume-10-fleur.png" },
      { emoji: "🥒", name: "Concombre Cosmique", icon: "legume-11-concombre.png" },
      { emoji: "🧄", name: "Ail Stellaire", icon: "legume-12-ail.png", iconScale: 1.15 },
      { emoji: "🫘", name: "Haricots Infinis", icon: "legume-13-haricots.png" },
      { emoji: "🥔", name: "Patate Primordiale", icon: "legume-14-patate.png" },
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

// ---- Run upgrades: bought with Stardust, reset at every Big Bang ----
// Unlike SKILL_TREE (Cosmic Energy, permanent), levels live in state.runUpgrades.
// Where each branch applies:
// - catalyst: productionMultiplier() (state.js)
// - resonance: maybeTriggerResonance() (economy.js), after each single-cell unlock
// - surge: previewBigBangGain() (economy.js)
// - cadence: autoSpawnIntervalMs() (state.js)
// Cost of level n: `first` for n = 1 (cheap entry), then base * growth^(n-1).
const RUN_UPGRADE_TREE = {
  catalyst: { name: "Catalyseur Stellaire", desc: "+4% production de Stardust de chaque case / niveau", maxLevel: 15, base: 3000, growth: 1.5, first: 300 },
  resonance: { name: "Résonance des Cases", desc: "+3% de chance de débloquer une case supplémentaire gratuite à chaque déblocage / niveau", maxLevel: 10, base: 5000, growth: 1.5, first: 500 },
  surge: { name: "Surcharge du Big Bang", desc: "+5% d'Énergie Cosmique gagnée au prochain Big Bang / niveau", maxLevel: 10, base: 8000, growth: 1.55, first: 800 },
  cadence: { name: "Cadence Stellaire", desc: "-4% cooldown de spawn auto / niveau (plancher 3s, cumulable avec Gravité Rapide)", maxLevel: 8, base: 6000, growth: 1.55, first: 600 },
};
function runUpgradeCost(branchKey, nextLevel) {
  const b = RUN_UPGRADE_TREE[branchKey];
  if (nextLevel === 1) return b.first;
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
  // Ananké only. Not in BOX_RARITY_WEIGHTS, so the Cosmic Box can never roll it.
  mythique: { label: "Mythique", color: "#f472e0" },
};

// `icon`: portrait in assets/gods/, rendered by godPortraitHtml() (ui.js).
const GODS = [
  {
    id: "selena", name: "Séléna", title: "Déesse des Lunes", emoji: "🌙", icon: "selena.png",
    rarity: "commun", alignment: "bienveillant",
    desc: "+15% production des Lunes et Planètes naines",
    effects: { tierProdBonus: { minTier: 2, maxTier: 3, mult: 1.15 } }, // used in state.js effectiveTileProd/totalProduction
    unlock: { type: "ritual" }, // granted automatically by the moon-merge ritual, see gods.js
    lore: "La première à avoir répondu à l'appel du rituel des lunes. Elle veille sur chaque fragment qui tourne encore dans le noir et guide la main du fusionneur novice. Elle n'a jamais cru que la Rupture fût un simple accident, et murmure qu'une présence bien plus ancienne qu'elle regardait, ce jour-là, sans rien faire pour l'empêcher.",
  },
  // Ritual counterpart of Séléna (same tiers 2-3), so the moon ritual offers a
  // benevolent and a fallen god side by side.
  {
    id: "zephar", name: "Zéphar", title: "Seigneur des Lunes Brisées", emoji: "🌘", icon: "zephar.png",
    rarity: "commun", alignment: "dechu",
    desc: "+15% chance de Gem bonus par fusion, mais -8% production des Lunes et Planètes naines",
    effects: { gemChanceBonus: 0.15, tierProdBonus: { minTier: 2, maxTier: 3, mult: 0.92 } },
    unlock: { type: "ritual" }, // granted by the moon-merge ritual with Séléna, see gods.js
    lore: "Zéphar n'a jamais pardonné à la Lune d'avoir survécu presque intacte quand tout le reste s'est brisé. Séléna continue d'y veiller comme avant. Lui y voit surtout ce qui reste à prendre. Il rôde parmi les fragments et offre, à qui l'écoute, la richesse cachée dans chaque éclat, contre un peu de la lumière qu'ils portaient encore.",
  },
  {
    id: "astreos", name: "Astréos", title: "Gardien des Astéroïdes", emoji: "☄️", icon: "astreos.png",
    rarity: "commun", alignment: "bienveillant",
    desc: "Spawn automatique 10% plus rapide",
    effects: { spawnSpeedMult: 0.9 }, // used in state.js autoSpawnIntervalMs
    unlock: { type: "milestone", check: (s) => s.lifetime.fusions >= 180, label: "Réalise 180 fusions à vie" },
    lore: "Il fut le premier corps à se briser lors de la Rupture, avant même que les treize n'aient eu le temps de réagir. Depuis, il pousse inlassablement la poussière vers la lumière, dans le vide que Nyx maintient grand ouvert, pour que jamais une case ne reste vide trop longtemps.",
  },
  {
    id: "nyx", name: "Nyx", title: "Dame du Vide", emoji: "🌌", icon: "nyx.png",
    rarity: "rare", alignment: "bienveillant",
    desc: "+1 case de départ supplémentaire",
    effects: { extraStartCells: 1 }, // used in state.js freshGrid
    unlock: { type: "milestone", check: (s) => s.achievements.unlockedIds.includes("unlocked_20"), label: "Débloque 20 cases en une partie" },
    lore: "Nyx n'a jamais choisi de camp, elle est l'espace lui-même, celui qui reste à conquérir. Elle prête volontiers un peu de vide à qui la sert, mais se tait dès qu'on lui demande ce qui habite les recoins qu'elle n'a jamais osé cartographier.",
  },
  {
    id: "helios", name: "Hélios", title: "Cœur Ardent", emoji: "☀️", icon: "helios.png",
    rarity: "rare", alignment: "bienveillant",
    desc: "+20% production des Étoiles et Étoiles à neutrons",
    effects: { tierProdBonus: { minTier: 6, maxTier: 7, mult: 1.2 } },
    unlock: { type: "milestone", check: (s) => s.lifetime.maxTierEver >= 7, label: "Atteins le palier Étoile à neutrons" },
    lore: "Quand la fusion atteint l'incandescence, Hélios se réveille. Il ne connaît qu'une loi : brûler plus fort, encore, jusqu'à ce que le froid du vide n'ait plus aucune prise, le même froid dont Erebus, dit-on, s'est fait un allié plutôt qu'un ennemi.",
  },
  {
    id: "chronos", name: "Chronos", title: "Maître du Temps", emoji: "⏳", icon: "chronos.png",
    rarity: "rare", alignment: "bienveillant",
    desc: "+4h de plafond de gains hors-ligne",
    effects: { offlineCapBonusH: 4 }, // used in state.js offlineCapHours
    unlock: { type: "milestone", check: (s) => s.lifetime.bigBangCount >= 3, label: "Déclenche 3 Big Bang" },
    lore: "Chronos a vu trois univers se replier sur eux-mêmes et renaître, assez pour reconnaître la main de Thanatos dans chaque fin prématurée. Il ne juge plus le temps qui passe. Il apprend simplement à en garder un peu plus de côté pour toi. Une seule chose le trouble encore : dans aucun de ses souvenirs, il n'a jamais vu le tout premier instant de la toute première Rupture.",
  },
  {
    id: "erebus", name: "Erebus", title: "Seigneur du Chaos", emoji: "🌑", icon: "erebus.png",
    rarity: "epique", alignment: "dechu",
    desc: "+25% Gems gagnées, mais -10% production globale",
    effects: { gemsMult: 1.25, prodMult: 0.9 },
    unlock: {
      type: "challenge", challengeId: "erebus",
      label: "Défi : fusionne 35 fois d'affilée sans jamais appuyer sur une case pour récupérer son bonus (appuyer remet ce compteur à zéro)",
      target: 35,
    },
    lore: "Erebus fut banni pour avoir préféré un désordre plein de promesses à un ordre qui n'avançait plus. Le servir coûte un peu de matière produite, mais il paie grassement en poussière précieuse ceux qui acceptent de le suivre.",
  },
  {
    id: "thanatos", name: "Thanatos", title: "l'Inévitable", emoji: "💀", icon: "thanatos.png",
    rarity: "epique", alignment: "dechu",
    desc: "Le prochain Big Bang garantit au moins 5 ⚡ Énergie Cosmique",
    effects: { bigBangMinEnergy: 5 }, // used in economy.js performBigBang
    unlock: {
      type: "challenge", challengeId: "thanatos",
      label: "Défi : déclenche un Big Bang alors que moins de la moitié des cases débloquées sont occupées",
      target: 1,
    },
    lore: "Thanatos n'attend jamais que tout soit fini pour mettre un terme aux choses. Là où Erebus cherche à prolonger le désordre, lui préfère l'arrêter net. Il enseigne qu'un cycle interrompu à temps vaut parfois mieux qu'un cycle mené jusqu'à l'épuisement.",
  },
  {
    id: "gaia", name: "Gaïa Suprême", title: "Créatrice", emoji: "🌍", icon: "gaia.png",
    rarity: "legendaire", alignment: "bienveillant",
    desc: "+10% à toute la production, +5% chance de Gem bonus par fusion",
    effects: { prodMult: 1.1, gemChanceBonus: 0.05 },
    unlock: { type: "shop", cost: 800, altCheck: (s) => s.lifetime.bigBangCount >= 10, altLabel: "ou 10 Big Bang déclenchés" },
    lore: "Avant la Rupture, Gaïa était le Cosmos tout entier, la même unité que Morgorath essaie aujourd'hui de reconstituer à l'envers, en avalant plutôt qu'en créant. Ce qu'elle t'offre n'est qu'un souvenir de cette unité perdue, mais même un souvenir de la Création reste un cadeau immense.",
  },
  {
    id: "morgorath", name: "Morgorath", title: "Dévoreur d'Étoiles", emoji: "🕳️", icon: "morgorath.png",
    rarity: "legendaire", alignment: "dechu",
    desc: "+40% production des Trous noirs, Galaxies et Univers",
    effects: { tierProdBonus: { minTier: 8, maxTier: 10, mult: 1.4 } },
    unlock: {
      type: "shop", cost: 800,
      altCheck: (s) => s.gods.morgorathChallengeCleared, altLabel: "ou atteins l'Univers sans utiliser Sauter une case ni Échanger deux cases dans la partie",
    },
    lore: "Morgorath ne crée rien, il concentre. Chaque étoile qu'il engloutit devient un peu plus dense, un peu plus lourde, jusqu'à ce que la lumière elle-même n'ose plus s'en échapper.",
  },

  // ---- Box-exclusive gods: unlock.type "box" means no story/milestone/shop
  // path exists at all - rollCosmicBox() (gods.js) is the only way in. Kept
  // deliberately non-commun, per design intent: the Cosmic Box should feel
  // worth opening even for a player who's already awakened every story god.
  {
    id: "iris", name: "Iris", title: "Messagère des Fragments", emoji: "🌈", icon: "iris.png",
    rarity: "rare", alignment: "bienveillant",
    desc: "+18% production des Planètes et Géantes gazeuses",
    effects: { tierProdBonus: { minTier: 4, maxTier: 5, mult: 1.18 } },
    unlock: { type: "box" },
    lore: "Iris ne s'éveille jamais d'elle-même. Elle apparaît, ou elle n'apparaît pas, au hasard d'une Boîte Cosmique ouverte. Elle porte les messages qu'aucun autre Dieu endormi ne peut plus entendre, y compris, murmure-t-on, un message qu'elle refuse de délivrer en entier : celui d'une voix plus vieille que les treize, qu'elle n'a croisée qu'une fois et qu'elle espère ne jamais recroiser.",
  },
  {
    id: "eris", name: "Éris", title: "Semeuse de Discorde", emoji: "🔮", icon: "eris.png",
    rarity: "epique", alignment: "dechu",
    desc: "+8% chance de Gem bonus par fusion, mais -7% production globale",
    effects: { gemChanceBonus: 0.08, prodMult: 0.93 },
    unlock: { type: "box" },
    lore: "Éris trouve la Rupture magnifique, un chaos si parfait qu'elle refuse d'y voir un accident, là où Némésis n'y voit qu'une faute à punir. Ceux qui l'invoquent gagnent en fortune ce qu'ils perdent en constance.",
  },
  {
    id: "nemesis", name: "Némésis", title: "la Justicière Cosmique", emoji: "⚖️", icon: "nemesis.png",
    rarity: "legendaire", alignment: "dechu",
    desc: "+12% production globale et +12% Gems gagnées",
    effects: { prodMult: 1.12, gemsMult: 1.12 },
    unlock: { type: "box" },
    lore: "Némésis ne pardonne à aucun Dieu d'avoir laissé le Cosmos se briser, bienveillant ou déchu, tous lui doivent des comptes, même Éris et son goût pour le désordre. Un seul être, dit-on, échappe à son jugement : une présence plus ancienne que la Rupture elle-même, que même Némésis n'ose pas accuser.",
  },
  // Secret 14th god, reward of the 4 easter eggs.
  // `secret: true` excludes her from "X/13" counts (NORMAL_GODS_COUNT) and the Cosmic Box.
  // Her "secret" unlock type keeps her out of milestone hints.
  {
    id: "ananke", name: "Ananké", title: "L'Origine Silencieuse", emoji: "🌀", icon: "ananke.png", secret: true,
    rarity: "mythique", alignment: "bienveillant",
    desc: "+20% production globale, +2h de plafond hors-ligne et +5% chance de Gem bonus par fusion",
    effects: { prodMult: 1.2, offlineCapBonusH: 2, gemChanceBonus: 0.05 },
    unlock: { type: "secret", label: "Un secret bien gardé du Cosmos" },
    lore: "Avant les treize, avant la Rupture elle-même, il y avait Ananké. Elle n'a rien causé. Elle a simplement toujours su que ça arriverait. Ceux qui la trouvent ne la choisissent pas : elle les attendait déjà.",
  },
];
// Gods counted in "X/13" displays: secret gods are excluded.
const NORMAL_GODS_COUNT = GODS.filter(g => !g.secret).length;

// ---- Secret challenge: 4 easter eggs, hidden until the first is found ----
// `hint` is shown while locked (a riddle), `revealText` once found. Detection:
// - restart_at_top: onRestartConfirm (input.js), restart while Big Bang is available
// - pure_extremes: performBigBang (economy.js), every cell is tier 1 or UNIVERSE_TIER
// - merge_chain: attemptMerge (input.js), EASTER_EGG_CHAIN_COUNT merges within EASTER_EGG_CHAIN_MS
// - second_loop: performMerge (economy.js), a tile reaches cycle 1
const EASTER_EGGS = [
  { id: "restart_at_top", name: "Le Renoncement",
    hint: "Un choix que peu osent faire, à l'instant où tout semblait acquis.",
    revealText: "Tu as tout recommencé alors que l'infini t'attendait déjà. Certains préfèrent choisir leur propre chemin." },
  { id: "pure_extremes", name: "Les Extrêmes",
    hint: "Rien qu'entre le premier souffle et le dernier.",
    revealText: "Un Big Bang né d'une grille faite uniquement de commencements et d'un seul aboutissement." },
  { id: "merge_chain", name: "La Cascade",
    hint: "Une main plus rapide que la pensée.",
    revealText: "Dix fusions en une poignée de secondes. Le Cosmos a du mal à suivre." },
  { id: "second_loop", name: "Le Second Souffle",
    hint: "Ce qui semblait fini a recommencé, une fois de plus.",
    revealText: "Une deuxième boucle s'est refermée sur elle-même. Le cycle n'a pas de fin." },
];
const EASTER_EGG_CHAIN_COUNT = 10;
const EASTER_EGG_CHAIN_MS = 8000;

// ---- Lore fragments: progressive story reveal in the Histoire panel ----
// The base story (renderStoryPanel) only tells you THAT the Rupture
// happened, deliberately not why - these fragments are the "why", unlocked
// by real progress so there's always a next piece of the mystery to chase.
const LORE_FRAGMENTS = [
  {
    id: "frag_doubt", title: "Le Premier Doute",
    unlock: (s) => !!s.gods.currentGodId,
    text: "Séléna te le dira, si tu l'écoutes vraiment : elle n'a jamais cru à l'accident. \"Un ordre parfait ne se brise pas tout seul\", murmure-t-elle. Alors quoi, ou qui ?",
  },
  {
    id: "frag_voices", title: "Les Deux Voix",
    unlock: (s) => s.gods.unlockedIds.length >= 3,
    text: "Chaque Dieu se souvient de la Rupture différemment, et c'est cette différence qui sépare aujourd'hui bienveillants et déchus. Les uns l'ont vécue comme un vol. Les autres, comme une porte enfin ouverte.",
  },
  {
    id: "frag_echo", title: "L'Écho du Big Bang",
    unlock: (s) => s.lifetime.bigBangCount >= 1,
    text: "Ce que tu viens de déclencher a un nom ancien. Chaque Big Bang que tu provoques est un écho miniature de LA Rupture originelle : en plus petit, en plus doux, mais un écho tout de même. Toi aussi, tu recommences le monde.",
  },
  {
    id: "frag_name", title: "Le Nom Interdit",
    unlock: (s) => s.gods.unlockedIds.length >= 6,
    // Hints at the secret god without naming it.
    text: "Un nom ne figure sur aucune liste, ne se prononce dans aucun temple : celui du quatorzième. Certains Dieux jurent qu'il n'existe pas. D'autres refusent simplement d'en parler. Némésis, elle, se contente de dire qu'un seul être échappe à son jugement, et qu'elle préfère ne pas savoir pourquoi.",
  },
  {
    id: "frag_truth", title: "La Vérité",
    unlock: (s) => s.achievements.unlockedIds.length >= ACHIEVEMENTS.length,
    // Keeps the cause of the Rupture a mystery, even at 100%.
    text: "Tu as tout accompli. Et pourtant la question reste entière : personne, pas même les treize, ne sait vraiment pourquoi le Cosmos s'est brisé ce jour-là. Une seule ombre a peut-être vu ce qui s'est réellement passé. Elle n'a jamais rien confirmé. Elle n'a jamais rien nié non plus.",
  },
];

// ---- Daily login cycle (7 days) ----
const DAILY_REWARDS = [
  { day: 1, type: "stardust", amount: 100, label: "100 ✨" },
  { day: 2, type: "gems", amount: 20, label: "20 💎" },
  { day: 3, type: "unlockCell", amount: 1, label: "1 case débloquée" },
  { day: 4, type: "stardust", amount: 300, label: "300 ✨" },
  { day: 5, type: "gems", amount: 40, label: "40 💎" },
  { day: 6, type: "streakFreeze", amount: 1, label: "❄️ Gel de série" },
  { day: 7, type: "bigReward", amount: 1, label: "1 ⚡ Énergie Cosmique + gros lot ✨" },
];

// ---- Daily quest pool (templates); 3 drawn per day + 1 bonus "watch ad" ----
// Quest rewards stay small so rewarded ads remain the main free Gems source.
const QUEST_POOL = [
  { id: "fuse15", desc: "Fusionne 15 fois", type: "fusions", target: 15, reward: 7 },
  { id: "fuse30", desc: "Fusionne 30 fois", type: "fusions", target: 30, reward: 11 },
  { id: "reachStar", desc: "Atteins le palier Étoile", type: "reachTier", target: 6, reward: 11 },
  { id: "reachPlanet", desc: "Atteins le palier Planète", type: "reachTier", target: 4, reward: 6 },
  { id: "reachBlackHole", desc: "Atteins le palier Trou noir", type: "reachTier", target: 8, reward: 14 },
  { id: "earn5000", desc: "Gagne 5000 Stardust", type: "earnStardust", target: 5000, reward: 7 },
  { id: "earn20000", desc: "Gagne 20000 Stardust", type: "earnStardust", target: 20000, reward: 13 },
  { id: "unlock1", desc: "Débloque 1 case", type: "unlockCells", target: 1, reward: 6 },
  { id: "unlock3", desc: "Débloque 3 cases", type: "unlockCells", target: 3, reward: 11 },
  { id: "spend500", desc: "Dépense 500 Stardust", type: "spendStardust", target: 500, reward: 6 },
  { id: "invoke5", desc: "Invoque 5 Météorites", type: "invokes", target: 5, reward: 7 },
  { id: "tapBonus10", desc: "Récupère 10 bonus manuels", type: "tapBonuses", target: 10, reward: 6 },
  { id: "spawnAuto5", desc: "Laisse apparaître 5 Météorites automatiques", type: "autoSpawns", target: 5, reward: 4 },
  { id: "fuse5tier5", desc: "Fusionne jusqu'à Géante gazeuse", type: "reachTier", target: 5, reward: 8 },
  { id: "fuse50", desc: "Fusionne 50 fois", type: "fusions", target: 50, reward: 15 },
  { id: "fuse8", desc: "Fusionne 8 fois", type: "fusions", target: 8, reward: 4 },
  { id: "reachGalaxy", desc: "Atteins le palier Galaxie", type: "reachTier", target: 9, reward: 18 },
  { id: "reachNeutronStar", desc: "Atteins le palier Étoile à neutrons", type: "reachTier", target: 7, reward: 12 },
  { id: "earn100000", desc: "Gagne 100 000 Stardust", type: "earnStardust", target: 100000, reward: 18 },
  { id: "earn1500", desc: "Gagne 1500 Stardust", type: "earnStardust", target: 1500, reward: 4 },
  { id: "unlock5", desc: "Débloque 5 cases", type: "unlockCells", target: 5, reward: 14 },
  { id: "spend2000", desc: "Dépense 2000 Stardust", type: "spendStardust", target: 2000, reward: 11 },
  { id: "invoke10", desc: "Invoque 10 Météorites", type: "invokes", target: 10, reward: 11 },
  { id: "invoke3", desc: "Invoque 3 Météorites", type: "invokes", target: 3, reward: 4 },
  { id: "tapBonus20", desc: "Récupère 20 bonus manuels", type: "tapBonuses", target: 20, reward: 10 },
  { id: "tapBonus5", desc: "Récupère 5 bonus manuels", type: "tapBonuses", target: 5, reward: 4 },
  { id: "spawnAuto10", desc: "Laisse apparaître 10 Météorites automatiques", type: "autoSpawns", target: 10, reward: 7 },
];
const BONUS_AD_QUEST = { id: "watchAd", desc: "Regarde une publicité", reward: 25 };

// ---- Achievements (permanent, never reset) ----
const ACHIEVEMENTS = [
  { id: "fuse_10", cat: "fusions", target: 10, name: "Premières fusions", reward: 5 },
  { id: "fuse_100", cat: "fusions", target: 100, name: "Artisan cosmique", reward: 12 },
  { id: "fuse_500", cat: "fusions", target: 500, name: "Maître fusionneur", reward: 30 },
  { id: "fuse_2000", cat: "fusions", target: 2000, name: "Légende de la fusion", reward: 75 },
  { id: "tier_4", cat: "maxTier", target: 4, name: "Formation planétaire", reward: 5 },
  { id: "tier_6", cat: "maxTier", target: 6, name: "Naissance d'une étoile", reward: 10 },
  { id: "tier_8", cat: "maxTier", target: 8, name: "Horizon des événements", reward: 20 },
  { id: "tier_9", cat: "maxTier", target: 9, name: "Voie lactée", reward: 35 },
  { id: "tier_10", cat: "maxTier", target: 10, name: "Créateur d'univers", reward: 60 },
  { id: "tier_11", cat: "maxTier", target: 11, name: "Au-delà de l'Univers", reward: 80 },
  { id: "tier_12", cat: "maxTier", target: 12, name: "Point de singularité", reward: 110 },
  { id: "tier_13", cat: "maxTier", target: 13, name: "Sans limites", reward: 150 },
  { id: "tier_14", cat: "maxTier", target: 14, name: "Créateur de tout", reward: 200 },
  { id: "bigbang_1", cat: "bigBangs", target: 1, name: "Premier Big Bang", reward: 15 },
  { id: "bigbang_5", cat: "bigBangs", target: 5, name: "Cycle cosmique", reward: 40 },
  { id: "bigbang_20", cat: "bigBangs", target: 20, name: "Éternel recommencement", reward: 100 },
  { id: "lifetime_10k", cat: "lifetimeStardust", target: 10000, name: "Petit collectionneur", reward: 5 },
  { id: "lifetime_100k", cat: "lifetimeStardust", target: 100000, name: "Riche en poussière d'étoiles", reward: 15 },
  { id: "lifetime_1m", cat: "lifetimeStardust", target: 1000000, name: "Millionnaire stellaire", reward: 35 },
  { id: "lifetime_100m", cat: "lifetimeStardust", target: 100000000, name: "Magnat de la galaxie", reward: 90 },
  { id: "streak_3", cat: "streak", target: 3, name: "Habitué·e", reward: 5 },
  { id: "streak_7", cat: "streak", target: 7, name: "Semaine complète", reward: 12 },
  { id: "streak_30", cat: "streak", target: 30, name: "Fidèle des étoiles", reward: 50 },
  { id: "quests_10", cat: "questsCompleted", target: 10, name: "Chasseur de quêtes", reward: 8 },
  { id: "quests_100", cat: "questsCompleted", target: 100, name: "Expert en missions", reward: 30 },
  { id: "unlocked_20", cat: "cellsUnlocked", target: 20, name: "Grande expansion", reward: 12 },
  { id: "unlocked_all", cat: "cellsUnlocked", target: 30, name: "Grille complète", reward: 25 },
  { id: "gems_1000", cat: "lifetimeGems", target: 1000, name: "Trésor de Gems", reward: 10 },
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
  { id: "cosmicBox", name: "Boîte Cosmique", desc: "Un Dieu que tu ne possèdes pas encore - Commun 50% · Rare 30% · Épique 15% · Légendaire 5% (jusqu'à 200 Gems une fois tous les Dieux obtenus)", cost: 120 },
];

// Cosmic Box odds: Commun is the most likely roll, Légendaire the rarest.
// rollCosmicBox (gods.js) never gives a duplicate: it re-rolls the rarity.
const BOX_RARITY_WEIGHTS = { commun: 50, rare: 30, epique: 15, legendaire: 5 };

// ---- IAP catalog (simulated at this stage) ----
const IAP_CATALOG = [
  { id: "remove_ads", type: "nonconsumable", name: "Suppression des pubs", price: "4,99 $", desc: "Retire toutes les publicités définitivement, et débloque instantanément tous les bonus normalement obtenus en pub (boost, quête bonus)." },
  // `perks`: one line per benefit, rendered as a list in the shop hero card.
  // The Gems value badge is computed at render time (passGemsValueBadgeText, ui.js).
  { id: "vip_monthly", type: "subscription", name: "Pass Supernova", price: "5,99 $/mois",
    desc: "L'expérience Spacemerge, sans limites.",
    perks: [
      "Aucune publicité tant que le Pass est actif",
      "Production de Stardust doublée",
      "Tous les sets d'icônes débloqués",
      "48h de gains hors-ligne couverts (au lieu de 24h)",
      "100 Gems offertes chaque jour",
    ] },
  { id: "stardust_boost", type: "nonconsumable", name: "Multiplicateur Stardust", price: "2,99 $", desc: "+50% de production de Stardust, en permanence, cumulable avec tous les autres bonus." },
  { id: "starter_pack", type: "nonconsumable", name: "Pack de démarrage", price: "1,99 $", desc: "500 Gems + 3 cases + boost 1h.", startersOnly: true },
  { id: "gems_small", type: "consumable", name: "100 Gems", price: "0,99 $", amount: 100 },
  { id: "gems_medium", type: "consumable", name: "550 Gems (+10%)", price: "4,99 $", amount: 550 },
  { id: "gems_large", type: "consumable", name: "1200 Gems (+20%)", price: "9,99 $", amount: 1200 },
  { id: "gems_mega", type: "consumable", name: "3000 Gems (+35%)", price: "19,99 $", amount: 3000 },
];

// ---- Formulas ----
function tierProd(tier) { return 0.5 * Math.pow(2, tier - 1); }
// Growth 1.8: the tap clicker adds income, so late unlocks must stay expensive
// (the 20th unlock costs ~3.8M Stardust) while the first ones stay cheap.
function unlockCost(n) { return Math.round(50 * Math.pow(1.8, n)); }
// Growth 1.12 up to INVOKE_COST_SOFTCAP_K, then 1.06, continuous at the seam,
// so late invokes keep getting pricier without running away.
const INVOKE_COST_SOFTCAP_K = 15;
function invokeCost(k) {
  const capped = Math.min(k, INVOKE_COST_SOFTCAP_K);
  const beyond = Math.max(0, k - INVOKE_COST_SOFTCAP_K);
  return Math.round(15 * Math.pow(1.12, capped) * Math.pow(1.06, beyond));
}

// Cosmic Energy bonus per tile at or above UNIVERSE_TIER on the grid, summed.
// Weight x1.4 per tier up to Genèse (14), then + BIG_BANG_LOOP_TIER_BONUS per extra tier:
// compounding over infinite loops would explode (and reach Infinity).
const BIG_BANG_LOOP_TIER_BONUS = 25;
function bigBangTileWeight(tier) {
  const escalating = Math.min(tier, TIERS.length);
  const looped = Math.max(0, tier - TIERS.length);
  return Math.round(13 * Math.pow(1.4, escalating - UNIVERSE_TIER)) + looped * BIG_BANG_LOOP_TIER_BONUS;
}
// Tile position on a single scale including loops: a cycle-1 tier-1 tile is above tier 14.
// Use it instead of `tile.tier` whenever comparing how high a tile has climbed.
function tileProgressTier(tile) {
  return tile.tier + (tile.cycle || 0) * TIERS.length;
}
function bigBangGain(stardustEarnedThisRun, grid) {
  const base = Math.floor(Math.sqrt(stardustEarnedThisRun / 500000));
  let tierBonus = 0;
  for (const t of grid) {
    if (!t) continue;
    const progress = tileProgressTier(t);
    if (progress >= UNIVERSE_TIER) tierBonus += bigBangTileWeight(progress);
  }
  return Math.max(1, base + tierBonus);
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

// Offline modal duration: one decimal under 10 s. formatDuration() rounds up to whole
// seconds, so short absences all read "1s" next to different Stardust amounts.
function formatOfflineDuration(ms) {
  if (ms < 10000) return (Math.max(ms, 0) / 1000).toFixed(1) + "s";
  return formatDuration(ms);
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
