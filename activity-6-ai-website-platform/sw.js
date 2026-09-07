/* Scope website service worker — offline support.
   Network-first for pages/assets (always fresh online, cached fallback offline);
   never touches /api/* (dynamic) or non-GET requests. */
var CACHE = "scope-v4";
var ASSETS = [
  "/", "/index.html", "/about.html", "/services.html", "/projects.html",
  "/contact.html", "/planner.html", "/quote.html",
  "/css/style.css", "/js/script.js", "/js/chatbot.js", "/js/planner.js",
  "/js/quote.js", "/images/logo.svg"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.pathname.indexOf("/api/") === 0) return; // dynamic — let it hit the network
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (m) { return m || caches.match("/index.html"); });
    })
  );
});
