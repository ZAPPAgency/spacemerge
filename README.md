# Spacemerge

Jeu merge/idle/prestige spatial, prévu pour iOS via Capacitor. Ce dépôt
contient **tout le projet** : code source, config Capacitor, assets,
documentation de soumission App Store — et c'est aussi le seul dépôt,
il n'y en a pas d'autre.

## Déploiement web (pour tester sur téléphone)

Le contenu de `www/` est déployé automatiquement sur **GitHub Pages** à
chaque `git push` sur `main`, via GitHub Actions
(`.github/workflows/deploy.yml`) :

**https://zappagency.github.io/spacemerge/**

Aucune étape manuelle : éditer les fichiers dans `www/`, commit, push
sur `main`, et la nouvelle version est en ligne en 1-2 minutes (suivre
la progression dans l'onglet **Actions** du dépôt GitHub).

```bash
git add -A
git commit -m "..."
git push
```

**Sur une branche/PR (pas `main`)** : deux autres workflows publient une
preview séparée, sans jamais toucher à l'URL ci-dessus :
- `.github/workflows/preview.yml` ("Deploy PR previews") - une PR ouverte
  obtient `https://zappagency.github.io/spacemerge/pr-preview/pr-<N>/`,
  mise à jour à chaque push sur la branche de la PR.
- `.github/workflows/branch-preview.yml` ("Deploy branch previews") - toute
  autre branche poussée (sans PR ouverte dessus) obtient
  `https://zappagency.github.io/spacemerge/branch-preview/<nom-de-branche>/`.

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
  (`com.example.spacemerge`) à remplacer par le vrai identifiant une fois
  l'App ID créé dans App Store Connect.
- `assets/` — icône source (1024×1024), jeu d'icônes iOS déjà généré (à
  refaire, voir `docs/QA_CHECKLIST.md`), captures d'écran (à refaire
  aussi, elles datent d'avant plusieurs refontes de l'UI).
- `game-full.html` — version à fichier unique
  (CSS/JS inlinés), utilisée pour tester le jeu ailleurs que via un
  serveur local. Régénérée par un script Python ponctuel (voir
  historique des commits), pas de dépendance à `www/` en direct.
  **⚠️ Date du tout premier commit du projet et n'a jamais été
  régénérée depuis** - elle ne reflète aucun des ajouts/corrections
  de cette branche. Les previews de PR (voir ci-dessus) sont maintenant
  le moyen à jour de tester le jeu ailleurs qu'en local ; à supprimer ou
  régénérer selon ce dont vous avez encore besoin.

## Pour builder pour iOS

Tout est détaillé dans [`docs/BUILD_IOS.md`](docs/BUILD_IOS.md) : comptes
requis (Apple Developer, AdMob, RevenueCat), installation, build Vite,
Xcode, StoreKit Sandbox, TestFlight.
