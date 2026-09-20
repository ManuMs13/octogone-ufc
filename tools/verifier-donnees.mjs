#!/usr/bin/env node
/**
 * Garde-fou des données d'OCTOGONE.
 *
 * À lancer APRÈS toute modification de index.html, et avant tout push :
 *     node tools/verifier-donnees.mjs
 *
 * Il attrape les erreurs qui ne se voient pas à l'œil et ne cassent rien
 * visiblement — donc celles qui partent en production sans qu'on les remarque :
 *
 *  - une clé de RESULTS qui ne correspond à aucun combat (faute de frappe,
 *    accent manquant) : le prono du joueur n'est jamais jugé, en silence ;
 *  - un vainqueur qui n'est ni l'un ni l'autre des deux combattants ;
 *  - un calendrier dans le désordre, des prélims après la carte principale ;
 *  - un tuple de combat malformé ;
 *  - une erreur de syntaxe JavaScript dans le bloc de données.
 *
 * Sort en code 1 si quelque chose ne va pas, 0 sinon.
 */
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FICHIER = process.argv[2] || "index.html";
const src = readFileSync(FICHIER, "utf8");
const erreurs = [];
const alertes = [];

/* Extrait un littéral `const NOM=…` en comptant les délimiteurs, en ignorant
   ceux qui se trouvent dans une chaîne ou un commentaire. */
function extraire(decl, ouvrant, fermant) {
  const i = src.indexOf(decl);
  if (i < 0) throw new Error(`bloc introuvable : ${decl}`);
  let profondeur = 0, chaine = null, echap = false;
  for (let j = i + decl.length; j < src.length; j++) {
    const c = src[j];
    if (chaine) {
      if (echap) echap = false;
      else if (c === "\\") echap = true;
      else if (c === chaine) chaine = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { chaine = c; continue; }
    if (c === "/" && src[j + 1] === "*") { j = src.indexOf("*/", j) + 1; continue; }
    if (c === ouvrant) profondeur++;
    else if (c === fermant && !--profondeur) return src.slice(i + decl.length, j + 1);
  }
  throw new Error(`bloc non fermé : ${decl}`);
}

/* 1. Syntaxe du JavaScript embarqué */
const blocs = [...src.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
blocs.forEach((m, i) => {
  const tmp = join(tmpdir(), `octogone-bloc-${process.pid}-${i}.js`);
  writeFileSync(tmp, m[1]);
  try {
    execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" });
  } catch (e) {
    erreurs.push(`syntaxe JavaScript (bloc ${i}) :\n${e.stderr?.toString().trim()}`);
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
});
if (erreurs.length) { rapport(); process.exit(1); }

/* 2. Cohérence des données */
const EVENTS = eval(extraire("const EVENTS=", "[", "]"));
const RESULTS = eval("(" + extraire("const RESULTS=", "{", "}") + ")");
const RANKINGS = eval(extraire("const RANKINGS=", "[", "]"));

const cle = (f) => f[0] + "|" + f[1];
const parId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
let juges = 0;

for (const [evId, res] of Object.entries(RESULTS)) {
  const e = parId[evId];
  if (!e) { erreurs.push(`RESULTS renvoie à un événement inexistant : "${evId}"`); continue; }
  const cles = new Set([...e.main, ...e.prelims].map(cle));
  for (const [k, vainqueur] of Object.entries(res)) {
    if (!cles.has(k)) {
      erreurs.push(`${evId} : la clé "${k}" ne correspond à aucun combat de la carte — le prono ne sera jamais jugé`);
      continue;
    }
    const [a, b] = k.split("|");
    if (vainqueur !== a && vainqueur !== b) {
      erreurs.push(`${evId} : vainqueur "${vainqueur}" absent du combat "${k}"`);
      continue;
    }
    juges++;
  }
}

const ids = EVENTS.map((e) => e.id);
if (new Set(ids).size !== ids.length) erreurs.push("deux événements partagent le même id");

let precedent = 0;
for (const e of EVENTS) {
  const t = Date.parse(e.mainUTC);
  if (Number.isNaN(t)) erreurs.push(`${e.id} : mainUTC illisible ("${e.mainUTC}")`);
  if (t < precedent) erreurs.push(`${e.id} : calendrier dans le désordre`);
  precedent = t;
  if (Date.parse(e.prelimsUTC) >= t) erreurs.push(`${e.id} : les prélims commencent après la carte principale`);
  for (const f of [...e.main, ...e.prelims]) {
    if (f.length !== 4 || typeof f[0] !== "string" || typeof f[3] !== "number")
      erreurs.push(`${e.id} : combat malformé ${JSON.stringify(f)}`);
  }
}

/* Un gala passé dont aucun combat n'est jugé = on a oublié d'entrer les résultats. */
const limite = Date.now() - 4 * 3600e3;
for (const e of EVENTS) {
  if (Date.parse(e.mainUTC) > limite) continue;
  const combats = [...e.main, ...e.prelims];
  if (!combats.length) continue;
  /* `nonJuges` déclare les combats annulés ou dont l'adversaire a changé. Un combat
     déclaré là est normal ; un combat manquant SANS déclaration est un oubli. */
  const declares = new Set(e.nonJuges || []);
  const manquants = combats.filter((f) => !(RESULTS[e.id] || {})[cle(f)]);
  const oublies = manquants.filter((f) => !declares.has(cle(f)));
  if (oublies.length)
    erreurs.push(`${e.id} : gala passé, ${oublies.length} résultat(s) non saisi(s) et non déclaré(s) annulé(s) — les pronos restent bloqués en « en attente » : ${oublies.map(cle).join(", ")}`);
  const declaresInutiles = [...declares].filter((k) => !combats.some((f) => cle(f) === k));
  if (declaresInutiles.length)
    erreurs.push(`${e.id} : nonJuges cite un combat absent de la carte : ${declaresInutiles.join(", ")}`);
  if (manquants.length - oublies.length)
    alertes.push(`${e.id} : ${manquants.length - oublies.length} combat(s) annulé(s), non jugé(s) comme prévu`);
}

for (const d of RANKINGS) {
  if (!Array.isArray(d.f) || !d.f.length) erreurs.push(`classement "${d.n}" vide`);
  if (new Set(d.f).size !== d.f.length) erreurs.push(`classement "${d.n}" : combattant en double`);
  if (d.c && d.f.includes(d.c)) erreurs.push(`classement "${d.n}" : "${d.c}" est à la fois champion et classé`);
}

/* Le cache du service worker doit changer à chaque déploiement, sinon les
   utilisateurs gardent l'ancienne version en mémoire. */
try {
  const cache = readFileSync("sw.js", "utf8").match(/const CACHE\s*=\s*"([^"]+)"/)?.[1];
  if (!cache) erreurs.push("sw.js : version de CACHE introuvable");
  else console.log(`   cache service worker : ${cache}`);
} catch { alertes.push("sw.js illisible depuis ce dossier"); }

function rapport() {
  for (const a of alertes) console.log(`⚠️  ${a}`);
  for (const e of erreurs) console.log(`❌ ${e}`);
}

rapport();
console.log(`\n${EVENTS.length} événements · ${juges} combats jugés · ${RANKINGS.length} classements`);
console.log(erreurs.length ? `\n❌ ${erreurs.length} erreur(s) — NE PAS DÉPLOYER.` : "\n✅ Données cohérentes.");
process.exit(erreurs.length ? 1 : 0);
