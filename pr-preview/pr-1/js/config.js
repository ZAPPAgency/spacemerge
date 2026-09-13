// Godspark - configuration & pure formulas (no state, no DOM)
"use strict";

const COLS = 6, ROWS = 5, TOTAL = COLS * ROWS;
const SAVE_KEY = "cosmerge_save_v2";
const SAVE_VERSION = 2;
const AUTOSAVE_MS = 5000;
const BASE_AUTO_SPAWN_MS = 8000;
const MIN_AUTO_SPAWN_MS = 3000;
// Per-cell cooldown between tap-bonus taps (grantTapBonus in input.js).
// Was 1000ms - way too slow to feel like a "clicker" when tapping the same
// tile repeatedly (which is exactly what the mechanic is for, see the
// spawnFloatingBonus "+N ✨" popup); short enough now to chain taps freely
// while still being a real cooldown, not literally unlimited.
const TAP_COOLDOWN_MS = 150;
const DRAG_THRESHOLD = 10;
const BASE_OFFLINE_CAP_H = 8;
const MAX_OFFLINE_CAP_H = 24;
// The specific relief valve for the "unlock costs feel like a wall"
// complaint - a free cell unlock is worth less late-run than early (
// unlockCost grows 1.5x per cell, so it can hit tens of thousands of
// Stardust), so it's kept frequently available rather than a rarer treat.
const UNLOCK_CELL_AD_COOLDOWN_MS = 2 * 60 * 60 * 1000;
// Loris: when Échanger (onSwapCellsClick, input.js) is clicked without
// enough Gems, offer a rewarded ad instead of a dead-end "Pas assez de
// Gems." - same cooldown as the free-cell-unlock ad above rather than a new
// number: swapCells costs 2x skipCell in the Gems shop (config.js
// SHOP_GEM_ITEMS), so it's the same tier of shortcut. Without a cooldown at
// all, keeping Gems at 0 would make this a free, repeatable way to bypass
// swapCells' cost entirely.
const SWAP_AD_COOLDOWN_MS = UNLOCK_CELL_AD_COOLDOWN_MS;
// Loris: "le bouton +20 gemmes une fois par jour il devrait être gratuit
// aussi (reset à minuit) et quand on veut le relancer [...] offre la
// possibilité [...] de regarder une publicité pour passer outre cette
// restriction." Puis précisé : le premier don du jour est gratuit (aucune
// pub), mais au-delà, garde le même principe que l'ancien système plutôt
// que de l'enlever - jusqu'à GEMS_AD_STREAK_SIZE pubs d'affilée, chacune
// donnant la récompense, puis GEMS_AD_COOLDOWN_MS de pause obligatoire
// avant de pouvoir relancer une nouvelle salve de pubs (le compteur de
// salve, comme le don gratuit, se réinitialise à minuit) - voir
// grantGemsFree()/grantGemsFromAd() (economy.js), state.gemsAdFree/
// gemsAdStreak (state.js).
const GEMS_AD_REWARD = 20;
const GEMS_AD_STREAK_SIZE = 5;
const GEMS_AD_COOLDOWN_MS = 5 * 60 * 1000;
const VIP_DAILY_GEMS = 100; // Loris: 50 -> 100/day for Pass Supernova
// Loris: "ajouter un bonus 'clicker automatique' [...] accessible
// gratuitement que une fois par jour (reset à minuit) et ça dure pendant 10
// minutes. Si on veut réactiver après les 10 minutes alors on doit regarder
// une publicité. Je pense que ce serait un meilleur bonus que le boost x2.
// Il devrait remplacer le boost x2." - same free-once-then-ad-gated pattern
// as GEMS_AD_REWARD above (state.autoClicker.freeUsedDay, state.js), and
// the same 10-minute duration the old Boost x2 used, but automatically
// triggering the tap-bonus (grantTapBonus, input.js) on a player-chosen
// cell instead of a flat production multiplier - see tickAutoClicker()
// (input.js, called every frame from main.js).
const AUTO_CLICKER_DURATION_MS = 10 * 60 * 1000;
const INTERSTITIAL_MIN_GAP_MS = 3 * 60 * 1000;
const INTERSTITIAL_QUIET_START_MS = 60 * 1000;
const MOON_MERGES_TO_CHOOSE_GOD = 4;
// Flat (not scaled like invokeCost) - a cheap, predictable Gems shortcut to
// summon a Meteorite instantly. Doesn't touch manualSpawnCount, so using it
// never makes the Stardust-priced Invoke button more expensive.
const GEMS_INVOKE_COST = 5;

