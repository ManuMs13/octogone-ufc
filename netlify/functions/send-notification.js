import { getStore } from "@netlify/blobs";
import webpush from "web-push";
import { sendToApns, apnsConfigured } from "../lib/apns.js";

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = req.headers.get("x-notify-secret");
  if (!secret || secret !== process.env.NOTIFY_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return new Response("VAPID keys not configured", { status: 500 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const title = body.title || "OCTOGONE";
  const message = body.body || "";
  const url = body.url || "/";
  const payload = JSON.stringify({ title, body: message, url });

  webpush.setVapidDetails(
    "mailto:contact@octogone-ufc.netlify.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const store = getStore("push-subscriptions");
  const { blobs } = await store.list();

  let sent = 0, failed = 0, removed = 0;
  for (const b of blobs) {
    const sub = await store.get(b.key, { type: "json" });
    if (!sub) continue;
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      failed++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        await store.delete(b.key);
        removed++;
      }
    }
  }

  /* --- App iOS native : envoi via APNs --- */
  let ios = { sent: 0, failed: 0, removed: 0, skipped: true };
  if (apnsConfigured()) {
    const apnsStore = getStore("apns-tokens");
    const { blobs: tokenBlobs } = await apnsStore.list();
    const tokens = tokenBlobs.map((b) => b.key);
    try {
      const r = await sendToApns(tokens, { title, body: message, url });
      for (const dead of r.gone) await apnsStore.delete(dead);
      ios = { sent: r.sent, failed: r.failed, removed: r.gone.length, skipped: false };
    } catch (err) {
      ios = { sent: 0, failed: tokens.length, removed: 0, skipped: false, error: String(err.message || err) };
    }
  }

  return new Response(
    JSON.stringify({ web: { sent, failed, removed }, ios }),
    { headers: { "content-type": "application/json" } }
  );
};

export const config = { path: "/api/send-notification" };
