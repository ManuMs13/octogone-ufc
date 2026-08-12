# OCTOGONE — UFC Tracker

Site statique (PWA) + fonctions Netlify (notifications push) + wrapper iOS Capacitor/Fastlane.
Déployé sur Netlify (`octogone-ufc.netlify.app`), l'app iOS charge ce même site à distance
(voir `capacitor.config.json` → `server.url`) — ce n'est PAS un bundle offline.

## Architecture (fichier par fichier)

- **`index.html`** (~1950 lignes, ~156 Ko) — TOUT le site : HTML + CSS + JS inline dans un seul
  fichier. C'est le fichier qui change le plus souvent (mises à jour de cartes de combat, etc.).
  Ne JAMAIS le lire en entier pour une petite modif — voir la carte des sections ci-dessous et
  utiliser `Grep`/`Read` avec `offset`/`limit` ciblé sur la zone concernée.
- **`www/index.html`** — stub minimal (6 lignes) requis par Capacitor comme `webDir`. L'app ne
  charge PAS ce fichier en prod (elle pointe vers l'URL Netlify). Ne pas y toucher, ne pas le
  "compléter" en pensant que c'est un doublon oublié.
- **`netlify/functions/`** — `subscribe.js`, `unsubscribe.js`, `send-notification.js` : back-end
  des notifications push (Web Push).
- **`fastlane/`, `.github/workflows/ios-release.yml`, `capacitor.config.json`** — pipeline de
  publication iOS. Le dossier `ios/` est régénéré en CI, jamais commité (voir `.gitignore`).
- **`privacy.html`, `terms.html`, `.well-known/assetlinks.json`** — pages légales / vérification
  d'app (Discord, Android App Links).
- **`sw.js`** — service worker (cache PWA).
- **`resources/`** (icon.png, splash.png) — sources pour `capacitor-assets generate`.

## Carte des sections dans `index.html`

CSS (balises `<style>`, avant la ligne 679), repérées par `/* ===== NOM ===== */` :
Fond arène, Header, Nav, Sections, Cartes verre, Bandeau champions, Hero, Événements,
Classements, Combattants, Modal fiche, Commentaires, Live, Pronostics/Duels, Arène des pronos,
Favoris, Réseaux, Actus, Fil vidéos, Drapeau combattant, Alarmes, Splash, Analyse IA.

HTML (balises `<!-- NOM -->`, lignes 529–667) : Événements, Mode pronos, Classements,
Combattants, Actus + Fil vidéos, Réseaux, Alarmes, Modal fiche combattant.

JS (balise `<script>` à partir de la ligne 678), repéré par `/* ============ NOM ============ */` :

| Bloc | Ligne approx. | Contenu |
|---|---|---|
| DONNÉES | 679 | `const EVENTS=[...]` — cartes de combat, dates, lieux, notes. **C'est ici qu'on met à jour les galas UFC** (ajout/retrait de combattants, changements de carte). |
| ÉTAT / STOCKAGE | 1118 | localStorage, état app |
| UTILS | 1126 | fonctions utilitaires |
| NAV | 1133 | navigation entre onglets |
| HORLOGE + HERO | 1183 | compte à rebours |
| PRONOSTICS (système + arène + partage image) | 1196–1397 | mode pronos |
| ÉVÉNEMENTS | 1398 | rendu de la liste d'événements |
| API COMBATTANTS | 1448 | appels API fiches combattants |
| CLASSEMENTS | 1464 | rankings |
| COMBATTANTS | 1480 | liste combattants |
| DRAPEAUX PAYS | 1518 | drapeaux |
| FICHE COMBATTANT | 1527 | modal détail |
| MÉDIAS (fil vidéos + actus) | 1583 | fil vidéos/actus — c'est ici qu'on ajoute/retire des vidéos (Embedded, media day, etc.) |
| COMMENTAIRES | 1699 | commentaires stockés localement |
| LIVE | 1745 | ambiance live synchronisée (estimation) |
| ALARMES | 1808 | notifications/alarmes |

→ Pour localiser vite : `grep -n "EVENTS=\[" index.html` (données combats) ou
`grep -n "FIL VIDÉOS" index.html` (actus/vidéos) plutôt que d'ouvrir tout le fichier.

## Règles pour économiser les tokens

1. **Ne jamais `Read` `index.html` en entier** pour une tâche ciblée. `Grep` d'abord pour trouver
   la ligne, puis `Read`/`Edit` seulement la zone concernée (±30 lignes autour du match).
2. **Regrouper les demandes du même sujet** en une seule passe (ex. plusieurs combattants à
   ajouter/retirer sur la même carte) plutôt que des allers-retours un par un — évite de relire
   le fichier à chaque fois.
3. **Une conversation = un sujet.** Pour un nouveau sujet sans lien (ex. passer de "carte UFC 331"
   à "bug notifications push"), démarrer un nouveau fil plutôt que de tout garder dans une session
   qui s'allonge.
4. **Pas de gros copier-coller** de pages web/JSON dans le chat (ex. résultats UFC.com) — donner le
   lien ou juste l'info utile ; préférer WebFetch ciblé si une lecture web est nécessaire.
5. **`package-lock.json` (224 Ko)** ne doit jamais être lu/édité à la main — géré uniquement par
   `npm install`.
6. Le repo est déjà propre (pas de fichiers dupliqués/orphelins au 2026-08-12) — pas besoin de
   chercher du "nettoyage" à chaque session, seulement si un ajout crée réellement un doublon.
