// Godspark - all rendering: grid, header, panels, modals, toasts, tutorial
"use strict";

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const dom = {
  grid: $("grid"),
  stardustValue: $("stardustValue"),
  stardustRate: $("stardustRate"),
  gemsValue: $("gemsValue"),
  energyValue: $("energyValue"),
  energyPill: $("energyPill"),
  invokeBtnStardust: $("invokeBtnStardust"),
  invokeBtnGems: $("invokeBtnGems"),
  invokeCost: $("invokeCost"),
  fabSwapCells: $("fabSwapCells"),
  bigBangBtn: $("bigBangBtn"),
  selectionHint: $("selectionHint"),
  toastContainer: $("toastContainer"),
  fabDailyLogin: $("fabDailyLogin"),
  fabWheel: $("fabWheel"),
  bannerAd: $("bannerAd"),
  menuBtn: $("menuBtn"),
  drawerOverlay: $("drawerOverlay"),
  drawerClose: $("drawerClose"),
  panelOverlay: $("panelOverlay"),
  panelTitle: $("panelTitle"),
  panelBody: $("panelBody"),
  panelClose: $("panelClose"),
};

let cellEls = [];
function buildGridDom() {
  dom.grid.innerHTML = "";
  cellEls = [];
  for (let i = 0; i < TOTAL; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.idx = i;
    dom.grid.appendChild(cell);
    cellEls.push(cell);
  }
}

function equippedEmojiSetDef() { return EMOJI_SETS.find(e => e.id === Game.state.equippedEmojiSet) || EMOJI_SETS[0]; }
function tierStyle(tier) {
  const t = TIERS[tier - 1];
  return `background:radial-gradient(circle at 35% 30%, ${t.from}, ${t.to});`;
}
function tierEmoji(tier) { const s = equippedEmojiSetDef(); return (s.tierSkin && s.tierSkin[tier - 1]) ? s.tierSkin[tier - 1].emoji : TIERS[tier - 1].emoji; }
function tierName(tier) { const s = equippedEmojiSetDef(); return (s.tierSkin && s.tierSkin[tier - 1]) ? s.tierSkin[tier - 1].name : TIERS[tier - 1].name; }

// ---------------- Cycle glow (loops past the top tier) ----------------
// Each cycle (tile.cycle) gets its own hue; the glow gets stronger with the tile's tier.
function cycleColor(cycle) {
  const hue = ((cycle - 1) * 47) % 360; // 47° apart so consecutive cycles look clearly different
  return `hsl(${hue}, 75%, 60%)`;
}
function applyCycleGlow(tile, tier, cycle) {
  if (!cycle) return;
  tile.classList.add("cycled");
  tile.style.setProperty("--cycle-color", cycleColor(cycle));
  tile.style.setProperty("--cycle-intensity", (tier / TIERS.length).toFixed(2));
}

// Inline tier icon for text outside the grid. Always the classic set's art, emoji fallback.
function tierInlineIconHtml(tier) {
  const t = TIERS[tier - 1];
  return t.icon
    ? `<img class="inlineTierIcon" src="assets/tiles/${t.icon}" alt="${t.name}">`
    : t.emoji;
}

// God portrait with emoji fallback. `cls` is the CSS size class of the spot using it.
// `locked` shows the shared "unknown god" image instead.
function godPortraitHtml(god, cls, locked) {
  if (locked) return `<img class="${cls}" src="assets/gods/unknown-v2.png" alt="Dieu inconnu">`;
  return god.icon
    ? `<img class="${cls}" src="assets/gods/${god.icon}" alt="${god.name}">`
    : god.emoji;
}

// Inline currency icon next to a number.
function currencyIconHtml(type) {
  if (type === "stardust") return `<img class="inlineCurrencyIcon" src="assets/ui/stardust.png" alt="Stardust">`;
  if (type === "gems") return `<img class="inlineCurrencyIcon" src="assets/ui/gems_ad.png" alt="Gems">`;
  if (type === "energy") return `<img class="inlineCurrencyIcon" src="assets/ui/ascension.png" alt="Énergie Cosmique">`;
  return "";
}

