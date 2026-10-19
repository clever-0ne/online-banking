"use client";

// Service worker registration, push subscriptions and the "install app" prompt, shared by the customer app and staff.

const SW_URL = process.env.NODE_ENV === "production" ? "/sw.js" : "/sw.js?dev=1";

export async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const isIos = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

export type PushState = "loading" | "unsupported" | "needs-install" | "unavailable" | "blocked" | "off" | "on";

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api(base: string, method: "GET" | "POST" | "DELETE", body?: object, query = "") {
  const res = await fetch(`${base}${query}`, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/** Where notifications stand on this device for the given endpoint base (/api/push or the staff one). */
export async function pushStatus(base: string): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  const info = await api(base, "GET", undefined, sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : "");
  if (!info.available) return "unavailable";
  // On only if the server has this device for whoever is signed in now; another account's device shows as off.
  return sub && info.subscribed && Notification.permission === "granted" ? "on" : "off";
}

export async function enablePush(base: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const reg = await registerSw();
  if (!reg) throw new Error("This browser couldn't set up notifications.");
  const { publicKey, available } = await api(base, "GET");
  if (!available) return "unavailable";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api(base, "POST", { subscription: sub.toJSON() });
  return "on";
}

export async function disablePush(base: string): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api(base, "DELETE", { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}

// ---------- Install ----------
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach((l) => l()); });
  window.addEventListener("appinstalled", () => { deferred = null; listeners.forEach((l) => l()); });
}
export const canPromptInstall = () => deferred !== null;
export const onInstallChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
  return outcome === "accepted";
}
