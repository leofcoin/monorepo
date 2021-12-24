import { version } from './../package.json';
import './../node_modules/datastore-level/cjs/src/index.js'
import './../node_modules/interface-datastore/cjs/src/key.js'

const store = new exports.LevelDatastore('artonline-exchange');

const staticContent = [
  '/manifest.json',
  '/favicon.ico',
  '/index.html'
];

const compareVersion = async activeVersion => {
  console.log('activeVersion:', activeVersion, 'new version:', version);
  const parsedVersion = version.split('.')
  const parsedActiveVersion = activeVersion.split('.')
  return parsedVersion[0] === parsedActiveVersion[0] &&
         parsedVersion[1] === parsedActiveVersion[1] &&
         parsedVersion[2] === parsedActiveVersion[2]
}

self.addEventListener('install', async event => {
  await store.open()
  console.log('installing' + version);
  event.waitUntil
  const cache = await caches.open('cache-' + version);

  await cache.addAll(staticContent);
  let activeVersion
  try {
    activeVersion = await store.get(new exports.Key('active-version'));
    activeVersion = activeVersion.toString()
  } catch (e) {
    activeVersion = undefined
  }
  if (!activeVersion || await compareVersion(activeVersion)) {
    // wrapping in an if while Chrome 40 is still around
    if (self.skipWaiting) {
      console.log('skipWaiting()');
      self.skipWaiting();
    }
  }
});

var expectedCaches = [
  'cache-' + version
];

const fetchAndAdd = async request => {
  if (request.url.includes('sw-loader')) return fetch(request)
  if (request.method !== 'GET') return fetch(request)

  const response = await fetch(request)
  const cache = await caches.open('cache-' + version)
  cache.put(request, response.clone())
  return response;
}

self.addEventListener('activate', async event => {
  console.log('activating' + version);
  await event.waitUntil
  await self.clients.claim();
  // remove caches beginning "svgomg-" that aren't in
  // expectedCaches
  var cacheNames = await caches.keys();
  console.log('cacheNames', cacheNames);
  for (var cacheName of cacheNames) {
    if (!/^cache-/.test(cacheName)) {
      continue;
    }
    if (expectedCaches.indexOf(cacheName) == -1) {
      console.log('deleting', cacheName);
      await caches.delete(cacheName);
    }
  }
  store.put(new exports.Key('active-version'), version);
});

self.addEventListener('redundant', event => {
  console.log('redundant' + version, event);
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetchAndAdd(event.request))
  );
});