// "#3a3550" -> "58, 53, 80", for rgba(var(--x), a) in CSS.
function hexRgbTriplet(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function lockIconHtml() { return `<img class="inlineCurrencyIcon" src="assets/ui/cadenas.png" alt="">`; }
function trophyIconHtml() { return `<img class="inlineCurrencyIcon" src="assets/ui/succes.png" alt="">`; }

function withCurrencyIcons(text) {
  return text
    .replace(/✨/g, currencyIconHtml("stardust"))
    .replace(/💎/g, currencyIconHtml("gems"))
    .replace(/⚡/g, currencyIconHtml("energy"));
}

// Tile icon: artwork from the set's tierSkin entry (or TIERS for classic), else the emoji.
// `setOverride` renders another set without equipping it (skin preview).
function tierIconNode(tier, setOverride) {
  const s = setOverride || equippedEmojiSetDef();
  const skinEntry = s.tierSkin && s.tierSkin[tier - 1];
  const src = skinEntry || TIERS[tier - 1];
  // Falls back to the emoji when the set has no art for this tier.
  if (src.icon && Game.state.iconStyle !== "emoji") {
    const img = document.createElement("img");
    img.className = "emoji tierIcon";
    img.src = "assets/tiles/" + src.icon;
    img.alt = src.name;
    // iconScale enlarges art that reads small; inline size overrides the .tierIcon CSS rule.
    if (src.iconScale) {
      const pct = (68 * src.iconScale).toFixed(1) + "%";
      img.style.width = pct; img.style.height = pct;
    }
    return img;
  }
  const span = document.createElement("div");
  span.className = "emoji";
  // Use `src.emoji`, not tierEmoji(): tierEmoji ignores setOverride.
  span.textContent = src.emoji;
  return span;
}

function renderCell(i, opts) {
  opts = opts || {};
  const state = Game.state;
  const cell = cellEls[i];
  const locked = !state.unlocked[i];
  const tileData = state.grid[i];
  cell.className = "cell";
  cell.innerHTML = "";

  if (locked) {
    cell.classList.add("locked");
    if (Game.skipCellArmed) cell.classList.add("skipArmed");
    const label = document.createElement("div");
    label.className = "lockLabel";
    if (Game.skipCellArmed) {
      label.innerHTML = `<span class="emoji">${currencyIconHtml("gems")}</span><span>Sauter</span>`;
    } else {
      const n = state.extraUnlockedCount;
      label.innerHTML = `<span class="emoji"><img src="assets/ui/cadenas.png" alt=""></span><span>${formatNumber(unlockCost(n))}${currencyIconHtml("stardust")}</span>`;
    }
    cell.appendChild(label);
    return;
  }

  if (!tileData) {
    cell.classList.add("empty");
    // Pop animation only right after an unlock, not on every re-render.
    if (opts.justUnlocked) cell.classList.add("unlockPop");
    if (Game.selectedIdx === i) cell.classList.add("selectableEmpty");
    return;
  }

  cell.classList.add("filled");
  if (Game.selectedIdx === i) cell.classList.add("selected");
  // Idle animation on max-tier tiles. On .cell, not .tile, to avoid clashing with merge/spawn transforms.
  if (tileData.tier === TIERS.length) cell.classList.add("tierMax");

  const tile = document.createElement("div");
  tile.className = "tile";
  if (opts.merged) tile.classList.add("merging");
  if (opts.spawned) tile.classList.add("spawnIn");
  tile.style.cssText += tierStyle(tileData.tier);
  applyCycleGlow(tile, tileData.tier, tileData.cycle || 0);
  const emoji = tierIconNode(tileData.tier);
  const num = document.createElement("div");
  num.className = "tierNum";
  num.textContent = tileData.tier;
  tile.appendChild(emoji); tile.appendChild(num);
  if (tileData.cycle) {
    const cycleBadge = document.createElement("div");
    cycleBadge.className = "cycleBadge";
    cycleBadge.textContent = "×" + tileData.cycle;
    cycleBadge.style.color = cycleColor(tileData.cycle);
    tile.appendChild(cycleBadge);
  }
  cell.appendChild(tile);
}

// Emoji/Illustrated toggle, used by the skin manager and the skin preview.
// `onChange` re-renders the host container. `set` picks which set's tier 1 illustrates
// the two buttons (defaults to the equipped set).
function renderIconStyleToggle(onChange, set) {
  const state = Game.state;
  const wrap = el("div", "iconStyleToggle");
  const s = set || equippedEmojiSetDef();
  const skin = (s.tierSkin && s.tierSkin[0]) || TIERS[0];
  // Falls back to the classic meteorite art if this set has no tier 1 art.
  const artSrc = skin.icon || TIERS[0].icon;
  const emojiBtn = el("button", "btn" + (state.iconStyle === "emoji" ? " primary" : " ghost"),
    `<span class="emoji">${skin.emoji}</span> Emoji`);
  const artBtn = el("button", "btn" + (state.iconStyle !== "emoji" ? " primary" : " ghost"),
    `<img class="inlineCurrencyIcon" src="assets/tiles/${artSrc}" alt=""> Illustré`);
  emojiBtn.addEventListener("click", () => { onSetIconStyle("emoji"); onChange(); });
  artBtn.addEventListener("click", () => { onSetIconStyle("illustrated"); onChange(); });
  wrap.appendChild(emojiBtn);
  wrap.appendChild(artBtn);
  return wrap;
}

function openSkinPreviewModal(setId) {
  const set = EMOJI_SETS.find(s => s.id === setId);
  if (!set) return;
  $("skinPreviewTitle").textContent = set.name;
  const toggleHost = $("skinPreviewToggle");
  toggleHost.innerHTML = "";
  toggleHost.appendChild(renderIconStyleToggle(() => openSkinPreviewModal(setId), set));
  const grid = $("skinPreviewGrid");
  grid.innerHTML = "";
  for (let t = 1; t <= TIERS.length; t++) {
    const cell = el("div", "cell filled previewCell");
    cell.style.setProperty("--stagger", ((t - 1) * 0.18).toFixed(2) + "s");
    const tile = el("div", "tile");
    tile.style.cssText += tierStyle(t);
    tile.appendChild(tierIconNode(t, set));
    tile.appendChild(el("div", "tierNum", String(t)));
    cell.appendChild(tile);
    grid.appendChild(cell);
  }
  $("skinPreviewModal").classList.remove("hidden");
}
function closeSkinPreviewModal() { $("skinPreviewModal").classList.add("hidden"); }

function refreshLockedCellPrices() {
  for (let i = 0; i < TOTAL; i++) {
    if (!Game.state.unlocked[i]) renderCell(i);
  }
}

function renderAll() {
  for (let i = 0; i < TOTAL; i++) renderCell(i);
  updateHeader();
  updateFabs();
}

let lastHeaderRender = {};
function updateHeader() {
  const state = Game.state;
  const now = Date.now();
  const stardustStr = formatNumber(Game.displayedStardust);
  if (stardustStr !== lastHeaderRender.stardust) { dom.stardustValue.textContent = stardustStr; lastHeaderRender.stardust = stardustStr; }

  const rateStr = "+" + formatNumber(totalProduction(state)) + "/s";
  if (rateStr !== lastHeaderRender.rate) { dom.stardustRate.textContent = rateStr; lastHeaderRender.rate = rateStr; }

  const gemsStr = formatNumber(state.gems);
  if (gemsStr !== lastHeaderRender.gems) { dom.gemsValue.textContent = gemsStr; lastHeaderRender.gems = gemsStr; }

  const energyStr = formatNumber(state.cosmicEnergy);
  if (energyStr !== lastHeaderRender.energy) { dom.energyValue.textContent = energyStr; lastHeaderRender.energy = energyStr; }

  const cost = invokeCost(state.manualSpawnCount);
  const costStr = formatNumber(cost);
  if (costStr !== lastHeaderRender.cost) { dom.invokeCost.textContent = costStr; lastHeaderRender.cost = costStr; }
  if (!lastHeaderRender.gemsCostSet) { $("invokeCostGems").textContent = GEMS_INVOKE_COST; lastHeaderRender.gemsCostSet = true; }
  const disabled = state.stardust < cost;
  if (disabled !== lastHeaderRender.disabled) { dom.invokeBtnStardust.classList.toggle("disabled", disabled); lastHeaderRender.disabled = disabled; }
  const gemsDisabled = state.gems < GEMS_INVOKE_COST;
  if (gemsDisabled !== lastHeaderRender.gemsDisabled) { dom.invokeBtnGems.classList.toggle("disabled", gemsDisabled); lastHeaderRender.gemsDisabled = gemsDisabled; }
  // Not disabled when Gems are short: the button then offers a free swap with an ad.
  // Disabled only during a swap selection or while that ad is on cooldown.
  const swapCost = SHOP_GEM_ITEMS.find(i => i.id === "swapCells").cost;
  const swapAffordable = state.gems >= swapCost;
  const swapAdLeft = state.cooldowns.swapAdUntil - now;
  const swapAdOnCooldown = !swapAffordable && swapAdLeft > 0;
  const swapDisabled = Game.swapArmed || swapAdOnCooldown;
  if (swapDisabled !== lastHeaderRender.swapDisabled) { dom.fabSwapCells.classList.toggle("disabled", swapDisabled); lastHeaderRender.swapDisabled = swapDisabled; }
  const swapLabel = swapAffordable
    ? `<img class="inlineCurrencyIcon" src="assets/ui/gems_ad.png" alt="Gems">${swapCost}`
    : (swapAdOnCooldown ? formatDuration(swapAdLeft)
      : `<img class="inlineCurrencyIcon" src="assets/ui/watch-ad.png" alt="">Gratuit`);
  if (swapLabel !== lastHeaderRender.swapLabel) { dom.fabSwapCells.innerHTML = swapLabel; lastHeaderRender.swapLabel = swapLabel; }

  const canBB = hasUniverseTile(state);
  if (canBB !== lastHeaderRender.canBB) { dom.bigBangBtn.classList.toggle("hidden", !canBB); lastHeaderRender.canBB = canBB; }

  let hint = "";
  if (Game.skipCellArmed) hint = "Choisis une case verrouillée à débloquer avec des Gems";
  else if (Game.swapArmed) hint = Game.swapFirstIdx === null ? "Échange : choisis la première case" : "Échange : choisis la seconde case";
  else if (Game.selectedIdx !== null) {
    hint = "Case choisie pour la prochaine invocation";
  }
  if (hint !== lastHeaderRender.hint) { dom.selectionHint.textContent = hint; lastHeaderRender.hint = hint; }
}

// Fabs appear one by one as lifetime fusions grow (onboarding, never hidden again).
// fabCurrentGod is not listed: it appears with the first god (moon ritual).
const FAB_DISCOVERY_FUSIONS = {
  fabDailyLogin: 1,
  fabRunUpgrades: 6,
  fabUnlockCellAd: 9,
  fabAutoClicker: 12,
  fabGemsAd: 15,
};
// Shows or hides a fab. The pop-in animation plays once per fab per session.
// Returns true only on that first reveal, so callers can hook a one-time action.
function revealFab(id, shouldShow) {
  const elDom = $(id);
  if (!shouldShow) { elDom.classList.add("hidden"); return false; }
  const wasHidden = elDom.classList.contains("hidden");
  elDom.classList.remove("hidden");
  if (wasHidden && !Game.fabRevealed.has(id)) {
    Game.fabRevealed.add(id);
    const revealCls = id === "fabDailyLogin" ? "fabReveal gift" : "fabReveal";
    elDom.classList.add(...revealCls.split(" "));
    setTimeout(() => elDom.classList.remove(...revealCls.split(" ")), 700);
    return true;
  }
  return false;
}

function updateFabs() {
  const state = Game.state;
  const fusions = state.lifetime.fusions;
  // Used to hide once claimed, which meant there was no way at all to check
  // your streak/freeze status between claims - it stays visible and just
  // switches to a "streak" readout (still opens the same modal, read-only).
  const claimedToday = !isDailyLoginAvailable(state);
  revealFab("fabDailyLogin", fusions >= FAB_DISCOVERY_FUSIONS.fabDailyLogin);
  // Only rewrite the icon when its state changes: updateFabs() runs every frame, and
  // replacing the <img> under the finger can swallow the tap.
  const dailyIcon = dom.fabDailyLogin.querySelector(".fabIcon");
  const dailyIconKey = claimedToday ? "claimed" : "gift";
  if (dailyIcon.dataset.state !== dailyIconKey) {
    dailyIcon.innerHTML = claimedToday ? '<img class="uiIcon" src="assets/ui/flamme.png" alt="">' : '<img class="uiIcon" src="assets/ui/cadeau.png" alt="">';
    dailyIcon.dataset.state = dailyIconKey;
  }
  const dailyLabel = dom.fabDailyLogin.querySelector(".fabLabel");
  const dailyLabelText = claimedToday ? `Série ${state.dailyLogin.streak}` : "Cadeau";
  if (dailyLabel.textContent !== dailyLabelText) dailyLabel.textContent = dailyLabelText;
  dom.fabDailyLogin.classList.toggle("active", claimedToday);
  ensureDailySpin(state);
  dom.fabWheel.classList.toggle("hidden", state.dailySpin.freeUsed && state.dailySpin.bonusUsed);
  const allUnlocked = unlockedCount(state) >= TOTAL;
  // Only shown when usable, like the wheel.
  const unlockCellAdReady = !allUnlocked && Date.now() >= state.cooldowns.unlockCellAdUntil;
  revealFab("fabUnlockCellAd", fusions >= FAB_DISCOVERY_FUSIONS.fabUnlockCellAd && unlockCellAdReady);

  const now = Date.now();
  const ac = state.autoClicker;
  const autoClickerActive = ac.activeUntil > now;
  // "Free" means no ad needed: today's free use, or an ad already watched (Game.autoClickerPaid).
  const autoClickerFree = !autoClickerActive && (isAutoClickerFreeAvailable(state) || Game.autoClickerPaid);
  const justRevealedAutoClicker = revealFab("fabAutoClicker", fusions >= FAB_DISCOVERY_FUSIONS.fabAutoClicker);
  $("fabAutoClicker").classList.toggle("ready", autoClickerFree);
  $("fabAutoClicker").classList.toggle("active", autoClickerActive);
  // innerHTML for the watch-ad icon; the other labels are plain text without HTML characters.
  const autoClickerLabel = autoClickerActive ? formatDuration(ac.activeUntil - now)
    : (autoClickerFree ? "Clicker Auto" : `<img class="inlineCurrencyIcon" src="assets/ui/watch-ad.png" alt=""> Clicker Auto`);
  if ($("fabAutoClickerLabel").innerHTML !== autoClickerLabel) $("fabAutoClickerLabel").innerHTML = autoClickerLabel;
  // Intro modal, once ever, when the fab first appears.
  if (justRevealedAutoClicker && !state.autoClicker.tutorialShown) openAutoClickerIntroModal();

  revealFab("fabGemsAd", fusions >= FAB_DISCOVERY_FUSIONS.fabGemsAd);
  const gemsAdFree = isGemsAdFreeAvailable(state);
  const gemsAdOnCooldown = !gemsAdFree && now < state.cooldowns.gemsAdUntil;
  $("fabGemsAd").classList.toggle("ready", gemsAdFree || !gemsAdOnCooldown);
  const gemsAdLabel = gemsAdFree ? `+${GEMS_AD_REWARD} Gems`
    : (gemsAdOnCooldown ? formatDuration(state.cooldowns.gemsAdUntil - now) : `<img class="inlineCurrencyIcon" src="assets/ui/watch-ad.png" alt=""> +${GEMS_AD_REWARD} Gems`);
  if ($("fabGemsAdLabel").innerHTML !== gemsAdLabel) $("fabGemsAdLabel").innerHTML = gemsAdLabel;
  revealFab("fabRunUpgrades", fusions >= FAB_DISCOVERY_FUSIONS.fabRunUpgrades);
  // Secret: stays hidden until the first easter egg is found.
  revealFab("fabSecrets", state.easterEggs.unlockedIds.length > 0);
  dom.bannerAd.classList.toggle("hidden", adsRemoved(state));
  updateQuestNotifDot();

  const god = state.gods.currentGodId ? getGod(state.gods.currentGodId) : null;
  revealFab("fabCurrentGod", !!god);
  if (god) {
    // Only touch the DOM when the equipped god changes.
    if (lastHeaderRender.fabGodId !== god.id) {
      $("fabGodEmoji").innerHTML = godPortraitHtml(god, "uiIcon");
      lastHeaderRender.fabGodId = god.id;
    }
    $("fabGodName").textContent = god.name;
  }
}

function hasClaimableQuest(state) {
  ensureDailyQuests(state);
  return state.quests.active.some(q => q.done && !q.claimed) || (state.quests.bonusAd.done && !state.quests.bonusAd.claimed);
}
let lastNotifDotState = null;
function updateQuestNotifDot() {
  const has = hasClaimableQuest(Game.state);
  if (has !== lastNotifDotState) {
    $("questsNotifDot").classList.toggle("hidden", !has);
    lastNotifDotState = has;
  }
}

// Delay before the impact. Must match the `chargeGlow` CSS animation and the delay in
// Sfx.meteorImpact() (audio.js). Short because it plays on every merge.
const METEOR_FALL_MS = 110;

// Draws the pre-merge tile at `idx` without touching state.grid, while the charge-up plays.
function renderMergeStandIn(idx, tier, cycle) {
  const cell = cellEls[idx];
  cell.className = "cell filled";
  cell.innerHTML = "";
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.style.cssText += tierStyle(tier);
  applyCycleGlow(tile, tier, cycle || 0);
  const emoji = tierIconNode(tier);
  const num = document.createElement("div");
  num.className = "tierNum";
  num.textContent = tier;
  tile.appendChild(emoji); tile.appendChild(num);
  if (cycle) {
    const cycleBadge = document.createElement("div");
    cycleBadge.className = "cycleBadge";
    cycleBadge.textContent = "×" + cycle;
    cycleBadge.style.color = cycleColor(cycle);
    tile.appendChild(cycleBadge);
  }
  cell.appendChild(tile);
}

// Restarts a CSS animation on an element that may still have the class.
// The forced reflow is costly, so it only happens when the class is present.
function restartAnim(el, cls) {
  if (el.classList.contains(cls)) {
    el.classList.remove(cls);
    void el.offsetWidth; // force reflow, only when actually needed to restart
  }
  el.classList.add(cls);
}

// Merge impact: tile burst, grid shake, screen flash, rays, shockwave rings and debris.
// `onImpact` fires on landing so the caller reveals the new tile then.
// Intensity grows mainly with `newTier`; `streak` only adds a little.
function playMeteorMerge(idx, onImpact, streak, newTier) {
  streak = streak || 0;
  const power = Math.min(0.4 + Math.min(newTier || 1, 10) * 0.19 + Math.min(streak, 5) * 0.02, 2.3);
  const cell = cellEls[idx];

  // Impact colors come from the tile gradient. Set on `cell` so an effect on another cell
  // never changes these colors mid-animation (screenFlash is on <body>, it gets its own copy).
  const tier = TIERS[Math.min(Math.max((newTier || 1) - 1, 0), TIERS.length - 1)];
  const mergeBright = hexRgbTriplet(tier.from);
  const mergeDark = hexRgbTriplet(tier.to);
  cell.style.setProperty("--mergeBright", mergeBright);
  cell.style.setProperty("--mergeDark", mergeDark);

  const glow = document.createElement("div");
  glow.className = "chargeGlow";
  cell.appendChild(glow);
  setTimeout(() => {
    // Measure before onImpact() mutates the DOM, to avoid a forced synchronous reflow.
    const rect = cell.getBoundingClientRect();

    glow.remove();
    onImpact();

    cell.classList.add("impactHero");
    setTimeout(() => cell.classList.remove("impactHero"), 520);

    restartAnim(dom.grid, "gridShake");
    dom.grid.style.setProperty("--shakePower", power.toFixed(2));
    setTimeout(() => dom.grid.classList.remove("gridShake"), 380);

    const flash = document.createElement("div");
    flash.className = "screenFlash";
    flash.style.setProperty("--fx", (rect.left + rect.width / 2) + "px");
    flash.style.setProperty("--fy", (rect.top + rect.height / 2) + "px");
    flash.style.setProperty("--fpower", power.toFixed(2));
    flash.style.setProperty("--mergeBright", mergeBright);
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 420);

    spawnBurstRays(cell, power);

    const localFlash = document.createElement("div");
    localFlash.className = "impactFlash";
    cell.appendChild(localFlash);
    setTimeout(() => localFlash.remove(), 260);

    // A second ring only during a streak: extra DOM work for a subtle effect.
    const ringDelays = streak > 0 ? [0, 90] : [0];
    ringDelays.forEach((delay) => {
      setTimeout(() => {
        const ring = document.createElement("div");
        ring.className = "impactRing";
        ring.style.setProperty("--ringPower", power.toFixed(2));
        cell.appendChild(ring);
        setTimeout(() => ring.remove(), 420);
      }, delay);
    });

    spawnImpactDebris(idx, streak, power);
  }, METEOR_FALL_MS);
}

