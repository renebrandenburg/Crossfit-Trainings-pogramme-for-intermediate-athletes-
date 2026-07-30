"use strict";

const CACHE_PREFIX = "crossfit-training-programme-";
const CACHE_NAME = `${CACHE_PREFIX}v11`;
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./movement-catalog.js",
  "./app.js",
  "./supabase-config.js",
  "./supabase-sync.js",
  "./react-app.js",
  "./manifest.webmanifest",
  "./icon.svg",
];
const PRIMARY_RUNTIME_ASSETS = [
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js",
];
const FALLBACK_RUNTIME_ASSETS = [
  "https://unpkg.com/@supabase/supabase-js@2.57.4/dist/umd/supabase.js",
];
const RUNTIME_ASSETS = new Set([
  ...PRIMARY_RUNTIME_ASSETS,
  ...FALLBACK_RUNTIME_ASSETS,
]);
const SCOPE_ORIGIN = new URL(self.registration.scope).origin;

function canCache(response) {
  return response && response.ok && ["basic", "cors"].includes(response.type);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (canCache(response)) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, {
      ignoreSearch: request.mode === "navigate",
    });
    if (cached) return cached;

    if (request.mode === "navigate") {
      const appShell = await cache.match(
        new URL("./index.html", self.registration.scope).href,
      );
      if (appShell) return appShell;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (canCache(response)) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(LOCAL_ASSETS);
      await Promise.all(
        PRIMARY_RUNTIME_ASSETS.map((asset) =>
          cache.add(asset).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === SCOPE_ORIGIN) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (RUNTIME_ASSETS.has(requestUrl.href)) {
    event.respondWith(cacheFirst(event.request));
  }
});
