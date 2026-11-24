/* =========================================================
   Service worker — app shell + cache ảnh
   Đổi VERSION mỗi lần deploy để buộc trình duyệt lấy bản mới.
   ========================================================= */

const VERSION = "3.6.0";
const SHELL_CACHE = `shell-${VERSION}`;
const IMAGE_CACHE = `img-${VERSION}`;
const MAX_IMAGES = 400;

// Trang chủ giữ dưới một khoá cố định để điều hướng offline luôn có thứ để trả.
const SHELL_URL = "./index.html";

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
            // Từng file một: một file lỗi không làm hỏng cả lần cài.
            await Promise.all(
                SHELL_FILES.map((file) =>
                    cache.add(new Request(file, { cache: "reload" })).catch((err) => {
                        console.warn("[sw] bỏ qua", file, err);
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

// Điều hướng: ưu tiên mạng, mất mạng thì trả bản đã lưu.
// Chỉ ghi đè khoá trang chủ khi máy chủ thật sự trả về HTML — trước đây
// một trang 404 hay file JSON cũng bị nhét vào chỗ của index.html.
async function networkFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
        const response = await fetch(request);
        const type = response.headers.get("content-type") || "";
        if (response.ok && type.includes("text/html")) {
            cache.put(SHELL_URL, response.clone());
        }
        return response;
    } catch {
        const cached = (await cache.match(request)) || (await cache.match(SHELL_URL));
        if (cached) return cached;
        throw new Error("offline và không có bản cache");
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
