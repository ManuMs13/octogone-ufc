# Réactualiser le contenu d'OCTOGONE

Mode d'emploi de la mise à jour automatique du contenu. La routine planifiée
(lundi et jeudi) lit ce fichier et l'applique. Manu peut le modifier : c'est lui
qui pilote le comportement de l'agent, pas le prompt de la routine.

OCTOGONE · Tracker suit l'UFC en français. C'est un site statique que Netlify
déploie tout seul à chaque push sur `main`.

**Tu travailles sans relecture. La qualité tient à ce que tu vérifies, pas à ce
que tu supposes.** Mieux vaut laisser une donnée absente qu'en inventer une.

---

## Où sont les données

Tout est codé en dur dans `index.html`, en constantes JavaScript :

| Constante | Contenu |
|---|---|
| `EVENTS` | Le calendrier. Un combat = `["Combattant A","Combattant B","Catégorie",titre]`, où `titre` vaut `1` pour un championnat, `0` sinon. |
| `RESULTS` | Les vainqueurs : `{ idEvenement: { "Combattant A\|Combattant B": "Nom du vainqueur" } }`. C'est ce qui fait tourner le jeu de pronostics. |
| `RANKINGS` | Les classements officiels UFC. `c` = champion (`null` si la ceinture est vacante), `f` = les 15 challengers dans l'ordre. |
| `NEWS` | Le fil d'actus, le plus récent en premier. |
| `VIDEOS` | Le fil vidéo (identifiants YouTube). |

---

## Ce que tu fais, dans l'ordre

### 1. Les résultats des galas passés — la priorité absolue

Tant qu'un résultat manque, le prono du joueur reste bloqué sur « en attente »
et ne rapporte **aucun point**. C'est le cœur de l'app ; ne saute jamais cette
étape.

Pour chaque gala déjà disputé sans entrée dans `RESULTS` : va chercher la carte
complète, prélims comprises. Sources fiables, dans cet ordre — la page Wikipédia
de l'événement, puis `ufc.com`, puis Sherdog. Recoupe si un résultat te surprend.

**La clé doit reprendre EXACTEMENT les deux noms du tableau `EVENTS`, dans le
même ordre, accents compris.** Une clé qui ne correspond à rien ne déclenche
aucune erreur visible : le prono n'est simplement jamais jugé. C'est le piège
principal de cette tâche.

### 2. Les combats annulés

Un combat annulé, ou dont l'adversaire a changé, **ne se juge pas** : ni point
gagné, ni point perdu. C'est le traitement correct d'un pronostic.

Ne mets rien dans `RESULTS`, et déclare-le sur l'événement :

```js
nonJuges:["Renato Moicano|Brian Ortega"],
```

Sans cette déclaration, le vérificateur considérera que tu as oublié un
résultat et refusera le déploiement — c'est voulu.

Explique l'annulation dans le champ `notes` de l'événement : le joueur doit
comprendre pourquoi son prono n'a rien rapporté.

### 3. Le calendrier

Couvre environ deux mois à venir. Ajoute les galas annoncés, complète les cartes
qui se sont remplies, corrige les combats annulés ou remplacés.

Conventions horaires en vigueur (`est:true` tant que l'UFC n'a pas confirmé) :

| Type | Prélims (UTC) | Carte principale (UTC) |
|---|---|---|
| PPV numéroté | 00:00 le dimanche | 02:00 le dimanche |
| Fight Night à l'Apex | 22:00 le samedi | 01:00 le dimanche |

Ces valeurs correspondent à l'heure d'été américaine. **Après le passage à
l'heure d'hiver aux États-Unis (début novembre), ajoute une heure aux deux.**
Le champ `date` porte la date **américaine** du gala (le samedi), pas la date UTC.

Passe `est:false` une fois le gala disputé.

### 4. Les classements

⚠️ **N'utilise pas `api.octagon-api.com/rankings`** : cette API renvoie un
instantané périmé. L'app s'en sert uniquement pour les fiches et photos de
combattants, jamais pour les rangs.

Prends les rangs sur `ufc.com/rankings`, et recoupe avec l'actualité récente :
la page officielle met parfois plusieurs jours à refléter un changement de
ceinture. Si un champion abandonne son titre, mets `c:null` et explique-le dans
une actu — n'invente pas un champion.

### 5. Les actus

Ajoute en tête de `NEWS` ce qui s'est passé depuis la dernière mise à jour :
résultats marquants, annonces de combats, changements de ceinture. Format :

```js
{t:"Débrief · 20 septembre 2026",h:"Titre de l'actu",
 p:"Deux à quatre phrases, concrètes, en français.",
 l:"https://source",ls:"Nom de la source",img:{f:"Nom d'un combattant"}},
```

Le public est francophone : mets en avant les combattants français (Gane,
Imavov, Saint Denis, Fiorot, Parnasse, Charrière, Cornolle, Sola…) quand
l'actualité s'y prête.

### 6. Les vidéos

**Ne touche à `VIDEOS` que si tu as vérifié que l'identifiant YouTube existe
vraiment.** Un identifiant inventé donne un lecteur cassé dans l'app. Dans le
doute, laisse le fil tel quel : c'est sans conséquence.

---

## Avant de pousser — obligatoire

1. **Bumpe le cache du service worker** dans `sw.js` (`octogone-vNN` → `NN+1`).
   Sans ça, les utilisateurs gardent l'ancienne version en mémoire et ne voient
   jamais ta mise à jour.

2. **Lance le vérificateur** :
   ```bash
   node tools/verifier-donnees.mjs
   ```
   Il attrape les erreurs qui ne se voient pas : clé de `RESULTS` sans combat
   correspondant, vainqueur absent du combat, calendrier dans le désordre,
   résultat oublié, classement en double. **S'il sort en erreur, corrige — ne
   pousse pas.**

3. **`git pull --rebase` avant le push.** Une autre session peut avoir committé
   sur `main` entre-temps. En conflit sur `sw.js`, garde le numéro de version le
   plus élevé et ajoute 1.

4. Commit en français, qui dit ce qui a changé et pourquoi, terminé par :
   ```
   Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
   ```

---

## Ce que tu ne fais pas

- **Rien sur les réseaux sociaux.** Aucun post TikTok, X ou Discord : c'est Manu
  qui valide chaque publication, séparément.
- **Tu ne touches pas** à `capacitor.config.json`, `fastlane/`, `.github/`,
  `privacy.html`, `terms.html`, `_headers`, ni au `.well-known/assetlinks.json`
  — ce sont les fichiers de publication sur les stores.
- **Tu n'inventes jamais** un résultat, un classement ou une date. Si une
  information ne se vérifie pas, laisse-la en l'état et dis-le dans ton rapport.

---

## À la fin

Résume en quelques lignes : galas dont les résultats ont été saisis, combats
jugés, événements ajoutés, divisions mises à jour, actus écrites — et surtout
**ce que tu n'as pas pu vérifier**. Si tu n'as rien poussé, dis pourquoi.
