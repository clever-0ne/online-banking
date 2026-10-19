// Anchor Bank service worker. It keeps the app's static files for fast starts, shows an offline page when there's
// no connection, and shows push notifications. Account pages and API responses are never stored on the device.
const VERSION = "anchor-v2";
const PRECACHE = ["/offline.html", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/badge-96.png"];
// Registered as /sw.js?dev=1 during development: notifications work, but nothing is cached, so code is always fresh.
const DEV = new URL(self.location.href).searchParams.has("dev");

self.addEventListener("install", (event) => {
  event.waitUntil((DEV ? Promise.resolve() : caches.open(VERSION).then((c) => c.addAll(PRECACHE))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => DEV || k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (DEV) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always from the network; the offline page if that fails.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Build files have content hashes in their names, so a stored copy is always right.
  const isStatic = url.pathname.startsWith("/_next/static/") || /^\/(icon-[\w-]+|apple-touch-icon|badge-96)\.png$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
  // Everything else (including /api) goes straight to the network.
});

// ---------- Push notifications ----------
self.addEventListener("push", (event) => {
  let msg = { title: "Anchor Bank", body: "You have a new update.", url: "/", tag: undefined };
  try { msg = { ...msg, ...event.data.json() }; } catch { if (event.data) msg.body = event.data.text(); }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: "/icon-192.png",
      badge: "/badge-96.png",
      tag: msg.tag,
      renotify: !!msg.tag,
      data: { url: msg.url || "/" },
    }),
  );
});

// Tapping a notification opens the page it's about, reusing an open Anchor Bank window when there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === target.origin && "focus" in w) {
        await w.focus();
        if ("navigate" in w) await w.navigate(target.href).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(target.href);
  })());
});

// The browser replaced the subscription (keys rotated or expired): there's nothing to update without the user's
// session, so the app re-subscribes the next time it's opened.
self.addEventListener("pushsubscriptionchange", () => {});