const TIERS = [
  // `icon` (optional): custom AI-generated artwork (Midjourney, background
  // removed in Photoshop) replacing the plain emoji glyph - classic skin
  // only, see tierIconNode() in ui.js. Fruits/Légumes skins keep their own
  // emoji via tierSkin, unaffected. Background colors were re-picked to
  // suit that art rather than just the tier's mood - a pale/glowing
  // subject reads far better on a dark tile than a light one (Lune moved
  // from a pale grey tile to a dark indigo "night sky" for exactly this).
  { n: 1, name: "Météorite", emoji: "☄️", icon: "tier-1-meteorite.png", from: "#3a3550", to: "#0c0a18" },
  { n: 2, name: "Lune", emoji: "🌙", icon: "tier-2-lune.png", from: "#2d3561", to: "#080a1c" },
  { n: 3, name: "Planète naine", emoji: "🪨", icon: "tier-3-planete-naine.png", from: "#d3ac7a", to: "#7a5c3a" },
  { n: 4, name: "Planète", emoji: "🌍", icon: "tier-4-planete.png", from: "#63c4ff", to: "#1e5f8c" },
  { n: 5, name: "Géante gazeuse", emoji: "🪐", icon: "tier-5-geante-gazeuse.png", from: "#f6d365", to: "#b8722e" },
  // Darkened from the original bright #fff9c4/#ff9800 - same "pale/bright
  // subject needs a darker tile to really pop" pattern as Lune/Univers.
  { n: 6, name: "Étoile", emoji: "⭐", icon: "tier-6-etoile.png", from: "#4a3a12", to: "#1a1406" },
  // Darkened from #e0f7ff/#00b8d4 for the same reason, kept in a teal-black
  // (not purple/indigo like Météorite/Lune/Univers) to stay visually
  // distinct from the other dark tiers. `iconScale` (see tierIconNode() in
  // ui.js) bumps this one up - its thin light rays reach the edges of the
  // image already, but the glowing core they radiate from reads small.
  { n: 7, name: "Étoile à neutrons", emoji: "💫", icon: "tier-7-etoile-neutrons.png", from: "#0e3d45", to: "#020a0c", iconScale: 1.3 },
  // iconScale bump: the source art is a wide/flat 420x295 image, and
  // object-fit:contain sizes to the limiting dimension - a non-square image
  // ends up looking smaller than a square one at the same box size.
  { n: 8, name: "Trou noir", emoji: "🕳️", icon: "tier-8-trou-noir.png", from: "#6a2bb8", to: "#000000", iconScale: 1.15 },
  // v2 (Loris): original was a flat face-on spiral (read as a 2D pattern,
  // not a 3D object like the other tiers) with cyan/blue tones that clashed
  // against this tile's own pink-violet gradient. Redone as a spiral galaxy
  // sealed inside a glossy glass sphere, viewed at a 3/4 tilted angle for
  // real depth, filling most of the sphere's interior, in the same
  // magenta/violet family as `from`/`to` below - renamed (not overwritten)
  // per the usual stale-image-cache convention, image URLs have no
  // cache-busting query param unlike the JS/CSS files that reference them.
  { n: 9, name: "Galaxie", emoji: "🌌", icon: "tier-9-galaxie-v2.png", from: "#ff7ce8", to: "#4a00e0" },
  // Was #ffffff/#ffd54f (white/gold) - the artwork's own bright white core
  // washed out almost completely against a white tile background, same
  // "pale subject on pale tile" problem as Lune's original background.
  // Cool dark chosen over warm dark per Loris ("le froid sinon c'est
  // vraiment pas joli").
  { n: 10, name: "Univers", emoji: "✨", icon: "tier-10-univers.png", from: "#1e1a32", to: "#05040a" },
  // Tiers 11-14 (Loris: "pour allonger le temps de jeu [...] il faudrait
  // pouvoir continuer [au-delà] que 10" - players hitting Univers had
  // nowhere left to go but Big Bang, since performMerge/attemptMerge
  // (economy.js/input.js) both hard-block merging past the last TIERS
  // entry). `icon`: custom AI-generated 3D renders (Midjourney, background
  // removed) - first pass of prompts rendered badly for cutout (wispy
  // vortex/rays/fractal effects with no clean edge, Loris: "rendent très
  // mal en détourage"), redone as compact solid objects (faceted crystal,
  // ringed sphere, glossy torus, glowing egg) with an explicit "no glow
  // extending beyond the silhouette" instruction, same as tiers 1-10.
  // Colors keep getting darker/more saturated the same way tiers 6-10 did.
  { n: 11, name: "Multivers", emoji: "🌀", icon: "tier-11-multivers.png", from: "#2e1065", to: "#0a0118" },
  // iconScale bump: source art is a wide/flat ringed-sphere shape (200x133)
  // - same "wide source art reads smaller" correction as tier 8's own
  // ringed-ish silhouette (Loris: "le visuel de case standard 12 devrait
  // être un peu plus gros").
  { n: 12, name: "Singularité", emoji: "⚛️", icon: "tier-12-singularite.png", from: "#4c0519", to: "#0a0005", iconScale: 1.15 },
  { n: 13, name: "Infini", emoji: "♾️", icon: "tier-13-infini.png", from: "#052e2b", to: "#000a08" },
  { n: 14, name: "Genèse", emoji: "🌟", icon: "tier-14-genese.png", from: "#1a1a2e", to: "#000000" },
];
// Big Bang eligibility used to just be "reached the last TIERS entry"
// (t.tier === TIERS.length, economy.js hasUniverseTile) - broke the moment
// TIERS grew past Univers (tier 10), since merging two Univers tiles into a
// Multivers would remove every tier-10 tile from the grid and silently
// revoke Big Bang eligibility the player had already earned. Fixed
// reference point instead: reaching Univers OR anything higher keeps Big
// Bang available forever after, however far past it the run goes. Also
// used by gods.js (Morgorath challenge - "reach Univers" specifically, not
// whatever the new ceiling is) and the Progression roadmap's "Atteindre
// l'Univers" step (ui.js).
const UNIVERSE_TIER = 10;

