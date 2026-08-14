// Service worker: makes the app installable and keeps it from showing a browser
// error page when a phone briefly loses signal.
//
// Deliberately conservative: property and account data is NEVER cached, because a
// resident seeing a stale rent figure or an employee seeing a stale work-order
// status is worse than seeing an honest offline message. Only the app shell and
// static assets are cached.
const CACHE = "fleming-shell-v2";
const SHELL = ["/", "/login", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never serve API responses from cache — always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// ── Push notifications ───────────────────────────────────────────────────────
// On iOS this only runs when the app has been added to the Home Screen — Safari
// tabs get no push at all — which is why the app asks people to install it first
// rather than showing a permission prompt that silently does nothing.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }

  const title = d.title || "Stephen Fleming Realty";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Same tag replaces an earlier notification about the same job instead of
      // stacking three of them on the lock screen.
      tag: d.tag || "fleming",
      renotify: true,
      data: { url: d.url || "/app" },
    })
  );
});

// Tapping one should land on the job it is about, and should re-use a window
// that is already open rather than launching a second copy of the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && "focus" in c) {
          if ("navigate" in c) c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// A subscription can be rotated by the browser without the user doing anything.
// Without this the device goes quiet and nobody finds out until someone asks why
// they stopped getting notified.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe(
        event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true }
      );
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch { /* the app re-subscribes next time it is opened */ }
  })());
});
