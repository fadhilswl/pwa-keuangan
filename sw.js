const CACHE_NAME = "finance-dark-v1"; // Naikkan versinya jika Anda merombak CSS/JS di masa depan
const ASSETS = [ "./", "./index.html", "./style.css", "./script.js", "./manifest.json" ];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  if (!e.request.url.includes('script.google.com')) {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
  }
});
