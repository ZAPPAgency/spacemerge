# App Store Connect — Questionnaire de classification d'âge

Réponses recommandées pour le questionnaire de classification d'âge
(Age Rating) d'App Store Connect, section par section. Toutes les
réponses non listées ci-dessous doivent être **"Aucun(e)"**.

| Question | Réponse | Justification |
|---|---|---|
| Violence réaliste / caricaturale / fantastique | Aucune | Aucun contenu violent — fusion d'astres |
| Contenu à caractère sexuel / nudité | Aucun | — |
| Langage grossier / vulgaire | Aucun | — |
| Thèmes matures / suggestifs | Aucun | — |
| Horreur / thèmes effrayants | Aucun | — |
| Usage de drogue, alcool, tabac | Aucun | — |
| Jeu d'argent simulé (casino) | Aucun | Aucune mécanique ne simule un jeu d'argent réel |
| **Loot boxes / mécanismes de récompense aléatoire payants** | **Oui** | La **Boîte Cosmique** (boutique, coûte 120 Gems) accorde un Dieu aléatoire pondéré par rareté. Les Gems sont directement achetables avec de l'argent réel (`gems_small/medium/large/mega`), donc cette boîte est indirectement payante — Apple exige la divulgation des probabilités dans ce cas (Guideline 3.1.1). **Fait** : les probabilités (Commun 50% / Rare 30% / Épique 15% / Légendaire 5%, voir `BOX_RARITY_WEIGHTS` dans `config.js`) sont désormais affichées en clair dans la description de l'article en boutique. La roue quotidienne reste gratuite et n'a pas besoin de cette divulgation. |
| Contenu généré par les utilisateurs non modéré | Aucun | Pas de chat, pas de contenu partagé entre joueurs |
| Réseaux sociaux non modérés / messagerie | Aucun | — |
| Achats intégrés | **Oui** | Voir `IAP_CATALOG` dans `config.js` (Gems, suppression des pubs, abonnement, skins) |
| Publicités tierces sans contrôle | **Oui** (contrôlées par AdMob) | Pubs récompensées/interstitielles/bannière |
| Contests / concours | Aucun | — |
| Accès web non restreint (navigateur intégré) | Aucun | L'app ne charge aucune page web arbitraire |

## Classement attendu
Avec ces réponses, l'app devrait obtenir la classification **4+**.

## Note sur les "loot boxes"
Apple exige la divulgation des probabilités pour tout mécanisme de type
loot box reachable avec de l'argent réel, même indirectement via une
monnaie virtuelle achetable. C'est le cas de la Boîte Cosmique de Spacemerge
(coûte des Gems, et des Gems sont vendues en IAP) : coche donc **"Oui"** à
la question Loot Boxes, et assure-toi que la description App Store
mentionne aussi les probabilités (voir `APP_STORE_METADATA.md`) en plus de
leur affichage déjà en jeu dans la boutique.
