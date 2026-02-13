// Travel Album - 静态资源缓存，API 网络优先
var CACHE_NAME = 'travel-album-v1';

// 安装：预缓存关键静态资源
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/location.html',
        '/location_detail.html',
        '/css/index.css',
        '/css/location.css',
        '/css/location_detail.css',
        '/js/theme.js',
        '/js/oss-utils.js',
        '/js/starfield.js',
        '/js/sky.js',
        '/js/index.js',
        '/js/location.js',
        '/js/location_detail.js',
        '/js/sakura.js',
        '/icon/hand.svg'
      ]).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

// 激活：接管页面
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 请求：静态资源缓存优先，API 网络优先
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) {
    e.respondWith(
      fetch(e.request).then(function (r) { return r; }).catch(function () {
        return caches.match(e.request).then(function (c) { return c || new Response('', { status: 503 }); });
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      if (cached) return cached;
      return fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.url.indexOf('/api/') === -1) {
          var clone = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(e.request, clone); });
        }
        return res;
      });
    })
  );
});
