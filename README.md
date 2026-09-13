# Spacemerge

Jeu merge/idle/prestige spatial, prévu pour iOS via Capacitor. Ce dépôt
contient **tout le projet** : code source, config Capacitor, assets,
documentation de soumission App Store — et c'est aussi le seul dépôt,
il n'y en a pas d'autre.

## Déploiement web (pour tester sur téléphone)

Le contenu de `www/` est déployé automatiquement sur **GitHub Pages** à
chaque `git push` sur `main`, via GitHub Actions
(`.github/workflows/deploy-pages.yml`) :

**https://zappagency.github.io/godspark/**

Aucune étape manuelle : éditer les fichiers dans `www/`, commit, push
sur `main`, et la nouvelle version est en ligne en 1-2 minutes (suivre
la progression dans l'onglet **Actions** du dépôt GitHub).

```bash
git add -A
git commit -m "..."
git push
```

Une workflow GitHub Actions est nécessaire (plutôt que le déploiement
"classique" par branche) car `www/` est un sous-dossier — le build
classique de GitHub Pages ne sait servir que la racine du dépôt ou un
dossier `/docs`, et `www` doit rester à cet endroit précis pour que le
build Capacitor/iOS fonctionne (voir `vite.config.js`, `root: "www"`).

## Structure

- `www/` — le jeu lui-même (HTML/CSS/JS vanilla, sans framework ni étape
  de build). C'est le dossier déployé sur GitHub Pages (voir ci-dessus).
- `docs/` — toute la documentation de soumission App Store : build iOS,
  checklist QA, métadonnées, réponses aux questionnaires Apple
  (confidentialité, classification d'âge). **Commencer par
  `docs/BUILD_IOS.md`** pour le build natif.
- `capacitor.config.ts` / `package.json` — config du projet Capacitor.
  L'`appId` dans `capacitor.config.ts` est encore un placeholder
  (`com.example.godspark`) à remplacer par le vrai identifiant une fois
  l'App ID créé dans App Store Connect.
- `assets/` — icône source (1024×1024), jeu d'icônes iOS déjà généré (à
  refaire, voir `docs/QA_CHECKLIST.md`), captures d'écran (à refaire
  aussi, elles datent d'avant plusieurs refontes de l'UI).
- `game-full.html` / `cosmerge-v2.html` — versions à fichier unique
  (CSS/JS inlinés), utilisées pour tester le jeu ailleurs que via un
  serveur local. Régénérées par un script Python ponctuel (voir
  historique des commits), pas de dépendance à `www/` en direct.

## Pour builder pour iOS

Tout est détaillé dans [`docs/BUILD_IOS.md`](docs/BUILD_IOS.md) : comptes
requis (Apple Developer, AdMob, RevenueCat), installation, build Vite,
Xcode, StoreKit Sandbox, TestFlight.
