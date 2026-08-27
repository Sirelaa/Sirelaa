// SIRELA - Service Worker
// Tujuan: bikin app bisa di-install sebagai PWA & buka lebih cepat.
// Data (lewat /api/...) SELALU diambil langsung dari server (tidak di-cache),
// supaya jadwal/ruangan yang ditampilkan selalu yang terbaru.

const CACHE_NAME = "sirela-shell-v2";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jangan cache panggilan API sama sekali — selalu ambil langsung dari server.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Untuk file shell (html/css/js/ikon): coba cache dulu, fallback ke network.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
          return res;
        })
      );
    })
  );
});