// Push notifications (Web Push with VAPID keys from the environment). Customers get notified about their own
// account; staff devices get notified about new deposit and withdrawal requests. Server only.
import webpush from "web-push";
import { all, one, run } from "./db";

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url?: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
}

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  const subject = process.env.VAPID_SUBJECT || process.env.APP_ORIGIN || "mailto:support@anchor.bank";
  webpush.setVapidDetails(subject, pub, priv);
  return (configured = true);
}
export const publicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";

/** "Chrome on Windows" and so on, from a User-Agent header. */
export function deviceName(ua: string | null): string {
  const u = ua ?? "";
  const os = /iPhone|iPad/.test(u) ? "iPhone" : /Android/.test(u) ? "Android" : /Mac/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows" : /Linux/.test(u) ? "Linux" : "a device";
  const browser = /Edg\//.test(u) ? "Edge" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "a browser";
  return `${browser} on ${os}`;
}

type Sub = { endpoint: string; p256dh: string; auth: string };

/** Checks a subscription from the browser has the shape the push services need. */
export function parseSubscription(v: unknown): Sub | null {
  const s = v as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== "string" || !/^https:\/\/\S{10,2000}$/.test(s.endpoint)) return null;
  if (typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return null;
  if (s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return null;
  return { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
}

/** Saves this device for a customer (userId) or for staff (userId null). Re-subscribing moves the device over. */
export async function saveSubscription(sub: Sub, audience: "customer" | "staff", userId: string | null, device: string) {
  await run(
    `INSERT INTO push_subscriptions (endpoint, audience, user_id, p256dh, auth, device, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET audience = excluded.audience, user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device`,
    sub.endpoint, audience, userId, sub.p256dh, sub.auth, device.slice(0, 120), new Date().toISOString(),
  );
}

/** Removes a device. A customer can only remove their own; staff only staff devices. */
export async function removeSubscription(endpoint: string, audience: "customer" | "staff", userId: string | null) {
  await run(
    audience === "customer" ? "DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?" : "DELETE FROM push_subscriptions WHERE endpoint = ? AND audience = 'staff'",
    ...(audience === "customer" ? [endpoint, userId] : [endpoint]),
  );
}

export async function isSubscribed(endpoint: string, audience: "customer" | "staff", userId: string | null): Promise<boolean> {
  return !!(audience === "customer"
    ? await one("SELECT 1 FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", endpoint, userId)
    : await one("SELECT 1 FROM push_subscriptions WHERE endpoint = ? AND audience = 'staff'", endpoint));
}

async function deliver(subs: Sub[], msg: PushMessage) {
  if (!subs.length || !pushConfigured()) return;
  const payload = JSON.stringify({ ...msg, url: msg.url ?? "/" });
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 24 * 3600, urgency: "high", timeout: 5000 });
      await run("UPDATE push_subscriptions SET last_sent_at = ? WHERE endpoint = ?", new Date().toISOString(), s.endpoint);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // The browser unsubscribed or the subscription expired: forget the device.
      if (status === 404 || status === 410) await run("DELETE FROM push_subscriptions WHERE endpoint = ?", s.endpoint);
    }
  }));
}

/** Notifies every device a customer turned notifications on for. Never throws. */
export async function notifyCustomer(userId: string, msg: PushMessage) {
  try {
    await deliver(await all<Sub>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", userId), msg);
  } catch {}
}

/** Notifies every staff device. Never throws. */
export async function notifyStaff(msg: PushMessage) {
  try {
    await deliver(await all<Sub>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE audience = 'staff'"), msg);
  } catch {}
}

/** Sends to one device, e.g. to confirm notifications work right after they're turned on. */
export async function notifyDevice(endpoint: string, msg: PushMessage) {
  try {
    await deliver(await all<Sub>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?", endpoint), msg);
  } catch {}
}
