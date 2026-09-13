// Godspark - Ad & IAP abstraction layer.
//
// Game code only ever calls AdService.* and IAPService.*. On web this file
// simulates both with visible modals so the whole monetization loop is
// testable without a real SDK. On iOS (Étape 6) this file is swapped for an
// implementation backed by an AdMob Capacitor plugin and RevenueCat — no
// other game file needs to change.
"use strict";

function simulatedModal({ title, body, durationMs, confirmLabel }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "simOverlay";
    const card = document.createElement("div");
    card.className = "simCard";
    const h = document.createElement("h3");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = body;
    const bar = document.createElement("div");
    bar.className = "simBar";
    const fill = document.createElement("div");
    fill.className = "simBarFill";
    bar.appendChild(fill);
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.textContent = confirmLabel || "OK";
    btn.disabled = true;

    card.appendChild(h); card.appendChild(p); card.appendChild(bar); card.appendChild(btn);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // CSS-transition-driven fill (GPU-composited, keeps animating even if
    // requestAnimationFrame gets throttled) + a single setTimeout as the
    // source of truth for enabling the button - this used to poll via rAF,
    // which could leave the button stuck disabled if the tab/webview
    // throttled animation frames (e.g. briefly backgrounded).
    fill.style.transition = `width ${durationMs}ms linear`;
    requestAnimationFrame(() => { fill.style.width = "100%"; });

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(true);
    };
    setTimeout(() => { btn.disabled = false; }, durationMs);
    // Auto-closes shortly after the bar finishes, so the flow always
    // completes even if nobody taps the button - a required extra tap here
    // was the likely cause of "nothing happens" reports on some devices.
    setTimeout(finish, durationMs + 500);
    btn.addEventListener("click", finish);
  });
}

const AdService = {
  async showRewarded(placementId) {
    if (window.DEBUG_ADS) console.log("[AdService] rewarded placement:", placementId);
    await simulatedModal({
      title: "Publicité simulée",
      body: "En version native, une vraie pub récompensée AdMob s'affiche ici.",
      durationMs: 2500,
      confirmLabel: "Continuer",
    });
    return true;
  },
  async showInterstitial() {
    if (window.DEBUG_ADS) console.log("[AdService] interstitial");
    await simulatedModal({
      title: "Publicité interstitielle simulée",
      body: "Ceci remplace une pub plein écran AdMob en version native.",
      durationMs: 1500,
      confirmLabel: "Fermer",
    });
  },
};

const IAPService = {
  async purchase(productId) {
    const product = IAP_CATALOG.find(p => p.id === productId);
    await simulatedModal({
      title: "Achat simulé",
      body: `${product ? product.name : productId} — ${product ? product.price : ""}\n(Aucun paiement réel n'est effectué en mode web.)`,
      durationMs: 900,
      confirmLabel: "Confirmer",
    });
    return { success: true, productId };
  },
  async restorePurchases() {
    await simulatedModal({
      title: "Restauration simulée",
      body: "En version native (RevenueCat), les achats précédents seraient restaurés ici.",
      durationMs: 800,
      confirmLabel: "OK",
    });
  },
  isSubscribed(productId) {
    return Game.state ? isVipActive(Game.state) : false;
  },
};
