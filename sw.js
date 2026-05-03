const CACHE_NAME = "organizeme-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Installation : mise en cache des ressources
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie : Network First (Firebase), Cache First (assets locaux)
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Firebase et CDN → toujours réseau, pas de cache
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("cloudflare") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("generativelanguage") ||
    url.hostname.includes("gemini")
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // Assets locaux → cache first, fallback réseau
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Mettre en cache les nouvelles ressources locales
        if (response.ok && e.request.method === "GET") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback hors-ligne : retourner index.html
        if (e.request.destination === "document") {
          return caches.match("/index.html");
        }
      });
    })
  );
});

// Notifications push
self.addEventListener("push", e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || "OrganizeMe", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-72.png",
      vibrate: [200, 100, 200],
      tag: data.tag || "organizeme",
      renotify: true,
      data: { url: data.url || "/" }
    })
  );
});

// Clic sur notification → ouvre l'app
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
