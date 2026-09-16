// Spacemerge - debug panel: paint any tile on any cell and drive Stardust
// production. Loaded only when the URL carries ?debug=1 (see index.html), never
// in a store build: it hands out currency and rewrites the grid for free.
"use strict";

(function () {
  // Patching the globals keeps the game files free of debug hooks: classic
  // scripts expose their top-level functions on window, and callers resolve
  // them there at call time.
  const prod = { mult: 1, fixedRate: null };
  const baseProductionMultiplier = window.productionMultiplier;
  const baseTotalProduction = window.totalProduction;
  window.productionMultiplier = (state) => baseProductionMultiplier(state) * prod.mult;
  // A fixed rate replaces the grid's output everywhere production is read,
  // including offline gains (computeOfflineGain, retention.js).
  window.totalProduction = (state) => (prod.fixedRate === null ? baseTotalProduction(state) : prod.fixedRate);

  let paintMode = null; // "tile" | "erase" | null

  const STYLE = `
    #dbgToggle { position: fixed; left: 8px; bottom: calc(8px + env(safe-area-inset-bottom)); z-index: 9999;
      min-width: 44px; min-height: 44px; border-radius: 12px; border: 1px solid #f7b733;
      background: rgba(12,10,24,.92); color: #f7b733; font: 600 13px system-ui; padding: 0 10px; }
    #dbgPanel { position: fixed; left: 8px; bottom: calc(60px + env(safe-area-inset-bottom)); z-index: 9999;
      width: 244px; max-height: 60vh; overflow: auto; padding: 10px; border-radius: 12px;
      border: 1px solid #f7b733; background: rgba(12,10,24,.96); color: #eee; font: 12px system-ui; }
    #dbgPanel.hidden, #dbgToggle.hidden { display: none; }
    #dbgPanel h4 { margin: 10px 0 4px; font-size: 11px; text-transform: uppercase; color: #f7b733; letter-spacing: .05em; }
    #dbgPanel h4:first-child { margin-top: 0; }
    #dbgPanel label { display: flex; align-items: center; gap: 6px; margin: 4px 0; }
    #dbgPanel label span { flex: 0 0 62px; color: #aaa; }
    #dbgPanel select, #dbgPanel input { flex: 1; min-width: 0; min-height: 30px; border-radius: 6px;
      border: 1px solid #443f5e; background: #17142b; color: #eee; padding: 0 6px; font: 12px system-ui; }
    #dbgPanel .dbgRow { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    #dbgPanel button { flex: 1; min-height: 32px; border-radius: 6px; border: 1px solid #443f5e;
      background: #211c3c; color: #eee; font: 12px system-ui; padding: 0 6px; }
    #dbgPanel button.armed { background: #f7b733; border-color: #f7b733; color: #14102a; font-weight: 700; }
  `;

  const PANEL_HTML = `
    <h4>Cases</h4>
    <label><span>Tiers</span><select id="dbgTier"></select></label>
    <label><span>Cycle</span><input id="dbgCycle" type="number" min="0" step="1" value="0"></label>
    <div class="dbgRow">
      <button id="dbgPaint">Remplacer</button>
      <button id="dbgErase">Effacer</button>
    </div>
    <div class="dbgRow">
      <button id="dbgFill">Remplir</button>
      <button id="dbgClear">Vider</button>
      <button id="dbgUnlockAll">Tout débloquer</button>
    </div>
    <h4>Stardust</h4>
    <label><span>Total</span><input id="dbgStardust" type="text" inputmode="decimal" placeholder="ex. 1e12"></label>
    <label><span>Prod ×</span><input id="dbgMult" type="text" inputmode="decimal" value="1"></label>
    <label><span>Prod /s</span><input id="dbgRate" type="text" inputmode="decimal" placeholder="auto"></label>
    <div class="dbgRow"><button id="dbgReset">Réinitialiser la prod</button></div>
  `;

  function build() {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);

    const toggle = document.createElement("button");
    toggle.id = "dbgToggle";
    toggle.textContent = "DEBUG";
    const panel = document.createElement("div");
    panel.id = "dbgPanel";
    panel.className = "hidden";
    panel.innerHTML = PANEL_HTML; // static template, no player input
    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    const tierSelect = $("dbgTier");
    for (const t of TIERS) {
      const opt = document.createElement("option");
      opt.value = t.n;
      opt.textContent = `${t.n} · ${t.name}`;
      tierSelect.appendChild(opt);
    }

    toggle.addEventListener("click", () => panel.classList.toggle("hidden"));
    $("dbgPaint").addEventListener("click", () => setPaintMode(paintMode === "tile" ? null : "tile"));
    $("dbgErase").addEventListener("click", () => setPaintMode(paintMode === "erase" ? null : "erase"));
    $("dbgFill").addEventListener("click", fillGrid);
    $("dbgClear").addEventListener("click", clearGrid);
    $("dbgUnlockAll").addEventListener("click", unlockAll);
    $("dbgStardust").addEventListener("change", (e) => {
      const value = parseFloat(e.target.value);
      if (!isNaN(value)) setStardust(Math.max(0, value));
      e.target.value = "";
    });
    $("dbgMult").addEventListener("change", (e) => {
      const value = parseFloat(e.target.value);
      prod.mult = isNaN(value) || value < 0 ? 1 : value;
      e.target.value = prod.mult;
    });
    $("dbgRate").addEventListener("change", (e) => {
      const value = parseFloat(e.target.value);
      prod.fixedRate = isNaN(value) ? null : Math.max(0, value);
    });
    $("dbgReset").addEventListener("click", () => {
      prod.mult = 1;
      prod.fixedRate = null;
      $("dbgMult").value = "1";
      $("dbgRate").value = "";
    });
  }

  function setPaintMode(mode) {
    paintMode = mode;
    $("dbgPaint").classList.toggle("armed", mode === "tile");
    $("dbgErase").classList.toggle("armed", mode === "erase");
    // The grid has to be tappable while painting.
    if (mode) $("dbgPanel").classList.add("hidden");
    $("dbgToggle").textContent = mode ? (mode === "erase" ? "EFFACE ✕" : `T${currentTile().tier} ✕`) : "DEBUG";
  }

  function currentTile() {
    return { tier: parseInt($("dbgTier").value, 10), cycle: Math.max(0, parseInt($("dbgCycle").value, 10) || 0) };
  }

  // `tile` null empties the cell. A locked cell is unlocked on the spot.
  function setCell(idx, tile) {
    const state = Game.state;
    if (!state.unlocked[idx]) {
      state.unlocked[idx] = true;
      state.extraUnlockedCount += 1; // keeps unlockCost() in step with the real grid
    }
    state.grid[idx] = tile;
    if (!tile) return;
    // Painting a tier stands in for having merged up to it. Both fields hold a
    // base tier (1..TIERS.length), never a looped progress tier.
    state.maxTierThisRun = Math.max(state.maxTierThisRun, tile.tier);
    state.lifetime.maxTierEver = Math.max(state.lifetime.maxTierEver, tile.tier);
  }

  function commit(spawnedIdx) {
    checkAchievements(Game.state);
    renderAll();
    if (spawnedIdx !== undefined) renderCell(spawnedIdx, { spawned: true });
    saveState(Game.state);
  }

  function fillGrid() {
    const tile = currentTile();
    for (let i = 0; i < TOTAL; i++) if (Game.state.unlocked[i]) setCell(i, { ...tile });
    commit();
  }

  function clearGrid() {
    for (let i = 0; i < TOTAL; i++) Game.state.grid[i] = null;
    commit();
  }

  function unlockAll() {
    for (let i = 0; i < TOTAL; i++) if (!Game.state.unlocked[i]) setCell(i, Game.state.grid[i]);
    commit();
  }

  function setStardust(target) {
    const state = Game.state;
    const delta = target - state.stardust;
    // Through the normal income/spend points so quests and achievements follow.
    if (delta >= 0) grantStardust(state, delta);
    else spendStardust(state, -delta);
    Game.displayedStardust = state.stardust;
    commit();
  }

  // Capture phase on document: onPointerDown (input.js) listens on the same node
  // in the bubble phase, so stopping here is what keeps a paint tap from merging.
  function onPaintDown(e) {
    if (!paintMode) return;
    const pos = localPos(e);
    const idx = cellIdxAtPoint(pos.x, pos.y);
    if (idx === null) return;
    e.preventDefault();
    e.stopPropagation();
    setCell(idx, paintMode === "erase" ? null : currentTile());
    commit(idx);
  }

  function init() {
    if (!window.Game || !Game.state || !cellEls.length) { requestAnimationFrame(init); return; }
    build();
    document.addEventListener("pointerdown", onPaintDown, { capture: true, passive: false });
    document.addEventListener("touchstart", onPaintDown, { capture: true, passive: false });
  }
  init();
})();
