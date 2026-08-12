/* 火哥的个人站 · Service Worker（网络优先，HTML 永不缓存，保证页面最新） */
var CACHE = 'hg-site-v19';
var CORE = [
  '/',
  '/assets/css/workbench.css',
  '/assets/css/style.css',
  '/assets/js/workbench.js',
  '/assets/js/nav.js',
  '/assets/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(CORE).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (isDoc) {
    /* HTML 文档：只走网络（失败才回退缓存），绝不写入缓存 → 页面永远最新 */
    e.respondWith(
      fetch(req).catch(function () { return caches.match(req); })
    );
    return;
  }
  /* 静态资源：网络优先，成功则更新缓存，离线回退缓存 */
  e.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('/'); });
    })
  );
});
