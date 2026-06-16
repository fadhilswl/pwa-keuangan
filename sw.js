const CACHE_NAME = "finance-emoji-v7"; 
const ASSETS = [ 
  "./", 
  "./index.html", 
  "./style.css", 
  "./script.js", 
  "./manifest.json" 
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  if (!e.request.url.includes('script.google.com') && 
      !e.request.url.includes('fonts.googleapis.com') && 
      !e.request.url.includes('fonts.gstatic.com')) {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
  }
});