// Separate thin rays rather than one conic-gradient (see .burstRay in style.css).
function spawnBurstRays(cell, power) {
  const RAY_COUNT = 6;
  for (let i = 0; i < RAY_COUNT; i++) {
    const ray = document.createElement("div");
    ray.className = "burstRay" + (i % 2 === 1 ? " short" : "");
    ray.style.setProperty("--ang", (i * (360 / RAY_COUNT)) + "deg");
    ray.style.setProperty("--burstPower", power.toFixed(2));
    cell.appendChild(ray);
    setTimeout(() => ray.remove(), 320);
  }
}

function spawnImpactDebris(idx, streak, power) {
  const cell = cellEls[idx];
  // Debris creates the most DOM nodes, so keep the count low for fast streaks.
  const count = 8 + Math.min(streak || 0, 4);
  for (let k = 0; k < count; k++) {
    const p = document.createElement("div");
    p.className = "debrisChip" + (k % 3 !== 1 ? " spark" : "");
    const angle = Math.random() * Math.PI * 2;
    const dist = (30 + Math.random() * 34) * power;
    p.style.setProperty("--dx", (Math.cos(angle) * dist) + "px");
    p.style.setProperty("--dy", (Math.sin(angle) * dist) + "px");
    p.style.setProperty("--rot", (Math.random() * 360 - 180) + "deg");
    p.style.setProperty("--chipScale", (0.7 + Math.random() * 0.8).toFixed(2));
    cell.appendChild(p);
    setTimeout(() => p.remove(), 560);
  }
}

