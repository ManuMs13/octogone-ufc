/* Supprime le token APNs quand l'utilisateur coupe les notifications. */
import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!/^[a-fA-F0-9]{64,200}$/.test(token)) {
    return new Response("Invalid device token", { status: 400 });
  }

  const store = getStore("apns-tokens");
  await store.delete(token);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" }
  });
};

export const config = { path: "/api/apns-unsubscribe" };
