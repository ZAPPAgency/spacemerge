// Godspark - native bridge (Capacitor build only).
//
// This file is the ONLY module-type script in index.html; every other game
// file stays plain <script> (global functions, zero build step) so the web
// prototype keeps working unmodified in any browser. This bridge is a no-op
// when Capacitor isn't present (window.Capacitor undefined), so including it
// in the plain web build is harmless.
//
// It replaces the web stubs (services.js: AdService/IAPService, audio.js:
// HapticService, state.js: saveState/loadState) with real native-backed
// versions, WITHOUT any other game file needing to change — that separation
// is the entire point of the AdService/IAPService abstraction from Étape 4.
//
// NOTE: plugin method/type names below match each package's docs at the time
// of writing. Re-check each plugin's README once installed — community
// plugin APIs (AdMob, RevenueCat, GameConnect in particular) do shift across
// major versions — and adjust before shipping.
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { AdMob } from "@capacitor-community/admob";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { GameConnect } from "@openforge/capacitor-game-connect";

if (!Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) {
  // Running in a plain browser (web prototype / Artifact preview) - do nothing.
} else {
  bootNative();
}

async function bootNative() {
  // ---- Status bar / splash ----
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#05040d" });
  } catch (e) { console.warn("StatusBar init failed", e); }

  // ---- Haptics: replace the no-op web stub ----
  const impactMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  window.HapticService.impact = async (type) => {
    try {
      if (type === "success") await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: impactMap[type] || ImpactStyle.Medium });
    } catch (e) { /* device may not support haptics */ }
  };

  // ---- Preferences-backed save/load (replaces localStorage) ----
  window.saveState = function nativeSaveState(state) {
    state.lastSaveTime = Date.now();
    Preferences.set({ key: SAVE_KEY, value: JSON.stringify(state) }).catch((e) => console.warn("Sauvegarde impossible", e));
  };
  // loadState() already ran synchronously off localStorage before this module
  // finished loading; on native we migrate that into Preferences once, then
  // Preferences becomes the source of truth for every future save/load.
  try {
    const { value } = await Preferences.get({ key: SAVE_KEY });
    if (value && JSON.stringify(Game.state) !== value) {
      // A previous native save exists and differs from the localStorage bootstrap
      // (e.g. first run after this bridge was added) - prefer it.
      const migrated = JSON.parse(value);
      if (migrated && migrated.version === SAVE_VERSION) Object.assign(Game.state, migrated);
    }
  } catch (e) { console.warn("Lecture Preferences impossible", e); }

  // ---- AdMob ----
  // Replace ad-unit IDs below with your real AdMob unit IDs before release;
  // these are Google's public TEST unit IDs and are safe to ship during QA.
  const AD_UNITS = {
    rewarded: "ca-app-pub-3940256099942544/1712485313",
    interstitial: "ca-app-pub-3940256099942544/4411468910",
  };
  try {
    await AdMob.initialize({ requestTrackingAuthorization: false, initializeForTesting: true });
  } catch (e) { console.warn("AdMob init failed", e); }

  window.AdService.showRewarded = async function (_placementId) {
    try {
      await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
      const result = await AdMob.showRewardVideoAd();
      return !!result; // AdMob resolves showRewardVideoAd's promise once a reward is granted
    } catch (e) {
      console.warn("Rewarded ad failed", e);
      return false;
    }
  };
  window.AdService.showInterstitial = async function () {
    try {
      await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
      await AdMob.showInterstitial();
    } catch (e) { console.warn("Interstitial failed", e); }
  };

  // ---- RevenueCat (IAP) ----
  // Replace with your real RevenueCat public SDK key (Project settings > API keys).
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey: "YOUR_REVENUECAT_PUBLIC_SDK_KEY" });
  } catch (e) { console.warn("RevenueCat init failed", e); }

  window.IAPService.purchase = async function (productId) {
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.availablePackages.find(p => p.product.identifier === productId)
        || offerings.current?.availablePackages.find(p => p.identifier === productId);
      if (!pkg) return { success: false, productId };
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      return { success: !!customerInfo, productId };
    } catch (e) {
      console.warn("Purchase failed", e);
      return { success: false, productId };
    }
  };
  window.IAPService.restorePurchases = async function () {
    try { await Purchases.restorePurchases(); } catch (e) { console.warn("Restore failed", e); }
  };
  window.IAPService.isSubscribed = function (_productId) {
    return Game.state ? isVipActive(Game.state) : false;
  };

  // ---- Game Center (leaderboards & achievements) ----
  try {
    await GameConnect.signIn();
  } catch (e) { console.warn("Game Center sign-in failed (user may have declined)", e); }
  window.GameCenterService = {
    async submitScore(leaderboardId, score) {
      try { await GameConnect.submitScore({ leaderboardID: leaderboardId, totalScoreAmount: score }); }
      catch (e) { console.warn("submitScore failed", e); }
    },
    async showLeaderboard(leaderboardId) {
      try { await GameConnect.showLeaderboard({ leaderboardID: leaderboardId }); }
      catch (e) { console.warn("showLeaderboard failed", e); }
    },
    async unlockAchievement(achievementId, percentComplete) {
      try { await GameConnect.unlockAchievement({ achievementID: achievementId, percentComplete: percentComplete ?? 100 }); }
      catch (e) { console.warn("unlockAchievement failed", e); }
    },
  };

  // ---- Local notifications: "come back" reminder scheduled on background ----
  try { await LocalNotifications.requestPermissions(); } catch (e) { /* user may decline */ }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }] }).catch(() => {});
    LocalNotifications.schedule({
      notifications: [
        {
          id: 1001,
          title: "Godspark",
          body: "Vos planètes ont produit du Stardust, venez récupérer !",
          schedule: { at: new Date(Date.now() + 4 * 3600 * 1000) },
        },
        {
          id: 1002,
          title: "Godspark",
          body: "Ne perdez pas votre série de connexion quotidienne !",
          schedule: { at: new Date(Date.now() + 20 * 3600 * 1000) },
        },
      ],
    }).catch((e) => console.warn("Schedule notification failed", e));
  });

  await SplashScreen.hide();
}