function spawnFloatingBonus(idx, amount) {
  const cell = cellEls[idx];
  const el = document.createElement("div");
  el.className = "floatBonus";
  el.innerHTML = "+" + formatNumber(amount) + " " + currencyIconHtml("stardust");
  cell.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

// Caps identical toasts on screen, so spamming an action doesn't flood the screen.
const TOAST_SAME_MSG_LIMIT = 3;
function toast(msg) {
  const sameMsgCount = Array.from(dom.toastContainer.children).filter(t => t.textContent === msg).length;
  if (sameMsgCount >= TOAST_SAME_MSG_LIMIT) return;
  const el = document.createElement("div");
  el.className = "toast"; el.textContent = msg;
  dom.toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ---------------- Drawer & generic panel ----------------
function renderDrawerHead() {
  const state = Game.state;
  $("drawerLevel").textContent = `Niveau Cosmique ${state.lifetime.bigBangCount}`;
  $("drawerHeadLogo").textContent = state.profile.emoji;
  $("drawerHeadLogo").style.background = `radial-gradient(circle at 35% 30%, #fff, ${state.profile.color})`;
  $("drawerHeadTitle").textContent = state.profile.name;
  // Reward for finding all 4 secrets: animated ring around the avatar (pure CSS).
  $("drawerHeadLogo").classList.toggle("mythicFrame", state.easterEggs.unlockedIds.length >= EASTER_EGGS.length);
}
function openDrawer() {
  dom.drawerOverlay.classList.remove("hidden");
  renderDrawerHead();
  requestAnimationFrame(() => dom.drawerOverlay.classList.add("open"));
}

// ---------------- Profile editor modal ----------------
let profileDraft = null;
function openProfileModal() {
  profileDraft = { ...Game.state.profile };
  $("profileNameInput").value = profileDraft.name;

  const emojiPicker = $("profileEmojiPicker");
  emojiPicker.innerHTML = "";
  PROFILE_EMOJI_CHOICES.forEach(emoji => {
    const btn = el("button", "profileEmojiBtn" + (emoji === profileDraft.emoji ? " selected" : ""), emoji);
    btn.addEventListener("click", () => { profileDraft.emoji = emoji; openProfileModal.refresh(); });
    emojiPicker.appendChild(btn);
  });

  const colorPicker = $("profileColorPicker");
  colorPicker.innerHTML = "";
  PROFILE_COLOR_CHOICES.forEach(color => {
    const btn = el("button", "profileColorBtn" + (color === profileDraft.color ? " selected" : ""));
    btn.style.background = color;
    btn.addEventListener("click", () => { profileDraft.color = color; openProfileModal.refresh(); });
    colorPicker.appendChild(btn);
  });

  $("profileModal").classList.remove("hidden");
}
openProfileModal.refresh = function () {
  $$("#profileEmojiPicker .profileEmojiBtn").forEach((b, i) => b.classList.toggle("selected", PROFILE_EMOJI_CHOICES[i] === profileDraft.emoji));
  $$("#profileColorPicker .profileColorBtn").forEach((b, i) => b.classList.toggle("selected", PROFILE_COLOR_CHOICES[i] === profileDraft.color));
};
function closeProfileModal() { $("profileModal").classList.add("hidden"); }
function closeDrawer() {
  dom.drawerOverlay.classList.remove("open");
  setTimeout(() => dom.drawerOverlay.classList.add("hidden"), 300);
}

const PANEL_RENDERERS = {
  shop: { title: "Boutique", render: renderShopPanel },
  gods: { title: "Dieux du Cosmos", render: renderGodsPanel },
  skills: { title: `Ascension ${currencyIconHtml("energy")}`, render: renderSkillsPanel },
  runUpgrades: { title: `Alchimie Stellaire ${currencyIconHtml("stardust")}`, render: renderRunUpgradesPanel },
  quests: { title: "Quêtes quotidiennes", render: renderQuestsPanel },
  achievements: { title: "Succès", render: renderAchievementsPanel },
  progression: { title: "Progression", render: renderProgressionPanel },
  story: { title: "Histoire", render: renderStoryPanel },
  settings: { title: "Réglages", render: renderSettingsPanel },
};
let currentPanel = null;
function openPanel(name) {
  closeDrawer();
  const def = PANEL_RENDERERS[name];
  if (!def) return;
  currentPanel = name;
  dom.panelTitle.innerHTML = def.title; // some titles embed an inline icon
  def.render();
  dom.panelOverlay.classList.remove("hidden");
  // Gods panel has its own background (.panelOverlay.godsTheme).
  dom.panelOverlay.classList.toggle("godsTheme", name === "gods");
}
function refreshCurrentPanel() { if (currentPanel) PANEL_RENDERERS[currentPanel].render(); }
function closePanel() { dom.panelOverlay.classList.add("hidden"); currentPanel = null; }

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

// Shared by the shop's Ambiances/Sets d'icônes sections and the skin
// manager popup - a compact 2-per-row grid where the swatch carries the
// visual weight and the button stays a small pill instead of a full-width
// bar dwarfing a tiny preview.
function renderCosmeticGrid(list, equippedId, onAfterAction) {
  const state = Game.state;
  const grid = el("div", "cosmeticGrid");
  list.forEach(item => {
    const owned = isSkinOwned(state, item.id);
    const equipped = equippedId === item.id;
    const tile = el("div", "cosmeticTile" + (equipped ? " equipped" : ""));
    const swatch = el("div", "skinSwatch big");
    // Representative icon: tier 6 of the set, honoring the Emoji/Illustrated setting.
    const rep = item.tierSkin ? item.tierSkin[5] : TIERS[5];
    if (state.iconStyle !== "emoji" && rep.icon) swatch.innerHTML = `<img src="assets/tiles/${rep.icon}" alt="">`;
    else swatch.textContent = rep.emoji;
    const name = el("div", "cosmeticName", item.name);
    // Always render a status tag so every card has the same height.
    const status = equipped ? el("span", "tag equipped", "Équipé")
      : (owned ? el("span", "tag owned", "Possédé") : el("span", "tag", "Non possédé"));
    const btn = el("button", "btn" + (equipped ? "" : " primary"), equipped ? "Équipé" : (owned ? "Équiper" : `${item.cost} ${currencyIconHtml("gems")}`));
    btn.disabled = equipped || (!owned && state.gems < item.cost);
    const runAction = () => { onCosmeticAction(item.id, owned); if (onAfterAction) onAfterAction(); };
    // Only a Gems purchase needs confirmation, not equipping.
    btn.addEventListener("click", () => {
      if (owned) { runAction(); return; }
      openConfirmModal({
        title: item.name,
        text: `Débloquer ce set d'icônes — ${item.cost} ${currencyIconHtml("gems")}`,
        confirmLabel: "Acheter",
        onConfirm: runAction,
      });
    });
    // Preview a set on a mini grid before buying or equipping it.
    const previewBtn = el("button", "btn ghost cosmeticPreviewBtn", "👁 Aperçu");
    previewBtn.addEventListener("click", (e) => { e.stopPropagation(); openSkinPreviewModal(item.id); });
    tile.appendChild(swatch);
    tile.appendChild(name);
    tile.appendChild(status);
    tile.appendChild(btn);
    tile.appendChild(previewBtn);
    grid.appendChild(tile);
  });
  return grid;
}

// Pass daily Gems value vs buying the same Gems in the shop, from live IAP_CATALOG prices.
// Parses French prices like "0,99 $".
function parsePriceToNumber(priceStr) {
  const match = priceStr.replace(",", ".").match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}
function passGemsValueBadgeText() {
  const smallPack = IAP_CATALOG.find(p => p.id === "gems_small");
  const pass = IAP_CATALOG.find(p => p.id === "vip_monthly");
  if (!smallPack || !pass) return "";
  const perGem = parsePriceToNumber(smallPack.price) / smallPack.amount;
  const monthlyGemsValue = VIP_DAILY_GEMS * 30 * perGem;
  const passPrice = parsePriceToNumber(pass.price);
  if (!passPrice) return "";
  const percentMore = Math.round((monthlyGemsValue / passPrice - 1) * 100);
  return percentMore > 0 ? ` <span class="tag value">+${percentMore}% de valeur</span>` : "";
}

// ---------------- Shop panel ----------------
function renderShopPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  dom.panelBody.appendChild(el("h3", null, "Bonus vidéo"));
  const adGrid = el("div", "shopGrid2");
  const ac = state.autoClicker;
  const autoClickerActive = ac.activeUntil > Date.now();
  const autoClickerFree = !autoClickerActive && isAutoClickerFreeAvailable(state);
  const autoClickerPaid = !autoClickerActive && !autoClickerFree && Game.autoClickerPaid; // ad already watched, cell not picked yet (onAutoClickerClick, input.js)
  const autoClickerCard = el("div", "card compact");
  autoClickerCard.innerHTML = `<div class="rowBetween"><h3><img class="inlineCurrencyIcon" src="assets/ui/boost.png" alt=""> Clicker Automatique (10 min)</h3></div>
    <p class="desc">${autoClickerActive ? `Actif encore ${formatDuration(ac.activeUntil - Date.now())}` :
      (autoClickerFree ? "Ton clicker gratuit du jour t'attend. Choisis une case, il tapera dessus tout seul pendant 10 minutes." :
        (autoClickerPaid ? "Ta publicité est déjà regardée. Choisis une case pour lancer le clicker." : "Ton clicker gratuit du jour est déjà utilisé. Regarde une publicité pour le relancer."))}</p>`;
  const autoClickerBtn = el("button", "btn primary full", autoClickerActive ? "Actif" : (autoClickerFree || autoClickerPaid || adsRemoved(state) ? "Choisir ma case" : "Regarder une pub"));
  autoClickerBtn.disabled = autoClickerActive;
  autoClickerBtn.addEventListener("click", onAutoClickerClick);
  autoClickerCard.appendChild(autoClickerBtn);
  adGrid.appendChild(autoClickerCard);

  const gemsAdFree = isGemsAdFreeAvailable(state);
  const gemsAdOnCooldown = !gemsAdFree && Date.now() < state.cooldowns.gemsAdUntil;
  const gemsAdCard = el("div", "card compact");
  gemsAdCard.innerHTML = `<div class="rowBetween"><h3>${currencyIconHtml("gems")} Pub contre Gems (+${GEMS_AD_REWARD})</h3></div>
    <p class="desc">${gemsAdFree ? "Ton don gratuit du jour t'attend." :
      (gemsAdOnCooldown ? `Prochaine salve de publicités dans ${formatDuration(state.cooldowns.gemsAdUntil - Date.now())}.` : "Regarde une publicité pour en recevoir plus.")}</p>`;
  const gemsAdBtn = el("button", "btn primary full", gemsAdOnCooldown ? formatDuration(state.cooldowns.gemsAdUntil - Date.now()) : (gemsAdFree || adsRemoved(state) ? "Recevoir" : "Regarder une pub"));
  gemsAdBtn.disabled = gemsAdOnCooldown;
  gemsAdBtn.addEventListener("click", onWatchGemsAd);
  gemsAdCard.appendChild(gemsAdBtn);
  adGrid.appendChild(gemsAdCard);
  dom.panelBody.appendChild(adGrid);

  dom.panelBody.appendChild(el("h3", null, "Boutique Gems"));
  const gemGrid = el("div", "shopGrid2");
  SHOP_GEM_ITEMS.forEach(item => {
    const card = el("div", "card compact");
    card.innerHTML = `<div class="rowBetween"><h3>${item.name}</h3><span class="tag">${item.cost} ${currencyIconHtml("gems")}</span></div>
      <p class="desc">${item.desc}</p>`;
    const btn = el("button", "btn primary full", "Acheter");
    btn.disabled = state.gems < item.cost;
    btn.addEventListener("click", () => openConfirmModal({
      title: item.name,
      text: `${item.desc} — ${item.cost} ${currencyIconHtml("gems")}`,
      confirmLabel: "Acheter",
      onConfirm: () => onBuyGemItem(item.id),
    }));
    card.appendChild(btn);
    gemGrid.appendChild(card);
  });
  dom.panelBody.appendChild(gemGrid);

  dom.panelBody.appendChild(el("h3", null, `<img class="inlineCurrencyIcon" src="assets/ui/palette.png" alt=""> Sets d'icônes`));
  // The Emoji/Illustrated toggle lives in the skin manager, not the shop.
  dom.panelBody.appendChild(renderCosmeticGrid(EMOJI_SETS, state.equippedEmojiSet));

  dom.panelBody.appendChild(el("h3", null, "Offres Premium"));
  // Curated order: Pass (hero), remove ads, Stardust boost, then the rest in catalog order.
  const daysSinceFirst = daysBetween(state.firstPlayedDay, todayStr());
  const visibleProducts = IAP_CATALOG.filter(product => {
    if (product.startersOnly && daysSinceFirst > 2) return false;
    if (isOneTimeIapOwned(state, product.id)) return false;
    if (product.skinId && state.iap.ownedSkinPacks.includes(product.skinId)) return false;
    return true;
  });
  const byId = (id) => visibleProducts.find(p => p.id === id);
  const pass = byId("vip_monthly");
  const featuredIds = ["remove_ads", "stardust_boost"];
  const featured = featuredIds.map(byId).filter(Boolean);
  const featuredSet = new Set(featured.map(p => p.id));
  const plain = visibleProducts.filter(p => p.id !== "vip_monthly" && !featuredSet.has(p.id));

  const buyBtn = (product, cls) => {
    const label = product.type === "subscription" ? "S'abonner" : "Acheter";
    const btn = el("button", cls, label);
    btn.addEventListener("click", () => openConfirmModal({
      title: product.name,
      text: `${product.desc || ""} — ${product.price}`,
      confirmLabel: label,
      onConfirm: () => onBuyIAP(product.id),
    }));
    return btn;
  };

  // All cards share the premium look; only the Pass has the perks list and the ribbon.
  if (pass) {
    const hero = el("div", "card iapCard iapHero");
    hero.innerHTML = `<div class="iapHeroBadge">★ Meilleure offre</div>
      <div class="rowBetween"><h3><img class="inlineCurrencyIcon" src="assets/ui/supernova.png" alt=""> ${pass.name}</h3><span class="iapPrice">${pass.price}</span></div>
      <p class="iapHeroTagline">${pass.desc}</p>`;
    const perkList = el("ul", "iapPerkList");
    (pass.perks || []).forEach(p => {
      // Value badge only on the daily-Gems perk line specifically, not every line.
      const html = p.includes("Gems offertes chaque jour") ? p + passGemsValueBadgeText() : p;
      perkList.appendChild(el("li", null, html));
    });
    hero.appendChild(perkList);
    hero.appendChild(buyBtn(pass, "btn primary full"));
    dom.panelBody.appendChild(hero);
  }

  [...featured, ...plain].forEach(product => {
    const card = el("div", "card iapCard");
    card.innerHTML = `<div class="rowBetween"><h3>${product.name}</h3><span class="iapPrice">${product.price}</span></div>
      ${product.desc ? `<p class="desc">${product.desc}</p>` : ""}`;
    card.appendChild(buyBtn(product, "btn primary full"));
    dom.panelBody.appendChild(card);
  });
  // "Restore purchases" lives in Settings (renderSettingsPanel).
}

// ---------------- Skills panel ----------------
// Effect text for current/next level. Display copies of the real formulas in state.js
// and economy.js: keep them in sync. Returns null at level 0.
function skillEffectAtLevel(key, level) {
  if (level <= 0) return null;
  if (key === "prod") return `+${level * 3}% production de Stardust`;
  if (key === "swarm") return `+${level} case(s) de départ déverrouillée(s)`;
  if (key === "gravity") return `-${level * 5}% de cooldown de spawn auto`;
  if (key === "echo") return `+${level * 2}h de plafond hors-ligne`;
  if (key === "luck") return `+${level}% de chance de Gem bonus par fusion`;
  return null;
}

function renderSkillsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  dom.panelBody.appendChild(el("p", "desc", `Dépense ton Énergie Cosmique (${currencyIconHtml("energy")} ${formatNumber(state.cosmicEnergy)}) gagnée à chaque Big Bang dans des bonus permanents.`));
  const grid = el("div", "skillGrid");
  Object.keys(SKILL_TREE).forEach(key => {
    const branch = SKILL_TREE[key];
    const level = state.skills[key];
    const maxed = level >= branch.maxLevel;
    const cost = maxed ? null : skillCost(key, level + 1);
    const currentText = skillEffectAtLevel(key, level) || "Aucun bonus actif";
    const nextText = maxed ? null : skillEffectAtLevel(key, level + 1);
    const card = el("div", "card skillRow");
    card.innerHTML = `<div class="rowBetween"><h3>${branch.name}</h3><span class="skillLevel">Niv. ${level}/${branch.maxLevel}</span></div>
      <p class="desc">${branch.desc}</p>
      <div class="progressBar"><div class="fill" style="width:${(level / branch.maxLevel * 100).toFixed(1)}%"></div></div>
      <div class="skillEffects">
        <span class="effectCurrent">Actuel : ${currentText}</span>
        ${nextText ? `<span class="effectNext">Prochain : ${nextText}</span>` : ""}
      </div>`;
    const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} ${currencyIconHtml("energy")}`);
    btn.disabled = maxed || state.cosmicEnergy < cost;
    if (!maxed) btn.addEventListener("click", () => onBuySkill(key));
    card.appendChild(btn);
    grid.appendChild(card);
  });
  dom.panelBody.appendChild(grid);
}

// ---------------- Run upgrades panel ----------------
// Effect text for current/next level. Display copies of the real formulas in state.js
// and economy.js: keep them in sync. Returns null at level 0.
function runUpgradeEffectAtLevel(key, level) {
  if (level <= 0) return null;
  if (key === "catalyst") return `+${level * 4}% production de Stardust`;
  if (key === "resonance") return `+${level * 3}% de chance de case bonus`;
  if (key === "surge") return `+${level * 5}% d'Énergie Cosmique au Big Bang`;
  if (key === "cadence") return `-${level * 4}% de cooldown de spawn`;
  return null;
}

// Like renderSkillsPanel(), for RUN_UPGRADE_TREE (Stardust, reset every Big Bang).
function renderRunUpgradesPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  dom.panelBody.appendChild(el("p", "desc", `Transmute le Stardust (${currencyIconHtml("stardust")} ${formatNumber(state.stardust)}) de cette grille en bonus qui durent jusqu'au prochain Big Bang.`));
  const grid = el("div", "skillGrid");
  Object.keys(RUN_UPGRADE_TREE).forEach(key => {
    const branch = RUN_UPGRADE_TREE[key];
    const level = state.runUpgrades[key];
    const maxed = level >= branch.maxLevel;
    const cost = maxed ? null : runUpgradeCost(key, level + 1);
    const currentText = runUpgradeEffectAtLevel(key, level) || "Aucun bonus actif";
    const nextText = maxed ? null : runUpgradeEffectAtLevel(key, level + 1);
    const card = el("div", "card skillRow");
    card.innerHTML = `<div class="rowBetween"><h3>${branch.name}</h3><span class="skillLevel">Niv. ${level}/${branch.maxLevel}</span></div>
      <p class="desc">${branch.desc}</p>
      <div class="progressBar"><div class="fill" style="width:${(level / branch.maxLevel * 100).toFixed(1)}%"></div></div>
      <div class="skillEffects">
        <span class="effectCurrent">Actuel : ${currentText}</span>
        ${nextText ? `<span class="effectNext">Prochain : ${nextText}</span>` : ""}
      </div>`;
    const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} ${currencyIconHtml("stardust")}`);
    btn.disabled = maxed || state.stardust < cost;
    if (!maxed) btn.addEventListener("click", () => onBuyRunUpgrade(key));
    card.appendChild(btn);
    grid.appendChild(card);
  });
  dom.panelBody.appendChild(grid);
}

// ---------------- Quests panel ----------------
function renderQuestsPanel() {
  const state = Game.state;
  ensureDailyQuests(state);
  dom.panelBody.innerHTML = "";
  state.quests.active.forEach(q => {
    const template = QUEST_POOL.find(t => t.id === q.id);
    const card = el("div", "card");
    card.innerHTML = `<div class="rowBetween"><h3>${template.desc}</h3><span class="tag">${template.reward} ${currencyIconHtml("gems")}</span></div>
      <div class="progressBar"><div class="fill" style="width:${Math.min(100, q.progress / template.target * 100).toFixed(1)}%"></div></div>
      <p class="desc">${Math.min(q.progress, template.target)} / ${template.target}</p>`;
    const btn = el("button", "btn primary full", q.claimed ? "Réclamée" : (q.done ? "Réclamer" : "En cours"));
    btn.disabled = q.claimed || !q.done;
    btn.addEventListener("click", () => onClaimQuest(q.id));
    card.appendChild(btn);
    dom.panelBody.appendChild(card);
  });

  const bonusCard = el("div", "card");
  bonusCard.innerHTML = `<div class="rowBetween"><h3>${BONUS_AD_QUEST.desc} (bonus)</h3><span class="tag">${BONUS_AD_QUEST.reward} ${currencyIconHtml("gems")}</span></div>
    <p class="desc">Quête bonus optionnelle, disponible chaque jour.</p>`;
  const bonusBtn = el("button", "btn primary full",
    state.quests.bonusAd.claimed ? "Réclamée" : (state.quests.bonusAd.done || adsRemoved(state) ? "Réclamer" : "Regarder une pub"));
  bonusBtn.disabled = state.quests.bonusAd.claimed;
  bonusBtn.addEventListener("click", onBonusAdQuest);
  bonusCard.appendChild(bonusBtn);
  dom.panelBody.appendChild(bonusCard);
}

// ---------------- Achievements panel ----------------
function renderAchievementsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";
  ACHIEVEMENTS.forEach(a => {
    const unlocked = state.achievements.unlockedIds.includes(a.id);
    const value = achievementValue(state, a.cat);
    const card = el("div", "card achCard" + (unlocked ? "" : " locked"));
    card.innerHTML = `<div class="rowBetween">
        <div><span class="achBadge">${unlocked ? trophyIconHtml() : lockIconHtml()}</span> <strong>${a.name}</strong></div>
        <span class="tag">${a.reward} ${currencyIconHtml("gems")}</span>
      </div>
      <div class="progressBar"><div class="fill" style="width:${Math.min(100, value / a.target * 100).toFixed(1)}%"></div></div>
      <p class="desc">${Math.min(value, a.target)} / ${a.target}</p>`;
    dom.panelBody.appendChild(card);
  });
}

// ---------------- Settings panel ----------------
// ---------------- Story panel ----------------
function renderStoryPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  // Keep each <p class="desc"> on one source line: .card p.desc uses white-space: pre-line.
  const intro = el("div", "card storyCard");
  intro.innerHTML = `<img class="storyMark" src="assets/ui/bigbang.png" alt="">
    <h3>La Rupture</h3>
    <p class="desc">Autrefois, le Cosmos ne connaissait pas le chaos. Treize Dieux le façonnaient dans un ordre parfait. Puis, un jour, cet ordre s'est brisé. <strong>Personne ne sait pourquoi.</strong> Il n'en reste qu'une poussière infinie d'astéroïdes muets, dispersée dans le vide.</p>
    <p class="desc">Les Dieux, eux, n'ont pas disparu. Ils dorment, chacun caché dans un fragment parmi des milliards d'autres, attendant qu'on les retrouve.</p>`;
  dom.panelBody.appendChild(intro);

  dom.panelBody.appendChild(el("h3", null, "L'Étincelle, c'est toi"));
  const spark = el("div", "card storyCard");
  spark.innerHTML = `<p class="desc">Chaque fusion recompose un peu de l'ordre perdu. Météorite, Lune, Planète, Étoile... jusqu'à l'Univers. Mais un Univers reconstitué ne tient jamais longtemps : il finit par se replier sur lui-même. C'est le Big Bang : la fin d'un cycle, et le début du suivant, toujours un peu plus loin.</p>`;
  dom.panelBody.appendChild(spark);

  dom.panelBody.appendChild(el("h3", null, "Deux camps, un seul Cosmos"));
  const camps = el("div", "card storyCard");
  camps.innerHTML = `<p class="desc">Les Dieux que tu réveilles se souviennent tous de la Rupture, mais pas de la même façon. Les <strong style="color:#93c5fd;">bienveillants</strong> 🕊️ veulent restaurer l'ordre ancien. Les <strong style="color:#fca5a5;">déchus</strong> 🔥 ont pris goût au chaos et refusent d'y renoncer.</p>`;
  dom.panelBody.appendChild(camps);

  // Progressive lore: unlocked by real milestones, so there's always a next
  // piece of "why did the Rupture happen" to chase - see LORE_FRAGMENTS.
  const unlockedFrags = LORE_FRAGMENTS.filter(f => f.unlock(state));
  dom.panelBody.appendChild(el("h3", null, `Fragments de mémoire (${unlockedFrags.length}/${LORE_FRAGMENTS.length})`));
  LORE_FRAGMENTS.forEach(frag => {
    const unlocked = frag.unlock(state);
    const card = el("div", "card storyCard" + (unlocked ? "" : " locked"));
    card.innerHTML = unlocked
      ? `<h3>✨ ${frag.title}</h3><p class="desc">${frag.text}</p>`
      : `<h3>${lockIconHtml()} ???</h3><p class="desc">Fragment verrouillé. Continue ta progression pour le découvrir.</p>`;
    dom.panelBody.appendChild(card);
  });

  if (state.gods.currentGodId) {
    const god = getGod(state.gods.currentGodId);
    dom.panelBody.appendChild(el("h3", null, "Ton Dieu du moment"));
    const godCard = el("div", "card storyCard");
    godCard.innerHTML = `<h3>${godPortraitHtml(god, "godInlineIcon")} ${god.name}, ${god.title}</h3>
      <p class="desc">${god.lore}</p>`;
    dom.panelBody.appendChild(godCard);
  }
}

// ---------------- Gods panel ----------------
// Compact grid of tiles (was one tall card per god) - tap a tile to open
// openGodDetailModal below, which now carries everything the old card's
// footer used to (unlock/choose/upgrade actions), so nothing was lost, just
// moved behind a tap for a panel that fits far more on screen at once.
function renderGodsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  if (state.gods.currentGodId) {
    const current = getGod(state.gods.currentGodId);
    dom.panelBody.appendChild(el("p", "desc", `${current.name} t'accompagne pour cette partie.`));
  } else {
    dom.panelBody.appendChild(el("p", "desc", "Fusionne 4 Lunes en une partie pour éveiller ton premier Dieu."));
  }

  const grid = el("div", "godsGrid");
  GODS.forEach(god => {
    const unlocked = isGodUnlocked(state, god.id);
    const equipped = state.gods.currentGodId === god.id;
    const rarity = RARITY[god.rarity];
    const tile = el("button", "godTile" + (equipped ? " equipped" : "") + (unlocked ? "" : " locked"));
    tile.style.setProperty("--rarity-color", rarity.color);
    tile.innerHTML = `
      ${equipped ? '<span class="godTileBadge">✓</span>' : ""}
      <div class="godTileEmoji">${godPortraitHtml(god, "godTilePortrait", !unlocked)}</div>
      <div class="godTileName">${unlocked ? god.name : "???"}</div>
      <div class="godTileTitle">${unlocked ? god.title : rarity.label}</div>`;
    tile.addEventListener("click", () => openGodDetailModal(god.id));
    grid.appendChild(tile);
  });
  dom.panelBody.appendChild(grid);
}

