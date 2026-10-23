// Push notifications (Web Push with VAPID keys from the environment). Customers get notified about their own
// account; staff devices get notified about new deposit and withdrawal requests. Server only.
import webpush from "web-push";
import { all, one, run } from "./db";
import { sendEmail, type EmailMessage } from "./email";

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url?: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
  /** The matching email. By default it repeats the title and body with a button to url; false sends no email. */
  email?: Partial<Omit<EmailMessage, "to">> | false;
}

const emailFor = (to: string, msg: PushMessage): EmailMessage => ({
  to,
  subject: msg.title,
  paragraphs: [msg.body],
  button: msg.url ? { label: "Open Anchor Bank", href: msg.url } : undefined,
  ...(msg.email || {}),
});

let configured: boolean | null = null;
/** Why notifications are off on this server, or null when they are set up. Shown in the staff setup check. */
export let pushProblem: string | null = null;

/** The contact push services require: mailto: or https. A bare email address is accepted and fixed up. */
function vapidSubject(): string {
  const raw = (process.env.VAPID_SUBJECT || process.env.APP_ORIGIN || "").trim();
  if (/^(mailto:|https:\/\/)/.test(raw)) return raw;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(raw)) return "mailto:" + raw;
  return "mailto:support@anchor.bank";
}

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim(), priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) {
    pushProblem = "VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY aren't set.";
    return (configured = false);
  }
  try {
    webpush.setVapidDetails(vapidSubject(), pub, priv);
  } catch (e) {
    pushProblem = `The VAPID keys aren't valid (${(e as Error).message}). Generate a new pair with: npx web-push generate-vapid-keys`;
    console.warn("[push]", pushProblem);
    return (configured = false);
  }
  pushProblem = null;
  return (configured = true);
}
export const publicKey = () => process.env.VAPID_PUBLIC_KEY?.trim() ?? "";

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

/** Notifies a customer on every device they turned notifications on for, and by email. Never throws. */
export async function notifyCustomer(userId: string, msg: PushMessage) {
  const push = async () => deliver(await all<Sub>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?", userId), msg);
  const mail = async () => {
    if (msg.email === false) return;
    const u = await one<{ email: string; status: string }>("SELECT email, status FROM users WHERE id = ?", userId);
    if (u) await sendEmail(emailFor(u.email, msg));
  };
  await Promise.allSettled([push(), mail()]);
}

/** Notifies every staff device, and STAFF_EMAIL if it's set. Never throws. */
export async function notifyStaff(msg: PushMessage) {
  const push = async () => deliver(await all<Sub>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE audience = 'staff'"), msg);
  const to = process.env.STAFF_EMAIL?.trim();
  await Promise.allSettled([push(), to && msg.email !== false ? sendEmail(emailFor(to, { ...msg, email: { button: msg.url ? { label: "Review it", href: msg.url } : undefined, ...(msg.email || {}) } })) : null]);
}

/** Sends to one device, e.g. to confirm notifications work right after they're turned on. */
export async function notifyDevice(endpoint: string, msg: PushMessage) {
  try {
    await deliver(await all<Sub>("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?", endpoint), msg);
  } catch {}
}
