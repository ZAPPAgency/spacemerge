# Pourquoi une sauvegarde manuelle, et ce qu'elle contourne

> **Contexte (à jour) :** le problème décrit ci-dessous appartient à une
> période antérieure du projet, quand le jeu était prototypé comme Artifact
> Claude. Ce n'est plus le cas : `www/` est maintenant hébergé en page de
> premier niveau sur GitHub Pages (voir `README.md`) et la future app
> Capacitor utilisera `@capacitor/preferences` - les deux solutions listées
> dans « Ce qui fonctionne réellement » ci-dessous sont donc déjà (ou
> bientôt) la réalité, pas de simples options théoriques. La sauvegarde
> manuelle (export/import) reste dans le jeu, mais maintenant surtout comme
> fonctionnalité utile en soi (transfert entre appareils, récupération après
> effacement des données du site) plutôt que comme contournement actif d'un
> bug encore présent.

## Le problème

Le jeu, tel qu'accédé via un lien d'Artifact Claude, tourne dans une iframe
cross-origin : `claude.ai` embarque `<uuid>.frame.claudeusercontent.com`.
Sur iOS Safari, l'accès persistant à `localStorage` pour une iframe
cross-origin nécessite un octroi explicite via la **Storage Access API**
(`document.requestStorageAccess()`), et cet octroi peut ne pas survivre à
une fermeture complète du navigateur (ou de la Web App installée depuis
l'écran d'accueil, qui suit exactement le même chemin de chargement).

Nous avons tenté de demander cet accès explicitement au premier tap de
l'utilisateur, avant tout chargement de sauvegarde. Cela ne suffit pas ici,
car l'iframe des Artifacts Claude a l'attribut :

```
sandbox="allow-scripts allow-same-origin allow-forms"
```

Il manque le flag `allow-storage-access-by-user-activation`, **requis** par
les navigateurs pour que `requestStorageAccess()` fonctionne à l'intérieur
d'une iframe sandboxée. Sans ce flag, l'appel échoue silencieusement, quel
que soit le soin apporté côté code JS. Cet attribut est défini par la
plateforme d'hébergement des Artifacts, pas par le code du jeu — il n'y a
donc pas de correctif purement côté client possible pour ce cas précis.

## Ce qui fonctionne réellement

- **Hébergement en tant que page de premier niveau** (pas dans une iframe
  cross-origin) : ouvrir `www/index.html` directement (fichier local,
  serveur local, ou un vrai hébergement comme GitHub Pages/Netlify/Vercel).
  Dans ce cas `window.self === window.top`, aucune restriction ITP ne
  s'applique, et `localStorage` se comporte normalement — sauvegarde fiable
  garantie.
- **La future app native (Capacitor)** : utilise `@capacitor/preferences`
  (stockage natif iOS), entièrement hors du modèle de permissions du
  navigateur — aucun problème de ce type.

## La sauvegarde manuelle (mitigation immédiate)

En attendant l'un des deux points ci-dessus, l'écran Réglages propose :

- **Exporter ma sauvegarde** : encode l'état complet de la partie
  (`btoa(encodeURIComponent(JSON.stringify(state)))`) dans un champ de texte
  pré-sélectionné, prêt à copier (bouton « Copier » avec repli manuel si
  l'API Clipboard est indisponible).
- **Importer une sauvegarde** : colle le code, le décode, valide sa
  structure (`importSaveCode()` dans `state.js`), et remplace l'état actuel
  si le code est valide — sinon affiche une erreur sans toucher à la partie
  en cours.

Voir `www/js/state.js` (`exportSaveCode`/`importSaveCode`) et
`www/js/ui.js`/`input.js` (`openSaveCodeModal`/`onSaveCodeAction`) pour
l'implémentation.