// ---------------- Progression panel ----------------
function renderProgressionPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  const summary = el("div", "card progressCard");
  summary.innerHTML = `<h3>Ton voyage</h3>
    <p class="rowBetween"><span>Niveau Cosmique (Big Bang)</span><strong>${state.lifetime.bigBangCount}</strong></p>
    <p class="rowBetween"><span>Palier le plus élevé atteint</span><strong>${TIERS[state.lifetime.maxTierEver - 1].name} ${tierInlineIconHtml(state.lifetime.maxTierEver)}</strong></p>
    <p class="rowBetween"><span>Stardust généré à vie</span><strong>${formatNumber(state.lifetime.stardustEarned)}</strong></p>
    <p class="rowBetween"><span>Dieux éveillés</span><strong>${state.gods.unlockedIds.filter(id => id !== "ananke").length} / ${NORMAL_GODS_COUNT}</strong></p>`;
  dom.panelBody.appendChild(summary);

  dom.panelBody.appendChild(el("h3", null, "Ton parcours"));

  // Ordered by actual prerequisite structure, not by data declaration order.
  // Astréos (fusion count), Erebus (fusion streak), Hélios (reach tier 7) and
  // Nyx (20 cells in one run) don't require a Big Bang at all - reaching
  // tier 7 in particular happens *on the way* to tier 10, so it belongs
  // before "Atteindre l'Univers", not after "Premier Big Bang". Within that
  // group, ordered by rarity/typical difficulty (matches config.js's own
  // commun -> rare -> épique ladder): Astréos (commun, 180 lifetime fusions -
  // accumulates passively) before the two rares Hélios (tier 7, usually hit
  // on the way to a first Universe) and Nyx (20 cells unlocked in one run, a
  // deliberate Stardust sink) before Erebus (épique, a deliberate hidden
  // challenge most players won't stumble into by accident).
  const godById = (id) => GODS.find(g => g.id === id);
  const godStep = (id) => { const g = godById(id); return { emoji: godPortraitHtml(g, "inlineTierIcon"), done: isGodUnlocked(state, id), text: g.name, sub: g.unlock.label }; };
  const roadIcon = (src) => `<img class="inlineTierIcon" src="assets/ui/${src}" alt="">`;
  const steps = [];
  steps.push({ emoji: roadIcon("dieux.png"), done: !!state.gods.currentGodId, text: "Éveiller ton premier Dieu" });
  steps.push(godStep("astreos"));
  steps.push(godStep("helios"));
  steps.push(godStep("nyx"));
  steps.push(godStep("erebus"));
  // UNIVERSE_TIER, not TIERS.length: this step is about reaching Univers.
  steps.push({ emoji: tierInlineIconHtml(UNIVERSE_TIER), done: state.lifetime.maxTierEver >= UNIVERSE_TIER, text: "Atteindre l'Univers" });
  steps.push({ emoji: roadIcon("bigbang.png"), done: state.lifetime.bigBangCount >= 1, text: "Premier Big Bang" });
  steps.push(godStep("thanatos"));
  steps.push(godStep("chronos"));
  steps.push({ emoji: roadIcon("succes.png"), done: state.achievements.unlockedIds.length >= ACHIEVEMENTS.length,
    text: "Tous les succès", sub: `${state.achievements.unlockedIds.length}/${ACHIEVEMENTS.length}` });

  const nextIdx = steps.findIndex(s => !s.done);
  const roadmap = el("div", "roadmap");
  steps.forEach((s, i) => {
    const state2 = s.done ? "done" : (i === nextIdx ? "next" : "locked");
    const node = el("div", "roadNode " + state2);
    node.innerHTML = `<div class="roadIcon"><span class="roadIconGlyph">${s.done ? "✓" : s.emoji}</span></div>
      <div class="roadText"><div class="roadLabel">${s.text}</div>${s.sub ? `<div class="roadSub">${s.sub}</div>` : ""}</div>`;
    roadmap.appendChild(node);
  });
  dom.panelBody.appendChild(roadmap);
}

// ---------------- God ritual & selection actions ----------------
// The ritual grants two gods, a benevolent and a fallen one. Cards are tinted by alignment.
function openGodPickerModal() {
  const state = Game.state;
  const list = $("godRitualList");
  list.innerHTML = "";
  const available = GODS.filter(g => isGodUnlocked(state, g.id));
  available.forEach(god => {
    const card = el("button", "godRitualCard " + god.alignment);
    card.innerHTML = `<div class="godEmoji">${godPortraitHtml(god, "godRitualPortrait")}</div>
      <div class="godName">${god.name}</div>
      <div class="godTitle">${god.title}</div>
      <p class="godDesc">${god.desc}</p>`;
    // Confirm first: a misclick would lock in the wrong first god.
    card.addEventListener("click", () => openConfirmModal({
      title: `Choisir ${god.name} ?`,
      text: `${god.title} — ${god.desc}`,
      confirmLabel: "Confirmer",
      onConfirm: () => {
        chooseGod(state, god.id);
        Sfx.purchase();
        toast(`${god.name} t'accompagne désormais !`);
        $("godRitualModal").classList.add("hidden");
        saveState(state);
        renderAll();
        maybeOpenGodRevealModal(); // shows reveals queued while the ritual was open
      },
    }));
    list.appendChild(card);
  });
  $("godRitualModal").classList.remove("hidden");
}