const INITIAL_UNLOCKED = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17];

const EMOJI_SETS = [
  { id: "classic", name: "Cases classiques", cost: 0, currency: "gems" },
  // Tier 1 used to be Cerise/Petit Pois - both unrecognizable at tile size
  // (tiny red blob / tiny green blob), swapped for something unmistakable.
  // `icon` (all 10): custom AI-generated artwork (Midjourney, background
  // removed), assets/tiles/ - same field tierIconNode() (ui.js) already
  // reads off TIERS[], just per-tierSkin-entry here instead. Falls back to
  // the plain emoji while state.iconStyle === "emoji", same as classic.
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
      // Tiers 11-14 - illustrated (same "compact solid object, clean
      // silhouette" prompt style as TIERS 11-14, config.js - the first
      // fruit prompts read fine but weren't fruit-colored, borrowed the
      // matching standard tier's own palette instead (violet, red/magenta,
      // teal, gold) - only Mangue got explicitly recolored to actual mango
      // tones per Loris; Pêche/Myrtille/Kiwi kept their delivered colors).
      { emoji: "🥭", name: "Mangue Cosmique", icon: "fruit-11-mangue.png" },
      { emoji: "🍑", name: "Pêche Stellaire", icon: "fruit-12-peche.png", iconScale: 1.15 },
      { emoji: "🫐", name: "Myrtille Infinie", icon: "fruit-13-myrtille.png" },
      { emoji: "🥝", name: "Kiwi Primordial", icon: "fruit-14-kiwi.png" },
    ] },
  { id: "legumes", name: "Légumes de l'Espace", cost: 300, currency: "gems",
    tierSkin: [
      // iconScale bump: source art is a tall/narrow crop (133x300) - object-
      // fit:contain sizes to the limiting dimension, so a narrow image reads
      // visibly thinner/smaller than a squarer one at the same box size, same
      // "non-square source art" correction as TIERS[6]/TIERS[7] (ui.js).
      { emoji: "🥕", name: "Carotte", icon: "legume-1-carotte.png", iconScale: 1.3 },
      { emoji: "🍅", name: "Tomate", icon: "legume-2-tomate.png" },
      { emoji: "🌽", name: "Maïs", icon: "legume-3-mais.png" },
      { emoji: "🫑", name: "Poivron", icon: "legume-4-poivron.png" },
      { emoji: "🍆", name: "Aubergine", icon: "legume-5-aubergine.png" },
      { emoji: "🥦", name: "Brocoli", icon: "legume-6-brocoli.png" },
      // Redone (Loris: "on voit pas vraiment ce que ça représente" - the
      // first version didn't read as an onion at all). Renamed to a new
      // filename (-v2) rather than overwriting legume-7-oignon.png in
      // place - unlike the JS/CSS files (cache-busted via ?v=N on every
      // deploy), image URLs here carry no such param, so a returning
      // player's browser could otherwise keep showing the old cached
      // bytes at the same URL indefinitely.
      { emoji: "🧅", name: "Oignon", icon: "legume-7-oignon-v2.png" },
      { emoji: "🫛", name: "Petit Pois", icon: "legume-8-pois.png" },
      { emoji: "🎃", name: "Citrouille Géante", icon: "legume-9-citrouille.png" },
      { emoji: "🌻", name: "Fleur Cosmique", icon: "legume-10-fleur.png" },
      // Tiers 11-14 - illustrated, same delivered-colors-kept note as
      // "fruits" above.
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

// ---- Run upgrades (temporary, spent with Stardust, reset every Big Bang)
// ----
// Loris: wanted a real reason to think about a run's Stardust beyond just
// tapping Invoquer/unlocking cells on autopilot - "un systeme
// d'investissement de poussiere d'etoile pour des ameliorations avec
// niveau qui sont propres a la grille en cours". Distinct from SKILL_TREE
// above in every way that matters: priced in Stardust (not Cosmic Energy),
// levels live in state.runUpgrades (not state.skills), and reset to 0 at
// every Big Bang (performBigBang, economy.js) instead of surviving it -
// same "this cycle only" contract as state.moonMergesThisRun/
// usedShortcutThisRun elsewhere. This also gives leftover Stardust sitting
// right before a Big Bang somewhere useful to go, instead of just being
// discarded by the reset.
// - catalyst: state.js productionMultiplier()
// - resonance: economy.js maybeTriggerResonance(), rolled after every
//   single-cell unlock (tryUnlock/grantFreeCellUnlock/skipCell - NOT the
//   starter pack's bulk 3-cell IAP grant, that's a one-time perk rather
//   than "the unlock action" this is meant to reward)
// - surge: economy.js previewBigBangGain() (also what performBigBang()
//   actually grants, since it calls previewBigBangGain() internally) -
//   named "surge" rather than "echo" specifically to avoid colliding with
//   SKILL_TREE's own unrelated "Écho Temporel" (offline cap) branch
// - cadence: state.js autoSpawnIntervalMs(), stacks with the permanent
//   Gravité Rapide skill and any god spawnSpeedMult as its own independent
//   multiplier
//
// Costs (base/growth): second pass, still too cheap (Loris: "on arrive
// trop rapidement aux 1000 ou 2000 stardust donc trop facile de bourriner
// les améliorations dès le début" - could already afford several levels
// within the first couple minutes of a fresh run). Bases raised well past
// what idle income accumulates that early (3000-8000 for a first level,
// vs 400-1500 before), so Alchimie Stellaire only becomes relevant once a
// run is genuinely underway. Also: Cadence Stellaire was cheaper than
// Catalyseur Stellaire despite Loris wanting it priced as the pricier of
// the two - its base/growth are now both higher, so every one of its 8
// levels costs roughly 2-2.5x the same-numbered Catalyseur level, even
// though Catalyseur's own total is larger overall (15 levels vs 8). Total
// to max all 4 branches is now ~4.7M (was ~1.1M, was ~20K before that).
// `first` (Loris: "diminuer le prix d'améliorations de l'alchimie pour le
// premier niveau histoire que au moins le premier niveau soit facilement
// accessible mais pas après") - a deliberately discounted level-1 price,
// separate from base/growth so levels 2+ keep exactly the same steep curve
// already tuned above (base itself still IS the level-2 cost, growth^1) -
// only the very first purchase is cheap, everything after jumps straight
// back onto the normal curve.
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
  // Ananké only (GODS below) - deliberately not a key in BOX_RARITY_WEIGHTS,
  // so the Cosmic Box's own weighted roll (which only ever iterates
  // Object.keys(BOX_RARITY_WEIGHTS)) can mathematically never select her -
  // that's the actual mechanism keeping her out of the box, not a special
  // case bolted onto rollCosmicBox().
  mythique: { label: "Mythique", color: "#f472e0" },
};

// `icon` (all 13, this whole array): custom AI-generated portrait
// (Midjourney, background removed), assets/gods/<icon>. Same "falls back
// to the plain emoji while locked" pattern as tierIconNode() - see
// godPortraitHtml() in ui.js, the single helper every god-emoji spot in
// the UI (Gods panel grid, detail modal, ritual picker, Histoire, Cosmic
// Box reveal) now goes through.
const GODS = [
  {
    id: "selena", name: "Séléna", title: "Déesse des Lunes", emoji: "🌙", icon: "selena.png",
    rarity: "commun", alignment: "bienveillant",
    desc: "+15% production des Lunes et Planètes naines",
    effects: { tierProdBonus: { minTier: 2, maxTier: 3, mult: 1.15 } }, // used in state.js effectiveTileProd/totalProduction
    unlock: { type: "ritual" }, // granted automatically by the moon-merge ritual, see gods.js
    lore: "La première à avoir répondu à l'appel du rituel des lunes. Elle veille sur chaque fragment qui tourne encore dans le noir et guide la main du fusionneur novice. Elle n'a jamais cru que la Rupture fût un simple accident, et murmure qu'une présence bien plus ancienne qu'elle regardait, ce jour-là, sans rien faire pour l'empêcher.",
  },
  // Loris: the moon-merge ritual should offer a real choice, not hand you
  // Séléna alone with a "choisis celui qui t'accompagnera" that lied about
  // there being anything to choose - un dieu bienveillant ET un dieu déchu,
  // côte à côte. Rather than repurpose an existing déchu god (losing its own
  // challenge/shop/box unlock path), Loris asked for a brand new one here -
  // same "commun"/"ritual" shape as Séléna, exact same tier scope (2-3) so
  // the two read as true mirror images of each other: one purely helps that
  // range, the other trades a little of its production for a chance at Gems
  // instead. See onFusionForGods() (gods.js) for the ritual granting both at
  // once, and openGodPickerModal() (ui.js) for the side-by-side picker.
  {
    id: "zephar", name: "Zéphar", title: "Seigneur des Lunes Brisées", emoji: "🌘", icon: "zephar.png",
    rarity: "commun", alignment: "dechu",
    desc: "+15% chance de Gem bonus par fusion, mais -8% production des Lunes et Planètes naines",
    effects: { gemChanceBonus: 0.15, tierProdBonus: { minTier: 2, maxTier: 3, mult: 0.92 } },
    unlock: { type: "ritual" }, // granted automatically by the moon-merge ritual, alongside Séléna - see gods.js
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
  // 14th, secret god - Loris's "challenge communautaire" (4 easter eggs,
  // ui.js/input.js/economy.js). `secret: true` pulls her out of every
  // normal "X/13" pantheon count (Progression's "Dieux éveillés",
  // rollCosmicBox's "all gods owned" gems-box transition, gods.js) without
  // needing to special-case her id all over the place - see
  // NORMAL_GODS_COUNT below. unlock.type "secret" (not "box"/"milestone"/
  // "challenge"/"shop") keeps her out of nextGodMilestoneHint's own
  // `unlock.type === "milestone"` sweep too. rarity "mythique" isn't a key
  // in BOX_RARITY_WEIGHTS, so the Cosmic Box's weighted roll can
  // mathematically never land on her - no separate exclusion needed there
  // either (see the comment on RARITY.mythique above).
  {
    id: "ananke", name: "Ananké", title: "L'Origine Silencieuse", emoji: "🌀", icon: "ananke.png", secret: true,
    rarity: "mythique", alignment: "bienveillant",
    desc: "+20% production globale, +2h de plafond hors-ligne et +5% chance de Gem bonus par fusion",
    effects: { prodMult: 1.2, offlineCapBonusH: 2, gemChanceBonus: 0.05 },
    unlock: { type: "secret", label: "Un secret bien gardé du Cosmos" },
    lore: "Avant les treize, avant la Rupture elle-même, il y avait Ananké. Elle n'a rien causé. Elle a simplement toujours su que ça arriverait. Ceux qui la trouvent ne la choisissent pas : elle les attendait déjà.",
  },
];
// The 13 "normal" gods, for every place that means to say "X/13" - Ananké
// (secret: true, above) never counts toward this, by design (Loris).
const NORMAL_GODS_COUNT = GODS.filter(g => !g.secret).length;

// ---- Secret challenge: 4 easter eggs, hidden until the first is found
// ----
// Loris: "débloquer 4 easter eggs pour recevoir une récompense inédite
// [...] compteur d'easter egg avec explications assez synthétique sous
// forme de copywriting énigme". `hint` is what the counter shows for a
// still-locked egg (deliberately vague - no instructions on how to find
// it); `revealText` is what shows once it's actually found. Detection
// logic for each lives where the trigger naturally happens:
// - restart_at_top: onRestartConfirm (input.js) - restarting while a
//   Big Bang was already available (hasUniverseTile).
// - pure_extremes: performBigBang (economy.js) - every grid cell at Big
//   Bang time is tier 1 or UNIVERSE_TIER, nothing in between.
// - merge_chain: attemptMerge (input.js) - EASTER_EGG_CHAIN_COUNT merges
//   land within EASTER_EGG_CHAIN_MS of each other.
// - second_loop: performMerge (economy.js) - a tile reaches cycle 2 (two
//   tier-14 tiles merging for the *second* time - Loris: "atteindre le
//   tier 2 (deux case de niveau 14 du tier de base qui fusionne)").
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
    // Loris: "il faut aussi faire attention car dans l'histoire c'est
    // némésis qui détient le savoir alors que [...] ce ne sera que le dieu
    // caché derrière les secrets" - redirige entièrement vers ce dieu
    // (jamais nommé ici), cohérent avec la nouvelle lore de Némésis
    // (config.js, GODS) qui ne prétend plus tout savoir elle-même.
    text: "Un nom ne figure sur aucune liste, ne se prononce dans aucun temple : celui du quatorzième. Certains Dieux jurent qu'il n'existe pas. D'autres refusent simplement d'en parler. Némésis, elle, se contente de dire qu'un seul être échappe à son jugement, et qu'elle préfère ne pas savoir pourquoi.",
  },
  {
    id: "frag_truth", title: "La Vérité",
    unlock: (s) => s.achievements.unlockedIds.length >= ACHIEVEMENTS.length,
    // Loris: "je pense que ce serait efficace [...] permettre d'en
    // apprendre plus sur l'histoire sans jamais réussir à comprendre la
    // raison de la rupture" - le fragment donnait auparavant une réponse
    // assez explicite (une "question posée par le Cosmos"). Récrit pour
    // rester un mystère jusqu'au bout, même au sommet de la progression :
    // la seule piste qui reste pointe vers le quatorzième (frag_name
    // ci-dessus), sans jamais rien confirmer.
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
  // Loris: "la récompense 'fragment de skin' ne donne rien" (Roue) - same
  // dead-end mechanic backed this day-6 slot (see applyDailyReward,
  // retention.js). A free streak-freeze charge instead - fits the "you're
  // one day from the big day-7 reward" spot better anyway (protects the
  // very streak this cycle is building toward).
  { day: 6, type: "streakFreeze", amount: 1, label: "❄️ Gel de série" },
  { day: 7, type: "bigReward", amount: 1, label: "1 ⚡ Énergie Cosmique + gros lot ✨" },
];

// ---- Daily quest pool (templates); 3 drawn per day + 1 bonus "watch ad" ----
// Rewards trimmed ~30% (Loris: quests were the biggest source of "free"
// Gems - easily 35-40/day just from normal play, no ad ever watched -
// undercutting the incentive to actually watch a rewarded ad. Loris wants
// Gems kept as the reward type here, just smaller amounts; BONUS_AD_QUEST
// below is untouched on purpose - that one's reward IS gated behind an ad
// already, so it doesn't compete with the ad-watching incentive).
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
const BONUS_AD_QUEST = { id: "watchAd", desc: "Regarde une publicité", reward: 25 }; // Loris: 15 -> 25

// ---- Achievements (permanent, never reset) ----
// Rewards cut ~50% across the board (Loris: "diminue les récompenses de
// tous les succès je trouve qu'ils rapportent trop") - a flat, consistent
// cut rather than singling out any one category, so the relative ordering/
// pacing between achievements is unchanged, just the absolute numbers.
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
  // Tiers 11-14 (Loris: allonger le temps de jeu après Univers - voir
  // TIERS/UNIVERSE_TIER, config.js) - fresh goals to chase once the grid
  // used to be a dead end at tier 10.
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
  // with BOX_RARITY_WEIGHTS below by hand if those ever change. Loris: "on
  // doit pouvoir gagner uniquement des dieux qu'on possède pas" - no more
  // duplicates (rollCosmicBox, gods.js re-rolls the rarity until it finds
  // one with an unowned god left), and once every god is owned the box
  // becomes a pure Gems roll instead.
  { id: "cosmicBox", name: "Boîte Cosmique", desc: "Un Dieu que tu ne possèdes pas encore - Commun 50% · Rare 30% · Épique 15% · Légendaire 5% (jusqu'à 200 Gems une fois tous les Dieux obtenus)", cost: 120 },
];

