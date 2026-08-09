import { getStore } from "@netlify/blobs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  let sub;
  try { sub = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (!sub || !sub.endpoint) return new Response("Invalid subscription", { status: 400 });

  const store = getStore("push-subscriptions");
  const key = Buffer.from(sub.endpoint).toString("base64url");
  await store.setJSON(key, sub);

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

export const config = { path: "/api/subscribe" };
