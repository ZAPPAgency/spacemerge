# Spacemerge — Build iOS (Capacitor)

Ce document a été préparé sans pouvoir être exécuté ni vérifié dans cet
environnement : il n'a ni Node.js, ni Xcode complet, ni CocoaPods, ni
simulateur iOS (seuls les outils en ligne de commande Xcode sont présents).
Toute cette étape doit donc être effectuée sur ta machine.

## Prérequis (sur ta machine, pas ici)

- **Node.js LTS** (≥ 18) + npm
- **Xcode** complet (pas seulement les Command Line Tools) — via l'App Store,
  puis `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- **CocoaPods** (`sudo gem install cocoapods` ou `brew install cocoapods`)
- Un **compte Apple Developer Program** (payant, ~99 $/an) pour signer et
  soumettre l'app
- Comptes créés à l'avance : **AdMob**, **RevenueCat**, et l'app enregistrée
  dans **App Store Connect** (pour Game Center)

## 1. Installer les dépendances

```bash
cd nebula-merge
npm install
```

## 2. Choisis ton bundle ID

Édite `capacitor.config.ts` : remplace `com.example.spacemerge` par ton
identifiant réel (doit correspondre à l'App ID créé dans App Store Connect).

## 3. Active le pont natif (Ads / IAP / Game Center / Haptics / Preferences)

`www/js/native-bridge.js` existe déjà mais n'est PAS chargé par
`www/index.html` — volontairement, pour que le jeu reste ouvrable tel quel
dans n'importe quel navigateur sans étape de build (c'est ce qui a été
testé et livré aux Étapes 1 à 5). Pour l'activer :

Ouvre `www/index.html` et ajoute cette ligne juste avant `</body>`, après les
autres scripts :

```html
<script type="module" src="js/native-bridge.js"></script>
```

Ce fichier ne fait rien tant que `window.Capacitor` n'existe pas (donc aucun
risque si tu le laisses même en testant dans un navigateur classique), mais
comme il utilise `import` (pour résoudre les plugins npm), il **doit être
construit avec Vite** avant d'être servi — sinon le navigateur essaiera de
résoudre `@capacitor/core` littéralement et échouera.

## 4. Build web (Vite) puis ajoute la plateforme iOS

```bash
npm run build          # construit www/ -> dist-www/ (bundle les imports de native-bridge.js)
npx cap add ios        # première fois seulement : génère le dossier ios/
npx cap sync ios       # à chaque changement de code web ou de plugin
```

`npx cap sync ios` exécute aussi `pod install` automatiquement.

## 5. Ouvrir dans Xcode

```bash
npx cap open ios
```

Dans Xcode :
- Sélectionne ton Team de signature (Signing & Capabilities)
- Ajoute la capability **Game Center**
- Ajoute la capability **Push Notifications** si tu veux des notifications
  distantes plus tard (les notifications locales utilisées ici n'en ont pas besoin)

## 6. Configuration AdMob

- Récupère ton **App ID AdMob** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`)
- Dans `ios/App/App/Info.plist`, ajoute :
  ```xml
  <key>GADApplicationIdentifier</key>
  <string>ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY</string>
  <key>SKAdNetworkItems</key>
  <array>
    <!-- liste SKAdNetworkIdentifier fournie par AdMob, voir leur doc d'intégration iOS -->
  </array>
  <key>NSUserTrackingUsageDescription</key>
  <string>Nous utilisons cet identifiant pour vous proposer des publicités plus pertinentes.</string>
  ```
- Dans `www/js/native-bridge.js`, remplace les IDs de test
  (`ca-app-pub-3940256099942544/...`) par tes vrais IDs de blocs d'annonces
  AdMob (un pour le rewarded, un pour l'interstitiel) une fois prêt à
  soumettre — garde les IDs de test pendant tout le développement/QA.
- Implémente le flux **App Tracking Transparency** (demande `AppTrackingTransparency`
  après le tutoriel, jamais au premier écran — voir checklist QA). Un plugin
  Capacitor ATT (ex. `@capacitor-community/app-tracking-transparency`) ou du
  code Swift natif minimal peut faire l'appel `ATTrackingManager.requestTrackingAuthorization`.
  Si l'utilisateur refuse, `AdMob.initialize({ requestTrackingAuthorization: false })`
  reste appelé (déjà le cas dans `native-bridge.js`) pour rester en pubs non
  personnalisées et garder l'app monétisable.

## 7. Configuration RevenueCat

- Crée un projet RevenueCat, connecte-le à ton app dans App Store Connect
  (Shared Secret / API iTunes Connect)
- Crée les mêmes **product IDs** que dans `www/js/config.js` → `IAP_CATALOG`
  (`remove_ads`, `vip_monthly`, `stardust_boost`, `starter_pack`,
  `gems_small`, `gems_medium`, `gems_large`, `gems_mega`) à la fois dans
  **App Store Connect** (In-App Purchases / Subscriptions) et dans le
  dashboard **RevenueCat** (Products + Offerings + Entitlements). Cette
  liste doit rester en phase avec `IAP_CATALOG` - si tu ajoutes/retires un
  produit côté code, répercute-le ici et dans App Store Connect/RevenueCat.
- Remplace `"YOUR_REVENUECAT_PUBLIC_SDK_KEY"` dans `native-bridge.js` par ta
  vraie clé publique RevenueCat (Project settings → API keys → Public app-specific key)
- `vip_monthly` doit être créé comme **abonnement auto-renouvelable** dans
  App Store Connect, dans un groupe d'abonnement dédié

## 8. Configuration Game Center

Dans App Store Connect → ta app → Fonctionnalités → Game Center, crée :
- 3 **classements** (leaderboard) avec exactement ces IDs :
  `maxTier`, `cosmicEnergy`, `bigBangCount`
- Un **succès** par entrée de `ACHIEVEMENTS` dans `www/js/config.js`, avec
  l'ID Game Center égal à l'`id` JS (ex. `fuse_10`, `tier_10`, `bigbang_5`, etc.)

`native-bridge.js` appelle déjà `submitScore` / `unlockAchievement` avec ces
identifiants — aucune modification de code n'est nécessaire si tu respectes
ce nommage côté App Store Connect.

## 9. Icône, splash, notifications locales

- Génère les jeux d'icônes/splash avec `npm run assets` (voir
  `docs/APP_STORE_ASSETS.md` pour la génération de l'icône source 1024×1024)
- Les notifications locales de rappel sont déjà programmées dans
  `native-bridge.js` (à la mise en arrière-plan) ; ajuste les délais/textes
  si besoin

## 10. Tester

- Lance sur un simulateur ou un appareil réel depuis Xcode (▶️)
- Vérifie les achats en **StoreKit Sandbox** (compte testeur Sandbox créé
  dans App Store Connect, PAS ton Apple ID réel)
- Vérifie les pubs avec les **IDs de test AdMob** avant de passer aux IDs réels
- Passe la checklist QA complète : `docs/QA_CHECKLIST.md`

## Limites connues de ce scaffold

- Les noms/méthodes exacts des plugins communautaires (`@capacitor-community/admob`,
  `@openforge/capacitor-game-connect`) peuvent avoir légèrement changé entre
  versions — vérifie leur README au moment de l'installation si une méthode
  ne compile pas.
- Rien ici n'a pu être exécuté dans cet environnement (pas de Node/Xcode
  complet/simulateur) : considère ce scaffold comme un point de départ solide
  et vérifié sur le papier, pas comme un build testé.