// Cosmic Box odds: Commun is the most likely roll, Légendaire the rarest.
// Never a duplicate any more (rollCosmicBox, gods.js) - re-rolls the
// rarity until one still has an unowned god.
const BOX_RARITY_WEIGHTS = { commun: 50, rare: 30, epique: 15, legendaire: 5 };

// ---- IAP catalog (simulated at this stage) ----
const IAP_CATALOG = [
  // "planète gratuite" removed from this description - that feature was
  // cut from the game entirely (see git log), this promise was stale.
  // Price swapped with stardust_boost below (Loris) - permanently removing
  // every ad is worth more than a production multiplier, so it should cost
  // more, not less.
  // Loris: "la suppression de pubs a 4,99$ une fois (pas mensuel comme le
  // pass)" - already exactly this (nonconsumable, 4,99$), no change here.
  { id: "remove_ads", type: "nonconsumable", name: "Suppression des pubs", price: "4,99 $", desc: "Retire toutes les publicités définitivement, et débloque instantanément tous les bonus normalement obtenus en pub (boost, quête bonus)." },
  // `perks` (structured, one line per benefit) replaces the old single
  // `desc` string of "✅ ..." lines joined by \n - Loris found that plain
  // checklist "pas très premium". Rendered as its own icon+text row list
  // in the hero card (renderShopPanel/ui.js) instead of a wall of
  // checkmarks; `desc` is now just the short tagline above it.
  // Price 6,99->5,99 $/mois, daily Gems 50->100 (VIP_DAILY_GEMS below) -
  // both per Loris. The Gems perk's own value-comparison badge (vs buying
  // that many Gems in the shop) is computed and appended at render time by
  // passGemsValueBadgeText() (ui.js), not hardcoded here, so it can't drift
  // out of sync if any of these prices change later.
  { id: "vip_monthly", type: "subscription", name: "Pass Supernova", price: "5,99 $/mois",
    desc: "L'expérience Godspark, sans limites.",
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
// Growth bumped 1.5 -> 1.65 -> 1.8, in two separate passes. First pass
// (Loris: "on arrive trop vite à la dernière ligne") predates the tap-bonus
// "clicker" rework in this same branch (grantTapBonus, input.js -
// TAP_COOLDOWN_MS dropped 1000ms -> 150ms so chaining taps across many
// cells reads as a real clicker). That rework meaningfully raises how much
// Stardust an active player can generate above pure idle production, which
// ate into the 1.65 pass's own point - Loris: "le déblocage des cases...
// un peu trop rapide étant donné qu'on a un cliqueur maintenant". Second
// pass barely moves the first few unlocks (n small - a new player's very
// first purchases are what most needs to stay cheap/frictionless) but
// compounds hard by the last row: at n=19 (the 20th and final
// manually-unlocked cell, TOTAL 30 minus the 10 INITIAL_UNLOCKED), cost
// goes 1.5->111K, 1.65->677K, 1.8->~3.8M Stardust.
function unlockCost(n) { return Math.round(50 * Math.pow(1.8, n)); }
// Loris: "la croissance du cout d'invocation est correct au début mais
// après c'est un peu trop violent" - a flat 1.12^k never stops compounding,
// so however reasonable it feels for the first invokes, it necessarily
// keeps accelerating forever (k=15 -> 82, k=25 -> 255, k=40 -> ~1396 - a
// 93x jump from the base 15, for a currency you're also spending on
// unlockCost above and can't stockpile between manual spawns without it
// idling in reserve). Left untouched below INVOKE_COST_SOFTCAP_K (still
// literally the same numbers Loris already approved) and switched to a
// gentler 1.06 growth past it, continuous at the seam (no visible jump):
// k=20 -> 110 (was 145), k=30 -> 197 (was 449), k=40 -> 352 (was 1396).
// Late invokes stay a real, escalating sink - just not a runaway one.
const INVOKE_COST_SOFTCAP_K = 15;
function invokeCost(k) {
  const capped = Math.min(k, INVOKE_COST_SOFTCAP_K);
  const beyond = Math.max(0, k - INVOKE_COST_SOFTCAP_K);
  return Math.round(15 * Math.pow(1.12, capped) * Math.pow(1.06, beyond));
}

// Loris: "on devrait gagner un peu moins de points d'ascension quand on
// fait un bigbang (et ça augmentera selon le nombre de cases de niveau 10
// et plus mais en comptant aussi une prime pour les niveaux supérieurs (11
// rapporte plus que 10 mais moins que 12)". Escalating per-tile weight
// (1.4x per tier above UNIVERSE_TIER) instead of the old flat
// maxTierReached-based bonus - a lone Univers tile is worth slightly LESS
// than the old formula gave for reaching tier 10 (13 vs the old flat 15),
// but every tier-10-or-higher tile actually sitting on the grid at Big
// Bang time now adds its own weight, summed - so several high tiles, or
// pushing into the new 11-14 tiers (TIERS/UNIVERSE_TIER, config.js), adds
// up fast instead of being capped at one flat number regardless of how
// many you have.
//
// The 1.4x escalation only runs to the top of TIERS (Genèse, 14) - the range
// Loris' "11 rapporte plus que 10 mais moins que 12" actually describes.
// Past that, progress comes from the infinite loop (`cycle`, performMerge in
// economy.js), which by design never ends, so continuing to compound would
// let Cosmic Energy run away: a single cycle-1 Genèse would already be worth
// ~6100 (vs 50 for a cycle-0 Genèse), two loops would trivialise the whole
// permanent SKILL_TREE, and far enough out Math.pow returns Infinity and
// poisons state.cosmicEnergy for good. Each tier beyond Genèse therefore
// adds a flat BIG_BANG_LOOP_TIER_BONUS instead: still strictly increasing,
// still a real reward for looping, but linear rather than explosive.
const BIG_BANG_LOOP_TIER_BONUS = 25;
function bigBangTileWeight(tier) {
  const escalating = Math.min(tier, TIERS.length);
  const looped = Math.max(0, tier - TIERS.length);
  return Math.round(13 * Math.pow(1.4, escalating - UNIVERSE_TIER)) + looped * BIG_BANG_LOOP_TIER_BONUS;
}
// How far a tile really is along the progression, flattening the infinite
// loop (`cycle`, see performMerge in economy.js) back onto a single scale:
// a cycle-1 tier-1 tile is the product of two tier-14 tiles, so it sits
// ABOVE tier 14, not below tier 2. Everything that asks "how high has this
// tile climbed" - Big Bang eligibility (hasUniverseTile, economy.js) and its
// payout weight below - must use this rather than `tile.tier`, which drops
// back to 1 at every loop boundary.
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

// Loris: "parfois le nombre de poussière d'étoile récolté durant l'absence
// bug et ça met '1sec - 1 stardust' ou parfois '1sec - 2 stardust'". Not
// actually a bug in what's granted - openOfflineModal's Stardust figure is
// computed from the true elapsed milliseconds (computeOfflineGain,
// retention.js), while formatDuration above always rounds UP to the
// nearest whole second (so nothing ever displays as a misleading "0s"
// while still pending on a cooldown, which is the right behavior for every
// other thing that calls it). Any elapsed time from just-over-0ms up to
// 1000ms all reads as the same "1s", while the Stardust figure computed
// from that same span keeps scaling continuously with it - so two
// genuinely different-length absences can both show "1s" next to two
// visibly different Stardust amounts, which reads as broken even though
// both numbers were individually correct. Used only for the offline-gain
// popup's duration line (not formatDuration's other callers, where whole
// seconds are correct) - shows one decimal under 10s specifically, so the
// two numbers on screen stay visibly, honestly proportional to each other
// at exactly the timescale where this ambiguity is possible.
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