function openGodDetailModal(godId) {
  const state = Game.state;
  const god = getGod(godId);
  const rarity = RARITY[god.rarity];
  const unlocked = isGodUnlocked(state, god.id);
  const equipped = state.gods.currentGodId === god.id;
  const level = state.gods.powerLevel[god.id] || 0;
  const card = $("godDetailCard");
  card.innerHTML = `
    <div class="godTop">
      <div class="godEmoji godDetailEmoji">${godPortraitHtml(god, "godDetailPortrait", !unlocked)}</div>
      <div class="godNames">
        <div class="godName" style="font-size:18px;">${unlocked ? god.name : "???"}</div>
        <div class="godTitle">${unlocked ? god.title : "Non éveillé"}</div>
      </div>
      <div class="godTagsCol">
        <span class="alignTag">${god.alignment === "bienveillant" ? "🕊️ Bienveillant" : "🔥 Déchu"}</span>
        <span class="rarityTag" style="background:${rarity.color}22;color:${rarity.color};">${rarity.label}</span>
        ${equipped ? '<span class="equippedTag">En jeu</span>' : ""}
      </div>
    </div>
    ${unlocked ? `<p class="godDesc" style="font-style:italic;">${god.lore}</p>
      <p class="godDesc"><strong>Pouvoir actuel (niveau ${level}/${GOD_POWER_MAX_LEVEL}) :</strong> ${describeGodEffect(god, level)}</p>`
      : `<p class="godDesc">Débloque ce Dieu pour découvrir son pouvoir et son histoire.</p>`}
  `;

  if (!unlocked) {
    const info = el("div", "godUnlockInfo");
    if (god.unlock.type === "milestone") info.innerHTML = lockIconHtml() + " " + god.unlock.label;
    else if (god.unlock.type === "challenge") {
      const progress = god.unlock.challengeId === "erebus" ? state.gods.erebusStreak : 0;
      info.textContent = `⚔️ ${god.unlock.label}` + (god.unlock.challengeId === "erebus" ? ` (${Math.min(progress, god.unlock.target)}/${god.unlock.target})` : "");
    } else if (god.unlock.type === "shop") {
      info.innerHTML = `${lockIconHtml()} Boutique : ${god.unlock.cost} ${currencyIconHtml("gems")} ${god.unlock.altLabel ? "(" + god.unlock.altLabel + ")" : ""}`;
    } else if (god.unlock.type === "box") {
      info.innerHTML = `${lockIconHtml()} Uniquement via la Boîte Cosmique (Boutique) - pas d'autre moyen de l'éveiller`;
    } else if (god.unlock.type === "secret") {
      // Hint at the Secrets challenge without giving its conditions.
      info.innerHTML = `${lockIconHtml()} Elle ne répond à aucun rituel connu. Quatre échos discrets sommeillent dans ton Cosmos - trouve-les tous pour qu'elle se révèle.`;
    } else {
      // "ritual": Séléna and Zéphar.
      info.innerHTML = `${lockIconHtml()} Éveille ton premier Dieu via le rituel des lunes.`;
    }
    card.appendChild(info);
    if (god.unlock.type === "shop") {
      const btn = el("button", "btn primary full", `Débloquer — ${god.unlock.cost} ${currencyIconHtml("gems")}`);
      btn.style.marginTop = "8px";
      btn.disabled = state.gems < god.unlock.cost;
      btn.addEventListener("click", () => { onBuyGod(god.id); openGodDetailModal(god.id); });
      card.appendChild(btn);
    }
  } else if (!equipped) {
    const btn = el("button", "btn full", "Choisir ce Dieu");
    btn.style.marginTop = "8px";
    btn.addEventListener("click", () => { onChooseGod(god.id); openGodDetailModal(god.id); });
    card.appendChild(btn);
  }

  if (unlocked) {
    const maxed = level >= GOD_POWER_MAX_LEVEL;
    const cost = maxed ? null : godPowerCost(level + 1);
    const power = el("div", "godPower");
    power.innerHTML = `<div class="rowBetween"><span class="godPowerLabel">Niveau de pouvoir</span><span class="skillLevel">${level}/${GOD_POWER_MAX_LEVEL}</span></div>
      <div class="progressBar"><div class="fill" style="width:${(level / GOD_POWER_MAX_LEVEL * 100).toFixed(1)}%"></div></div>`;
    const btn = el("button", "btn primary full", maxed ? "Niveau maximum" : `Améliorer — ${cost} ${currencyIconHtml("gems")}`);
    btn.style.marginTop = "6px";
    btn.disabled = maxed || state.gems < cost;
    if (!maxed) btn.addEventListener("click", () => { onBuyGodPower(god.id); openGodDetailModal(god.id); });
    power.appendChild(btn);
    card.appendChild(power);
  }

  const closeBtn = el("button", "btn ghost full", "Fermer");
  closeBtn.style.marginTop = "10px";
  closeBtn.addEventListener("click", () => $("godDetailModal").classList.add("hidden"));
  card.appendChild(closeBtn);
  $("godDetailModal").classList.remove("hidden");
}

// Unlock modal for a new god. Open it through maybeOpenGodRevealModal() (input.js),
// which drains Game.pendingGodReveals.
let godUnlockModalGodId = null;
function openGodUnlockModal(godId) {
  godUnlockModalGodId = godId;
  const god = getGod(godId);
  const rarity = RARITY[god.rarity];
  const portrait = $("godUnlockPortrait");
  portrait.innerHTML = godPortraitHtml(god, "godDetailPortrait");
  portrait.style.background = `radial-gradient(circle at 35% 30%, #2a2452, ${rarity.color}22)`;
  $("godUnlockTitle").textContent = `✨ Nouveau Dieu éveillé : ${god.name} !`;
  const power = describeGodEffect(god, 0);
  $("godUnlockText").textContent = `${rarity.label}, ${god.title}.` + (power ? ` ${power}.` : "");
  Sfx.chest();
  $("godUnlockModal").classList.remove("hidden");
}
// Every way of closing ends here so the reveal queue is drained in one place.
function closeGodUnlockModal() {
  godUnlockModalGodId = null;
  $("godUnlockModal").classList.add("hidden");
  maybeOpenGodRevealModal(); // next queued reveal, if any
}

// ---------------- VIP daily Gems (Pass Supernova) ----------------
function openVipGemsModal(amount) {
  $("vipGemsText").textContent = `Tu as reçu ${amount} Gems grâce à ton Pass Supernova ! Reviens chaque jour pour ne jamais en manquer un.`;
  $("vipGemsModal").classList.remove("hidden");
}
function closeVipGemsModal() { $("vipGemsModal").classList.add("hidden"); }

// ---------------- Auto-clicker intro (first-time guide) ----------------
function openAutoClickerIntroModal() {
  const state = Game.state;
  // Marked as shown on open: a backdrop close skips the buttons.
  state.autoClicker.tutorialShown = true;
  saveState(state);
  $("autoClickerIntroModal").classList.remove("hidden");
}

function renderSettingsPanel() {
  const state = Game.state;
  dom.panelBody.innerHTML = "";

  [["sound", "Son"], ["music", "Musique"], ["notifications", "Notifications"]].forEach(([key, label]) => {
    const row = el("div", "settingsRow");
    row.innerHTML = `<span>${label}</span>`;
    const sw = el("div", "switch" + (state.settings[key] ? " on" : ""), '<div class="knob"></div>');
    sw.addEventListener("click", () => {
      state.settings[key] = !state.settings[key];
      Game.settings = state.settings;
      if (key === "music") MusicService.setEnabled(state.settings.music);
      saveState(state);
      renderSettingsPanel();
    });
    row.appendChild(sw);
    dom.panelBody.appendChild(row);
  });

  const restoreBtn = el("button", "btn full", "Restaurer mes achats");
  restoreBtn.addEventListener("click", onRestorePurchases);
  dom.panelBody.appendChild(restoreBtn);

  const backupCard = el("div", "card");
  backupCard.innerHTML = `<h3>Sauvegarde manuelle</h3>
    <p class="desc">Utile si la sauvegarde automatique ne tient pas sur cet appareil : copie un code de ta progression avant de fermer, colle-le pour la restaurer.</p>`;
  const exportBtn = el("button", "btn full", "📤 Exporter ma sauvegarde");
  exportBtn.style.marginBottom = "8px";
  exportBtn.addEventListener("click", () => openSaveCodeModal("export"));
  const importBtn = el("button", "btn ghost full", "📥 Importer une sauvegarde");
  importBtn.addEventListener("click", () => openSaveCodeModal("import"));
  backupCard.appendChild(exportBtn);
  backupCard.appendChild(importBtn);
  dom.panelBody.appendChild(backupCard);

  const restartCard = el("div", "card");
  restartCard.innerHTML = `<h3>Recommencer</h3>
    <p class="desc">Repars de zéro sur cette partie sans attendre l'Univers. L'Énergie Cosmique, les Gems, l'Ascension, les Dieux et les succès restent acquis.</p>`;
  const restartBtn = el("button", "btn danger full", "🔄 Recommencer la partie");
  restartBtn.addEventListener("click", openRestartModal);
  restartCard.appendChild(restartBtn);
  dom.panelBody.appendChild(restartCard);

  const status = el("p", "desc", state.iap.removeAds || isVipActive(state) ?
    "✅ Publicités désactivées sur cet appareil." : "Les publicités sont actives (retirables dans la Boutique).");
  dom.panelBody.appendChild(status);

  const priv = el("a", "btn ghost full", "Politique de confidentialité");
  priv.href = "privacy.html"; priv.target = "_blank"; priv.style.textDecoration = "none"; priv.style.justifyContent = "center";
  dom.panelBody.appendChild(priv);

  const support = el("a", "btn ghost full", "Contacter le support");
  support.href = "mailto:support@cosmerge.example"; support.style.textDecoration = "none"; support.style.justifyContent = "center";
  dom.panelBody.appendChild(support);

  dom.panelBody.appendChild(el("p", "desc", "Godspark — v1.0.0 (prototype)"));
}

// ---------------- Tutorial ----------------
// Step text is HTML so tier icons can be inlined.
const TUT_STEPS = [
  { title: "Invoquer", text: () => `Appuie sur « Invoquer » pour faire apparaître un Météorite ${tierInlineIconHtml(1)} sur une case vide de la grille.`, target: () => dom.invokeBtnStardust },
  { title: "Fusionner", text: () => `Glisse un astéroïde sur une case adjacente identique pour les fusionner en une Lune ${tierInlineIconHtml(2)}.`, target: () => cellEls[8] },
  // No target: highlighting the whole grid looked like a stray rectangle.
  { title: "Progresser", text: () => `Continue à fusionner pour atteindre Planète ${tierInlineIconHtml(4)}, Étoile ${tierInlineIconHtml(6)}, Trou noir ${tierInlineIconHtml(8)}... jusqu'à l'Univers ${tierInlineIconHtml(10)}, puis déclenche un Big Bang pour recommencer plus fort !`, target: () => null },
];
let tutIndex = 0;
let currentHighlight = null;
function showTutStep(i) {
  if (currentHighlight) currentHighlight.classList.remove("tutorial-highlight");
  const step = TUT_STEPS[i];
  $("tutStep").textContent = `Étape ${i + 1} / ${TUT_STEPS.length}`;
  $("tutTitle").textContent = step.title;
  $("tutText").innerHTML = step.text();
  $("tutNext").textContent = (i === TUT_STEPS.length - 1) ? "C'est parti !" : "Suivant";
  currentHighlight = step.target();
  if (currentHighlight) currentHighlight.classList.add("tutorial-highlight");
}
function endTutorial() {
  if (currentHighlight) currentHighlight.classList.remove("tutorial-highlight");
  $("tutOverlay").classList.add("hidden");
  Game.state.tutorialSeen = true;
  saveState(Game.state);
}

