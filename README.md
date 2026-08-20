# OCTOGONE · Tracker

Application de suivi d'événements MMA en français — web, Android et iOS, depuis une seule base de code.

**[octogone-ufc.netlify.app](https://octogone-ufc.netlify.app)**

---

## Ce que ce dépôt contient réellement

Une application complète menée seul, du premier commit à la soumission sur les deux stores **en huit jours** — et **sans posséder de Mac**, alors que compiler pour iOS l'exige.

| | |
|---|---|
| Du 1<sup>er</sup> commit à la soumission App Store | **8 jours** (9 → 17 août 2026) |
| Versions déployées en production | **56** |
| Machines macOS possédées | **0** |
| Frameworks front-end | **0** |

## Architecture

Pas de framework, pas d'étape de compilation. Ce n'est pas de la nostalgie : c'est ce qui rend le déploiement instantané, et c'est la condition du point 4 ci-dessous.

```
index.html            application complète, une seule page, aucun build
sw.js                 cache, mode hors ligne, réception des notifications
netlify/functions/    abonnements push, envoi, export calendrier (.ics)
netlify/lib/apns.js   client APNs écrit à la main (HTTP/2 + JWT ES256)
.github/workflows/    compilation, signature et envoi TestFlight iOS
fastlane/             configuration de livraison
capacitor.config.json applications mobiles, en mode server.url
```

## Cinq problèmes qui valaient le détour

**1. Une CSP qui ne casse le site qu'en production.**
Dans le contexte d'un service worker, un `fetch()` d'image compte comme `connect-src`, pas `img-src`. Une politique qui autorisait les images bloquait donc le service worker — invisible en local, où le service worker n'était pas actif. Résolu par deux CSP distinctes : stricte sur la page, élargie sur `/sw.js` uniquement.

**2. Le Web Push n'existe pas dans une app iOS.**
Safari sur iOS 16.4+ le supporte, la WebView embarquée non. Le mécanisme validé sur le site ne pouvait structurellement pas fonctionner dans l'application. D'où un second canal : un client APNs écrit à la main sur `node:http2`, avec JWT ES256 mis en cache 50 minutes (Apple accepte un jeton une heure et refuse qu'on en génère trop) et reconstruction du PEM quelle que soit la mise en forme de la clé `.p8`.

**3. Compiler pour iOS sans Mac.**
Le projet Xcode n'existe sur aucune machine : il est régénéré, compilé, signé et envoyé sur TestFlight à chaque exécution du workflow, puis jeté. Détail coûteux : les descriptions de permission s'injectent avec `plutil` et non `PlistBuddy` — ce dernier analyse lui-même sa chaîne `-c`, donc une apostrophe dans un texte français casse le build sur `Parse Error: Unclosed Quotes`.

**4. Corriger l'app sans repasser par la review.**
Capacitor en mode `server.url` : l'application charge le site, avec navigation restreinte à ce seul domaine. Toute correction s'applique instantanément dans les apps déjà installées. Le compromis est réel et assumé — on dépend de la disponibilité du serveur, et une app trop fine expose à la Guideline 4.2 d'Apple. C'est précisément pourquoi le point 2 était indispensable.

**5. Un rejet Apple, et ce qu'il a appris.**
Rejet en Guideline 2.1. En relisant le brouillon de réponse contre le code réellement déployé, j'y ai trouvé quatre affirmations fausses — un examinateur les aurait réfutées avec ma propre vidéo de démonstration. Règle adoptée depuis : n'affirmer que ce qui est constatable dans le code déployé, et déclarer spontanément les points inconfortables plutôt que de les laisser découvrir.

## État actuel

Sans arrondir dans le bon sens :

| Plateforme | État |
|---|---|
| **Web** | En production, mis à jour en continu |
| **Android** | Paquet signé et fiche prêts — **pas encore publié** |
| **iOS** | Distribué sur TestFlight, **en cours de review** après un rejet 2.1 |

## Pile technique

`JavaScript` · `Service Workers` · `Web Push (VAPID)` · `APNs / HTTP2` · `Netlify Functions` · `Capacitor` · `Fastlane` · `GitHub Actions` · `CSP`

---

*OCTOGONE est une application indépendante, gratuite et communautaire créée par un fan. Elle n'est ni affiliée, ni sponsorisée, ni approuvée par aucune organisation ou fédération de MMA. Les noms et contenus tiers appartiennent à leurs propriétaires respectifs.*
