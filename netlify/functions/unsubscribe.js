import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let body;
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (!body || !body.endpoint) return new Response("Invalid request", { status: 400 });

  const store = getStore("push-subscriptions");
  const key = Buffer.from(body.endpoint).toString("base64url");
  await store.delete(key);

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

export const config = { path: "/api/unsubscribe" };