// ---------------- Offline modal ----------------
// A second absence can arrive while a gain is still uncollected, e.g. when the ad from
// "Doubler (pub)" returns focus. Add to the pending gain, never replace it.
function openOfflineModal(gainInfo, spawnedCount) {
  const pending = Game.pendingOfflineGain;
  if (pending && !$("offlineModal").classList.contains("hidden")) {
    gainInfo = {
      elapsedMs: pending.elapsedMs + gainInfo.elapsedMs,
      cappedMs: pending.cappedMs + gainInfo.cappedMs,
      gain: pending.gain + gainInfo.gain,
      wasCapped: pending.wasCapped || gainInfo.wasCapped,
    };
    spawnedCount += pending.spawnedCount || 0;
  }
  gainInfo.spawnedCount = spawnedCount;
  Game.pendingOfflineGain = gainInfo;
  const capNote = gainInfo.wasCapped ? ` (plafonné à ${offlineCapHours(Game.state)}h)` : "";
  const spawnNote = spawnedCount > 0 ? `\n${spawnedCount} case(s) remplie(s) automatiquement` : "";
  $("offlineText").textContent = `Temps écoulé : ${formatOfflineDuration(gainInfo.cappedMs)}${capNote}\n+${formatNumber(gainInfo.gain)} Stardust${spawnNote}`;
  $("offlineDouble").textContent = adsRemoved(Game.state) ? "Doubler" : "Doubler (pub)";
  $("offlineModal").classList.remove("hidden");
}

// ---------------- Daily login modal ----------------
function openDailyModal() {
  const state = Game.state;
  const freezeNote = state.dailyLogin.streakFreezeCharges > 0
    ? ` — ❄️ ${state.dailyLogin.streakFreezeCharges} gel(s) de série en réserve` : "";
  $("dailyStreakLine").innerHTML = `<img class="inlineCurrencyIcon" src="assets/ui/flamme.png" alt=""> Série actuelle : ${state.dailyLogin.streak} jour(s)${freezeNote}`;
  const grid = $("dailyGrid");
  grid.innerHTML = "";
  DAILY_REWARDS.forEach(r => {
    const claimedAlready = r.day < state.dailyLogin.cycleDay || (r.day === state.dailyLogin.cycleDay && !isDailyLoginAvailable(state));
    const isToday = r.day === state.dailyLogin.cycleDay;
    const cellDiv = el("div", "dayCell" + (claimedAlready ? " claimed" : "") + (isToday ? " today" : ""));
    cellDiv.innerHTML = `<div class="dNum">Jour ${r.day}</div><div>${withCurrencyIcons(r.label)}</div>`;
    grid.appendChild(cellDiv);
  });
  $("dailyClaim").disabled = !isDailyLoginAvailable(state);
  $("dailyModal").classList.remove("hidden");
}
function closeDailyModal() { $("dailyModal").classList.add("hidden"); }

// ---------------- Wheel modal ----------------
function openWheelModal() {
  ensureDailySpin(Game.state);
  $("wheelResult").textContent = "";
  $("wheelEl").style.transform = "rotate(0deg)";
  wheelRotation = 0; // keep input.js's spin total in sync
  refreshWheelButtons();
  $("wheelModal").classList.remove("hidden");
}
function refreshWheelButtons() {
  const s = Game.state.dailySpin;
  $("wheelSpinFree").disabled = s.freeUsed;
  $("wheelSpinAd").disabled = s.bonusUsed;
  $("wheelSpinAd").textContent = adsRemoved(Game.state) ? "Spin bonus" : "Spin bonus (pub)";
}
function closeWheelModal() { $("wheelModal").classList.add("hidden"); }

// ---------------- Big Bang modal ----------------
function openBigBangModal() {
  const gain = previewBigBangGain(Game.state);
  $("bigBangText").innerHTML = `Tu vas gagner ${gain} ${currencyIconHtml("energy")} Énergie Cosmique.`;
  $("bigBangModal").classList.remove("hidden");
}
function closeBigBangModal() { $("bigBangModal").classList.add("hidden"); }

// ---------------- Big Bang summary (shown right after confirming) ----------------
// A toast alone flashed and vanished, with nothing recapping what the run was
// actually worth or pointing at what's next - this replaces it with a real
// screen: run recap + the single nearest god milestone as a concrete "why
// keep playing" hook (see gods.js nextGodMilestoneHint).
function openBigBangSummaryModal({ stardustEarned, maxTier, gain }) {
  const state = Game.state;
  $("bbSummaryStardust").textContent = formatNumber(stardustEarned);
  $("bbSummaryTier").innerHTML = `${TIERS[maxTier - 1].name} ${tierInlineIconHtml(maxTier)}`;
  $("bbSummaryEnergy").innerHTML = `+${formatNumber(gain)} ${currencyIconHtml("energy")}`;
  // innerHTML: the hint contains a portrait <img>.
  $("bbSummaryHint").innerHTML = nextGodMilestoneHint(state)
    || "Tous les Dieux à objectif direct sont éveillés - tente ta chance à la Boîte Cosmique (Boutique) pour les derniers !";
  $("bigBangSummaryModal").classList.remove("hidden");
}
function closeBigBangSummaryModal() { $("bigBangSummaryModal").classList.add("hidden"); }

function openRestartModal() { $("restartModal").classList.remove("hidden"); }
function closeRestartModal() { $("restartModal").classList.add("hidden"); }

// ---------------- Generic purchase/action confirmation ----------------
// Confirmation before any spend.
let pendingConfirmAction = null;
let pendingConfirmDontAskKey = null;
// `dontAskKey` (optional): shows a "don't ask again" checkbox that sets
// state.dontAskAgain[dontAskKey]. The caller checks that flag and skips the modal.
function openConfirmModal({ title, text, confirmLabel, onConfirm, dontAskKey }) {
  $("confirmActionTitle").textContent = title;
  $("confirmActionText").innerHTML = text; // may contain an inline currency icon
  $("confirmActionConfirm").textContent = confirmLabel || "Confirmer";
  pendingConfirmAction = onConfirm;
  pendingConfirmDontAskKey = dontAskKey || null;
  $("confirmActionDontAsk").checked = false;
  $("confirmActionDontAskRow").classList.toggle("hidden", !dontAskKey);
  $("confirmActionModal").classList.remove("hidden");
}
function closeConfirmModal() { $("confirmActionModal").classList.add("hidden"); pendingConfirmAction = null; pendingConfirmDontAskKey = null; }
function onConfirmActionConfirm() {
  const action = pendingConfirmAction;
  if (pendingConfirmDontAskKey && $("confirmActionDontAsk").checked) {
    Game.state.dontAskAgain[pendingConfirmDontAskKey] = true;
    saveState(Game.state);
  }
  closeConfirmModal();
  if (action) action();
}

// ---------------- Stardust info popup (tapping the Stardust pill) ----------------
function openStardustInfoModal() {
  const state = Game.state;
  ensureDailyStats(state);
  $("stardustInfoRate").textContent = "+" + formatNumber(totalProduction(state)) + "/s";
  const runElapsedMs = Date.now() - state.runStartedAt;
  $("stardustInfoRunTime").textContent = formatDuration(runElapsedMs);
  $("stardustInfoToday").textContent = "+" + formatNumber(state.lifetime.stardustEarned - state.dailyStats.stardustAtDayStart);
  // The no-record text wraps, so that row switches to a stacked layout.
  const noRecord = state.lifetime.bestBigBangMs === null;
  $("stardustInfoBest").textContent = noRecord
    ? "Termine ton premier Big Bang pour établir un record !"
    : formatDuration(state.lifetime.bestBigBangMs);
  $("stardustInfoBestRow").classList.toggle("stack", noRecord);
  $("stardustInfoModal").classList.remove("hidden");
}
function closeStardustInfoModal() { $("stardustInfoModal").classList.add("hidden"); }

// ---------------- Purchase confirmation (every IAP) ----------------
// A toast alone was easy to miss, especially for VIP where the actual
// effect (double production, no ads, all skins) isn't dramatic-looking on
// its own - state.js's isVipActive()/productionMultiplier()/isSkinOwned()
// already read state.iap.vipUntil live the instant it's set in onBuyIAP,
// this modal just makes that unmistakable instead of easy to doubt.
function openPurchaseConfirmModal(product) {
  // No icon prefix: the animated checkmark above the title already shows it.
  $("purchaseConfirmTitle").textContent = product.name;
  $("purchaseConfirmText").textContent = product.id === "vip_monthly"
    ? `Le Pass Supernova est actif dès maintenant : +100% de production, plus aucune pub, tous les skins débloqués, et tes ${VIP_DAILY_GEMS} Gems quotidiennes dès demain.`
    : `Achat confirmé - ${product.desc || "profite-en !"}`;
  $("purchaseConfirmModal").classList.remove("hidden");
}
function closePurchaseConfirmModal() { $("purchaseConfirmModal").classList.add("hidden"); }

// ---------------- Cosmic Box reveal ----------------
// Buying a Cosmic Box used to just show a toast - easy to miss, and gave the
// Gems spent no sense of occasion. This spins briefly then reveals the god
// (or, for a duplicate, the Gems it converted into) with its own beat.
function openCosmicBoxRevealModal(box) {
  const anim = $("cosmicBoxAnim");
  $("cosmicBoxTitle").textContent = "Ouverture...";
  $("cosmicBoxText").textContent = "";
  anim.className = "cosmicBoxAnim spinning";
  anim.textContent = "📦";
  anim.style.removeProperty("--rarity-color");
  $("cosmicBoxClose").classList.add("hidden");
  $("cosmicBoxModal").classList.remove("hidden");
  setTimeout(() => {
    anim.className = "cosmicBoxAnim revealed";
    // Every god owned: the box gave Gems instead.
    if (box.allGodsOwned) {
      anim.style.setProperty("--rarity-color", "#38bdf8");
      // Large emoji: the frame is sized for a portrait, not an inline icon.
      anim.textContent = "💎";
      $("cosmicBoxTitle").textContent = "✨ Panthéon complet !";
      $("cosmicBoxText").innerHTML = `Tous les Dieux sont déjà à toi - +${box.gems} ${currencyIconHtml("gems")}`;
    } else {
      const rarity = RARITY[box.god.rarity];
      anim.style.setProperty("--rarity-color", rarity.color);
      anim.innerHTML = godPortraitHtml(box.god, "cosmicBoxPortrait");
      $("cosmicBoxTitle").textContent = `✨ Nouveau Dieu : ${box.god.name} !`;
      $("cosmicBoxText").textContent = `${rarity.label} - ${box.god.title}`;
    }
    Sfx.chest();
    $("cosmicBoxClose").classList.remove("hidden");
  }, 900);
}
function closeCosmicBoxModal() { $("cosmicBoxModal").classList.add("hidden"); }

// ---------------- Secret 4-egg challenge ----------------
// See EASTER_EGGS (config.js) and unlockEasterEgg() (gods.js).

// Pips (●/○) for found/locked eggs. `justUnlockedId` animates one pip.
function renderEggPips(state, justUnlockedId) {
  const row = el("div", "eggPipsRow");
  EASTER_EGGS.forEach(egg => {
    const unlocked = state.easterEggs.unlockedIds.includes(egg.id);
    const pip = el("span", "eggPip" + (unlocked ? " filled" : "") + (egg.id === justUnlockedId ? " justFilled" : ""), unlocked ? "●" : "○");
    row.appendChild(pip);
  });
  return row;
}

// Takes unlockEasterEgg()'s result. The last egg opens the finale instead of the small reveal.
function revealEasterEgg(result) {
  if (!result) return;
  if (result.complete) { openEggFinaleModal(); return; }
  openEggFoundModal(result.egg);
}

