# Spacemerge — Checklist QA avant soumission

Légende : ✅ validé dans cet environnement (web) · 🔶 partiellement validé,
vérification native recommandée · ⬜ à valider par toi sur device/Xcode réel
(impossible à tester ici : pas de Node, pas de simulateur iOS, pas de
StoreKit Sandbox dans cet environnement).

## Sauvegarde & fiabilité

- 🔶 **La sauvegarde ne se corrompt jamais même si l'app est tuée en
  pleine écriture.** Validé : `loadState()` encapsule le `JSON.parse` dans
  un `try/catch` et retourne une partie par défaut si la sauvegarde est
  illisible ou de version incompatible (testé avec `localStorage`
  indisponible et avec une sauvegarde v1 → migration v2). Non testé : tuer
  réellement le process iOS pendant un `Preferences.set()` en cours
  (écriture native atomique, comportement à vérifier sur device).
- ⬜ **Aucun crash en mode avion / hors-ligne complet.** Le jeu ne fait
  aucun appel réseau propre ; seuls AdMob/RevenueCat/Game Center en font.
  Chaque appel natif dans `native-bridge.js` est enveloppé de
  `try/catch` avec fallback silencieux — à confirmer en coupant le réseau
  sur un vrai device.
- ✅ **Un échec de chargement de pub ne bloque jamais l'interface.**
  `AdService.showRewarded/showInterstitial` retournent respectivement
  `false`/une résolution silencieuse en cas d'échec (vérifié dans le code
  du stub web et de `native-bridge.js`) ; aucun appelant ne suppose que la
  pub réussit toujours (`onFreePlanet`, `onWheelSpinAd`, etc. gèrent le
  cas `!ok`).

## Affichage

- ✅ **Aucun texte tronqué sur petit écran.** Testé à 375px de large
  (largeur iPhone SE) : pas de débordement horizontal (`scrollWidth ===
  clientWidth`), boutons et libellés lisibles. Non re-testé à 667px de
  hauteur (hauteur totale iPhone SE) — les panneaux utilisent
  `overflow-y:auto` donc devraient s'adapter, mais un contrôle visuel sur
  simulateur SE est recommandé.
- ✅ **Mode sombre.** L'app est un thème sombre unique et assumé (identité
  visuelle spatiale), il n'y a pas de bascule clair/sombre à gérer.

## Performance

- ✅ **Grille pleine (30 tuiles) + animations restent fluides.** Testé
  dans le navigateur avec la grille remplie de tuiles variées, fusions en
  chaîne (Fusion Express) et particules simultanées, sans ralentissement
  visible ni erreur console. Non profilé sur un appareil iOS plus ancien
  (ex. iPhone SE 2020) — recommandé avant soumission.

## Monétisation

- ✅ **« Restaurer les achats » fonctionne.** Le flux UI → `onRestorePurchases`
  → `IAPService.restorePurchases()` a été testé de bout en bout côté web
  (simulation). ⬜ Le comportement réel dépend de RevenueCat +
  StoreKit Sandbox, à tester sur device.
- ✅ **« Suppression des pubs » persiste après redémarrage.** Testé :
  achat simulé → `state.iap.removeAds = true` → sauvegarde → rechargement
  complet de la page → le flag est toujours `true` et la bannière reste
  masquée.
- ⬜ **Achats testés en StoreKit Sandbox** (compte testeur Sandbox, pas
  ton Apple ID réel) — à faire une fois le build natif compilé.
- ⬜ **Version testée via TestFlight** avant soumission publique.

## Confidentialité / conformité

- ⬜ **Flux App Tracking Transparency** implémenté et déclenché après le
  tutoriel (jamais au premier écran) — voir `docs/BUILD_IOS.md` §6.
  L'app doit rester jouable et monétisable (pubs non personnalisées) si
  l'utilisateur refuse.
- ✅ **Politique de confidentialité** rédigée et cohérente avec les
  réponses App Privacy (`docs/privacy-policy.html`,
  `docs/APP_PRIVACY_ANSWERS.md`).
- ✅ **Probabilités de la Boîte Cosmique divulguées** dans sa fiche
  boutique (Commun 50% / Rare 30% / Épique 15% / Légendaire 5%) - requis
  car elle coûte des Gems, et des Gems sont vendues en IAP (voir
  `docs/AGE_RATING_ANSWERS.md`, réponse Loot Boxes mise à jour en "Oui").

## Gameplay (validé dans cette session, voir tests en début de conversation)

- ✅ Fusion tap-tap et par glisser-déposer
- ✅ Bonus manuel + cooldown 1s par tuile
- ✅ Production passive + gains hors-ligne (avec plafond et bonus VIP)
- ✅ Déverrouillage de case (Stardust et Gems)
- ✅ Big Bang : reset correct, gain d'Énergie Cosmique, stats permanentes
  conservées
- ✅ Arbre de compétences (achat, plafond de niveau, effets appliqués à la
  production/au spawn/au plafond hors-ligne)
- ✅ Quêtes quotidiennes (progression, réclamation, régénération le
  lendemain)
- ✅ Succès (déblocage automatique, récompense en Gems, jamais réinitialisés)
- ✅ Connexion quotidienne (cycle de 7 jours, gestion de série)
- ✅ Roue quotidienne (spin gratuit + spin bonus pub)
- ✅ Boutique Gems (Sauter une case, Échanger deux cases, Gel de série,
  Boîte Cosmique avec animation de révélation)
- ✅ Ambiances et sets d'icônes cosmétiques (deux emplacements
  d'équipement indépendants, y compris revenir au set de base)
- ✅ Dieux du Cosmos (rituel des lunes, défis de déblocage, niveau de
  pouvoir, panneau en grille compacte)
- ✅ Catalogue IAP simulé (achat, application de la récompense pour
  chaque type de produit, VIP vérifié : x2 production, pubs retirées,
  tous les skins déverrouillés, confirmation d'achat affichée)
- ✅ Réglages (son/musique/notifications persistés)
- ✅ Sauvegarde/rechargement de bout en bout (toutes les données v2
  vérifiées après reload : Stardust, Gems, Énergie Cosmique, compétences,
  IAP, succès, réglages)
- ✅ Réinitialisation quotidienne des quêtes vérifiée programmatiquement
  (date de référence forcée dans le passé, re-tirage confirmé, plus
  d'exclusion des 3 quêtes de la veille pour éviter un re-tirage identique)

## Ce qu'il reste à faire (nécessite ta machine)

1. `npm install` puis suivre `docs/BUILD_IOS.md` de bout en bout.
2. Remplacer les IDs de test AdMob par tes vrais IDs avant la soumission
   finale (garde les IDs de test pendant tout le développement).
3. Configurer RevenueCat + les produits App Store Connect avec les mêmes
   identifiants que `IAP_CATALOG`.
4. Créer les classements/succès Game Center avec les IDs listés dans
   `docs/BUILD_IOS.md` §8.
5. Régénérer `assets/icon-1024.png` puis les jeux d'icônes complets avec
   `npm run assets` : le design a changé (nouveau logo "spark", plus
   d'emoji) - `www/icon-512.png` est la source à jour, mais elle est en
   512×512 et l'icône App Store doit être en 1024×1024 sans transparence
   ni coins arrondis (Xcode/App Store Connect les appliquent eux-mêmes).
   L'ancien jeu dans `assets/ios-icons/` date d'avant ce changement de
   design et doit être régénéré, pas réutilisé tel quel.
6. Tester sur simulateur puis device réel, en StoreKit Sandbox.
7. Soumettre via TestFlight avant la review publique.
