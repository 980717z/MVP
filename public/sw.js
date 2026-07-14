// Minimal service worker — its ONLY job is to make the app installable (Chrome/
// Android require a registered SW with a fetch handler for the install prompt).
//
// ⚠️ Deliberately does NO caching. We previously hit a bug where an old cached
// HTML referenced hashed JS chunks that no longer existed, leaving the login page
// dead. A caching SW would reintroduce exactly that class of stale-asset bug, so
// this one is a pure network passthrough: every request goes straight to the
// network, nothing is ever served from cache.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler must exist for installability. Empty body = let the browser
// fetch normally (no cache interception).
self.addEventListener("fetch", () => {});
