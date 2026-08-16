/* Enregistre le token APNs de l'app iOS native.
   Le token est fourni par iOS lui-même ; il n'identifie pas l'utilisateur. */
import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  // Un token APNs est une chaîne hexadécimale (64 caractères, parfois plus).
  if (!/^[a-fA-F0-9]{64,200}$/.test(token)) {
    return new Response("Invalid device token", { status: 400 });
  }

  const store = getStore("apns-tokens");
  await store.setJSON(token, { token, platform: "ios", updatedAt: Date.now() });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" }
  });
};

export const config = { path: "/api/apns-subscribe" };
