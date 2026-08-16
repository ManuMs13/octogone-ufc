/* Sert un fichier calendrier depuis une vraie URL.

   Dans l'app iOS native, télécharger un Blob ne déclenche rien et la feuille
   de partage oblige l'utilisateur à choisir une destination. En servant le
   .ics depuis une adresse web avec le bon type de contenu, iOS le reconnaît
   et propose directement de l'ajouter au Calendrier.

   Les données de l'événement viennent de l'app (elle seule tient le
   calendrier à jour) ; cette fonction ne fait que les mettre en forme. */

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
const stamp = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/* Une ligne ICS ne doit pas dépasser 75 octets : les suivantes sont repliées
   avec une espace en tête (RFC 5545). */
function fold(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = "";
  for (const ch of line) {
    const next = cur + ch;
    if (Buffer.byteLength(next, "utf8") > (out.length === 0 ? 75 : 74)) { out.push(cur); cur = ch; }
    else cur = next;
  }
  if (cur) out.push(cur);
  return out.join("\r\n ");
}

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const name = (q.get("name") || "").slice(0, 200).trim();
  const start = Number(q.get("start"));

  if (!name || !Number.isFinite(start) || start <= 0) {
    return new Response("Parametres manquants", { status: 400 });
  }

  const id = (q.get("id") || "octogone").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "octogone";
  const loc = (q.get("loc") || "").slice(0, 200).trim();
  const label = (q.get("label") || "").slice(0, 120).trim();

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Octogone//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}-${start}@octogone`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + 3 * 3600000)}`,
    fold(`SUMMARY:🥊 ${esc(name)}${label ? " — " + esc(label) : ""}`),
    loc ? fold(`LOCATION:${esc(loc)}`) : null,
    fold(`DESCRIPTION:${esc(loc || name)} · Octogone Tracker`),
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Le combat commence dans 30 min !",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return new Response(lines.join("\r\n") + "\r\n", {
    status: 200,
    headers: {
      // "inline" : iOS ouvre l'aperçu « Ajouter au calendrier » au lieu de
      // ranger le fichier dans Fichiers.
      "content-type": "text/calendar; charset=utf-8; method=PUBLISH",
      "content-disposition": `inline; filename="${id}.ics"`,
      "cache-control": "no-store",
    },
  });
};

export const config = { path: "/api/ics" };
