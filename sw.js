/* =========================================================
   Service worker â€” app shell + cache áº£nh
   Äá»•i VERSION má»—i láº§n deploy Ä‘á»ƒ buá»™c trÃ¬nh duyá»‡t láº¥y báº£n má»›i.
   ========================================================= */

const VERSION = "3.4.1";
const SHELL_CACHE = `shell-${VERSION}`;
const IMAGE_CACHE = `img-${VERSION}`;
const MAX_IMAGES = 400;

const SHELL_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./products.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(SHELL_CACHE);
            // Tá»«ng file má»™t: má»™t file lá»—i khÃ´ng lÃ m há»ng cáº£ láº§n cÃ i.
            await Promise.all(
                SHELL_FILES.map((file) =>
                    cache.add(new Request(file, { cache: "reload" })).catch((err) => {
                        console.warn("[sw] bá» qua", file, err);
                    })
                )
            );
        })()
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key !== SHELL_CACHE && key !== IMAGE_CACHE)
                    .map((key) => caches.delete(key))
            );
            if (self.registration.navigationPreload) {
                await self.registration.navigationPreload.enable();
            }
            await self.clients.claim();
        })()
    );
});

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length <= maxItems) return;
    for (const key of keys.slice(0, keys.length - maxItems)) {
        await cache.delete(key);
    }
}

async function networkFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put("./index.html", response.clone());
        return response;
    } catch {
        const cached = (await cache.match(request)) || (await cache.match("./index.html"));
        if (cached) return cached;
        throw new Error("offline vÃ  khÃ´ng cÃ³ báº£n cache");
    }
}

async function cacheFirst(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
        trimCache(IMAGE_CACHE, MAX_IMAGES);
    }
    return response;
}

async function staleWhileRevalidate(request) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    const network = fetch(request)
        .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);
    return cached || (await network) || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
        return;
    }

    if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
        event.respondWith(cacheFirst(request).catch(() => new Response("", { status: 504 })));
        return;
    }

    event.respondWith(staleWhileRevalidate(request));
});