function openEggFoundModal(egg) {
  const state = Game.state;
  $("eggFoundTitle").textContent = `Secret découvert : ${egg.name}`;
  $("eggFoundText").textContent = egg.revealText;
  const pipsHost = $("eggFoundPips");
  pipsHost.innerHTML = "";
  pipsHost.appendChild(renderEggPips(state, egg.id));
  Sfx.chest();
  $("eggFoundModal").classList.remove("hidden");
}
function closeEggFoundModal() { $("eggFoundModal").classList.add("hidden"); }

// ---------------- Secrets counter (fabSecrets) ----------------
function renderSecretsModal() {
  const state = Game.state;
  const list = $("secretsList");
  list.innerHTML = "";
  list.appendChild(renderEggPips(state));
  EASTER_EGGS.forEach(egg => {
    const unlocked = state.easterEggs.unlockedIds.includes(egg.id);
    const card = el("div", "card storyCard" + (unlocked ? "" : " locked"));
    card.innerHTML = unlocked
      ? `<h3>✨ ${egg.name}</h3><p class="desc">${egg.revealText}</p>`
      : `<h3>${lockIconHtml()} ???</h3><p class="desc">${egg.hint}</p>`;
    list.appendChild(card);
  });
  if (state.easterEggs.unlockedIds.length >= EASTER_EGGS.length) {
    list.appendChild(el("p", "desc", "Les quatre secrets sont réunis. Ananké a répondu."));
  }
}
function openSecretsModal() {
  renderSecretsModal();
  $("secretsModal").classList.remove("hidden");
}
function closeSecretsModal() { $("secretsModal").classList.add("hidden"); }

// ---------------- Grand finale (all 4 eggs found) ----------------
// Biggest animation in the game, shown once: rays, falling sparkles, shake, portrait reveal.
function openEggFinaleModal() {
  const god = getGod("ananke");
  $("eggFinalePortrait").innerHTML = godPortraitHtml(god, "eggFinalePortraitImg");
  $("eggFinaleGodName").textContent = god.name;
  $("eggFinaleGodTitle").textContent = god.title;
  $("eggFinaleDesc").textContent = `${god.desc}. Un cadre unique orne désormais ton profil - la marque de celles et ceux qui ont trouvé les quatre secrets.`;
  $("eggFinaleClose").classList.add("hidden");
  const stage = $("eggFinaleStage");
  stage.classList.remove("revealed");
  const burstHost = $("eggFinaleBurst"), sparkleHost = $("eggFinaleSparkles");
  burstHost.innerHTML = "";
  sparkleHost.innerHTML = "";
  $("eggFinaleModal").classList.remove("hidden");

  const RAY_COUNT = 14;
  for (let i = 0; i < RAY_COUNT; i++) {
    const ray = el("div", "eggFinaleRay" + (i % 2 === 1 ? " short" : ""));
    ray.style.setProperty("--ang", (i * (360 / RAY_COUNT)) + "deg");
    burstHost.appendChild(ray);
  }
  const SPARKLE_COUNT = 26;
  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const s = el("div", "eggFinaleSparkle");
    s.style.left = (Math.random() * 100) + "%";
    s.style.setProperty("--fallDur", (2.2 + Math.random() * 1.8).toFixed(2) + "s");
    s.style.setProperty("--fallDelay", (Math.random() * 1.2).toFixed(2) + "s");
    s.style.setProperty("--drift", ((Math.random() - 0.5) * 60).toFixed(0) + "px");
    sparkleHost.appendChild(s);
  }

  document.body.classList.add("eggFinaleShake");
  setTimeout(() => document.body.classList.remove("eggFinaleShake"), 600);
  Sfx.bigBang();
  setTimeout(() => Sfx.chest(), 700);
  setTimeout(() => {
    stage.classList.add("revealed");
    $("eggFinaleClose").classList.remove("hidden");
  }, 1400);
}
function closeEggFinaleModal() {
  $("eggFinaleModal").classList.add("hidden");
  $("eggFinaleBurst").innerHTML = "";
  $("eggFinaleSparkles").innerHTML = "";
}

// ---------------- Skin manager (home screen, tap outside to close) ----------------
function openSkinManagerModal() {
  const state = Game.state;
  const list = $("skinManagerList");
  list.innerHTML = "";
  // No palette icon: the modal title already has it.
  list.appendChild(el("h3", null, "Set d'icônes"));
  list.appendChild(renderIconStyleToggle(openSkinManagerModal));
  list.appendChild(renderCosmeticGrid(EMOJI_SETS, state.equippedEmojiSet, openSkinManagerModal));
  $("skinManagerModal").classList.remove("hidden");
}
function closeSkinManagerModal() { $("skinManagerModal").classList.add("hidden"); }

// ---------------- Gems quick menu (tapping the Gems pill) ----------------
function openGemsMenuModal() { $("gemsMenuModal").classList.remove("hidden"); }
function closeGemsMenuModal() { $("gemsMenuModal").classList.add("hidden"); }

// ---------------- Remove-ads soft prompt (shown once, after the 5th rewarded ad) ----------------
function openRemoveAdsPromptModal() {
  const product = IAP_CATALOG.find(p => p.id === "remove_ads");
  $("removeAdsPromptBuy").textContent = `${product.name} — ${product.price}`;
  $("removeAdsPromptModal").classList.remove("hidden");
}
function closeRemoveAdsPromptModal() { $("removeAdsPromptModal").classList.add("hidden"); }

// Fusion-milestone promos (checkFusionPromo, retention.js). `icon`: title artwork.
const FUSION_PROMOS = {
  starterPack: {
    title: "Bien joué !",
    icon: "cadeau.png",
    text: "Tu commences à prendre le rythme. Le Pack de démarrage te donne 500 Gems, 3 cases débloquées et un boost d'1h - un vrai coup de pouce pour la suite.",
    productId: "starter_pack",
  },
  vipPass: {
    title: "Tu es accroché !",
    icon: "supernova.png",
    // Say "while active", not "forever": no ads only lasts while the Pass is active.
    text: "130 fusions déjà - le Pass Supernova retire les pubs tant qu'il est actif, double ta production de Stardust et t'offre 100 Gems chaque jour. Pensé pour les joueurs comme toi.",
    productId: "vip_monthly",
  },
};
let fusionPromoProductId = null;
function openFusionPromoModal(kind) {
  const promo = FUSION_PROMOS[kind];
  const product = promo && IAP_CATALOG.find(p => p.id === promo.productId);
  if (!product || isOneTimeIapOwned(Game.state, product.id)) return; // already bought since the promo was queued
  fusionPromoProductId = product.id;
  $("fusionPromoTitle").innerHTML = promo.icon
    ? `<img class="inlineCurrencyIcon" src="assets/ui/${promo.icon}" alt=""> ${promo.title}`
    : promo.title;
  $("fusionPromoText").textContent = promo.text;
  $("fusionPromoBuy").textContent = product.type === "subscription" ? `S'abonner — ${product.price}` : `${product.name} — ${product.price}`;
  $("fusionPromoModal").classList.remove("hidden");
}
function closeFusionPromoModal() { $("fusionPromoModal").classList.add("hidden"); fusionPromoProductId = null; }

// ---------------- Manual save backup modal ----------------
function openSaveCodeModal(mode) {
  Game.saveCodeMode = mode;
  const textarea = $("saveCodeText");
  if (mode === "export") {
    $("saveCodeTitle").textContent = "📤 Exporter ma sauvegarde";
    $("saveCodeHelp").textContent = "Sélectionne tout le texte ci-dessous et copie-le (garde-le dans tes Notes, par exemple). Colle-le dans « Importer une sauvegarde » pour la restaurer plus tard.";
    textarea.value = exportSaveCode(Game.state);
    textarea.readOnly = true;
    $("saveCodeAction").textContent = "Copier";
  } else {
    $("saveCodeTitle").textContent = "📥 Importer une sauvegarde";
    $("saveCodeHelp").textContent = "Colle ici un code exporté précédemment. Cela remplacera ta progression actuelle sur cet appareil.";
    textarea.value = "";
    textarea.readOnly = false;
    $("saveCodeAction").textContent = "Restaurer";
  }
  $("saveCodeModal").classList.remove("hidden");
  if (mode === "export") { textarea.focus(); textarea.select(); }
}
function closeSaveCodeModal() { $("saveCodeModal").classList.add("hidden"); }

function buildStars() {
  const bg = $("starsBg");
  for (let i = 0; i < 50; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2 + 1;
    s.style.width = size + "px"; s.style.height = size + "px";
    s.style.left = (Math.random() * 100) + "%";
    s.style.top = (Math.random() * 100) + "%";
    s.style.animationDelay = (Math.random() * 3) + "s";
    bg.appendChild(s);
  }
  scheduleShootingStars();
  buildWheelSegments();
}

// Draws the wheel slices from WHEEL_PRIZES weights and lists the prizes in #wheelLegend
// (labels don't fit on narrow slices). Built once at boot.
function buildWheelSegments() {
  const wheelEl = $("wheelEl");
  const legendEl = $("wheelLegend");
  wheelEl.innerHTML = "";
  legendEl.innerHTML = "";
  const colors = ["#3730a3", "#7c3aed", "#2563eb", "#0891b2", "#be185d", "#f59e0b", "#dc2626"];
  const stops = [];
  const boundaries = [];
  WHEEL_PRIZES.forEach((p, i) => {
    const { startDeg, endDeg } = wheelSegmentBounds(i);
    boundaries.push(startDeg);
    const color = colors[i % colors.length];
    stops.push(`${color} ${startDeg}deg ${endDeg}deg`);

    const item = el("div", "wheelLegendItem");
    const swatch = el("span", "wheelLegendSwatch");
    swatch.style.background = color;
    item.appendChild(swatch);
    item.appendChild(el("span", null, withCurrencyIcons(p.label)));
    legendEl.appendChild(item);
  });
  wheelEl.style.background =
    `radial-gradient(circle at 34% 24%, rgba(255,255,255,.20), transparent 45%), ` +
    `conic-gradient(from 0deg, ${stops.join(", ")})`;

  boundaries.forEach((deg) => {
    const line = el("div", "wheelDivider");
    line.style.transform = `translateX(-50%) rotate(${deg}deg)`;
    wheelEl.appendChild(line);
  });
  wheelEl.appendChild(el("div", "wheelHub"));
}

// Rare shooting star behind the grid, at random intervals.
function spawnShootingStar() {
  const bg = $("starsBg");
  const star = document.createElement("div");
  star.className = "shootingStar";
  // Distance is based on the viewport so the star always exits the screen.
  // The trail is rotated opposite to the travel direction.
  const vw = window.innerWidth, vh = window.innerHeight;
  const fromLeft = Math.random() < 0.5;
  const startX = fromLeft ? -vw * 0.08 : vw * 1.08;
  const startY = vh * (0.05 + Math.random() * 0.3);
  const dx = (fromLeft ? 1 : -1) * vw * (1.16 + Math.random() * 0.14); // always crosses and exits
  const dy = vh * (0.35 + Math.random() * 0.35);
  const dist = Math.hypot(dx, dy);
  const speed = 900 + Math.random() * 500; // px/s, same pace whatever the distance
  const dur = Math.min(Math.max(dist / speed, 0.7), 1.8).toFixed(2) + "s";
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  star.style.left = startX + "px";
  star.style.top = startY + "px";
  star.style.setProperty("--dx", dx + "px");
  star.style.setProperty("--dy", dy + "px");
  star.style.setProperty("--dur", dur);
  star.style.setProperty("--trail-angle", (angle + 180) + "deg"); // points backward along the path
  bg.appendChild(star);
  setTimeout(() => star.remove(), (parseFloat(dur) * 1000) + 100);
}
function scheduleShootingStars() {
  // Wait before spawning so the first star doesn't appear during boot.
  const next = 3000 + Math.random() * 6000;
  setTimeout(() => { spawnShootingStar(); scheduleShootingStars(); }, next);
}
