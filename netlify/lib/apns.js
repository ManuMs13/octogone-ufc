/* Envoi de notifications via APNs (Apple Push Notification service).
 *
 * L'app iOS native ne peut pas utiliser le Web Push (l'API n'existe pas dans la
 * WebView) : elle passe par APNs, avec un token d'appareil fourni par iOS.
 * Le Web Push (VAPID) reste utilisé pour le site et l'app Android.
 *
 * Variables d'environnement Netlify attendues :
 *   APNS_KEY_ID    identifiant de la clé APNs (10 caractères)
 *   APNS_TEAM_ID   identifiant d'équipe Apple
 *   APNS_P8        contenu du fichier .p8 (retours à la ligne réels ou \n)
 *   APNS_BUNDLE_ID identifiant de l'app (défaut : com.octogone.ufc)
 */
import http2 from "node:http2";
import crypto from "node:crypto";

const APNS_HOST = "https://api.push.apple.com";
const b64url = (v) => Buffer.from(v).toString("base64url");

/* Apple accepte un jeton pendant 1 h et refuse qu'on en génère trop :
   on le garde en mémoire et on le renouvelle au bout de 50 min. */
let cached = null;

export function apnsConfigured() {
  return Boolean(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_P8);
}

function buildJwt() {
  const now = Math.floor(Date.now() / 1000);
  if (cached && now - cached.iat < 3000) return cached.jwt;

  const key = process.env.APNS_P8.includes("\\n")
    ? process.env.APNS_P8.replace(/\\n/g, "\n")
    : process.env.APNS_P8;

  const unsigned =
    b64url(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID })) +
    "." +
    b64url(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: now }));

  // ES256 exige la signature au format brut (r||s), pas le DER par défaut.
  const signature = crypto
    .createSign("SHA256")
    .update(unsigned)
    .sign({ key, dsaEncoding: "ieee-p1363" });

  const jwt = `${unsigned}.${b64url(signature)}`;
  cached = { jwt, iat: now };
  return jwt;
}

/* Renvoie { sent, failed, gone } — `gone` liste les tokens qu'Apple déclare
   périmés (app désinstallée) et qu'il faut supprimer du stockage. */
export async function sendToApns(tokens, { title, body, url }) {
  if (!tokens.length) return { sent: 0, failed: 0, gone: [] };
  if (!apnsConfigured()) throw new Error("APNs non configuré (clé, équipe ou .p8 manquant)");

  const jwt = buildJwt();
  const topic = process.env.APNS_BUNDLE_ID || "com.octogone.ufc";
  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: "default" },
    url: url || "/"
  });

  const client = http2.connect(APNS_HOST);
  client.on("error", () => {});

  const results = await Promise.all(
    tokens.map(
      (token) =>
        new Promise((resolve) => {
          const req = client.request({
            ":method": "POST",
            ":path": `/3/device/${token}`,
            authorization: `bearer ${jwt}`,
            "apns-topic": topic,
            "apns-push-type": "alert",
            "apns-priority": "10",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload)
          });

          let status = 0;
          let data = "";
          req.on("response", (h) => { status = h[":status"]; });
          req.on("data", (c) => { data += c; });
          req.on("end", () => resolve({ token, status, data }));
          req.on("error", (e) => resolve({ token, status: 0, data: String(e) }));
          req.setTimeout(10000, () => { req.close(); resolve({ token, status: 0, data: "timeout" }); });
          req.end(payload);
        })
    )
  );

  client.close();

  let sent = 0;
  let failed = 0;
  const gone = [];
  for (const r of results) {
    if (r.status === 200) { sent++; continue; }
    failed++;
    // 410 = appareil désinscrit ; 400 BadDeviceToken = token invalide.
    if (r.status === 410 || (r.status === 400 && r.data.includes("BadDeviceToken"))) {
      gone.push(r.token);
    }
  }
  return { sent, failed, gone };
}
