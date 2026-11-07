// Galaxeed - native bridge (Capacitor build only).
//
// This file is the ONLY module-type script in index.html; every other game
// file stays plain <script> (global functions, zero build step) so the web
// build keeps working unmodified in any browser. Without Capacitor, nothing below runs.
//
// It starts the game from the native save (bootGame in main.js) and replaces the
// web stubs (AdService/IAPService in services.js, HapticService in audio.js,
// saveState in state.js) with native-backed versions.
// The stubs are top-level `const` objects, which are not window properties:
// patch them by name (HapticService.impact = …), never through window.
//
// Community plugin APIs (AdMob, RevenueCat) change across major versions:
// check their README when upgrading.
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { AdMob } from "@capacitor-community/admob";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

if (!Capacitor || !Capacitor.isNativePlatform || !Capacitor.isNativePlatform()) {
  // Plain browser. The bare imports above only resolve in the Vite build, so the web
  // build logs one expected, harmless console error here.
} else {
  window.nativeBoot = true; // main.js leaves the boot to bootGameFromNativeSave()
  bootNative();
}

// Preferences is the source of truth on native: the OS can purge WebView storage.
// The WebView's localStorage is read only while Preferences is still empty, to
// keep games saved before the native save existed.
async function bootGameFromNativeSave() {
  let raw;
  try {
    raw = (await Preferences.get({ key: SAVE_KEY })).value;
  } catch (e) {
    // Keep the web saveState this session: a native save we could not read
    // must not be overwritten.
    console.warn("Lecture Preferences impossible", e);
    bootGame(loadState());
    return;
  }
  window.saveState = function nativeSaveState(state) {
    state.lastSaveTime = Date.now();
    Preferences.set({ key: SAVE_KEY, value: JSON.stringify(state) }).catch((e) => console.warn("Sauvegarde impossible", e));
  };
  bootGame(raw ? parseSave(raw) : loadState());
}

async function bootNative() {
  await bootGameFromNativeSave();

  // ---- Status bar / splash ----
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#05040d" });
  } catch (e) { console.warn("StatusBar init failed", e); }

  // ---- Haptics: replace the no-op web stub ----
  const impactMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  HapticService.impact = async (type) => {
    try {
      if (type === "success") await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: impactMap[type] || ImpactStyle.Medium });
    } catch (e) { /* device may not support haptics */ }
  };

  // ---- AdMob ----
  // IDs come from .env.staging (Google demo units) or .env.production, per platform.
  const env = import.meta.env;
  const isIos = Capacitor.getPlatform() === "ios";
  const AD_UNITS = isIos
    ? { rewarded: env.VITE_ADMOB_REWARDED_IOS, interstitial: env.VITE_ADMOB_INTERSTITIAL_IOS }
    : { rewarded: env.VITE_ADMOB_REWARDED_ANDROID, interstitial: env.VITE_ADMOB_INTERSTITIAL_ANDROID };
  try {
    await AdMob.initialize({ requestTrackingAuthorization: false, initializeForTesting: env.VITE_ADS_TESTING === "true" });
  } catch (e) { console.warn("AdMob init failed", e); }

  AdService.showRewarded = async function (_placementId) {
    try {
      await AdMob.prepareRewardVideoAd({ adId: AD_UNITS.rewarded });
      const result = await AdMob.showRewardVideoAd();
      return !!result; // AdMob resolves showRewardVideoAd's promise once a reward is granted
    } catch (e) {
      console.warn("Rewarded ad failed", e);
      return false;
    }
  };
  AdService.showInterstitial = async function () {
    try {
      await AdMob.prepareInterstitial({ adId: AD_UNITS.interstitial });
      await AdMob.showInterstitial();
    } catch (e) { console.warn("Interstitial failed", e); }
  };

  // ---- RevenueCat (IAP) ----
  // Without a key, RevenueCat stays unconfigured and every purchase below fails cleanly.
  const revenueCatKey = isIos ? env.VITE_RC_KEY_IOS : env.VITE_RC_KEY_ANDROID;
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    if (revenueCatKey) await Purchases.configure({ apiKey: revenueCatKey });
  } catch (e) { console.warn("RevenueCat init failed", e); }

  IAPService.purchase = async function (productId) {
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
  IAPService.restorePurchases = async function () {
    try { await Purchases.restorePurchases(); } catch (e) { console.warn("Restore failed", e); }
  };
  IAPService.isSubscribed = function (_productId) {
    return Game.state ? isVipActive(Game.state) : false;
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
          title: "Galaxeed",
          body: "Vos planètes ont produit du Stardust, venez récupérer !",
          schedule: { at: new Date(Date.now() + 4 * 3600 * 1000) },
        },
        {
          id: 1002,
          title: "Galaxeed",
          body: "Ne perdez pas votre série de connexion quotidienne !",
          schedule: { at: new Date(Date.now() + 20 * 3600 * 1000) },
        },
      ],
    }).catch((e) => console.warn("Schedule notification failed", e));
  });

  await SplashScreen.hide();
}
