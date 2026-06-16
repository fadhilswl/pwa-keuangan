const CACHE_NAME = "keuangan-v1";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json"
];

// Install Service Worker dan caching aset
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Menyajikan aset dari Cache jika offline
self.addEventListener("fetch", (event) => {
  // Hanya proses cache untuk request internal (bukan API GAS)
  if (!event.request.url.includes('script.google.com')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});