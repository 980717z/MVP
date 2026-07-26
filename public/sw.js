// Service worker: (1) makes the app installable, (2) receives Web Push and shows
// the OS notification even when the app is closed / the screen is locked.
//
// ⚠️ Deliberately does NO fetch caching. We previously hit a bug where an old
// cached HTML referenced hashed JS chunks that no longer existed, killing the
// login page. A caching SW would reintroduce that stale-asset class of bug, so
// the fetch handler is a pure passthrough — nothing is ever served from cache.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Required for installability. Empty = browser fetches normally (no interception).
self.addEventListener("fetch", () => {});

// ── Web Push ───────────────────────────────────────────────────────────────
// Payload (JSON) is sent by /api/push/send: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "🔔 新订单 New order";
  const options = {
    body: data.body || "",
    icon: "/icons/192",
    badge: "/icons/192",
    // Same tag → new order replaces the previous banner instead of stacking.
    tag: data.tag || "bento-order",
    renotify: true,
    requireInteraction: true, // stay on screen until staff acts on it
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses an existing tab (or opens one) at the order page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.focus();
          if ("navigate" in c) c.navigate(url).catch(() => {});
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
