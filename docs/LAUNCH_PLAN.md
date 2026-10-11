# Spacemerge — Plan de lancement iOS + Android

**Rédigé le :** 2026-09-27, à partir de `main` @ `5043983` et de tous les fichiers de `docs/`.
**Pour :** Moi (dev, code, build) et le Collègue (UI/UX, assets, marketing).

**Légende**
- Statuts : **Fait** · **Partiel** · **À faire** · **Obsolète**.
- `fichier:ligne` = preuve lue dans le code le 2026-09-27.
- ⚠️ = non vérifié : règle de store ou comportement de plugin à confirmer à la source indiquée.
- ★ = chemin critique · ⏳ = délai externe que tu ne contrôles pas.
- Cocher `- [x]` au fil de l'eau. Une todo ≤ 4 h. Les IDs sont stables.

## Sommaire

0. [Synthèse](#0-synthèse)
1. [État réel de l'audit](#1-état-réel-de-laudit)
2. [Incohérences entre documents](#2-incohérences-entre-documents)
3. [Décisions](#3-décisions)
4. [Plan par phases](#4-plan-par-phases)
5. [Calendrier semaine par semaine](#5-calendrier-semaine-par-semaine)
6. [Top 10 des risques](#6-top-10-des-risques)
7. [Semaine 1 : par quoi commencer ce soir](#7-semaine-1--par-quoi-commencer-ce-soir)
- [Annexe A : backlog v1.1](#annexe-a--backlog-v11) · [Annexe B : liste de coupes](#annexe-b--liste-de-coupes-si-tu-prends-du-retard) · [Annexe C : sources](#annexe-c--sources-consultées-le-2026-09-27)

---

## 0. Synthèse

- **Trois bloquants absents de l'audit**, vérifiés en lançant le build le 2026-09-27 :
  1. `npm run build` **échoue** : `native-bridge.js:24` importe `GameConnect`, alors que le plugin exporte `CapacitorGameConnect`.
  2. Même une fois cet import corrigé, `dist-www/` ne contient **ni `js/`** (les 10 scripts du jeu), **ni `assets/tiles`, ni `assets/gods`**, ni `privacy.html`. La cause : Vite ne copie pas les `<script>` classiques. En l'état, l'app native afficherait une page vide.
  3. `@openforge/capacitor-game-connect@5.0.2` déclare une peer dependency `@capacitor/core ^5.0.0`, n'a pas de `Package.swift` (or SPM est le mode par défaut des nouveaux projets Capacitor 8) et embarque un AGP `8.0.0-beta03`.
- **Poste de travail** : la licence Xcode n'est pas acceptée, donc `git` et `pod` échouent en ligne de commande. Le JDK par défaut est la version 24 ; le JDK 21 est installé.
- **Audit** : aucun des 7 P0 n'est corrigé. La structure (S-1, S-3) est partiellement faite. Le détail est au §1.
- **Décisions recommandées** : Android d'abord ; V1 en français seulement, dans 5 pays francophones (sans la Belgique) ; pas de bannière ; pubs non personnalisées sans ATT mais avec UMP ; 4 IAP. Cloud save, Game Center et anglais passent en v1.1.
- **Calendrier réaliste** : environ 137 h de travail pour toi, à 8 h/semaine.
  - Test fermé Google lancé vers le 7 novembre.
  - Android public vers début janvier 2027, iOS vers fin janvier 2027.
  - Un lancement « avant fin 2026 » n'est tenable que pour Android, et seulement avec +0,5 h/semaine et les coupes 1 et 2 de l'annexe B.

---

## 1. État réel de l'audit

Relevé le 2026-09-27 sur `main` @ `5043983`. L'audit (`docs/AUDIT_AND_ROADMAP.md`, 2026-08-26) reste un document historique : **ce tableau fait foi**.

| Item | Statut | Preuve | Suite |
|---|---|---|---|
| **P0-1** Restaurer les achats | À faire | `input.js:1104-1108` affiche « Achats restaurés. » sans rien appliquer. `native-bridge.js:115-117` ignore le résultat de `Purchases.restorePurchases()`. Le libellé « (simulation) » cité par l'audit a disparu : sur natif, le toast est donc faux. | IAP-07 |
| **P0-2** Bannière placeholder | À faire | `index.html:160-162` contient toujours « Bannière publicitaire (placeholder) », rendue visible par `ui.js:393` dès que les pubs sont actives. `native-bridge.js` n'a aucun `showBanner`. | ADS-02 (D2) |
| **P0-3** VIP simulé en local | À faire | `input.js:1091-1093` fixe `vipUntil = Date.now() + 30 j` et `state.js:339-341` lit ce timestamp local. `remove_ads` (`input.js:1045-1047`) et `stardust_boost` (`input.js:1094-1096`) sont aussi de simples flags locaux. | IAP-05 |
| **P0-4** Mentions d'abonnement, EULA | À faire | `renderShopPanel` (`ui.js:719-829`) n'a ni mention de renouvellement, ni lien CGU/EULA, ni lien confidentialité. Le seul lien confidentialité est dans les Réglages (`ui.js:1296-1298`) : il est relatif (`privacy.html`) et le fichier est absent du bundle natif. | IAP-09, IAP-10 |
| **P0-5** Prix codés en dur | À faire | `config.js:1112-1179`. Les valeurs ont changé depuis l'audit : `remove_ads` 4,99 $, `vip_monthly` 5,99 $/mois. `ui.js:702-716` calcule un badge « +x % de valeur » en parsant ces chaînes. | IAP-08 |
| **P0-6** ATT | À faire, Obsolète en V1 (D3) | `native-bridge.js:75` : `requestTrackingAuthorization: false`, aucun prompt. Le plugin AdMob installé expose déjà `requestTrackingAuthorization()` (`node_modules/@capacitor-community/admob/dist/esm/definitions.d.ts:33`) : aucun plugin ATT séparé ne sera nécessaire en v1.1. | V11-03 |
| **P0-7** Identifiants de test | À faire | `native-bridge.js:70-73` : IDs de test **iOS** utilisés aussi sur Android. `:75` : `initializeForTesting: true`. `:99` : `YOUR_REVENUECAT_PUBLIC_SDK_KEY`. | STR-03, ADS-08 |
| **P1-1** Cloud save | À faire, reporté (D5) | Aucun `CloudSaveService` dans `www/js/` (grep vide). | V11-02 |
| **P1-2** Course au démarrage natif | À faire, **plus grave que décrit** | `main.js:20` charge `localStorage` et démarre tout de suite. `native-bridge.js:57-65` écrase ensuite l'état par `Object.assign`, sans re-render ni `deepFill`, et ignore silencieusement toute sauvegarde dont la version ≠ `SAVE_VERSION`. Comme le `saveState` natif (`:50-53`) n'écrit plus dans `localStorage`, celui-ci garde une copie figée des premières secondes de la 1re session. Conséquence : à chaque lancement, les gains hors-ligne (`main.js:66-78`) sont calculés sur cette copie périmée. | FND-01 |
| **P1-3** Sauvegarde à chaque seconde | À faire, aggravé | Trois déclencheurs : chaque tick (`main.js:103`), un `setInterval` de 5 s (`main.js:117`, `AUTOSAVE_MS` `config.js:9`) et `blur` (`main.js:120`). | FND-03 |
| **P1-4** Bump de `SAVE_VERSION` = effacement | Partiel | Le chemin additif existe : `deepFill` (`state.js:230-243`), `migrateRetiredFields` (`state.js:207-228`), `migrateFromV1` (`state.js:174-185`), et la règle est écrite dans `CLAUDE.md`. Mais `state.js:194` renvoie encore `defaultState()` si la version diffère. | FND-02 |
| **P1-5** Classements Game Center invisibles | Obsolète en V1 (D6) | `showLeaderboard` n'est appelé nulle part, et le plugin casse le build (N-01). `retention.js:248` teste déjà `window.GameCenterService` : retirer le plugin n'a aucun effet sur le jeu. | STR-01, V11-02 |
| **P1-6** `importSaveCode` accepte `iap` | À faire | `state.js:260-270` conserve `iap` et `input.js:617` fait `Object.assign(Game.state, imported)`. | FND-06 |
| **P2-1** Anglais | À faire, v1.1 (D7) | `index.html:2` : `lang="fr"`. Pas de fichier i18n. | V11-01 |
| **P2-2** Hygiène du dépôt | Partiel | Fait : `cosmerge-v2.html` a disparu. Reste : `game.html` et `game-full.html` à la racine, `assets/ios-icons/` (13 fichiers), `assets/screenshots/` (3 captures 1290×2796 d'avant les refontes). `assets/icon-1024.png` fait bien 1024×1024 en RVB sans alpha (vérifié avec `file`), mais ⚠️ je n'ai pas vérifié visuellement qu'il s'agit du nouveau logo. | STR-07, AST-01 |
| **P2-3** Tests et CI | À faire | Aucun test. Les 3 workflows publient `www/` brut sans build ni test (`deploy.yml:28`, `preview.yml:29`, `branch-preview.yml:55`). | STR-05, STR-06 |
| **P3** `appId` | À faire | `capacitor.config.ts:6` : `com.example.spacemerge`. | CPT-02, AND-01 |
| **P3** Cache-buster manuel | Partiel | Toujours manuel (`?v=125`, `index.html:40` et `:655-664`), mais le process est documenté dans `CLAUDE.md`. Aucun effet sur le natif. | À garder |
| **P3** `nebula-merge` | À faire | `docs/BUILD_IOS.md:22`. | STR-07 |
| **P3** Remote `origin` | Fait | `.git/config` : `git@github.com:ZAPPAgency/spacemerge.git`. | — |
| **P3** Reporting d'erreurs | À faire | Aucun SDK de reporting. | OBS-01 (D10) |
| **S-0** Ordre des scripts | Partiel | Documenté dans `CLAUDE.md` §3, pas dans `index.html:655-665`. | STR-02 |
| **S-1** Point d'entrée unique | Partiel | Fait : `native-bridge.js` est chargé en permanence (`index.html:665`). Reste : les fichiers web-only ne sont pas exclus, il n'y a pas de garde-fou, et le build est cassé et incomplet (N-01, N-02). `BUILD_IOS.md` §3 (l.31-49) décrit encore l'ancien fonctionnement. | STR-01 à STR-03 |
| **S-2a** Scinder `config.js` | À faire, v1.1 | 1 321 lignes (contenu et équilibrage mélangés). À faire juste avant l'i18n. | V11-01 |
| **S-2b** Scinder `ui.js` | À faire, post-lancement | 1 781 lignes. | V11-08 |
| **S-3** Un seul dépôt, `ios/` committé | Partiel | Fait : un seul dépôt, déploiement Pages par Actions (`deploy.yml`). Reste : `.gitignore:3` ignore toujours `ios/`. ⚠️ Greffe de l'historique `Cosmerge` non vérifiée (git bloqué par la licence Xcode ; l'historique récent contient bien de vrais commits). | STR-04 |

### Nouveaux problèmes trouvés (hors audit)

| ID | Problème | Preuve | Suite |
|---|---|---|---|
| N-01 | Le build Vite échoue (`MISSING_EXPORT GameConnect`). | `native-bridge.js:24` ; le plugin exporte `CapacitorGameConnect` (`node_modules/@openforge/capacitor-game-connect/dist/esm/index.js`). | STR-01 |
| N-02 | `dist-www/` est incomplet : ni `js/`, ni `assets/tiles`, ni `assets/gods`, ni `privacy.html`. | Build de test lancé depuis le scratchpad avec l'import corrigé : Vite affiche « can't be bundled without type="module" » pour les 10 scripts. | STR-02 |
| N-03 | Le plugin Game Center est incompatible avec Capacitor 8. | `package.json` du plugin : peer `@capacitor/core ^5.0.0`, pas de `Package.swift`, `android/build.gradle:14` en AGP `8.0.0-beta03`. | STR-01, D6 |
| N-04 | Aucun consentement UMP, alors qu'il est requis en EEE, au Royaume-Uni et en Suisse. | `native-bridge.js:74-76`. | ADS-04 |
| N-05 | Notifications : permission demandée au boot, toggle ignoré, vouvoiement. | Permission au boot : `native-bridge.js:142`. Le toggle « Notifications » (`ui.js:1253`) n'est jamais lu par `native-bridge.js:143-162`, il ne fait donc rien. Les textes vouvoient alors que le jeu tutoie. | FND-05 |
| N-06 | `@capacitor/app` est installé mais jamais importé : pas d'`appStateChange`, pas de bouton retour Android. | `grep -rn "@capacitor/app" www/js` vide. | FND-04 |
| N-07 | La récompense rewarded dépend de la simple résolution de la promesse (`return !!result`), alors que `CLAUDE.md` exige la confirmation du SDK. | `native-bridge.js:82`. ⚠️ Comportement du plugin en cas de fermeture anticipée non vérifié. | ADS-03 |
| N-08 | « Spacemerge — v1.0.0 (prototype) » est visible dans les Réglages : risque Guideline 2.2 (démo, bêta), et la version est codée en dur. | `ui.js:1304`. | FND-07 |
| N-09 | Lien confidentialité relatif et e-mail de support placeholder. | `ui.js:1296-1302`. | FND-07 |
| N-10 | `starter_pack` est déclaré `nonconsumable` alors qu'il donne des Gems (consommables) : sa restauration serait ambiguë. | `config.js:1144-1145`. | IAP-01 (D8) |
| N-11 | Probabilités de la Boîte Cosmique inexactes dès qu'une rareté est complète. `rollCosmicBox` re-tire la rareté, donc les probabilités réelles sont renormalisées. Une fois tous les Dieux obtenus, la boîte donne 10 à 200 Gems selon une loi au carré, sans probabilités affichées. | `gods.js:207-216`, `gods.js:222-226`, texte fixe `config.js:1102`. | CMP-02 |
| N-12 | `npm run assets` ne trouvera pas les sources : `@capacitor/assets` attend `assets/icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png` et `splash-dark.png`, alors que le dépôt a `icon-1024.png` et `splash-2732.png`. Les scripts `assets` et `sync` sont limités à iOS. | README du paquet l.58-66 ; `package.json:8` et `:10`. | AND-04, IOS-05 |
| N-13 | `smallIcon: 'ic_stat_icon'` pointe vers une ressource Android qui n'existe pas. | `capacitor.config.ts:26`. | AND-04 |
| N-14 | Poste de travail : licence Xcode non acceptée (git et pod KO), `@capacitor/android` absent, JDK par défaut 24. OK : Node 24 (le CLI Capacitor 8 exige ≥ 22), SDK Android 34-36, JDK 21, Xcode 27.0. | `@capacitor/cli` `engines` ; sorties de `git` et `pod`. | CPT-01 |
| N-15 | Le template iOS de Capacitor 8 cible iPhone **et** iPad (`TARGETED_DEVICE_FAMILY = "1,2"`) : captures iPad exigées si on ne change rien. Côté Android, le template est bon : `targetSdk 36` et `allowBackup="true"`. | Templates dans `node_modules/@capacitor/cli/assets/`. | IOS-03 |
| N-17 | **Le bridge natif s'arrête dès sa 2e étape**, donc rien de natif ne tourne : ni sauvegarde Preferences, ni AdMob, ni RevenueCat, ni haptique, ni notifications. `native-bridge.js` écrit dans `window.HapticService`, `window.AdService` et `window.IAPService`, mais ces objets sont des `const` globaux (`audio.js:268`, `services.js:58`, `services.js:80`), qui ne sont pas des propriétés de `window`. `window.HapticService.impact = …` (l.39) lève donc une erreur, et le reste de `bootNative` n'est jamais exécuté. Ce bug masque P1-2 : tant qu'il n'est pas corrigé, la partie est sauvée dans le `localStorage` de la WebView. | Vérifié le 2026-10-11 sur le OnePlus 12 : `typeof window.HapticService === "undefined"`, `CapacitorStorage.xml` absent, `saveState` resté en version web, pubs restées simulées. | FND-01 |
| N-16 | L'achat de Gems contourne `grantGems` (`state.gems += …`) : quêtes et succès ne sont pas mis à jour (invariant de `CLAUDE.md`). | `input.js:1052-1053` et `input.js:1088-1089`. | IAP-06 |

---

## 2. Incohérences entre documents

| # | Incohérence | Où | Correction proposée | Todo |
|---|---|---|---|---|
| I-01 | La description parle de « neuf Dieux » (FR l.17, EN l.84), puis de « 12 Dieux » (l.32, l.98). Le code en contient **14** (`GODS`, `config.js:353`), dont Ananké, « mythique », que la Boîte ne peut pas donner. | `APP_STORE_METADATA.md` | Pas de chiffre dans l'accroche (« des Dieux endormis ») ; « 14 Dieux » dans la liste, à recompter au gel du contenu. | AST-06 |
| I-02 | « 10 paliers, de l'astéroïde à l'Univers », alors que le code a **14 paliers, de Météorite à Genèse** (`TIERS`, `config.js:43`). | `APP_STORE_METADATA.md:31`, `:97` | « 14 paliers, de la Météorite à la Genèse ». | AST-06 |
| I-03 | La politique promet un prompt ATT « au premier lancement (après le tutoriel) ». `BUILD_IOS.md:84-97` et `QA_CHECKLIST.md:64-67` l'exigent aussi, mais `APP_PRIVACY_ANSWERS.md:42-47` recommande de ne pas le faire. | `www/privacy.html` = `docs/privacy-policy.html` (fichiers identiques) | Aligner sur D3 : pas d'ATT en V1, partout. | CMP-01, CMP-07 |
| I-04 | Le « résumé V1 » d'App Privacy ne garde que Achats et Game Center, ce qui est **faux**. Le SDK Google Mobile Ads collecte ID d'appareil, adresse IP (localisation approximative), interactions produit, données publicitaires et diagnostics, même en mode non personnalisé (page Google « App store data disclosure »). Game Center sort de la V1. | `APP_PRIVACY_ANSWERS.md:42-47` | Réécrire à partir des pages Google, RevenueCat et Sentry. | CMP-05, CMP-07 |
| I-05 | La bannière est citée comme format AdMob dans la politique et dans `AGE_RATING_ANSWERS.md:20`. | politique, âge | La retirer (D2). | CMP-01, CMP-07 |
| I-06 | La politique ne parle que d'iOS (« Réglages iOS », « contrôles parentaux natifs d'iOS »). Il manquent : Android et Google Play, UMP, droits RGPD/nLPD, durée de conservation. Game Center y est encore listé. | politique | Réécriture valable pour les deux plateformes. | CMP-01 |
| I-07 | E-mail de support placeholder `support@spacemerge.example`. | politique, `ui.js:1301` | Créer une vraie adresse. | CPT-08, FND-07 |
| I-08 | Le nom du projet varie : `cd nebula-merge` (`BUILD_IOS.md:22`), Godspark et Cosmerge (audit l.861-990), `SAVE_KEY = "cosmerge_save_v2"` (`config.js:7`). | docs, code | Fixer « Spacemerge » dans les docs. **Ne jamais changer `SAVE_KEY`** (invariant de `CLAUDE.md`), mais le signaler comme nom historique dans `BUILD_*.md`. | STR-07 |
| I-09 | `appId` placeholder, que le README (l.48-51) signale lui aussi. | `capacitor.config.ts:6` | Choisir l'identifiant final (CPT-02). | CPT-02 |
| I-10 | `BUILD_IOS.md` est obsolète sur cinq points : le §3 dit que `native-bridge.js` n'est pas chargé (faux depuis `index.html:665`), le §9 renvoie vers `docs/APP_STORE_ASSETS.md` qui n'existe pas (l.130), il demande Node ≥ 18 (Capacitor 8 exige ≥ 22), il décrit CocoaPods (Capacitor 8 crée des projets SPM), et il inclut Game Center et ATT. | `BUILD_IOS.md` | Réécrire après IOS-07, avec les commandes réellement utilisées. | STR-07 |
| I-11 | `QA_CHECKLIST` coche plusieurs points faux ou obsolètes : « Restaurer les achats ✅ » (l.50-53, faux sur natif), « la bannière reste masquée » (l.54-57), « Fusion Express » (l.43, n'existe plus : grep vide), « Politique cohérente ✅ » (l.68-70, faux, voir I-03 et I-04). | `QA_CHECKLIST.md` | Refaire en deux colonnes, iOS et Android. | CMP-07 |
| I-12 | `AGE_RATING_ANSWERS` suit l'ancien questionnaire. Apple a ajouté les classes 13+, 16+ et 18+ et de nouvelles questions, obligatoires depuis le 31/01/2026. « 4+ attendu » est peu probable avec loot box et pubs ⚠️. La ligne IAP cite des « skins », alors que les sets d'icônes se paient en Gems. Rien sur IARC (Google). | `AGE_RATING_ANSWERS.md` | Refaire à partir des questionnaires réels. | CMP-06, CMP-04 |
| I-13 | Une fiche anglaise est prête alors que l'app est 100 % française en V1 : elle promettrait une langue absente. | `APP_STORE_METADATA.md:70-129` | La garder pour la v1.1, ne pas la publier en V1. | AST-06 |
| I-14 | Mots-clés : FR 88/100 caractères, EN 81/100 (comptés). Aucun texte Google Play, et la description courte (80 caractères) manque. | `APP_STORE_METADATA.md` | Ajouter une section Google Play. | AST-06 |
| I-15 | Le doc renvoie à `BUILD_IOS.md` pour les captures, qui n'en parle pas. | `APP_STORE_METADATA.md:153-155` | Tout décrire dans AST-04 et AST-05. | AST-04, AST-05 |
| I-16 | Android est absent : le README dit « prévu pour iOS », `package.json` indique « (Capacitor iOS) », `docs/` ne couvre pas Android. | README, `package.json:5` | Mettre à jour et créer `docs/BUILD_ANDROID.md`. | STR-07 |
| I-17 | Les notifications vouvoient (`native-bridge.js:151`, `:157`) alors que le jeu tutoie. | code | Passer au tutoiement. | FND-05 |
| I-18 | `SAVE_BACKUP.md` décrit le contexte « Artifact Claude », aujourd'hui obsolète. | `SAVE_BACKUP.md` | Le marquer comme historique. | STR-07 |
| I-19 | L'audit parle de `cosmerge-v2.html` (disparu) et de prix à 3,99 $ / 6,99 $ (le code dit 4,99 $ / 5,99 $). | audit | Rien à modifier : l'audit est daté et le §1 fait foi. | — |

---

## 3. Décisions

### Hypothèses retenues et réponses reçues

- **H-1** Le nom final est **« Spacemerge »** (branche `chore/rename_spacemerge`, `package.json`, README). Recherche d'homonymes et de marques : en attente (CPT-02).
- **H-2 · Décidé le 2026-09-30.** L'identifiant iOS et Android est **`com.zappstudio.spacemerge`** (même `appId` Capacitor pour les deux). **Irréversible** une fois publié. Libre sur Google Play (404 vérifié le 2026-09-30).
- **H-3 · Confirmé le 2026-09-30.** Comptes personnels : Apple « Individual » (pas de D-U-N-S) et ton compte Google perso, **créé en 2026**. Le test fermé (12 testeurs pendant 14 jours) est donc **obligatoire** : DST-01 à DST-03 restent sur le chemin critique.
- **H-4 · Confirmé le 2026-09-30.** Le Collègue a un iPhone : il sert pour IOS-02, TestFlight et la QA iOS.
- **H-5** Temps disponible : 8 h/semaine pour toi, environ 4 h/semaine pour le Collègue.
- **H-6 · Décidé le 2026-09-30.** Seule nouvelle dépendance autorisée : `@sentry/capacitor` (D10). Toute autre reste à valider (règle `CLAUDE.md`).
- **H-7** ⚠️ Pays de résidence fiscale inconnu (Suisse ou France). Il ne change que le formulaire fiscal Apple et l'autorité citée dans la politique (PFPDT ou CNIL).

### D1. iOS et Android : dans quel ordre ?

- **Options.**
  - **A.** Les deux en parallèle.
  - **B.** iOS d'abord, Android 6 à 8 semaines après.
  - **C.** Android d'abord (build et test fermé), iOS 3 à 4 semaines après, fondations communes.
- **Recommandation : C.**
  - Ton seul appareil réel est Android (OnePlus 12), et ton compte Google existe déjà, pas le compte Apple.
  - Le test fermé de 14 jours est incompressible : lancé tôt, il tourne pendant que tu codes les IAP et les pubs.
  - Environ 90 % du travail (FND, IAP, ADS, CMP) est commun. Le portage iOS coûte ensuite environ 25 h.
- **Impact.** Android public en S14 (début janvier 2027), iOS en S18 (fin janvier 2027), soit environ 4 semaines d'écart.

### D2. Bannière

- **Options.** L'implémenter (environ 8 h : `showBanner`, marges, masquage après achat, tests) ou la supprimer.
- **Recommandation : la supprimer en V1.**
  - Le placeholder visible entraîne un rejet assuré (Guideline 2.1).
  - Rewarded et interstitiel suffisent à apprendre la monétisation publicitaire.
  - Une bannière sous la grille dégrade l'écran principal.
  - On pourra y revenir en v1.1 avec des données de rétention.
- **Impact.** 0,5 h au lieu de 8 h.

### D3. Pubs personnalisées + ATT, ou non personnalisées seulement

- **Options.**
  - **(a)** Pubs personnalisées avec ATT et UMP.
  - **(b)** Pubs non personnalisées (`npa: true`, `node_modules/@capacitor-community/admob/dist/esm/shared/ad-options.interface.d.ts:35`) sans ATT, avec UMP.
- **Recommandation : (b) en V1.**
  - Pas de prompt ATT à justifier en review.
  - App Privacy est plus simple : tracking « Non » ⚠️ à confirmer avec la définition Apple (CMP-05).
  - Environ 3 h de moins.
  - L'eCPM est plus bas (⚠️ baisse souvent citée entre 30 et 50 %, non vérifiée), ce qui reste acceptable puisque le revenu est un bonus.
  - L'ATT devient un bon exercice mesurable pour la v1.1 (V11-03).
  - **L'UMP reste obligatoire même en non personnalisé** : sans consentement, Google ne sert que des « pubs limitées » ⚠️.
- **Impact.** −3 h. Corrige I-03 et I-04.

### D4. Consentement RGPD (EEE, Royaume-Uni, Suisse)

- **Options.** UMP de Google (gratuit, certifié TCF), CMP tierce payante, ou rien (non conforme).
- **Recommandation : UMP, via le plugin AdMob déjà installé.**
  - Le plugin expose `requestConsentInfo`, `showConsentForm` et `showPrivacyOptionsForm` (vérifié dans `consent/consent-definition.interface.d.ts`).
  - Utiliser le message AdMob **« Réglementations européennes »**, qui couvre l'EEE, le Royaume-Uni et la Suisse. Google exige une CMP certifiée pour la Suisse depuis le 31/07/2024.
  - Vu la cible francophone (FR, CH, LU, MC sont tous dans le périmètre), c'est indispensable dès le lancement.
  - Il faut aussi une entrée « Confidentialité des pubs » dans les Réglages.
- **Impact.** +4 h (ADS-04, ADS-05).

### D5. Sauvegarde cloud

- **Options.**
  - iCloud KVS + Play Games Saved Games derrière `CloudSaveService` (4 à 6 jours d'après l'audit).
  - Backend avec comptes (plusieurs semaines).
  - Rien en V1, avec des filets de sécurité.
- **Recommandation : pas de cloud save en V1**, avec trois filets :
  1. **Android Auto Backup** : `allowBackup="true"` est vérifié dans le template, et Preferences stocke dans SharedPreferences ⚠️ inclus dans la sauvegarde à confirmer sur appareil.
  2. **iOS** : UserDefaults est inclus dans la sauvegarde iCloud de l'appareil, mais pas en cas de suppression puis réinstallation de l'app.
  3. **L'export/import de code** existe déjà et sera expliqué dans la FAQ (MKT-01).
- En v1.1, un seul plugin pourra couvrir cloud save et Game Center / Play Games (V11-02).
- **Impact.** Environ −30 h. Risque accepté et mesuré via les avis.

### D6. Game Center et Play Games Services

- **Recommandation : les reporter en v1.1** et retirer le plugin maintenant.
  - Il casse le build (N-01) et vise Capacitor 5 (N-03).
  - Succès et classements n'aident pas à passer la review.
  - En v1.1, évaluer un plugin Capacitor 8 qui couvre GameKit, Play Games et les sauvegardes (⚠️ exemple : le fork `modbender/capacitor-play-games`, maintenance à vérifier).
- **Impact.** −8 h, et le build est débloqué dès STR-01.

### D7. Langue et pays

- **Options.** Anglais au lancement (environ 45 h : scinder `config.js`, ~750 chaînes, fiches et captures EN) ou français seul en V1 et anglais en v1.1.
- **Recommandation : français seul en V1, soft launch francophone** en France, Suisse, Canada, Luxembourg et Monaco.
  - **Exclure la Belgique** : une loot box payante via des Gems achetables y est un jeu de hasard illégal (jugement d'Anvers, janvier 2025).
  - **Exclure le Brésil** : une loot box y fait passer l'app en 18+.
  - Anglais et ouverture mondiale en v1.1, une fois la rétention et le taux de crash validés.
- **Impact.** −45 h en V1. La fiche EN n'est pas publiée (I-13).

### D8. Catalogue IAP

- **Options.** Garder les 8 produits ou réduire.
- **Recommandation : 4 produits** : `remove_ads` (non consommable), `vip_monthly` (abonnement), `gems_small` et `gems_medium` (consommables).
  - Les trois types d'IAP sont couverts, donc tout l'apprentissage, avec moitié moins de fiches, de captures de review et de tests.
  - `starter_pack` pose un problème de type (N-10) et `stardust_boost` reprend la mécanique de `remove_ads`.
  - Le code masquera ce que le store ne renvoie pas (IAP-08) : on pourra les réactiver en v1.1 sans toucher au code.
- **Impact.** Environ −4 h.

### D9. Nom, identifiants, type de compte

- **Recommandation.**
  - Nom et identifiant : **Spacemerge** et **`com.zappstudio.spacemerge`** (H-1, H-2).
  - Comptes personnels (H-3). Conséquences :
    - Apple affiche ton nom légal comme vendeur.
    - Chez Google, la règle des 12 testeurs pendant 14 jours s'applique.
  - **Statut DSA (UE)** : tu monétises (pubs et IAP), donc tu es a priori un « trader ».
    - Apple affiche alors adresse, téléphone et e-mail sur les fiches UE ; Google a une déclaration équivalente ⚠️.
    - Si tu ne veux pas exposer ton domicile, il faut une adresse professionnelle ⚠️ (acceptation à vérifier ; ceci n'est pas un avis juridique).
  - `SAVE_KEY` reste `cosmerge_save_v2`.
- **Impact.** Identifiant et type de compte décidés le 2026-09-30 ; statut DSA encore à trancher en S1 (CPT-02). Un compte « organisation » demanderait un D-U-N-S (délai de plusieurs semaines) mais dispenserait du test fermé : ce n'est pas rentable ici.

### D10. Mesure et erreurs

- **Options.** Consoles natives seules, consoles + Sentry (erreurs seulement), ou analytics produit (Firebase…).
- **Recommandation : consoles + Sentry, erreurs seulement** (sans PII, sans traces, sans replay).
  - Les consoles (Play vitals, Xcode Organizer, ASC Analytics, RevenueCat, AdMob) ne voient pas les erreurs JS de la WebView.
  - Ce que tu apprends ici se réutilise tel quel en Flutter (`sentry_flutter`).
  - Nouvelle dépendance **acceptée le 2026-09-30**.
- **Impact.** +3 h, plus les déclarations dans les formulaires de confidentialité.

---

## 4. Plan par phases

Format de chaque todo : responsable, plateforme, estimation et dépendances, puis pourquoi, fichiers, étapes et définition de « fait ».

### Phase 0 — Comptes et décisions

**Critère de sortie :** les 4 consoles (App Store Connect, Play Console, AdMob, RevenueCat) sont accessibles, le Paid Apps Agreement est actif, et le §3 porte les valeurs décidées.

- [ ] **CPT-01 · Accepter la licence Xcode et vérifier la chaîne d'outils**
  - Moi · Les deux · **0,5 h** · Dépend de : —
  - Pourquoi : `git` et `pod` échouent tant que la licence n'est pas acceptée (N-14). Capacitor 8 exige Node ≥ 22 et JDK 21 ⚠️.
  - Fichiers : `~/.zshrc`
  - Étapes :
    1. ~~`sudo xcodebuild -license accept`, puis `xcodebuild -runFirstLaunch`.~~ Fait le 2026-09-30 : `git` 2.54 et `pod` 1.16.2 répondent.
    2. ~~Xcode → Settings → Components : installer un runtime iOS Simulator.~~ Fait : runtimes iOS 18.5 et 26.4 présents.
    3. **Reste à faire :** dans `~/.zshrc`, ajouter `export JAVA_HOME=$(/usr/libexec/java_home -v 21)` (le 2026-09-30, `java -version` affiche encore 24). Dans Android Studio : Settings → Build Tools → Gradle → Gradle JDK = 21.
    4. `git --version && pod --version && node -v && java -version`.
  - Fait quand : `git status` et `pod --version` répondent, `java -version` affiche 21, et un simulateur iPhone démarre.

- [ ] **CPT-02 · Figer le nom, l'identifiant d'app et le statut DSA**
  - Moi (+ Collègue pour la recherche de nom) · Les deux · **1 h** · Dépend de : —
  - Pourquoi : l'identifiant ne se change plus après publication. Il conditionne `cap add`, l'App ID Apple, le package Android, AdMob et RevenueCat (P3 `appId`, D9).
  - Fichiers : `docs/LAUNCH_PLAN.md` (§3), `capacitor.config.ts`
  - Étapes :
    1. Collègue : chercher « Spacemerge » sur l'App Store, Google Play et dans une base de marques (EUIPO eSearch, Swissreg ou INPI), puis noter les homonymes.
    2. ~~Vérifier que `https://play.google.com/store/apps/details?id=com.zappstudio.spacemerge` renvoie bien 404.~~ Fait le 2026-09-30.
    3. Trancher trader ou non-trader, et l'adresse publique (D9).
    4. ~~Remplacer « Hypothèse » par « Décidé le … » dans le §3.~~ Fait pour H-2 à H-4 et H-6 ; ajouter le statut DSA une fois tranché.
    5. Mettre l'`appId` final à `capacitor.config.ts:6` et supprimer le commentaire des lignes 3-4, devenu faux.
  - Fait quand : le §3 est à jour et `grep -n "com.example" capacitor.config.ts` ne renvoie rien.

- [ ] **CPT-03 · S'inscrire à l'Apple Developer Program (individuel)** ⏳
  - Moi · iOS · **1 h** (+ 1 à 7 jours de délai Apple ⚠️) · Dépend de : CPT-02
  - Pourquoi : prérequis pour la signature, TestFlight et les IAP. Délai externe : à lancer tôt.
  - Étapes :
    1. App « Apple Developer » → Account → Enroll → Individual. Identité vérifiée par pièce d'identité. 99 USD/an ⚠️ prix local.
    2. Utiliser un Apple ID avec 2FA, dédié au développement (les testeurs Sandbox demandent d'autres adresses e-mail).
  - Fait quand : developer.apple.com/account affiche le programme actif.

- [ ] **CPT-04 · Préparer la Play Console : compte, app, profil marchand** ⏳
  - Moi · Android · **1 h** · Dépend de : CPT-02
  - Pourquoi : l'app doit exister avant le test fermé, et un profil marchand est requis pour créer des produits in-app.
  - Étapes :
    1. Tableau de bord du compte : vérifier identité, téléphone et appareil. Noter si la carte « tests requis avant production » apparaît (confirme H-3).
    2. Créer l'app : « Spacemerge », langue par défaut français (France), Jeu, Gratuite.
    3. Paramètres → Profil de paiement : créer le profil marchand (IBAN, fiscalité).
    4. ⚠️ Remplir la déclaration de statut « trader » (DSA) si Play Console la demande.
  - Fait quand : l'app est listée, et Monétisation → Produits est accessible sans bandeau « profil marchand ».

- [ ] **CPT-05 · Créer le compte AdMob**
  - Moi · Les deux · **0,5 h** · Dépend de : —
  - Étapes : admob.google.com avec le compte Google du projet ; renseigner pays, fuseau et devise. Ne pas encore créer d'app (ADS-01).
  - Fait quand : la console AdMob s'ouvre.

- [ ] **CPT-06 · Créer le compte RevenueCat**
  - Moi · Les deux · **0,5 h** · Dépend de : —
  - Étapes : app.revenuecat.com → projet « Spacemerge ». ⚠️ Vérifier le plafond de revenu du palier gratuit sur revenuecat.com/pricing.
  - Fait quand : le projet est visible.

- [ ] **CPT-07 · App Store Connect : accords, fiscalité, banque, fiche app** ⏳
  - Moi · iOS · **1,5 h** (+ délais de validation) · Dépend de : CPT-03
  - Pourquoi : sans Paid Apps Agreement actif, pas de vente ni de Sandbox IAP ⚠️. Créer la fiche réserve le nom.
  - Étapes :
    1. Business : accepter le Paid Apps Agreement, puis renseigner banque, formulaire fiscal (W-8BEN si tu n'es pas résident US) et contacts.
    2. Certificates, IDs & Profiles → Identifiers : créer l'App ID explicite (CPT-02), sans Game Center.
    3. Apps → + : « Spacemerge », langue principale français, SKU `spacemerge-ios`.
    4. S'inscrire au **Small Business Program** (commission de 15 %).
    5. Business → statut DSA selon D9.
  - Fait quand : Paid Apps apparaît « Active » et la fiche app existe.

- [ ] **CPT-08 · Créer l'adresse e-mail de support**
  - Moi · Les deux · **0,5 h** · Dépend de : CPT-02
  - Pourquoi : e-mail public obligatoire dans les deux stores et dans la politique (I-07).
  - Étapes : créer une adresse dédiée avec transfert vers toi et le Collègue, puis tester l'envoi et la réponse.
  - Fait quand : un mail extérieur arrive, et la réponse repart depuis cette adresse.

### Phase 1 — Structure et outillage

**Critère de sortie :**
- `npm test` et `npm run build:staging` passent en CI.
- `python3 -m http.server -d dist-www 8080` sert un jeu complet.
- `npm run build:release` refuse un build qui contient un ID de test.

- [ ] **STR-01 · Réparer `npm run build` en retirant le plugin Game Center** ★
  - Moi · Les deux · **1 h** · Dépend de : CPT-01
  - Pourquoi : N-01, N-03, D6.
  - Fichiers : `www/js/native-bridge.js`, `package.json`, `package-lock.json`
  - Étapes :
    1. `npm uninstall @openforge/capacitor-game-connect`.
    2. Supprimer l'import (l.24) et le bloc Game Center (l.122-139). `retention.js:248` teste déjà `window.GameCenterService` : rien d'autre à changer.
    3. Réécrire l'en-tête (l.1-15) selon `CLAUDE.md` §4 : plus de GameConnect, plus de « Étape ».
    4. `npm run build`.
  - Fait quand : le build sort en code 0 et `grep -rn "GameConnect\|game-connect" www package.json` ne renvoie rien.

- [ ] **STR-02 · Produire un `dist-www/` complet, sans fichiers web-only** ★
  - Moi · Les deux · **3 h** · Dépend de : STR-01
  - Pourquoi : N-02 (sans ça l'app native est vide), S-1 (fichiers web-only dans le bundle). `debug.js` ne doit jamais partir dans un binaire store.
  - Fichiers : `vite.config.js`, `package.json`, nouveau `scripts/build-native.mjs`, `www/index.html`
  - Étapes (option A recommandée, à valider en la codant) :
    1. Copier `www/` vers `dist-www/` avec `fs.cp` de Node, sans dépendance. Exclure : `js/debug.js`, `js/native-bridge.js` (remplacé par sa version bundlée), `privacy.html`, `social-share.png`, `icon-512.png`, `favicon.png`, `apple-touch-icon.png`.
    2. Bundler **uniquement** `www/js/native-bridge.js` avec Vite en mode `build.lib` (format `es`) vers `dist-www/js/native-bridge.js`, avec `emptyOutDir: false`. L'`index.html` copié le référence déjà (l.665).
    3. Option B si A coince : garder `vite build`, puis copier `js/*.js` et `assets/{tiles,gods,ui}` après le build.
    4. `package.json` : `"build": "node scripts/build-native.mjs"`.
    5. Au-dessus de `index.html:655`, ajouter : `<!-- Load order is the dependency graph (CLAUDE.md §3). -->` (S-0).
  - Fait quand :
    - `ls dist-www/js` liste les 10 scripts et `native-bridge.js`.
    - `ls dist-www/assets/tiles | wc -l` donne 27.
    - Le jeu tourne via `python3 -m http.server -d dist-www 8080`.
    - `dist-www` ne contient ni `debug.js` ni `social-share.png`.

- [ ] **STR-03 · Séparer les IDs de test et les IDs réels, avec un garde-fou de release**
  - Moi · Les deux · **2,5 h** · Dépend de : STR-02
  - Pourquoi : P0-7, N-16. Cliquer sur ses propres pubs réelles peut faire suspendre le compte AdMob.
  - Fichiers : `www/js/native-bridge.js`, `.env.staging`, `.env.production`, `scripts/build-native.mjs`, nouveau `scripts/check-release.mjs`, `package.json`, `.gitignore`
  - Étapes :
    1. Créer les variables Vite `VITE_ADMOB_{REWARDED,INTERSTITIAL}_{IOS,ANDROID}`, `VITE_RC_KEY_{IOS,ANDROID}` et `VITE_ADS_TESTING`.
       - Staging : IDs de test Google officiels **par plateforme** (page AdMob « Test ads »).
       - Production : vides jusqu'à ADS-01 et IAP-04.
       - Ces IDs ne sont pas secrets (ils sont dans le binaire) : les committer.
    2. Dans le bridge : lire `import.meta.env.*` et choisir selon `Capacitor.getPlatform()`.
    3. Scripts : `build:staging` (mode staging) et `build:release` (mode production, puis `check-release.mjs`).
    4. `check-release.mjs` échoue si `dist-www/` contient `3940256099942544`, `YOUR_` ou `debug.js`, si une variable de production est vide, ou si `Info.plist` / `AndroidManifest.xml` contiennent un App ID d'exemple Google.
    5. `.gitignore` : `*.jks`, `*.keystore`, `*.p8`, `*service-account*.json`, `keystore.properties`.
  - Fait quand : `build:release` échoue avec un message clair tant que la production est incomplète, et `build:staging` passe.

- [ ] **STR-04 · Faire suivre `ios/` et `android/` par git**
  - Moi · Les deux · **0,5 h** · Dépend de : —
  - Pourquoi : S-3. `Info.plist`, entitlements, manifest et Gradle sont des sources.
  - Fichiers : `.gitignore`, `CLAUDE.md` §5
  - Étapes :
    1. Retirer `ios/` (l.3).
    2. Ignorer : `ios/App/App/public/`, `ios/App/build/`, `ios/App/Pods/`, `ios/DerivedData/`, `xcuserdata/`, `*.xcuserstate`, `android/.gradle/`, `android/build/`, `android/app/build/`, `android/local.properties`, `android/app/src/main/assets/public/`, `android/.idea/`.
    3. `CLAUDE.md` §5 : remplacer « `ios/` and `android/` are generated (gitignored) » par « `ios/` and `android/` are committed; `cap sync` only regenerates `public/` and the plugin list. »
  - Fait quand : après AND-01 et IOS-01, `git status` ne montre ni `build/`, ni `public/`, ni `Pods/`.

- [ ] **STR-05 · Écrire les tests unitaires de l'économie (sans dépendance)**
  - Moi · Web · **3 h** · Dépend de : STR-01
  - Pourquoi : P2-3. Les formules sont pures, et `node:test` est intégré à Node 24 : pas besoin de Vitest.
  - Fichiers : nouveaux `tests/load-game.mjs`, `tests/economy.test.mjs` ; `package.json` (`"test": "node --test tests/"`)
  - Étapes :
    1. Écrire un helper `vm` qui évalue `config.js`, `state.js`, `gods.js`, `retention.js` et `economy.js` dans l'ordre d'`index.html`, avec un `Game` et un `localStorage` factices.
    2. Tester :
       - `tierProd`, `unlockCost`, `invokeCost` (continuité au softcap) ;
       - `productionMultiplier` (VIP, boost, dieu) et `offlineCapHours` (plafonds 24 et 48) ;
       - `computeOfflineGain` (`retention.js:79`) et `previewBigBangGain` (`economy.js:11`) ;
       - la somme de `BOX_RARITY_WEIGHTS` = 100.
  - Fait quand : au moins 15 tests passent, et casser volontairement `tierProd` en fait échouer un.

- [ ] **STR-06 · CI : build, tests et vérification de syntaxe sur chaque push et PR**
  - Moi · Les deux · **1,5 h** · Dépend de : STR-03, STR-05
  - Fichiers : nouveaux `.github/workflows/ci.yml` et `.nvmrc`
  - Étapes : `actions/setup-node` (depuis `.nvmrc`), `npm ci`, `npm test`, `npm run build:staging`, puis `node --check` sur chaque fichier de `www/js/*.js` sauf `native-bridge.js` (module). Ne pas toucher aux workflows de déploiement.
  - Fait quand : une PR de test est verte, et une PR qui casse un test est rouge.

- [ ] **STR-07 · Nettoyer le dépôt et remettre les docs de build à jour**
  - Moi · Les deux · **1,5 h** · Dépend de : IOS-07 (pour réécrire `BUILD_IOS.md` à partir du vrai build)
  - Pourquoi : P2-2, I-08, I-10, I-16, I-18.
  - Fichiers : `game.html`, `game-full.html`, `assets/ios-icons/`, `README.md`, `docs/BUILD_IOS.md`, nouveau `docs/BUILD_ANDROID.md`, `docs/SAVE_BACKUP.md`, `package.json`
  - Étapes :
    1. Vérifier que rien ne les référence : `grep -rn "game-full\|game.html\|ios-icons" --exclude-dir=node_modules .`. Puis `git rm game.html game-full.html` et `git rm -r assets/ios-icons`.
    2. `BUILD_IOS.md` : retirer le §3, `nebula-merge`, Game Center et ATT ; indiquer Node ≥ 22, SPM, et noter que `SAVE_KEY` garde son nom historique.
    3. `BUILD_ANDROID.md` : JDK 21, keystore, AAB, Play App Signing, license testers, permissions relevées en AND-03.
    4. README et description de `package.json` : iOS + Android, lien vers ce plan.
    5. Ajouter en tête de l'audit et de `SAVE_BACKUP.md` : « Document historique, voir LAUNCH_PLAN.md ».
  - Fait quand : `grep -rn "nebula\|Godspark" README.md docs/BUILD_*.md` ne renvoie rien.

### Phase 2 — Fondations

**Critère de sortie :** sur OnePlus 12, après un kill puis une relance, pas de tutoriel ; un seul modal hors-ligne après 15 min ; le bouton retour ferme la modale ; au plus 7 écritures par minute ; tests de migration verts.

- [ ] **FND-01 · Charger la sauvegarde native avant de démarrer le jeu** ★
  - Moi · Les deux · **4 h** · Dépend de : STR-02
  - Pourquoi : P1-2 (voir §1). C'est le bug le plus dangereux pour les joueurs.
  - Fichiers : `www/js/main.js`, `www/js/state.js`, `www/js/native-bridge.js`, `www/js/config.js`
  - Étapes :
    0. Bridge (N-17) : remplacer `window.HapticService`, `window.AdService` et `window.IAPService` par `HapticService`, `AdService` et `IAPService` (l.39, 75, 85, 99, 112, 115). Les `const` globaux des scripts classiques restent visibles depuis un module ; seule la ligne `window.saveState` (fonction globale, donc bien attachée à `window`) peut rester telle quelle.
    1. `state.js` : extraire `parseSave(raw)`, qui enchaîne JSON → migrations → `migrateRetiredFields` → `deepFill`. `loadState`, `importSaveCode` et le bridge l'utilisent tous les trois.
    2. `main.js` : transformer l'IIFE (l.14) en `window.bootGame(state)`. En fin de fichier, ne démarrer directement que si `!(window.Capacitor && Capacitor.isNativePlatform())`.
    3. Bridge :
       - Remplacer `saveState` en premier.
       - Lire Preferences ; si c'est vide, migrer une fois depuis `localStorage`, puis supprimer cette clé.
       - Appeler `bootGame(parseSave(value))` **avant** AdMob et RevenueCat.
    4. Filet de sécurité : sans boot natif au bout de `NATIVE_BOOT_TIMEOUT_MS` (3000, dans `config.js`), démarrer depuis `localStorage`.
    5. Réécrire les commentaires des lignes touchées (`CLAUDE.md` §4).
  - Fait quand : sur le web, rien ne change. En natif (revérifié en AND-02) : relance sans tutoriel, et un seul modal hors-ligne au bon montant après 15 min.

- [ ] **FND-02 · Remplacer l'effacement par une chaîne de migrations**
  - Moi · Les deux · **3 h** · Dépend de : FND-01, STR-05
  - Pourquoi : P1-4 (`state.js:194`).
  - Fichiers : `www/js/state.js`, nouveau `tests/save.test.mjs`
  - Étapes :
    1. Créer `SAVE_MIGRATIONS = { 1: migrateFromV1 }` et boucler tant que `version < SAVE_VERSION`.
    2. Version inconnue ou future : archiver le brut sous `SAVE_KEY + "_orphan"` (sans changer `SAVE_KEY`), puis démarrer une partie neuve avec un toast.
    3. Tests : passage v1 → v2 ; sauvegarde v2 partielle complétée par `deepFill` ; version future archivée ; JSON corrompu sans exception.
  - Fait quand : `npm test` est vert, et aucune différence de version ne donne de partie neuve sans archive.

- [ ] **FND-03 · Découpler la sauvegarde du tick**
  - Moi · Les deux · **1,5 h** · Dépend de : FND-01
  - Pourquoi : P1-3.
  - Fichiers : `www/js/main.js:98-120`, `www/js/config.js`
  - Étapes :
    1. Au tick, passer un flag `dirty` à vrai.
    2. Persister si `dirty` est vrai et que `PERSIST_INTERVAL_MS` (10 000) est écoulé.
    3. Supprimer la sauvegarde à chaque tick et le `setInterval(AUTOSAVE_MS)` ; retirer `AUTOSAVE_MS` s'il n'est plus utilisé.
    4. Garder hide, pagehide et les `saveState` explicites après les actions.
  - Fait quand : avec un `console.count` temporaire, on compte au plus 7 écritures par minute en jeu passif.

- [ ] **FND-04 · Gérer le cycle de vie natif et le bouton retour Android**
  - Moi · Les deux · **3 h** · Dépend de : FND-01, AND-01
  - Pourquoi : N-06, règles de `CLAUDE.md` §5.
  - Fichiers : `www/js/native-bridge.js`, `www/js/main.js` (exposer `handleAppResume` et `handleAppHide`), `www/js/ui.js` (`closePanel` l.650, `closeDrawer` l.621, modales ouvertes)
  - Étapes :
    1. `App.addListener("appStateChange")` appelle resume ou hide ; la garde anti double-déclenchement existe déjà (`main.js:137`).
    2. `App.addListener("backButton")` ferme la modale, puis le panneau, puis le tiroir. S'il n'y a plus rien d'ouvert, `App.minimizeApp()`.
    3. Sauvegarder en premier dans le handler hide.
  - Fait quand : sur OnePlus 12, le retour ferme la boutique, puis minimise l'app ; au retour après 5 min, un seul modal hors-ligne.

- [ ] **FND-05 · Notifications : permission en contexte et réglage respecté**
  - Moi · Les deux · **2 h** · Dépend de : FND-04
  - Pourquoi : N-05, I-17. Android 13+ exige `POST_NOTIFICATIONS`.
  - Fichiers : `www/js/native-bridge.js:141-162`, `www/js/services.js` (nouveau `NotificationService` web sans effet), `www/js/ui.js:1253-1265`, `www/js/config.js`
  - Étapes :
    1. Supprimer la demande de permission au boot.
    2. Demander la permission quand le joueur active le toggle, ou après son 1er Big Bang.
    3. Ne rien programmer si `settings.notifications` est faux, et annuler les notifications prévues quand on le désactive.
    4. Textes au tutoiement ; délais de 4 h et 20 h en constantes `_MS`.
    5. ⚠️ Dans le manifest fusionné (AND-03), vérifier qu'il n'y a pas de `SCHEDULE_EXACT_ALARM` (sinon, déclaration Play obligatoire).
  - Fait quand : aucun popup système au 1er lancement, et aucune notification quand le toggle est coupé (testé en staging avec un délai de 1 min).

- [ ] **FND-06 · Ne plus importer les achats via le code de sauvegarde**
  - Moi · Les deux · **1 h** · Dépend de : FND-01
  - Pourquoi : P1-6.
  - Fichiers : `www/js/state.js` (`importSaveCode`), `www/js/input.js:611-623`
  - Étapes : dans l'import, remplacer `data.iap` par le `Game.state.iap` actuel. Après IAP-05, relancer aussi `applyEntitlements`.
  - Fait quand : importer un code contenant `iap.removeAds = true` ne retire pas les pubs.

- [ ] **FND-07 · Corriger les liens externes, l'e-mail et la mention « prototype »**
  - Moi · Les deux · **1,5 h** · Dépend de : CPT-08, CMP-01
  - Pourquoi : N-08, N-09, I-07.
  - Fichiers : `www/js/ui.js:1296-1304`, `www/js/config.js`, `www/js/native-bridge.js`
  - Étapes :
    1. Déclarer `PRIVACY_URL`, `TERMS_URL` et `SUPPORT_EMAIL` dans `config.js`, avec les URLs GitHub Pages absolues.
    2. ⚠️ Vérifier sur appareil que Capacitor ouvre les URLs externes dans le navigateur système. Sinon, le joueur resterait coincé sans bouton retour.
    3. Remplacer « v1.0.0 (prototype) » par la vraie version : `App.getInfo()` (version et build) via le bridge, « web » sur le web.
  - Fait quand : les 3 liens ouvrent le navigateur ou le mail et on revient dans l'app intacte ; `grep -rn prototype www/` ne renvoie rien.

### Phase 3 — Build Android

**Critère de sortie :** l'AAB signé est installé sur le OnePlus 12 depuis la piste de test interne, les pubs de test s'affichent et l'icône adaptative est correcte.

- [ ] **AND-01 · Ajouter la plateforme Android** ★
  - Moi · Android · **2 h** · Dépend de : STR-02, STR-04, CPT-02
  - Fichiers : `package.json`, `android/`
  - Étapes :
    1. `npm i @capacitor/android@^8` (même version majeure que `@capacitor/core` 8.5).
    2. `npm run build:staging && npx cap add android`.
    3. Scripts : `sync:android`, `open:android`, et renommer `sync` en `sync:ios`.
    4. Vérifier `android/variables.gradle` (minSdk 24, compile et target 36) et `allowBackup="true"` dans le manifest (D5).
    5. Committer.
  - Fait quand : `npx cap open android` donne une synchronisation Gradle réussie.

- [ ] **AND-02 · Premier lancement sur OnePlus 12 avec les pubs de test** ★
  - Moi · Android · **3 h** · Dépend de : AND-01, FND-01
  - Pourquoi : les APIs des plugins communautaires n'ont jamais été exécutées (`BUILD_IOS.md` l.143-151). Valider aussi FND-01 sur appareil.
  - Fichiers : `android/app/src/main/AndroidManifest.xml`, `www/js/native-bridge.js`
  - Étapes :
    1. Ajouter la meta-data `com.google.android.gms.ads.APPLICATION_ID` avec l'App ID d'exemple Android de Google ⚠️ (page « Test ads »). Il sera remplacé en ADS-01.
    2. Activer le débogage USB, puis Run depuis Android Studio.
    3. Suivre la console via `chrome://inspect` et corriger chaque dérive d'API. Un RevenueCat sans clé doit échouer proprement.
    4. Rejouer le scénario de FND-01.
  - Fait quand : 10 min de jeu, rewarded et interstitiel de test affichés, aucune erreur rouge sauf RevenueCat non configuré.

- [ ] **AND-03 · Bord à bord, zones sûres, orientation, permissions**
  - Moi · Android · **2 h** · Dépend de : AND-02
  - Pourquoi : l'edge-to-edge est imposé en targetSdk ≥ 35. Il faut aussi l'inventaire des permissions pour la Data safety.
  - Fichiers : `android/app/src/main/AndroidManifest.xml`, `www/css/style.css`
  - Étapes :
    1. Tester en navigation gestuelle puis à 3 boutons : ni le header ni la grille ne doivent passer sous les barres.
       - ⚠️ Vérifier que `env(safe-area-inset-*)` est bien rempli par la WebView de Capacitor 8. Sinon, voir la doc Capacitor « System Bars ».
    2. `android:screenOrientation="portrait"` ⚠️. Android 16 ignore cette contrainte sur les écrans ≥ 600 dp.
    3. Android Studio → Merged Manifest : lister les permissions (INTERNET, AD_ID, POST_NOTIFICATIONS, BILLING…) pour CMP-03, CMP-04 et `BUILD_ANDROID.md`.
    4. ⚠️ `StatusBar.setBackgroundColor` peut être sans effet en edge-to-edge : l'adapter si besoin.
  - Fait quand : captures sans chevauchement dans les deux modes de navigation, et liste des permissions notée.

- [ ] **AND-04 · Icônes adaptatives, splash et icône de notification**
  - Moi · Android · **1,5 h** · Dépend de : AST-01, AST-02
  - Pourquoi : N-12, N-13.
  - Fichiers : `assets/icon-only.png`, `assets/icon-foreground.png`, `assets/icon-background.png`, `assets/splash.png`, `assets/splash-dark.png`, `package.json`, `android/app/src/main/res/`
  - Étapes :
    1. Déposer les fichiers du Collègue sous ces noms exacts.
    2. Script `"assets": "capacitor-assets generate"` (sans `--ios`).
    3. Lancer `npx capacitor-assets generate --android`.
    4. Créer `ic_stat_icon` : icône blanche sur fond transparent, via Android Studio → Image Asset → Notification Icons.
  - Fait quand : l'icône s'affiche bien dans les formes rond et squircle, en version monochrome si les icônes à thème sont activées, et une notif de test montre l'icône (pas un carré blanc).

- [ ] **AND-05 · Créer la clé d'upload et activer Play App Signing**
  - Moi · Android · **1,5 h** · Dépend de : CPT-04
  - Pourquoi : sans clé d'upload, pas de mise à jour possible. Avec Play App Signing, Google garde la clé de signature et une clé d'upload perdue peut être réinitialisée par le support.
  - Fichiers : `android/keystore.properties` (gitignoré), `android/app/build.gradle`
  - Étapes :
    1. `keytool -genkeypair -v -keystore ~/secure/spacemerge-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`.
    2. Ranger le `.jks` et les mots de passe dans un gestionnaire de mots de passe, **plus** une 2e copie chiffrée hors du Mac. Jamais dans git.
    3. Dans `build.gradle`, faire lire `keystore.properties` par `signingConfigs.release`.
    4. ⚠️ À l'upload (AND-06), vérifier que Play App Signing est actif.
  - Fait quand : `./gradlew bundleRelease` produit un AAB signé, et restaurer le `.jks` depuis la 2e copie a été testé.

- [ ] **AND-06 · Construire l'AAB release et le publier en test interne** ★
  - Moi · Android · **2 h** · Dépend de : AND-05, STR-03
  - Fichiers : `android/app/build.gradle`
  - Étapes :
    1. `versionCode 1` et `versionName "1.0.0"` ; règle : versionCode +1 à chaque upload.
    2. `npm run build:staging && npx cap sync android`, puis Generate Signed App Bundle.
    3. Play Console → Test interne : uploader l'AAB et ajouter les testeurs (toi et le Collègue).
    4. Installer depuis le lien de test, puis lire le rapport pré-lancement 1 à 2 jours plus tard ⏳.
  - Fait quand : l'app s'installe depuis le Play Store et le rapport pré-lancement ne montre aucun crash.

### Phase 4 — Pubs et consentement

**Critère de sortie :** en staging avec la géographie EEE, le formulaire UMP s'affiche au 1er lancement, la rewarded n'est accordée qu'après visionnage complet, l'entrée des Réglages fonctionne et `app-ads.txt` est servi à la racine.

- [ ] **ADS-01 · Créer les apps et les blocs AdMob, et le message RGPD**
  - Moi · Les deux · **1,5 h** · Dépend de : CPT-05, CPT-02
  - Fichiers : `.env.production`, `android/app/src/main/AndroidManifest.xml`
  - Étapes :
    1. Créer 2 apps « Spacemerge » (Android et iOS), marquées « non publiée ».
    2. Pour chacune, créer un bloc Récompense `rewarded_main` et un bloc Interstitiel `interstitial_bigbang`.
    3. Confidentialité et messages → « Réglementations européennes » : un message en français pour les 2 apps, avec « Gérer les options » et le lien vers la politique.
    4. Reporter les IDs dans `.env.production`, et l'App ID Android dans le manifest (l'App ID iOS se fait en IOS-03).
  - Fait quand : les 4 blocs sont visibles et le message RGPD est publié.

- [ ] **ADS-02 · Supprimer la bannière placeholder**
  - Moi · Web · **0,5 h** · Dépend de : —
  - Pourquoi : P0-2 (D2).
  - Fichiers : `www/index.html:160-162`, `www/css/style.css:309` (`.bannerAd`), `www/js/ui.js:23`, `www/js/ui.js:393`
  - Étapes : supprimer le `div`, la règle CSS, `dom.bannerAd` et la ligne 393. Puis bump du cache-buster dans un commit séparé (`CLAUDE.md`).
  - Fait quand : `grep -rn "bannerAd" www/` ne renvoie rien.

- [ ] **ADS-03 · Rewarded confirmée par le SDK, pubs non personnalisées**
  - Moi · Les deux · **3 h** · Dépend de : STR-03, AND-02
  - Pourquoi : N-07, D3. Règle de `CLAUDE.md` : « Rewarded ads grant only after the SDK confirms the reward ».
  - Fichiers : `www/js/native-bridge.js:67-93`
  - Étapes :
    1. Écouter `RewardAdPluginEvents.Rewarded`, `Dismissed` et `FailedToShow`. Ne renvoyer `true` que si `Rewarded` arrive avant `Dismissed`.
    2. Passer `npa: true` sur les deux formats.
    3. Précharger la pub suivante à la fermeture. Sans pub disponible, renvoyer `false` : les appelants gèrent déjà le cas `!ok`.
    4. Piloter `initializeForTesting` et `testingDevices` par `VITE_ADS_TESTING`.
  - Fait quand : fermer la pub avant la fin ne donne aucune récompense, la regarder en entier donne la récompense, et en mode avion on a un message sans blocage.

- [ ] **ADS-04 · Consentement UMP avant toute requête de pub**
  - Moi · Les deux · **3 h** · Dépend de : ADS-01, ADS-03
  - Pourquoi : N-04, D4.
  - Fichiers : `www/js/native-bridge.js`
  - Étapes :
    1. Après `bootGame`, sans bloquer le jeu : appeler `AdMob.requestConsentInfo()`. Si le formulaire est disponible et que le statut vaut `REQUIRED`, appeler `AdMob.showConsentForm()`.
    2. Ne charger les pubs qu'après ce flux. ⚠️ Vérifier le nom exact du champ « peut demander des pubs » dans `consent/consent-info.interface.d.ts`.
    3. En staging, forcer `debugGeography` EEE avec l'ID de test de l'appareil (loggé par le SDK).
    4. Ne jamais appeler `requestTrackingAuthorization` (D3).
  - Fait quand : en staging EEE, le formulaire s'affiche une seule fois ; après un refus, les pubs s'affichent en mode limité ou échouent proprement.

- [ ] **ADS-05 · Ajouter « Confidentialité des pubs » dans les Réglages**
  - Moi · Les deux · **1 h** · Dépend de : ADS-04
  - Pourquoi : un moyen de modifier son consentement est exigé quand il est requis ⚠️ (`privacyOptionsRequirementStatus`).
  - Fichiers : `www/js/ui.js` (`renderSettingsPanel`, l.1249), `www/js/services.js`, `www/js/native-bridge.js`
  - Étapes : `AdService.hasPrivacyOptions()` et `AdService.showPrivacyOptions()`, sans effet sur le web ; en natif, `AdMob.showPrivacyOptionsForm()`. Le bouton n'est affiché que si c'est requis.
  - Fait quand : en EEE le bouton rouvre le formulaire ; hors EEE il est masqué.

- [ ] **ADS-06 · Publier le site racine et `app-ads.txt`**
  - Moi · Web · **1,5 h** · Dépend de : MKT-01, ADS-01
  - Pourquoi : AdMob exige la vérification `app-ads.txt` pour les nouvelles apps (depuis janvier 2025) avant la revue « app readiness ». Le fichier doit être à la **racine** du domaine indiqué comme site du développeur dans les fiches store ; `…github.io/spacemerge/` est un sous-chemin, donc ne suffit pas ⚠️.
  - Fichiers : nouveau dépôt `ZAPPAgency/zappagency.github.io`
  - Étapes :
    1. Créer ce dépôt, y mettre la landing (MKT-01) et `app-ads.txt`, avec la ligne fournie par AdMob → Apps → app-ads.txt.
    2. Déclarer `https://zappagency.github.io` comme site web dans la fiche Play et comme URL marketing et support dans App Store Connect.
    3. `curl -s https://zappagency.github.io/app-ads.txt`.
  - Fait quand : curl renvoie la ligne `google.com, pub-…, DIRECT, f08c47fec0942fa0`.

- [ ] **ADS-07 · Tester les pubs de bout en bout**
  - Moi · Android (iOS en DST-06) · **2 h** · Dépend de : ADS-04, ADS-05
  - Étapes : dérouler cette matrice :
    - 1er lancement en EEE et hors EEE ; consentement accepté puis refusé ;
    - chaque emplacement rewarded (`grep -n "watchRewardedAd(" www/js/*.js`) ;
    - interstitiel après Big Bang (pas dans la 1re minute, 3 min d'écart minimum : `config.js:35-36`) ;
    - avec `remove_ads` : aucune pub et bonus accordés directement ;
    - mode avion ; bouton retour pendant une pub.
  - Fait quand : la matrice est cochée dans `QA_CHECKLIST.md` (CMP-07).

- [ ] **ADS-08 · Passer aux IDs réels au bon moment**
  - Moi · Les deux · **1 h** · Dépend de : ADS-07, DST-03
  - Pourquoi : IDs de test pendant tout le dev et la QA (le trafic invalide peut suspendre le compte). Les IDs réels ne servent qu'au build de production.
  - Étapes :
    1. Remplir `.env.production` puis lancer `npm run build:release` : le garde-fou doit passer.
    2. Déclarer le OnePlus 12 et l'iPhone de test dans AdMob → Paramètres → Appareils de test.
    3. Ne jamais cliquer sur une pub réelle depuis un autre appareil.
  - Fait quand : sur un appareil de test, le build release montre des pubs marquées comme test ⚠️, et le garde-fou passe.

### Phase 5 — Conformité et observabilité

**Critère de sortie :** la politique publiée décrit le comportement réel, et les formulaires Play « Contenu de l'app », Apple App Privacy et classification d'âge sont remplis sans contradiction.

- [ ] **CMP-01 · Réécrire et publier la politique de confidentialité**
  - Moi · Les deux · **3 h** · Dépend de : D3, D10, CPT-08
  - Pourquoi : I-03, I-05, I-06. Apple 5.1.1(i) et Google exigent une politique exacte, publique et accessible dans l'app.
  - Fichiers : `www/privacy.html` (publié automatiquement par `deploy.yml`), `docs/privacy-policy.html` (doublon identique : le supprimer et pointer vers l'URL)
  - Étapes :
    1. Rendre le texte valable pour l'App Store et pour Google Play.
    2. Lister les traitements réels :
       - sauvegarde locale, plus la sauvegarde système (Android Auto Backup, iCloud) ;
       - AdMob non personnalisé : ID d'appareil, IP (donc localisation approximative), interactions, diagnostics ;
       - UMP : consentement TCF ;
       - RevenueCat : ID anonyme et historique d'achats ;
       - Sentry : erreurs, sans PII.
    3. Ajouter bases légales, durée de conservation, droits (suppression via l'e-mail support), autorité de contrôle (CNIL ou PFPDT ⚠️ selon H-7), contact et date.
    4. Retirer ATT, bannière et Game Center.
    5. ⚠️ Ceci n'est pas un avis juridique : faire relire si possible.
  - Fait quand : `https://zappagency.github.io/spacemerge/privacy.html` sert la nouvelle version, et chaque SDK de `package.json` y est cité.

- [ ] **CMP-02 · Rendre exactes les probabilités de la Boîte Cosmique**
  - Moi · Les deux · **2 h** · Dépend de : —
  - Pourquoi : N-11. Apple 3.1.1 et la politique Monétisation de Google exigent les probabilités **avant** l'achat.
  - Fichiers : `www/js/gods.js:199-226`, `www/js/config.js:1094-1104`, `www/js/ui.js` (carte boutique), `tests/`
  - Étapes :
    1. Écrire une fonction pure `cosmicBoxOdds(state)` :
       - poids des raretés qui ont encore un Dieu non possédé, renormalisés ;
       - si tout est possédé : tranches de Gems calculées à partir de la loi au carré.
    2. Générer l'affichage de la carte et de la modale depuis cette fonction, au lieu de pourcentages en dur.
    3. Tester : total de 100 % et cas « tous les communs possédés ».
    4. Fiche store : « Probabilités affichées dans le jeu avant chaque ouverture ».
  - Fait quand : avec les 3 communs possédés, la carte affiche Rare 60 %, Épique 30 %, Légendaire 10 %, et les tests passent.

- [ ] **CMP-03 · Remplir la Sécurité des données (Data safety) Google Play**
  - Moi · Android · **1,5 h** · Dépend de : CMP-01, AND-03, OBS-01
  - Étapes :
    1. Collecte : Oui.
    2. Types de données :
       - ID d'appareil (AdMob, AD_ID) ;
       - localisation approximative (IP via AdMob) ⚠️ ;
       - interactions dans l'app (AdMob) ;
       - plantages et diagnostics (AdMob, Sentry) ;
       - historique d'achats (RevenueCat, Google Play).
    3. Finalités : publicité, fonctionnalité, analyse, prévention de la fraude.
    4. Chiffrement en transit : Oui. Suppression : sur demande par e-mail.
    5. Sources : pages Google AdMob « data disclosure » et RevenueCat « Google Play's Data Safety ».
  - Fait quand : la section est marquée terminée, et l'aperçu est recopié dans `docs/PLAY_DATA_SAFETY.md`.

- [ ] **CMP-04 · Compléter le « Contenu de l'app » Google Play**
  - Moi · Android · **1,5 h** · Dépend de : CPT-04, CMP-01
  - Étapes :
    1. URL de la politique ; accès à l'app sans restriction.
    2. Annonces : Oui ; identifiant publicitaire utilisé pour la publicité.
    3. IARC : répondre Oui pour les achats intégrés et les objets aléatoires payants ⚠️ selon le questionnaire.
    4. Public cible **13 ans et plus** (évite la politique Familles), et « n'attire pas particulièrement les enfants » ⚠️ Google peut le contester.
    5. Statut trader ⚠️. Actualités, santé et finance : Non.
  - Fait quand : le tableau de bord « Configurer votre application » n'a plus de tâche, hormis la fiche.

- [ ] **CMP-05 · Remplir App Privacy (App Store Connect)**
  - Moi · iOS · **1,5 h** · Dépend de : CMP-01, CPT-07, IOS-04
  - Étapes :
    1. Même inventaire que CMP-03, avec les catégories Apple :
       - Identifiants : ID d'appareil ;
       - Localisation approximative ⚠️ ;
       - Utilisation : interactions produit, données publicitaires ;
       - Diagnostics : plantages, performances, autres ;
       - Achats : historique.
    2. Tracking : Non en V1 ⚠️, à confirmer avec la définition Apple et la colonne « tracking » de la page Google.
    3. Comparer avec le rapport de confidentialité Xcode (IOS-04).
  - Fait quand : App Privacy est publié, sans contradiction avec CMP-01 ni avec le rapport Xcode.

- [ ] **CMP-06 · Classification d'âge, chiffrement, URLs et disponibilité côté Apple**
  - Moi · iOS · **1,5 h** · Dépend de : CPT-07
  - Étapes :
    1. Remplir le nouveau questionnaire d'âge (obligatoire depuis le 31/01/2026) : loot box Oui, publicité Oui. Noter la classe obtenue (⚠️ probablement 9+ ou 13+).
    2. Chiffrement : `ITSAppUsesNonExemptEncryption = NO` (HTTPS standard seulement ; la clé est ajoutée en IOS-03).
    3. Renseigner les URLs de confidentialité, de support et marketing.
    4. Disponibilité selon D7 : sans la Belgique ni le Brésil.
    5. Prix : gratuit.
  - Fait quand : App Information et Pricing & Availability n'ont plus de champ manquant.

- [ ] **CMP-07 · Aligner les docs de conformité sur ce qui est livré**
  - Moi · Les deux · **2 h** · Dépend de : CMP-03, CMP-04, ADS-07 (la partie Apple se complète en 15 min après CMP-05 et CMP-06)
  - Pourquoi : I-03, I-04, I-05, I-11, I-12. Règle `CLAUDE.md` §5 : garder ces docs synchronisés.
  - Fichiers : `docs/APP_PRIVACY_ANSWERS.md`, `docs/AGE_RATING_ANSWERS.md`, `docs/QA_CHECKLIST.md`, `docs/APP_STORE_METADATA.md`, `docs/PLAY_DATA_SAFETY.md`
  - Étapes :
    1. Écrire les réponses effectivement soumises.
    2. Refaire la QA en colonnes iOS et Android, avec les scénarios FND, ADS et IAP.
    3. Retirer Fusion Express, la bannière et l'ATT.
  - Fait quand : le Collègue a relu, sans trouver de contradiction avec `privacy.html`.

- [ ] **OBS-01 · Remonter les erreurs JS avec Sentry (sans données personnelles)**
  - Moi · Les deux · **3 h** · Dépend de : STR-03 (dépendance acceptée le 2026-09-30)
  - Pourquoi : P3, D10.
  - Fichiers : `package.json`, `www/js/native-bridge.js`, `.env.*`
  - Étapes :
    1. Installer `@sentry/capacitor` et son SDK web associé ⚠️ (paquets et versions compatibles Capacitor 8 : voir la doc Sentry).
    2. Initialiser dans le bridge seulement : DSN en variable Vite, `sendDefaultPii: false`, sans traces ni replay, `release` = version de l'app.
    3. Dans Sentry, activer « Prevent storing of IP addresses ».
    4. Provoquer une erreur volontaire en staging.
  - Fait quand : l'erreur provoquée sur le OnePlus 12 apparaît dans Sentry avec la version et sans IP.

### Phase 6 — Assets et fiches store (surtout le Collègue)

**Critère de sortie :** tous les visuels et textes sont aux formats exigés, comptés et validés par toi.

- [ ] **AST-01 · Livrer l'icône 1024×1024 et les sources de génération**
  - Collègue · Les deux · **3 h** · Dépend de : — · Échéance : fin S2
  - Pourquoi : l'ancien jeu d'icônes est obsolète (`QA_CHECKLIST.md` l.117-123). Apple exige un PNG 1024×1024 sans transparence ni coins arrondis.
  - Fichiers : `assets/icon-only.png`, `assets/splash.png`, `assets/splash-dark.png` (2732×2732, logo centré, fond `#05040d`)
  - Étapes : redessiner en 1024 dans Figma (pas d'agrandissement de `www/icon-512.png`), exporter sans canal alpha, vérifier la lisibilité à 40 px.
  - Fait quand : `file assets/icon-only.png` affiche « 1024 x 1024, 8-bit/color RGB », et tu l'as validée à 40 px.

- [ ] **AST-02 · Icône adaptative Android et icône Play 512**
  - Collègue · Android · **2 h** · Dépend de : AST-01 · Échéance : fin S3
  - Fichiers : `assets/icon-foreground.png`, `assets/icon-background.png` (1024×1024)
  - Étapes :
    1. Placer le sujet dans la zone sûre centrale (66/108 dp ⚠️).
    2. Prévoir une version monochrome pour les icônes à thème (Android 13+).
    3. Exporter l'icône Play : 512×512, PNG 32 bits, ≤ 1 Mo.
  - Fait quand : aucun rognage dans les masques rond, squircle et carré.

- [ ] **AST-03 · Feature graphic Google Play**
  - Collègue · Android · **2 h** · Dépend de : AST-01 · Échéance : fin S4
  - Étapes : 1024×500, JPEG ou PNG 24 bits sans alpha, sans texte important près des bords ⚠️, sans prix ni classement.
  - Fait quand : le fichier est validé par toi et accepté par Play Console.

- [ ] **AST-04 · Captures Android**
  - Collègue · Android · **3 h** · Dépend de : AND-02 · Échéance : fin S4
  - Étapes : 4 à 8 captures portrait 9:16 (1080×1920 minimum recommandé ⚠️ ; limites 320 à 3 840 px). Scènes : grille et fusion, Dieux, Big Bang, boutique. Accroche en français en surimpression.
  - Fait quand : les captures sont acceptées par la fiche Play.

- [ ] **AST-05 · Captures iPhone 6,9"**
  - Collègue · iOS · **3 h** · Dépend de : IOS-01 · Échéance : S15
  - Étapes : 3 à 10 captures en 1320×2868 ou 1290×2796 ⚠️ (App Store Connect Help → Screenshot specifications), depuis le simulateur iPhone Pro Max. Mêmes scènes qu'en AST-04. Pas d'iPad (IOS-03).
  - Fait quand : les captures sont acceptées par App Store Connect.

- [ ] **AST-06 · Textes des fiches en français (Apple et Google), comptés et relus**
  - Collègue (rédaction) + Moi (relecture 0,5 h) · Les deux · **3 h** · Dépend de : D7 · Échéance : fin S4 (Play), S15 (champs Apple)
  - Fichiers : `docs/APP_STORE_METADATA.md` (ajouter une section Google Play)
  - Étapes :
    1. Corriger I-01 et I-02.
    2. Apple : nom (30), sous-titre (30), texte promo (170), description (4 000), mots-clés (100 octets ⚠️).
    3. Google : titre (30), description courte (80), description complète (4 000).
    4. Dans la description Apple : probabilités et lien vers les conditions d'utilisation (EULA).
    5. Compter chaque champ avec `node -e`.
    6. Ne pas publier la fiche EN (I-13).
  - Fait quand : chaque champ est sous sa limite, tu as relu, et il n'y a plus de « neuf » ou « 12 Dieux ».

- [ ] **AST-07 · Captures de review des IAP (Apple)**
  - Moi · iOS · **0,5 h** · Dépend de : IAP-09, IOS-01
  - Étapes : une capture par produit, plus la carte Pass avec ses mentions, jointes à chaque IAP dans App Store Connect.
  - Fait quand : les 4 IAP ont leur capture.

### Phase 7 — Monétisation

**Critère de sortie :** sur les deux stores en sandbox, achat, annulation, restauration après réinstallation et expiration de l'abonnement fonctionnent, et les prix locaux sont identiques à ceux de la feuille du store.

- [ ] **IAP-01 · Réduire le catalogue au périmètre V1**
  - Moi · Les deux · **1 h** · Dépend de : D8
  - Pourquoi : D8, N-10.
  - Fichiers : `www/js/config.js:1112-1179`, `www/js/retention.js:51-55`, `www/js/ui.js` (promos, vers l.1640-1665)
  - Étapes :
    1. Garder tout `IAP_CATALOG` pour la simulation web. Sur natif, seul ce que l'offering renvoie sera affiché (IAP-08).
    2. Créer `IAPService.isAvailable(id)` (toujours vrai sur le web). La promo starter pack (`retention.js:51`) ne se déclenche que si ce produit est disponible.
    3. Passer `starter_pack.type` à `consumable` pour la v1.1 : l'achat unique est déjà géré par `iap.starterPack`.
  - Fait quand : en natif, la boutique affiche 4 produits et aucune promo n'annonce un produit absent.

- [ ] **IAP-02 · Créer les produits dans App Store Connect**
  - Moi · iOS · **2 h** · Dépend de : CPT-07
  - Étapes :
    1. In-App Purchases : `remove_ads` (Non-Consumable), `gems_small` et `gems_medium` (Consumable). Pour chacun : prix, nom et description en français, capture et note de review (AST-07).
    2. Subscriptions : groupe « Pass Supernova », produit `vip_monthly` d'un mois.
    3. Garder les mêmes IDs que le code et Google.
    4. Passer en « Ready to Submit » : ils partiront avec la 1re version (REL-02).
  - Fait quand : les 4 produits sont prêts à soumettre.

- [ ] **IAP-03 · Créer les produits dans Play Console**
  - Moi · Android · **1,5 h** · Dépend de : AND-06 (un AAB contenant la bibliothèque Billing doit déjà être uploadé), CPT-04
  - Étapes :
    1. Produits intégrés : `remove_ads`, `gems_small`, `gems_medium`.
    2. Abonnements : `vip_monthly`, avec un base plan `monthly` renouvelable automatiquement chaque mois, sans essai.
    3. Tout activer.
    4. Paramètres → Test de licence : ajouter ton Gmail et celui du Collègue.
  - Fait quand : 3 produits et 1 abonnement sont actifs.

- [ ] **IAP-04 · Configurer RevenueCat : apps, clés, entitlements, offering** ⏳
  - Moi · Les deux · **3 h** (2,5 h Android en S9, 0,5 h iOS en S16) · Dépend de : IAP-03 (Android), IAP-02 (iOS), CPT-06
  - Étapes :
    1. **Android** : compte de service Google Cloud avec l'API Google Play Android Developer, invité dans Play Console avec les droits indiqués par RevenueCat ⚠️. Uploader le JSON (jamais committé). La validation peut prendre jusqu'à 36 h ⚠️.
    2. **iOS** : clé In-App Purchase `.p8` (App Store Connect → Users and Access → Integrations) ⚠️.
    3. Importer les produits, et **marquer `remove_ads` comme non consommable** côté Android, sinon il pourrait être consommé ⚠️ (vérifier dans la doc RevenueCat).
    4. Entitlements : `no_ads` ← `remove_ads` + `vip_monthly` ; `vip` ← `vip_monthly`.
    5. Offering `default` avec 4 packages.
    6. Mettre les clés publiques `goog_…` et `appl_…` dans les deux fichiers `.env.*`.
  - Fait quand : RevenueCat indique des identifiants valides pour chaque store, et l'offering contient 4 packages.

- [ ] **IAP-05 · Faire de RevenueCat la source de vérité des droits** ★
  - Moi · Les deux · **3 h** · Dépend de : IAP-04, FND-01
  - Pourquoi : P0-3.
  - Fichiers : `www/js/state.js` (nouveau `applyEntitlements`), `www/js/native-bridge.js`, `www/js/input.js:1039-1103`
  - Étapes :
    1. `applyEntitlements(state, customerInfo)` :
       - `removeAds` = `no_ads` actif ;
       - `vipUntil` = date d'expiration de `vip`, 0 sinon ;
       - ne touche jamais aux Gems.
    2. L'appeler au boot (`getCustomerInfo`, après `bootGame`), après chaque achat et dans `addCustomerInfoUpdateListener`.
    3. Sur natif, `onBuyIAP` n'écrit plus de flag local pour `remove_ads` et `vip_monthly`. La simulation web garde son comportement.
    4. Hors connexion, garder la dernière valeur connue.
    5. Relancer `applyEntitlements` après un import de sauvegarde (FND-06).
  - Fait quand : en sandbox, un abonnement expiré (le « mois » dure 5 min ⚠️) retire le VIP, et une réinstallation suivie d'une restauration le rend.

- [ ] **IAP-06 · Sécuriser l'achat : consommables crédités une seule fois, annulation, attente**
  - Moi · Les deux · **2,5 h** · Dépend de : IAP-05
  - Pourquoi : règle de `CLAUDE.md` « purchases only after the store confirms », et N-16.
  - Fichiers : `www/js/native-bridge.js:102-114`, `www/js/input.js:1039-1103`, `www/js/state.js` (`defaultState` : `iap.grantedTransactions: []`, champ additif, pas de bump de `SAVE_VERSION`)
  - Étapes :
    1. Retrouver le package par ID produit en ignorant le suffixe du base plan Android (`vip_monthly:monthly` ⚠️ format RevenueCat) : aujourd'hui `native-bridge.js:105` ne le trouverait pas.
    2. Si l'utilisateur annule (`userCancelled`), rester silencieux.
    3. Consommables : créditer via `grantGems` (N-16), une seule fois par `transactionIdentifier` (liste persistée), puis `saveState` immédiatement.
    4. Achat en attente (Ask to Buy, paiement différé Google) : afficher « Achat en attente de validation » et ne rien créditer ⚠️. Le crédit différé (réconciliation par `nonSubscriptionTransactions`) est à décider en v1.1.
    5. Désactiver le bouton pendant l'achat.
  - Fait quand : un double tap n'ouvre qu'une feuille d'achat, et tuer l'app juste après la confirmation ne crédite pas deux fois.

- [ ] **IAP-07 · Restaurer réellement les achats** ★
  - Moi · Les deux · **1 h** · Dépend de : IAP-05
  - Pourquoi : P0-1 (Guideline 3.1.1).
  - Fichiers : `www/js/native-bridge.js:115-117`, `www/js/input.js:1104-1108`
  - Étapes :
    1. Le bridge renvoie `customerInfo`, ou `null` en cas d'échec.
    2. Côté jeu : `applyEntitlements`, `saveState`, `renderAll`.
    3. Toast selon le résultat : « Achats restaurés », « Aucun achat à restaurer » ou « Restauration impossible, réessaie ».
  - Fait quand : après une réinstallation propre, « Restaurer » retire les pubs sur les deux stores.

- [ ] **IAP-08 · Afficher les prix du store et masquer les produits indisponibles**
  - Moi · Les deux · **2,5 h** · Dépend de : IAP-04
  - Pourquoi : P0-5.
  - Fichiers : `www/js/native-bridge.js`, `www/js/services.js`, `www/js/ui.js:700-829`
  - Étapes :
    1. Au boot : `getOfferings()` donne pour chaque ID le `priceString`, le prix numérique et la période. Les exposer via `IAPService.getProducts()` (catalogue simulé sur le web).
    2. Boutique :
       - « Chargement… » tant que les offres ne sont pas là ;
       - un produit absent de l'offering est masqué ;
       - hors connexion : « Boutique indisponible hors connexion ».
    3. `passGemsValueBadgeText` : utiliser le prix numérique au lieu de parser la chaîne.
  - Fait quand : téléphone en CHF, la boutique affiche le même montant que la feuille Google Play ⚠️ (format exact à vérifier).

- [ ] **IAP-09 · Mentions légales au point d'achat de l'abonnement** ★
  - Moi · Les deux · **2,5 h** · Dépend de : IAP-08, IAP-10, FND-07
  - Pourquoi : P0-4 (Apple 3.1.2) et politique Abonnements de Google Play.
  - Fichiers : `www/js/ui.js` (carte Pass, modale de confirmation), `www/js/config.js`, `www/js/services.js` (`PlatformService` : la plateforme vient du bridge, le jeu n'importe jamais Capacitor)
  - Étapes : sous la carte Pass et dans la modale, afficher :
    1. Titre, durée et prix par période, venant du store.
    2. « Renouvellement automatique sauf résiliation au moins 24 h avant la fin de la période. Gérable dans les réglages de ton compte App Store / Google Play. »
    3. Liens : conditions d'utilisation (iOS : EULA standard Apple ; Android : `terms.html`) et confidentialité.
    4. Bouton « Gérer mon abonnement » :
       - iOS : `https://apps.apple.com/account/subscriptions` ;
       - Android : `https://play.google.com/store/account/subscriptions?package=<id>` ⚠️ format.
  - Fait quand : une capture de la carte Pass montre les 5 éléments, et chaque lien s'ouvre sur appareil.

- [ ] **IAP-10 · Rédiger et publier les conditions d'utilisation**
  - Moi · Les deux · **1,5 h** · Dépend de : CPT-08
  - Fichiers : nouveau `www/terms.html` (style de `privacy.html`)
  - Étapes :
    1. Éditeur, objet du service.
    2. Achats et abonnement : renouvellement, résiliation, remboursements gérés par Apple et Google.
    3. Monnaie virtuelle sans valeur réelle, probabilités de la Boîte, contact, droit applicable ⚠️.
    4. Renvoi vers l'EULA standard d'Apple pour iOS.
    5. ⚠️ Ceci n'est pas un avis juridique.
  - Fait quand : `https://zappagency.github.io/spacemerge/terms.html` répond.

- [ ] **IAP-11 · Tester Google Play Billing avec des testeurs de licence**
  - Moi · Android · **3 h** · Dépend de : IAP-05 à IAP-10
  - Étapes :
    1. Installer depuis la piste de test avec un compte testeur de licence.
    2. Utiliser les cartes de test « toujours approuvée », « toujours refusée » et « lente ».
    3. Scénarios :
       - chaque produit ; annulation ; refus ; paiement en attente ;
       - renouvellement accéléré de l'abonnement ⚠️ (quelques minutes) ;
       - résiliation depuis le Play Store, puis expiration ;
       - remboursement depuis Play Console ⚠️ (délai) ;
       - réinstallation puis restauration ; mode avion.
  - Fait quand : les scénarios sont cochés (colonne Android) et les transactions sont visibles dans RevenueCat (sandbox).

- [ ] **IAP-12 · Tester StoreKit (local, puis Sandbox)**
  - Moi · iOS · **3 h** · Dépend de : IAP-05 à IAP-10, IOS-07
  - Étapes :
    1. Créer un fichier StoreKit Configuration synchronisé avec App Store Connect, et tester sur simulateur : achat, échec, Ask to Buy, renouvellement accéléré.
    2. Sandbox :
       - créer un testeur dans App Store Connect (Utilisateurs et accès → Sandbox) ;
       - sur l'iPhone : Réglages → Développeur → compte Sandbox ⚠️ ;
       - rejouer les scénarios d'IAP-11.
    3. ⚠️ Non vérifié : achats Sandbox sur simulateur.
  - Fait quand : les scénarios sont cochés (colonne iOS) et visibles dans RevenueCat.

### Phase 8 — Build iOS

**Critère de sortie :** le build est installé sur un iPhone réel via TestFlight, et le rapport de confidentialité Xcode est généré.

- [ ] **IOS-01 · Ajouter la plateforme iOS (SPM) et lancer sur simulateur**
  - Moi · iOS · **2,5 h** · Dépend de : STR-02, STR-04, CPT-01, CPT-02, ADS-01
  - Fichiers : `ios/`, `package.json`
  - Étapes :
    1. `npm run build:staging && npx cap add ios`. SPM est le mode par défaut de Capacitor 8 : ne pas mélanger avec CocoaPods.
    2. Vérifier la présence des packages AdMob et RevenueCat (les deux ont un `Package.swift`, vérifié).
    3. Ajouter tout de suite `GADApplicationIdentifier` dans `Info.plist` (sinon crash au lancement ⚠️).
    4. Run sur simulateur, console via Safari → Développement → Simulateur.
    5. Committer.
  - Fait quand : le jeu tourne sur simulateur, les pubs de test s'affichent et la sauvegarde survit à un kill.

- [ ] **IOS-02 · Signature, capacités et lancement sur iPhone réel**
  - Moi · iOS · **1,5 h** · Dépend de : IOS-01, CPT-03
  - Étapes :
    1. Xcode → Signing & Capabilities : équipe, signature automatique, bundle ID, capacité In-App Purchase. Pas de Game Center ni de Push.
    2. iPhone du Collègue (H-4) : activer le Mode développeur, puis Run.
  - Fait quand : l'app se lance sur un iPhone réel depuis Xcode.

- [ ] **IOS-03 · Compléter Info.plist et les réglages du projet**
  - Moi · iOS · **2 h** · Dépend de : IOS-01, ADS-01
  - Fichiers : `ios/App/App/Info.plist`, `ios/App/App.xcodeproj`
  - Étapes :
    1. `GADApplicationIdentifier` : l'App ID iOS réel.
    2. `SKAdNetworkItems` : copier la liste officielle ⚠️ (doc AdMob iOS « Update your Info.plist »).
    3. `ITSAppUsesNonExemptEncryption` = NO, `CFBundleDisplayName` = Spacemerge.
    4. Portrait uniquement ; `TARGETED_DEVICE_FAMILY` = 1, iPhone seul (N-15).
    5. Pas de `NSUserTrackingUsageDescription` (D3). Version 1.0.0, build 1.
  - Fait quand : aucun avertissement AdMob au lancement, et Archive → Validate App passe.

- [ ] **IOS-04 · Vérifier les manifestes de confidentialité**
  - Moi · iOS · **1,5 h** · Dépend de : IOS-01
  - Pourquoi : Apple exige un `PrivacyInfo.xcprivacy` pour les SDK de sa liste, et pour l'app si elle utilise une API « required reason » (UserDefaults via Preferences).
  - Fichiers : nouveau `ios/App/App/PrivacyInfo.xcprivacy`
  - Étapes :
    1. Vérifier que Google Mobile Ads, UMP et RevenueCat embarquent leur manifeste ⚠️ (celui de Capacitor est vérifié dans `node_modules/@capacitor/ios`).
    2. Dans le manifeste de l'app : `NSPrivacyAccessedAPICategoryUserDefaults` avec la raison `CA92.1` ⚠️, pas de tracking.
    3. Organizer → Generate Privacy Report, puis comparer avec CMP-05.
  - Fait quand : le rapport PDF est archivé, et aucun avertissement de manifeste n'apparaît à l'upload.

- [ ] **IOS-05 · Icônes et splash iOS**
  - Moi · iOS · **1 h** · Dépend de : AST-01, IOS-01
  - Étapes : `npx capacitor-assets generate --ios`, puis vérifier l'AppIcon 1024 sans alpha et le fond du splash `#05040d`.
  - Fait quand : l'icône est correcte sur le simulateur et sur l'iPhone, sans avertissement à l'upload.

- [ ] **IOS-06 · Vérifier les zones sûres, les petits écrans et la compatibilité iPad**
  - Moi · iOS · **1,5 h** · Dépend de : IOS-01
  - Étapes :
    1. Tester sur simulateur un iPhone Pro Max (Dynamic Island), un iPhone SE et un iPad en mode compatibilité (les reviewers testent parfois sur iPad).
    2. Vérifier que `contentInset: 'always'` (`capacitor.config.ts:13`) ne double pas les marges de `viewport-fit=cover`.
  - Fait quand : 3 captures sans chevauchement ni texte tronqué.

- [ ] **IOS-07 · Archiver et envoyer sur TestFlight (interne)**
  - Moi · iOS · **2 h** · Dépend de : IOS-02 à IOS-05, STR-03
  - Étapes :
    1. `npm run build:staging && npx cap sync ios`.
    2. Product → Archive → Distribute → App Store Connect.
    3. Ajouter en testeurs internes toi et le Collègue (qui a besoin d'un rôle App Store Connect).
  - Fait quand : le build est installé via TestFlight sur l'iPhone du Collègue.

### Phase 9 — Distribution et lancement

**Critère de sortie :** Android puis iOS sont publics dans les pays V1, AdMob est « prêt » et RevenueCat reçoit des transactions de production.

- [ ] **DST-01 · Démarrer le test fermé Google (14 jours)** ★ ⏳
  - Moi · Android · **1,5 h** · Dépend de : AND-06, AND-04, CMP-03, CMP-04, AST-02 à AST-04, AST-06, MKT-02
  - Pourquoi : un compte perso créé après le 13/11/2023 doit avoir **au moins 12 testeurs inscrits en continu pendant au moins 14 jours** avant de demander l'accès production (règle confirmée en 2026, voir annexe C).
  - Étapes :
    1. Créer un Google Group « spacemerge-testeurs » et y inscrire **au moins 20** adresses (marge sur 12).
    2. Test fermé → piste Alpha : pays des testeurs, testeurs = le Google Group, release = dernier AAB staging.
    3. Remplir la fiche principale (AST) : elle est requise pour publier la piste ⚠️.
    4. Envoyer le lien d'inscription (MKT-05).
    5. Noter J0 = le jour où le 12e testeur accepte.
  - Fait quand : Play Console affiche au moins 12 testeurs inscrits. J0 = `____`.

- [ ] **DST-02 · Faire vivre le test fermé**
  - Moi · Android · **1 h** (2 × 0,5 h) · Dépend de : DST-01
  - Pourquoi : Google peut refuser l'accès production si l'engagement est jugé insuffisant.
  - Étapes : publier au moins 2 builds avec notes de version pendant le test (après ADS-03/04 et FND-02). Lire les retours et les vitals, et ne jamais laisser le nombre d'inscrits passer sous 12 ⚠️.
  - Fait quand : 14 jours consécutifs à 12 inscrits ou plus, et 2 builds publiés.

- [ ] **DST-03 · Demander l'accès à la production** ⏳
  - Moi · Android · **1 h** · Dépend de : DST-01 + 14 jours
  - Étapes : Tableau de bord → « Demander l'accès en production ». Répondre au questionnaire (recrutement, retours reçus, changements faits) avec des exemples concrets tirés de MKT-05. Examen annoncé en 7 jours environ ⚠️.
  - Fait quand : l'e-mail « accès à la production accordé » est arrivé.

- [ ] **DST-04 · TestFlight externe** ⏳
  - Moi · iOS · **1,5 h** · Dépend de : IOS-07, IAP-12
  - Étapes : créer un groupe externe à lien public (20 à 30 testeurs), rédiger les infos de test, puis passer la Beta App Review (24 à 48 h ⚠️).
  - Fait quand : le build externe est approuvé, avec au moins 5 testeurs actifs.

- [ ] **DST-05 · Passe QA complète sur Android**
  - Moi · Android · **2 h** · Dépend de : IAP-11, ADS-07, FND-01 à FND-07
  - Étapes : dérouler `QA_CHECKLIST.md` (colonne Android) sur le OnePlus 12 avec le build release (IDs réels, appareil de test) :
    - sauvegarde : kill, redémarrage, mise à jour par-dessus la version précédente, réinstallation avec Auto Backup ⚠️ ;
    - hors-ligne ; pubs ; IAP ; notifications ; bouton retour ; textes tronqués.
  - Fait quand : tout est coché, ou chaque écart non bloquant est noté pour la v1.1.

- [ ] **DST-06 · Passe QA complète sur iOS**
  - Moi · iOS · **2 h** · Dépend de : DST-04
  - Étapes : même checklist (colonne iOS), sur iPhone réel et sur le simulateur SE.
  - Fait quand : tout est coché, ou chaque écart est noté.

- [ ] **REL-01 · Publier en production sur Google Play** ★ ⏳
  - Moi · Android · **1,5 h** · Dépend de : DST-03, DST-05, ADS-08, CMP-07, AST-06
  - Étapes :
    1. `npm run build:release`, puis un AAB avec versionCode n+1.
    2. Production → nouvelle release : pays D7, notes de version en français.
    3. Déploiement progressif si la console le propose pour une 1re release ⚠️.
    4. Envoyer à l'examen (jusqu'à 7 jours ou plus pour un nouveau compte ⚠️).
  - Fait quand : le statut passe à « Publiée ».

- [ ] **REL-02 · Soumettre à l'App Review** ★ ⏳
  - Moi · iOS · **2 h** · Dépend de : DST-06, IAP-02, CMP-05, CMP-06, AST-05, AST-07
  - Étapes :
    1. Build release avec les IDs réels.
    2. Page de version : captures, textes, et **cocher les 4 IAP** (1re soumission).
    3. Notes de review : « Pas de compte. Abonnement : Boutique → Pass Supernova. Restauration : Réglages → Restaurer mes achats. Probabilités : Boutique → Boîte Cosmique. Pubs non personnalisées, pas d'ATT. »
    4. Choisir la publication manuelle.
  - Fait quand : le statut passe à « Waiting for Review ».

- [ ] **REL-03 · Réserve pour un rejet Google**
  - Moi · Android · **2 h** · Dépend de : REL-01
  - Étapes : lire le motif (e-mail et Centre des règles), corriger, renvoyer. Faire appel si la politique est ambiguë.
  - Fait quand : l'app est publiée (ou la réserve n'a pas servi).

- [ ] **REL-04 · Réserve pour un rejet Apple**
  - Moi · iOS · **4 h** · Dépend de : REL-02
  - Étapes : répondre dans le Resolution Center avec texte et captures, corriger, renvoyer. Causes probables : 3.1.1 et 3.1.2 (IAP), 2.1 (bug iPad), 5.1.1 (politique).
  - Fait quand : l'app est approuvée.

- [ ] **REL-05 · Jour J (une fois par plateforme)**
  - Moi · Les deux · **1 h** (2 × 0,5 h) · Dépend de : REL-01 ou REL-02 approuvée
  - Étapes :
    1. Publier.
    2. Dans AdMob, lier l'app à sa fiche store. Cela lance la vérification `app-ads.txt` puis la revue « readiness » (2 à 3 jours de diffusion limitée) ⏳.
    3. Vérifier RevenueCat en production, Sentry et les vitals.
    4. Installer depuis le store sur un appareil propre, puis déclencher MKT-06.
  - Fait quand : AdMob indique « Prête » et une transaction de production apparaît dans RevenueCat.

### Phase 10 — Marketing (Collègue)

**Critère de sortie :** au moins 12 testeurs actifs pendant 14 jours, landing en ligne, tableau de métriques rempli dès la 1re semaine publique.

- [ ] **MKT-01 · Landing page (site racine)**
  - Collègue · Web · **4 h** · Dépend de : AST-01 · Échéance : S10 (publication par ADS-06)
  - Étapes :
    1. Présentation du jeu et 3 visuels.
    2. Badges App Store et Google Play (« Bientôt » en attendant).
    3. Liens vers la confidentialité, les conditions et l'e-mail de support.
    4. FAQ sauvegarde : export de code, sauvegarde auto Android, pas de cloud en V1.
    5. ⚠️ À trancher : la démo web (achats simulés gratuits) reste-t-elle en lien ?
  - Fait quand : le HTML statique est livré et validé sur mobile.

- [ ] **MKT-02 · Recruter les testeurs (au moins 20 sur Android, 10 sur iOS)**
  - Collègue · Les deux · **2 h** · Dépend de : — · Échéance : fin S5
  - Étapes :
    1. Recruter parmi amis, famille et communautés FR (Gmail requis pour Android).
    2. Expliquer le rôle : garder l'app installée et l'ouvrir plusieurs fois pendant 14 jours.
    3. **Ne pas committer les adresses** : le dépôt est public.
  - Fait quand : la liste de 20 Gmail ou plus est validée.

- [ ] **MKT-03 · Plan de soft launch et tableau de métriques**
  - Collègue · Les deux · **2 h** · Dépend de : — · Échéance : S11
  - Étapes : un tableau hebdo et un rituel de 30 min/semaine. Métriques et outils :

    | Métrique | Outil |
    |---|---|
    | Installs | Play Console, App Store Connect |
    | Rétention J1, J7, J30 | Play Console Statistiques, ASC Analytics (utilisateurs consentants) |
    | Taux sans crash | Android vitals, Xcode Organizer, Sentry |
    | IAP, conversion, MRR | RevenueCat |
    | eCPM, taux de remplissage | AdMob |
    | Notes et avis | Consoles des stores |

    Repères de soft launch ⚠️ (à confronter aux données du genre) : J1 ≥ 35 %, J7 ≥ 10 %, sans crash ≥ 99 %.
  - Fait quand : le tableau est prêt, avec les 5 sources identifiées.

- [ ] **MKT-04 · Contenus de lancement**
  - Collègue · Les deux · **4 h** · Dépend de : AST-04 · Échéance : S13
  - Étapes : GIF de fusion, vidéo verticale de 15 à 30 s, 3 posts et un texte d'annonce en français.
  - Fait quand : le kit est validé par toi.

- [ ] **MKT-05 · Animer les testeurs (formulaire et relances)**
  - Collègue · Les deux · **2 h** · Dépend de : MKT-02 · Échéance : S6 à S8
  - Étapes : Google Form (bugs, plaisir, compréhension du Big Bang, avis sur pubs et prix), 2 relances pendant les 14 jours, puis une synthèse pour DST-03.
  - Fait quand : au moins 8 réponses et une synthèse envoyée.

- [ ] **MKT-06 · Lancer et suivre les avis**
  - Collègue · Les deux · **3 h** · Dépend de : REL-05 · Échéance : S15 (Android), S18 (iOS)
  - Étapes : annonce le jour J (réseaux, communautés FR d'idle games ⚠️ règles de chaque communauté), réponse aux avis sous 48 h, synthèse hebdo pour la v1.1.
  - Fait quand : 2 semaines de suivi documentées.

---

## 5. Calendrier semaine par semaine

À 8 h/semaine pour toi. Chaque ligne liste les todos de la semaine dans l'ordre où les faire.

| Sem. | Dates | Moi (h) | Collègue | Externe / jalon |
|---|---|---|---|---|
| S1 | 28/09–04/10 | CPT-01, CPT-02, CPT-03, STR-01, STR-02, STR-04, CPT-05, CPT-06 **(8)** | Recherche de nom (CPT-02), AST-01, MKT-02 | ⏳ Vérification Apple, 1 à 7 j |
| S2 | 05–11/10 | FND-01, FND-03, STR-03 **(8)** | AST-01 livré, AST-02 | Apple approuvé (visé) |
| S3 | 12–18/10 | CPT-04, CPT-07, CPT-08, AND-01, AND-02 **(8)** | AST-02 livré, AST-06 (Play) | ⏳ Accords ASC et banque ; profil marchand Google |
| S4 | 19–25/10 | AND-03, FND-04, AND-05, ADS-02, FND-06 **(8)** | AST-03, AST-04, AST-06 livré | |
| S5 | 26/10–01/11 | AND-04, AND-06, CMP-01, ADS-01 **(8)** | MKT-02 : liste de 20 ou plus | ⏳ Rapport pré-lancement, 1 à 2 j |
| S6 | 02–08/11 | OBS-01, CMP-03, CMP-04, DST-01 **(7,5)** | MKT-05 (formulaire, accueil des testeurs) | ★ **J0 du test fermé (~07/11)** ⏳ examen de la piste ⚠️ |
| S7 | 09–15/11 | ADS-03, ADS-04, ADS-05, DST-02 **(7,5)** | MKT-05, relance 1 | Test J+2 à J+8 |
| S8 | 16–22/11 | STR-05, FND-02, STR-06, DST-02 **(8)** | MKT-05, relance 2 et synthèse | ★ **J+14 ≈ 21/11** |
| S9 | 23–29/11 | DST-03, IAP-01, IAP-03, IAP-04 (Android), FND-05 **(8)** | MKT-01 | ⏳ Examen de l'accès production ≈ 7 j ⚠️ ; ⏳ compte de service RevenueCat ≤ 36 h |
| S10 | 30/11–06/12 | IAP-05, IAP-06, IAP-07, FND-07 **(8)** | MKT-01 livré | Accès production obtenu (visé) |
| S11 | 07–13/12 | IAP-10, IAP-08, IAP-09, ADS-06 **(8)** | MKT-03 | |
| S12 | 14–20/12 | CMP-02, IAP-11, ADS-07 **(7)** | MKT-04 | |
| S13 | 21–27/12 | DST-05, CMP-07, ADS-08, AST-06 (relecture), REL-01 **(7)** | MKT-04 livré | ★ **Soumission production Android (~26/12)** ⏳ examen ≤ 7 j ⚠️. Semaine de fêtes : disponibilité à confirmer. |
| S14 | 28/12–03/01 | REL-03 (réserve), IOS-01, IOS-02, IOS-03 **(8)** | — | **Android public visé : 30/12 au 05/01** |
| S15 | 04–10/01/2027 | REL-05 (Android), IOS-04, IOS-05, IOS-06, IOS-07, CMP-06 **(8)** | MKT-06 (Android), AST-05, AST-06 (Apple) | TestFlight interne |
| S16 | 11–17/01 | IAP-02, IAP-04 (iOS), IAP-12, CMP-05, AST-07 **(7,5)** | Tests TestFlight | |
| S17 | 18–24/01 | DST-04, DST-06, STR-07, REL-02 **(7)** | Tests TestFlight externes | ⏳ Beta App Review 24 à 48 h ; ★ **soumission App Store (~23/01)** ⏳ review 1 à 3 j ⚠️ |
| S18 | 25–31/01 | REL-04 (réserve), REL-05 (iOS), planification v1.1 **(6)** | MKT-06 (iOS) | **iOS public visé : 27/01 au 06/02** |

**Total pour toi : environ 137 h.** La réserve de 1 h en S12 et S13 absorbe les petites dérives.

### 5.1 Chemin critique

**Android :**
1. CPT-01 → STR-01 → STR-02 → FND-01 → AND-01 → AND-02 → AND-05 → AND-06.
2. En parallèle : CMP-01, CMP-03, CMP-04 et les assets AST-02 à AST-04 et AST-06.
3. **DST-01 : 14 jours calendaires** ⏳, puis DST-03 : environ 7 j ⏳.
4. IAP-03 → IAP-04 → IAP-05 → IAP-06 à IAP-09 → IAP-11 → DST-05 → ADS-08 → REL-01 (≤ 7 j ⏳) → public.

Tant que le test fermé démarre au plus tard en S6, les 14 jours s'écoulent pendant le travail sur les pubs, les tests et les migrations : le chemin critique reste **tes heures de dev**. Si le J0 glisse au-delà de S9, c'est le test fermé qui devient critique.

**iOS :**
1. CPT-03 (1 à 7 j ⏳) → CPT-07 (accords et banque ⏳).
2. IOS-01 à IOS-07 → IAP-02 → IAP-12 → DST-04 (Beta review ⏳) → DST-06 → REL-02 (1 à 3 j ⏳) → public.

### 5.2 Ce que la date « avant fin 2026 » implique

- **Android public avant le 31/12 :** soumettre vers le 15/12 pour garder une semaine d'examen. Pour ça : appliquer les coupes 1 et 2 de l'annexe B (−4,5 h) et ajouter +0,5 h/semaine de S4 à S12.
- **iOS avant le 31/12 :** il faudrait environ 30 h de plus avant mi-décembre (environ 11 h/semaine). Non recommandé.

---

## 6. Top 10 des risques

| # | Risque | Prob. | Impact | Parade |
|---|---|---|---|---|
| 1 | Le rythme de 8 h/semaine n'est pas tenu (travail, fatigue, fêtes en S13 et S14). | Élevée | Fort : tout glisse | Réserves en S12, S13 et S14. Liste de coupes (annexe B). Revue du calendrier chaque dimanche, 15 min. |
| 2 | Test fermé Google : moins de 12 testeurs actifs, ou engagement jugé insuffisant, donc accès production refusé. | Moyenne | Fort : +3 semaines sur Android | Recruter 20 testeurs ou plus, Google Group, 2 relances, au moins 2 builds pendant le test, réponses concrètes au questionnaire (MKT-05). |
| 3 | Rejet Apple sur les IAP : restauration, mentions d'abonnement, prix, IAP non joints à la version. | Moyenne | Moyen : +1 à 2 semaines sur iOS | IAP-05 à IAP-09, notes de review précises, IAP cochés dans la version, REL-04 budgétée. |
| 4 | iPhone de test partagé (celui du Collègue, H-4) : bugs WKWebView, audio ou Sandbox trouvés trop tard si l'appareil est peu disponible. | Faible | Moyen | Réserver des créneaux avec le Collègue de S14 à S18 pour IOS-02, IAP-12 et DST-06. |
| 5 | Perte ou corruption de sauvegarde (boot, migration, import). | Moyenne | Très fort : avis 1★ | FND-01, FND-02, FND-06 et leurs tests ; scénarios QA kill, relance et mise à jour ; Auto Backup Android ; export de code. |
| 6 | Outils cassés : Xcode 27 avec Capacitor 8.5, SPM, JDK, AGP ; CocoaPods passe en lecture seule en décembre 2026. | Moyenne | Moyen | CI avec build (STR-06), `package-lock` verrouillé, JDK 21, SPM uniquement. Avancer IOS-01 si une semaine a de la marge. |
| 7 | AdMob : suspension pour trafic invalide, ou diffusion limitée (`app-ads.txt`, readiness). | Faible à moyenne | Fort en cas de suspension | IDs de test jusqu'à ADS-08, appareils de test déclarés, `app-ads.txt` à la racine avant le jour J, ne jamais cliquer sur ses pubs. |
| 8 | UMP mal configuré : pubs bloquées en EEE ou en Suisse, ou non-conformité. | Moyenne | Moyen | ADS-04, ADS-05 et ADS-07 avec `debugGeography` ; suivre le taux de remplissage EEE la 1re semaine. |
| 9 | Conformité légale : loot box (Belgique, Brésil), adresse publique DSA, politique qui ne correspond pas au comportement, donc retrait. | Faible à moyenne | Fort | D7 (exclusions), CMP-02 (probabilités exactes), D9 tranchée en S1, CMP-07 (relecture croisée). |
| 10 | Perte de la clé d'upload Android ou de l'accès aux comptes (Apple ID, 2FA). | Faible | Fort | Play App Signing, 2 copies chiffrées du keystore (AND-05), codes de secours 2FA, Collègue en admin secondaire des consoles. |

---

## 7. Semaine 1 : par quoi commencer ce soir

Environ 6,5 h au total : trois todos ce soir (2,5 h), STR-01 dès que tu as un créneau, STR-02 ce week-end.

1. [ ] **CPT-01 · Accepter la licence Xcode et vérifier la chaîne d'outils** (0,5 h). Débloque `git` et `pod`, sans quoi rien ne se committe proprement.
2. [ ] **CPT-02 · Figer le nom, l'identifiant d'app et le statut DSA** (1 h). Identifiant décidé (`com.zappstudio.spacemerge`). Restent la recherche de nom par le Collègue et le statut DSA.
3. [ ] **CPT-03 · S'inscrire à l'Apple Developer Program** (1 h). Le plus long délai externe du plan : à lancer ce soir, même si iOS arrive en S14.
4. [ ] **STR-01 · Réparer `npm run build` en retirant le plugin Game Center** (1 h). Premier maillon ★ ; le build ne passe pas aujourd'hui.
5. [ ] **STR-02 · Produire un `dist-www/` complet** (3 h). Sans ça, aucune app native ne peut afficher le jeu.

Pour compléter S1 : STR-04, CPT-05, CPT-06 (1,5 h).

---

## Annexe A : backlog v1.1

Estimations indicatives, à redécouper en todos de 4 h maximum au moment de les planifier.

| ID | Sujet | Estimation | Items d'origine |
|---|---|---|---|
| V11-01 | Anglais : scinder `config.js` (balance / contenu), puis i18n, fiches EN et captures EN ; ouvrir tous les pays (Belgique et Brésil à réévaluer). | ~48 h | S-2a, P2-1 |
| V11-02 | Cloud save + Game Center / Play Games derrière `CloudSaveService`, avec modale de conflit. Évaluer un plugin Capacitor 8 unique (⚠️ maintenance à vérifier). | ~30 h | P1-1, P1-5 |
| V11-03 | ATT + pubs personnalisées : `AdMob.requestTrackingAuthorization()` après le tutoriel, `NSUserTrackingUsageDescription`, App Privacy à mettre à jour ; mesurer l'eCPM avant/après. | ~6 h | P0-6 |
| V11-04 | Bannière adaptative, si les données de rétention le permettent. | ~8 h | P0-2 (A) |
| V11-05 | Reste du catalogue : `stardust_boost`, `starter_pack` en consommable, `gems_large`, `gems_mega` ; crédit différé des achats en attente. | ~6 h | D8, IAP-06 |
| V11-06 | Belgique : bloquer l'achat de Gems vers la Boîte Cosmique, ou rendre la Boîte non aléatoire (⚠️ avis juridique). | ~4 h | D7 |
| V11-07 | Analytics produit (événements de progression) si les consoles ne suffisent pas. | ~6 h | D10 |
| V11-08 | Scinder `ui.js`, avec un helper commun pour ouvrir et fermer les modales. | ~16 h | S-2b |
| V11-09 | Générer versionCode et build à partir de `package.json`. | ~2 h | — |

---

## Annexe B : liste de coupes si tu prends du retard

Dans cet ordre :

1. **OBS-01 → v1.0.1** (−3 h). Retirer Sentry des déclarations CMP-01, CMP-03 et CMP-05.
2. **FND-05 → désactiver les notifications en V1** (−1,5 h). Retirer l'appel côté bridge et masquer le toggle.
3. **`gems_medium` → v1.1** (−0,5 h de configuration et de tests).
4. **STR-07 → après le lancement** (−1,5 h).
5. **DST-04 → TestFlight interne seulement** (−1 h).

**À ne jamais couper :** FND-01, FND-02, IAP-05 à IAP-09, ADS-03, ADS-04, CMP-01 à CMP-06, REL-03, REL-04.

---

## Annexe C : sources consultées le 2026-09-27

Règles de stores à revérifier au moment d'agir : elles changent.

- Google Play, tests requis pour les nouveaux comptes perso (12 testeurs, 14 jours) : https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play, niveau d'API cible (API 36 depuis le 31/08/2026) : https://support.google.com/googleplay/android-developer/answer/11926878
- Apple, SDK minimum (Xcode 26 / SDK iOS 26 depuis le 28/04/2026) : https://developer.apple.com/news/upcoming-requirements/
- Apple, nouvelles classifications d'âge (13+, 16+, 18+ ; obligatoires depuis le 31/01/2026 ; loot box ⇒ 18+ au Brésil) : https://developer.apple.com/news/?id=f5zj08ey
- Apple, statut « trader » DSA : https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/
- Apple, exigences pour les SDK tiers (manifestes, signatures) : https://developer.apple.com/support/third-party-SDK-requirements/
- Google, CMP requise pour l'EEE, le Royaume-Uni et la Suisse : https://support.google.com/admob/answer/13554116
- AdMob, app readiness et `app-ads.txt` : https://support.google.com/admob/answer/10564477 · https://support.google.com/admob/answer/14538460
- AdMob, données collectées par le SDK iOS (pour App Privacy) : https://developers.google.com/admob/ios/privacy/data-disclosure
- RevenueCat, App Privacy et Data Safety : https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy · https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety
- Capacitor 8 et SPM : https://capacitorjs.com/docs/ios/spm
- Google Play, probabilités des loot boxes (politique Monétisation, depuis 2019) : https://www.gamedeveloper.com/business/games-on-the-google-play-store-now-required-to-disclose-loot-box-odds
- Belgique, loot boxes : https://sites.google.com/view/leon-xiao/policy/belgium
- Plugin Capacitor 8 GameKit + Play Games (candidat v1.1, non évalué) : https://github.com/modbender/capacitor-play-games
