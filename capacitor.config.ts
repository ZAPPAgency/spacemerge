import type { CapacitorConfig } from '@capacitor/cli';

// Replace with your real reverse-DNS bundle ID before running `npx cap add ios`
// (must match the App ID registered in App Store Connect / your Apple Developer account).
const config: CapacitorConfig = {
  appId: 'com.example.spacemerge',
  appName: 'Spacemerge',
  // 'dist-www' is the Vite build output (see vite.config.js / docs/BUILD_IOS.md) -
  // it bundles native-bridge.js's plugin imports. Point this at 'www' directly
  // only if you strip native-bridge.js and don't need Ads/IAP/GameCenter/Haptics.
  webDir: 'dist-www',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#05040dff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      overlaysWebView: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
    },
  },
};

export default config;
