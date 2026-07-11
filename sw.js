"use strict";

const CACHE_NAME = "crossfit-training-programme-v6";
const LOCAL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase-config.js",
  "./supabase-sync.js",
  "./react-app.js",
  "./manifest.webmanifest",
  "./icon.svg",
];
const RUNTIME_ASSETS = [
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(LOCAL_ASSETS).then(() => {
        return Promise.all(
          RUNTIME_ASSETS.map((asset) =>
            cache.add(asset).catch(() => undefined),
          ),
        );
      });
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    }),
  );
});
