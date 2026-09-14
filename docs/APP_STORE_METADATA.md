# Spacemerge — Métadonnées App Store Connect

## 🇫🇷 Français

**Nom** (≤30 car.)
```
Spacemerge
```

**Sous-titre** (≤30 car. — actuel : 23)
```
Fusion, Dieux & Mystère
```

**Description**
```
Le Cosmos s'est brisé. Personne ne sait pourquoi - mais neuf Dieux dorment
encore, chacun caché dans un fragment parmi des milliards d'astéroïdes.
Toi seul peux les réveiller.

Fusionne des astéroïdes en lunes, planètes, étoiles et trous noirs sur une
grille cosmique en expansion. Chaque tuile produit du Stardust en continu,
même quand tu n'es pas là. Débloque de nouvelles cases, invoque de
nouveaux astres, et grimpe jusqu'à l'Univers ✨.

Quand la grille ne suffit plus, déclenche un Big Bang : recommence avec
une grille vierge et une Énergie Cosmique permanente à investir dans un
arbre de bonus qui rend chaque nouvelle partie plus rapide et plus
puissante.

★ FUSIONNEZ — 10 paliers, de l'astéroïde à l'Univers
★ RÉVEILLEZ DES DIEUX — 12 Dieux du Cosmos aux pouvoirs uniques, chacun
  avec sa propre histoire et son propre camp (bienveillant ou déchu)
★ DÉCOUVREZ LE MYSTÈRE — des fragments de mémoire à débloquer peu à peu,
  jusqu'à percer ce qui a vraiment causé la Rupture
★ PRODUISEZ — du Stardust en continu, même hors-ligne
★ PROGRESSEZ — arbre de compétences permanent, succès, quêtes quotidiennes
★ PERSONNALISEZ — ambiances et sets d'icônes à combiner comme tu veux pour
  ta grille

Spacemerge se joue à ton rythme : quelques secondes pour fusionner et
récupérer tes gains, ou de longues sessions pour optimiser ta grille et
ton arbre de compétences. Connexion quotidienne, quêtes et succès te
récompensent chaque jour.

Gratuit à jouer, avec des publicités récompensées optionnelles et des
achats intégrés qui accélèrent ta progression sans jamais la bloquer.

La Boîte Cosmique (boutique) offre un Dieu au hasard : Commun 50%, Rare
30%, Épique 15%, Légendaire 5%.
```

**Mots-clés** (≤100 car., séparés par virgules sans espace)
```
fusion,merge,idle,incremental,spatial,dieux,mythologie,planetes,etoiles,clicker,prestige
```

**Notes de version (V1.0)**
```
Version 1.0 — Lancement de Spacemerge ! Fusionne, réveille les Dieux,
provoque ton premier Big Bang. Merci de nous rejoindre dès le premier
jour de la Rupture.
```

**Catégorie primaire** : Jeux > Casual
**Catégorie secondaire** : Jeux > Simulation

---

## 🇬🇧 English

**Name** (≤30 chars)
```
Spacemerge
```

**Subtitle** (≤30 chars — current: 24)
```
Merge Idle & Awaken Gods
```

**Description**
```
The Cosmos shattered. Nobody knows why - but nine Gods still sleep,
each hidden inside a fragment among billions of asteroids. Only you can
wake them.

Merge asteroids into moons, planets, stars, and black holes on an
ever-expanding cosmic grid. Every tile produces Stardust around the
clock, even while you're away. Unlock new cells, summon new bodies, and
climb all the way to the Universe ✨.

When the grid isn't enough anymore, trigger a Big Bang: start over with a
fresh grid and permanent Cosmic Energy to invest in a skill tree that
makes every run faster and stronger.

★ MERGE — 10 tiers, from asteroid to Universe
★ AWAKEN GODS — 12 Gods of the Cosmos with unique powers, each with their
  own story and allegiance (benevolent or fallen)
★ UNCOVER THE MYSTERY — unlockable memory fragments that slowly reveal
  what actually caused the Rupture
★ PRODUCE — Stardust around the clock, even offline
★ PROGRESS — permanent skill tree, achievements, daily quests
★ CUSTOMIZE — mix and match ambiances and icon sets for your grid

Spacemerge plays at your pace: a few seconds to merge and collect, or
long sessions to optimize your grid and skill tree. Daily login, quests,
and achievements reward you every day.

Free to play, with optional rewarded ads and in-app purchases that speed
up your progress without ever gating it.

The Cosmic Box (shop) grants a random God: Common 50%, Rare 30%, Epic
15%, Legendary 5%.
```

**Keywords** (≤100 chars, comma-separated, no spaces)
```
merge,idle,incremental,clicker,space,gods,mythology,planets,stars,prestige,puzzle
```

**Release notes (V1.0)**
```
Version 1.0 — Spacemerge launches! Merge, awaken the Gods, trigger your
first Big Bang. Thanks for joining us on day one of the Rupture.
```

**Primary category**: Games > Casual
**Secondary category**: Games > Simulation

---

## Divulgation des probabilités (Boîte Cosmique / Cosmic Box)

Apple exige que les probabilités d'un mécanisme de type loot box reachable
avec de l'argent réel (ici : Gems achetables en IAP → Boîte Cosmique)
soient visibles **avant achat**. C'est fait à deux endroits :
- Dans la description App Store ci-dessus (dernière ligne de chaque langue)
- Dans la fiche de l'article en jeu (`SHOP_GEM_ITEMS` → `cosmicBox` dans
  `www/js/config.js`), visible avant de dépenser les Gems

Garde ces deux textes synchronisés avec `BOX_RARITY_WEIGHTS` si les
probabilités changent un jour.

## Notes

- Compte les caractères toi-même dans App Store Connect avant de valider —
  ces textes ont été comptés manuellement, une relecture finale est
  recommandée.
- Choisis explicitement de **désactiver le support iPad** dans les
  capacités du projet Xcode si tu veux éviter la génération de captures
  d'écran iPad supplémentaires (voir `docs/BUILD_IOS.md`).
- Les captures d'écran dans `assets/screenshots/` datent d'avant plusieurs
  refontes visuelles de cette session (boutique, panneau des Dieux,
  histoire) - à refaire avant soumission, voir `docs/BUILD_IOS.md`.
