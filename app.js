/* =========================================================
   Tạp Hóa Thanh Trúc — app.js
   Không framework, không build step. Mở file là chạy.
   ========================================================= */
"use strict";

/* ---------------- tiện ích ---------------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
}

function svgUse(id, cls = "ico") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", cls);
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + id);
    svg.appendChild(use);
    return svg;
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Bỏ dấu tiếng Việt, gộp khoảng trắng. "Mì Hảo Hảo" -> "mi hao hao"
function normalize(str) {
    return String(str || "")
        .toLowerCase()
        .replace(/đ/g, "d")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// Chỉ giữ chữ và số, dùng để so khớp không quan tâm dấu cách.
function collapse(str) {
    return normalize(str).replace(/[^a-z0-9]/g, "");
}

// Chữ cái đầu của từng từ. "Mì hảo hảo" -> "mhh"
function initials(str) {
    return normalize(str).split(" ").filter(Boolean).map((w) => w[0]).join("");
}

function matchesSearch(name, query) {
    if (!query) return true;
    const q = collapse(query);
    if (!q) return true;
    return collapse(name).includes(q) || initials(name).startsWith(q);
}

// Tên file ảnh: bỏ dấu, khoảng trắng -> _, & -> va
function toFileName(str) {
    return normalize(str)
        .replace(/\s+/g, "_")
        .replace(/&/g, "va")
        .replace(/[^a-z0-9_.-]/g, "");
}

function debounce(fn, wait) {
    let timer = null;
    return function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/* ---------------- lưu trữ ---------------- */

const STORE = {
    cart: "cart",
    history: "historyLog",
    checking: "checkingList",
    trash: "trashList",
};

function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed == null ? fallback : parsed;
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn("Không lưu được vào localStorage:", key, err);
        return false;
    }
}

/* ---------------- dữ liệu ---------------- */

const PLACEHOLDER_IMG =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
            '<rect width="64" height="64" rx="14" fill="#243049"/>' +
            '<path d="M20 25h24l-2.6 20.4a3 3 0 0 1-3 2.6H25.6a3 3 0 0 1-3-2.6z" fill="none" stroke="#5b6d90" stroke-width="2.4" stroke-linejoin="round"/>' +
            '<path d="M26 25v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#5b6d90" stroke-width="2.4" stroke-linecap="round"/>' +
            "</svg>"
    );

const catalog = []; // [{ name, category }]
const categoryOf = new Map(); // name -> category
const categoryNames = [];

function buildCatalog() {
    catalog.length = 0;
    categoryNames.length = 0;
    categoryOf.clear();

    if (typeof products === "undefined" || !products) {
        console.error("products.js chưa nạp hoặc rỗng.");
        return;
    }

    for (const [category, items] of Object.entries(products)) {
        categoryNames.push(category);
        for (const name of items) {
            if (categoryOf.has(name)) {
                console.warn("Sản phẩm trùng tên ở 2 danh mục:", name);
                continue;
            }
            categoryOf.set(name, category);
            catalog.push({ name, category });
        }
    }
}

function imagePath(name, ext = "webp") {
    const category = categoryOf.get(name) || "Khác";
    return `./images/${category}/${toFileName(name)}.${ext}`;
}

// webp -> jpg -> placeholder. Mỗi ảnh chỉ thử tối đa 2 nguồn rồi dừng,
// nên không lặp vô hạn như bản cũ.
function attachImage(img, name) {
    img.loading = "lazy";
    img.decoding = "async";

    const sources = [imagePath(name, "webp"), imagePath(name, "jpg")];
    let index = 0;

    // Ảnh hiện dần. Gắn class một lần, gỡ listener ngay.
    const settled = () => {
        img.classList.add("is-loaded");
        img.removeEventListener("load", settled);
        img.removeEventListener("error", onError);
    };

    const onError = () => {
        index += 1;
        if (index < sources.length) {
            img.src = sources[index];
            return;
        }
        img.removeEventListener("error", onError);
        img.removeEventListener("load", settled);
        img.classList.add("is-missing", "is-loaded");
        img.src = PLACEHOLDER_IMG;
    };

    img.addEventListener("load", settled);
    img.addEventListener("error", onError);

    img.src = sources[0];
    if (img.complete && img.naturalWidth) settled();
}

/* ---------------- state ---------------- */

let cart = readJSON(STORE.cart, {});
let historyLog = readJSON(STORE.history, []);
let checkingList = [];
let trashList = [];

let currentCategory = "Tất cả";
let searchQuery = "";
const cardByName = new Map();

// Bản cũ lưu danh sách kiểm hàng dạng mảng chuỗi -> nâng cấp sang {id, text}
function migrateItems(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            if (item && typeof item === "object" && typeof item.text === "string") {
                return { id: item.id || uid(), text: item.text };
            }
            if (typeof item === "string" && item.trim()) {
                return { id: uid(), text: item.trim() };
            }
            return null;
        })
        .filter(Boolean);
}

checkingList = migrateItems(readJSON(STORE.checking, []));
trashList = migrateItems(readJSON(STORE.trash, []));

function saveCart() {
    writeJSON(STORE.cart, cart);
}

function saveLists() {
    writeJSON(STORE.checking, checkingList);
    writeJSON(STORE.trash, trashList);
}

/* ---------------- thông báo (toast) ---------------- */

let toastTimer = null;
let toastClick = null;

function toast(message, type = "info", duration = 2200, onClick = null) {
    const box = $("#toast");
    if (!box) return;

    clearTimeout(toastTimer);
    box.className = "toast " + type;
    box.replaceChildren();

    const badge = el("span", "toast-badge");
    badge.appendChild(svgUse(type === "success" ? "i-check" : type === "error" ? "i-close" : "i-star"));
    box.append(badge, el("span", "toast-text", message));

    box.classList.toggle("actionable", typeof onClick === "function");
    toastClick = typeof onClick === "function" ? onClick : null;

    void box.offsetWidth;
    box.classList.add("show");

    toastTimer = setTimeout(() => {
        box.classList.remove("show", "actionable");
        toastClick = null;
    }, duration);
}

/* ---------------- xác nhận ---------------- */

let confirmCallback = null;

function showConfirm(html, callback) {
    const overlay = $("#confirm-overlay");
    const msg = $("#confirm-message");
    if (!overlay || !msg) return;
    msg.innerHTML = html; // nội dung tĩnh do app tự sinh, không chứa dữ liệu người dùng
    confirmCallback = callback;
    overlay.classList.add("open");
}

function answerConfirm(ok) {
    const overlay = $("#confirm-overlay");
    if (overlay) overlay.classList.remove("open");
    const cb = confirmCallback;
    confirmCallback = null;
    if (typeof cb === "function") cb(ok);
}

/* ---------------- overlay ---------------- */

const overlayStack = [];

function staggerSheet(overlay) {
    const body = overlay.querySelector(".ov-body");
    if (!body) return;
    // Chỉ so le vài phần tử đầu, danh sách dài thì để yên.
    let i = 0;
    for (const child of body.children) {
        if (child.hidden) continue;
        if (i < 6) child.style.setProperty("--i", i);
        else child.style.removeProperty("--i");
        i++;
    }
}

function syncSheetState() {
    document.body.classList.toggle("sheet-open", overlayStack.length > 0);
}

function openOverlay(id, onOpen) {
    const overlay = document.getElementById(id);
    if (!overlay || overlay.classList.contains("open")) return;
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    overlayStack.push(id);
    syncSheetState();
    if (typeof onOpen === "function") onOpen();
    staggerSheet(overlay);
}

function closeOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
    const idx = overlayStack.lastIndexOf(id);
    if (idx >= 0) overlayStack.splice(idx, 1);
    syncSheetState();
}

// Kéo thanh tiêu đề xuống để đóng, chỉ trên cảm ứng.
function enableSwipeToClose(overlay) {
    const head = overlay.querySelector(".ov-head");
    if (!head) return;

    let startY = 0;
    let startX = 0;
    let dragY = 0;
    let active = false;
    let decided = false;
    let horizontal = false;

    head.addEventListener(
        "pointerdown",
        (event) => {
            if (event.pointerType === "mouse") return;
            active = true;
            decided = false;
            horizontal = false;
            dragY = 0;
            startY = event.clientY;
            startX = event.clientX;
        },
        { passive: true }
    );

    head.addEventListener(
        "pointermove",
        (event) => {
            if (!active) return;
            const dy = event.clientY - startY;
            const dx = event.clientX - startX;

            // Vuốt ngang thì nhả ra cho trình duyệt xử lý.
            if (!decided && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
                decided = true;
                horizontal = Math.abs(dx) > Math.abs(dy);
            }
            if (horizontal) return;

            dragY = Math.max(0, dy);
            if (dragY > 4) {
                overlay.classList.add("dragging");
                overlay.style.setProperty("--drag", `${dragY}px`);
            }
        },
        { passive: true }
    );

    const finish = () => {
        if (!active) return;
        active = false;
        if (!overlay.classList.contains("dragging")) return;
        overlay.classList.remove("dragging");
        overlay.style.removeProperty("--drag");
        if (!horizontal && dragY > 90) closeOverlay(overlay.id);
        dragY = 0;
    };

    head.addEventListener("pointerup", finish, { passive: true });
    head.addEventListener("pointercancel", finish, { passive: true });
    head.addEventListener("pointerleave", finish, { passive: true });
}

function closeTopLayer() {
    if ($("#confirm-overlay")?.classList.contains("open")) return answerConfirm(false);
    if ($("#image-zoom-overlay")?.classList.contains("open")) return closeZoom();
    const top = overlayStack[overlayStack.length - 1];
    if (top) return closeOverlay(top);
    if ($("#sidebar")?.classList.contains("open")) closeSidebar();
}

function openSidebar() {
    $("#sidebar")?.classList.add("open");
    $("#sidebar")?.setAttribute("aria-hidden", "false");
    $("#scrim")?.classList.add("show");
    $("#menu-btn")?.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
    $("#sidebar")?.classList.remove("open");
    $("#sidebar")?.setAttribute("aria-hidden", "true");
    $("#scrim")?.classList.remove("show");
    $("#menu-btn")?.setAttribute("aria-expanded", "false");
}

/* ---------------- zoom ảnh ---------------- */

function openZoom(src, alt) {
    const overlay = $("#image-zoom-overlay");
    const img = $("#zoomed-image");
    if (!overlay || !img) return;

    // Nếu bản webp thiếu thì rơi về jpg gốc, cuối cùng là ảnh giữ chỗ.
    const fallback = src.replace(/\.webp$/i, ".jpg");
    img.onerror = () => {
        img.onerror = () => {
            img.onerror = null;
            img.src = PLACEHOLDER_IMG;
        };
        img.src = fallback === src ? PLACEHOLDER_IMG : fallback;
    };

    img.src = src;
    img.alt = alt || "";
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
}

function closeZoom() {
    const overlay = $("#image-zoom-overlay");
    if (!overlay) return;
    overlay.classList.remove("open");
    overlay.setAttribute("aria-hidden", "true");
}

/* ---------------- lịch sử ---------------- */

const MAX_HISTORY = 400;

function logHistory(action, productName, qty) {
    const now = Date.now();
    const last = historyLog[0];
    // Gộp các lần bấm liên tiếp cùng một món thành 1 dòng.
    if (last && last.action === action && last.product === productName && now - last.ts < 4000) {
        last.qty = qty;
        last.ts = now;
    } else {
        historyLog.unshift({ ts: now, action, product: productName, qty });
    }
    if (historyLog.length > MAX_HISTORY) historyLog.length = MAX_HISTORY;
    writeJSON(STORE.history, historyLog);
}

function formatTime(ts) {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderHistory() {
    const box = $("#history-content");
    const empty = $("#history-empty");
    if (!box) return;

    box.replaceChildren();
    if (!historyLog.length) {
        if (empty) empty.hidden = false;
        return;
    }
    if (empty) empty.hidden = true;

    const frag = document.createDocumentFragment();
    for (const item of historyLog) {
        const row = el("div", "history-item");
        row.append(
            el("span", "time", formatTime(item.ts)),
            el("span", "action", item.action),
            el("span", "history-product", item.product),
            el("span", "qty", `SL ${item.qty}`)
        );
        frag.appendChild(row);
    }
    box.appendChild(frag);
}

/* ---------------- giỏ hàng ---------------- */

function cartCount() {
    return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

let lastCartTotal = null;

function updateCartBadge() {
    const total = cartCount();
    const count = $("#cart-count");
    const totalCount = $("#cart-total-count");
    if (count) {
        count.textContent = total;
        // Nhảy nhẹ khi số lượng đổi, không nhảy lúc mới mở app.
        if (lastCartTotal !== null && total !== lastCartTotal) {
            count.classList.remove("bump");
            void count.offsetWidth;
            count.classList.add("bump");
            setTimeout(() => count.classList.remove("bump"), 340);
        }
    }
    if (totalCount) totalCount.textContent = `(${total})`;
    lastCartTotal = total;
}

function addProduct(name, sourceEl, event) {
    cart[name] = (cart[name] || 0) + 1;
    logHistory(cart[name] === 1 ? "thêm mới" : "tăng", name, cart[name]);
    saveCart();
    syncCard(name, true);
    updateCartBadge();
    if (sourceEl) {
        pulseBadge(sourceEl);
        popCard(sourceEl);
    }

    const point = event && typeof event.clientX === "number" && event.clientX
        ? { x: event.clientX, y: event.clientY }
        : centerOf(sourceEl);
    if (point) flyToCart(point.x, point.y);
}

function popCard(card) {
    card.classList.remove("just-added");
    void card.offsetWidth;
    card.classList.add("just-added");
    setTimeout(() => card.classList.remove("just-added"), 320);
}

function decProduct(name) {
    const qty = cart[name] || 0;
    if (qty <= 0) return;
    if (qty === 1) {
        delete cart[name];
        logHistory("xoá", name, 0);
        toast(`Đã bỏ "${name}" khỏi giỏ`, "info", 1600);
    } else {
        cart[name] = qty - 1;
        logHistory("giảm", name, cart[name]);
    }
    saveCart();
    syncCard(name);
    updateCartBadge();
}

function setQty(name, value) {
    const qty = Math.max(0, Math.floor(Number(value) || 0));
    if (qty === 0) {
        removeProduct(name);
        return;
    }
    if (cart[name] === qty) return;
    cart[name] = qty;
    logHistory("sửa số lượng", name, qty);
    saveCart();
    syncCard(name);
    renderCart();
    updateCartBadge();
}

function removeProduct(name) {
    if (!(name in cart)) return;
    delete cart[name];
    logHistory("xoá", name, 0);
    saveCart();
    syncCard(name);
    renderCart();
    updateCartBadge();
    toast(`Đã xoá "${name}"`, "info", 1600);
}

function clearAllCart() {
    if (!Object.keys(cart).length) {
        toast("Giỏ hàng đang trống", "info");
        return;
    }
    showConfirm("Bạn có chắc muốn <strong>XÓA SẠCH</strong> giỏ hàng không?", (ok) => {
        if (!ok) return;
        cart = {};
        logHistory("xoá toàn bộ", "Tất cả sản phẩm", 0);
        saveCart();
        for (const name of cardByName.keys()) syncCard(name);
        renderCart();
        updateCartBadge();
        toast("Đã xoá sạch giỏ hàng", "success");
    });
}

function renderCart() {
    const list = $("#selected-list");
    const empty = $("#cart-empty");
    if (!list) return;

    const names = Object.keys(cart);
    list.replaceChildren();
    list.hidden = names.length === 0;
    if (empty) empty.hidden = names.length > 0;

    const frag = document.createDocumentFragment();
    for (const name of names) {
        const row = el("li", "cart-row");
        row.dataset.name = name;

        const img = el("img", "thumb");
        img.alt = "";
        img.width = 46;
        img.height = 46;
        attachImage(img, name);

        const main = el("div", "row-main");
        const nameEl = el("span", "row-name", name);
        const meta = el("span", "row-meta", categoryOf.get(name) || "Khác");
        main.append(nameEl, meta);

        const stepper = el("div", "stepper");
        const decBtn = el("button", null);
        decBtn.type = "button";
        decBtn.dataset.step = "dec";
        decBtn.setAttribute("aria-label", `Giảm ${name}`);
        decBtn.appendChild(svgUse("i-minus"));
        const input = el("input");
        input.type = "number";
        input.min = "1";
        input.dataset.qty = "1";
        input.value = cart[name];
        input.setAttribute("aria-label", `Số lượng ${name}`);
        input.inputMode = "numeric";
        const incBtn = el("button", null);
        incBtn.type = "button";
        incBtn.dataset.step = "inc";
        incBtn.setAttribute("aria-label", `Tăng ${name}`);
        incBtn.appendChild(svgUse("i-plus"));
        stepper.append(decBtn, input, incBtn);

        const del = el("button", "row-del");
        del.type = "button";
        del.dataset.del = "1";
        del.setAttribute("aria-label", `Xoá ${name}`);
        del.appendChild(svgUse("i-trash"));

        row.append(img, main, stepper, del);
        frag.appendChild(row);
    }
    list.appendChild(frag);
    updateCartBadge();
}

function cartCopyText() {
    // Sắp theo đúng thứ tự danh mục để đi lấy hàng cho nhanh.
    const grouped = [];
    for (const category of categoryNames) {
        const names = catalog.filter((p) => p.category === category && cart[p.name]).map((p) => p.name);
        if (names.length) grouped.push(names);
    }
    const leftover = Object.keys(cart).filter((n) => !categoryOf.has(n));
    if (leftover.length) grouped.push(leftover);

    return grouped
        .flat()
        .map((name) => `${name} (${cart[name]})`)
        .join("\n");
}

function writeClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(
            () => true,
            () => legacyCopy(text)
        );
    }
    return Promise.resolve(legacyCopy(text));
}

// Dự phòng cho http:// qua LAN hoặc trình duyệt cũ.
function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);

    const selection = window.getSelection();
    const previous = selection && selection.rangeCount ? selection.getRangeAt(0) : null;

    area.select();
    area.setSelectionRange(0, text.length);

    let ok = false;
    try {
        ok = document.execCommand("copy");
    } catch {
        ok = false;
    }
    area.remove();
    if (previous && selection) {
        selection.removeAllRanges();
        selection.addRange(previous);
    }
    return ok;
}

function copyList() {
    const text = cartCopyText();
    if (!text) {
        toast("Giỏ hàng đang trống", "info");
        return;
    }
    writeClipboard(text).then((ok) => {
        if (ok) {
            const count = Object.keys(cart).length;
            toast(`Đã sao chép ${count} món`, "success");
        } else {
            toast("Không sao chép được — bôi đen rồi Ctrl+C", "error", 3200);
        }
    });
}

/* ---------------- sản phẩm ---------------- */

function syncCard(name, pulse = false) {
    const card = cardByName.get(name);
    if (!card) return;
    const qty = cart[name] || 0;
    card.classList.toggle("selected", qty > 0);

    const badge = $(".qty-badge", card);
    if (badge) {
        badge.hidden = qty <= 0;
        if (qty > 0) badge.textContent = qty;
    }
    const minus = $(".card-minus", card);
    if (minus) minus.hidden = qty <= 0;

    if (pulse) pulseBadge(card);
}

function pulseBadge(card) {
    const badge = $(".qty-badge", card);
    if (!badge || badge.hidden) return;
    badge.classList.remove("pulse");
    void badge.offsetWidth;
    badge.classList.add("pulse");
}

function buildCard(name, index) {
    const card = el("article", "product");
    card.dataset.name = name;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Thêm ${name} vào giỏ`);
    card.tabIndex = 0;
    // Chỉ 12 thẻ đầu so le, phần còn lại vào cùng lúc cho khỏi nặng.
    if (index < 12) card.style.setProperty("--i", index);

    const wrap = el("div", "thumb-wrap");

    const img = el("img", "product-img");
    img.alt = "";
    img.width = 100;
    img.height = 100;
    attachImage(img, name);

    const badge = el("span", "qty-badge");
    badge.hidden = true;

    const minus = el("button", "card-minus");
    minus.type = "button";
    minus.hidden = true;
    minus.dataset.act = "dec";
    minus.setAttribute("aria-label", `Bớt ${name}`);
    minus.appendChild(svgUse("i-minus"));

    wrap.append(img, badge, minus);

    const label = el("span", "product-name", name);
    card.append(wrap, label);

    cardByName.set(name, card);
    syncCard(name);
    return card;
}

// Câu trong trạng thái rỗng: nói rõ đang lọc cái gì.
function updateEmptyText() {
    const text = $("#empty-text");
    if (!text) return;
    const q = searchQuery.trim();
    if (q) {
        text.textContent = `Không có món nào khớp “${q}”`;
    } else if (currentCategory !== "Tất cả") {
        text.textContent = `Mục “${currentCategory}” chưa có món nào`;
    } else {
        text.textContent = "Không tìm thấy sản phẩm nào";
    }
}

// Dòng đếm kết quả ngay dưới ô tìm kiếm.
function updateListMeta(shown) {
    const meta = $("#list-meta");
    if (!meta) return;

    // Không có kết quả thì để trạng thái rỗng nói, khỏi nói hai lần.
    if (shown === 0) {
        meta.replaceChildren();
        return;
    }

    const frag = document.createDocumentFragment();
    const strong = el("b", null, String(shown));

    if (searchQuery.trim()) {
        frag.append("Tìm thấy ", strong, " kết quả cho “", searchQuery.trim(), "”");
    } else if (currentCategory !== "Tất cả") {
        frag.append(strong, " sản phẩm · ", currentCategory);
    } else {
        frag.append(strong, " sản phẩm");
    }

    meta.replaceChildren(frag);
}

function renderProducts({ intro = false } = {}) {
    const container = $("#product-container");
    const emptyState = $("#empty-state");
    if (!container) return;

    cardByName.clear();
    const frag = document.createDocumentFragment();
    let shown = 0;
    let index = 0;

    for (const item of catalog) {
        if (currentCategory !== "Tất cả" && item.category !== currentCategory) continue;
        if (!matchesSearch(item.name, searchQuery)) continue;
        frag.appendChild(buildCard(item.name, index));
        shown++;
        index++;
    }

    container.classList.toggle("intro", intro);
    container.replaceChildren(frag);
    container.hidden = shown === 0;
    if (emptyState) emptyState.hidden = shown !== 0;
    if (shown === 0) updateEmptyText();
    container.scrollTop = 0;
    updateCartBadge();
    updateListMeta(shown);

    if (intro) {
        // Gỡ sau khi chạy xong để lần lọc sau không diễn lại.
        setTimeout(() => container.classList.remove("intro"), 900);
    }
    updateScrollUi();
}

function renderCategories() {
    const list = $("#categories");
    if (!list) return;

    list.replaceChildren();

    const counts = new Map();
    for (const item of catalog) counts.set(item.category, (counts.get(item.category) || 0) + 1);

    const makeItem = (label, value, count, index) => {
        const li = el("li");
        li.dataset.category = value;
        if (currentCategory === value) li.classList.add("active");
        if (index < 9) li.style.setProperty("--i", index);
        li.append(el("span", "cat-name", label), el("span", "cat-count", String(count)));
        li.addEventListener("click", () => {
            currentCategory = value;
            renderCategories();
            renderProducts();
            closeSidebar();
        });
        return li;
    };

    list.appendChild(makeItem("Tất cả", "Tất cả", catalog.length, 0));
    categoryNames.forEach((category, i) => {
        list.appendChild(makeItem(category, category, counts.get(category) || 0, i + 1));
    });
}

/* ---------------- kiểm hàng / thùng rác ---------------- */

function updateNoteBadges() {
    const noteCount = $("#note-count");
    const noteTotal = $("#note-total-count");
    const trashCount = $("#trash-count");
    const trashTotal = $("#trash-total-count");

    if (noteCount) {
        noteCount.hidden = checkingList.length === 0;
        noteCount.textContent = checkingList.length;
    }
    if (noteTotal) noteTotal.textContent = `(${checkingList.length})`;
    if (trashCount) trashCount.textContent = trashList.length;
    if (trashTotal) trashTotal.textContent = `(${trashList.length})`;

    const noteEmpty = $("#note-empty");
    if (noteEmpty) noteEmpty.hidden = checkingList.length > 0;
    const trashEmpty = $("#trash-empty");
    if (trashEmpty) trashEmpty.hidden = trashList.length > 0;
}

function checkRow(item, mode) {
    const row = el("div", "check-item" + (mode === "trash" ? " trash" : ""));
    row.dataset.id = item.id;

    const img = el("img", "thumb");
    img.alt = "";
    img.width = 46;
    img.height = 46;
    attachImage(img, item.text.replace(/\s*\(.*?\)\s*$/, "").trim());

    const name = el("span", "row-name", item.text);

    const actions = el("div", "check-actions");
    if (mode === "trash") {
        const restore = el("button", "mini-btn restore");
        restore.type = "button";
        restore.dataset.restore = item.id;
        restore.append(svgUse("i-undo"), el("span", null, "Khôi phục"));
        actions.appendChild(restore);
    } else {
        const done = el("button", "mini-btn done");
        done.type = "button";
        done.dataset.done = item.id;
        done.append(svgUse("i-check"), el("span", null, "Xong"));
        actions.appendChild(done);
    }

    row.append(img, name, actions);
    return row;
}

function renderChecking() {
    const box = $("#note-items-container");
    if (!box) return;
    box.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const item of checkingList) frag.appendChild(checkRow(item, "check"));
    box.appendChild(frag);
    updateNoteBadges();
}

function renderTrash() {
    const box = $("#trash-items-container");
    if (!box) return;
    box.replaceChildren();
    const frag = document.createDocumentFragment();
    for (const item of trashList) frag.appendChild(checkRow(item, "trash"));
    box.appendChild(frag);
    updateNoteBadges();
}

function importNote() {
    const input = $("#note-input");
    if (!input) return;
    const lines = input.value.split(/\r?\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!lines.length) {
        toast("Chưa có gì để nhập", "info");
        return;
    }

    const existing = new Set(checkingList.map((i) => i.text.toLowerCase()));
    let added = 0;
    let skipped = 0;

    for (const line of lines) {
        if (existing.has(line.toLowerCase())) {
            skipped++;
            continue;
        }
        existing.add(line.toLowerCase());
        checkingList.push({ id: uid(), text: line });
        added++;
    }

    input.value = "";
    saveLists();
    renderChecking();

    if (added) toast(`Đã nhập ${added} món${skipped ? `, bỏ qua ${skipped} món trùng` : ""}`, "success");
    else toast("Các món này đã có trong danh sách", "info");
}

function checkDone(id) {
    const index = checkingList.findIndex((i) => i.id === id);
    if (index < 0) return;

    const [item] = checkingList.splice(index, 1);
    trashList.unshift(item);
    saveLists();

    const node = $(`#note-items-container [data-id="${id}"]`);
    if (node) {
        node.classList.add("leaving");
        setTimeout(() => {
            node.remove();
            updateNoteBadges();
        }, 240);
    }
    updateNoteBadges();
}

function restoreItem(id) {
    const index = trashList.findIndex((i) => i.id === id);
    if (index < 0) return;

    const [item] = trashList.splice(index, 1);
    checkingList.push(item);
    saveLists();
    renderChecking();
    renderTrash();
    toast(`Đã khôi phục "${item.text}"`, "success");
}

function clearAllNote() {
    if (!checkingList.length) {
        toast("Danh sách đang trống", "info");
        return;
    }
    showConfirm("Bạn có chắc muốn <strong>XÓA SẠCH</strong> danh sách kiểm hàng?", (ok) => {
        if (!ok) return;
        checkingList = [];
        saveLists();
        renderChecking();
        toast("Đã xoá sạch danh sách", "success");
    });
}

function clearAllTrash() {
    if (!trashList.length) {
        toast("Thùng rác đang trống", "info");
        return;
    }
    showConfirm("Bạn có chắc muốn <strong>DỌN SẠCH</strong> thùng rác?", (ok) => {
        if (!ok) return;
        trashList = [];
        saveLists();
        renderTrash();
        toast("Đã dọn sạch thùng rác", "success");
    });
}

/* ---------------- hiệu ứng ---------------- */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

function centerOf(node) {
    if (!node || !node.getBoundingClientRect) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Gợn sóng nhỏ tại điểm chạm. Một phần tử, xoá ngay khi chạy xong.
function spawnRipple(host, clientX, clientY) {
    if (reduceMotion.matches || !host) return;

    const rect = host.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.1;
    const dot = el("span", "ripple");
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${clientX - rect.left - size / 2}px`;
    dot.style.top = `${clientY - rect.top - size / 2}px`;
    host.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
}

// Thẻ sản phẩm: vệt sáng theo ngón tay + gợn sóng.
function bindCardFeedback() {
    const container = $("#product-container");
    if (!container) return;

    container.addEventListener(
        "pointerdown",
        (event) => {
            const card = event.target.closest(".product");
            if (!card) return;
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
            card.style.setProperty("--my", `${event.clientY - rect.top}px`);
            card.classList.add("touching");
        },
        { passive: true }
    );

    const release = () => {
        for (const card of container.querySelectorAll(".product.touching")) {
            card.classList.remove("touching");
        }
    };
    container.addEventListener("pointerup", release, { passive: true });
    container.addEventListener("pointercancel", release, { passive: true });
    container.addEventListener("pointerleave", release, { passive: true });

    // Máy có chuột thì vệt sáng chạy theo con trỏ.
    if (finePointer.matches) {
        let lastCard = null;
        container.addEventListener("pointermove", (event) => {
            const card = event.target.closest(".product");
            if (!card) return;
            if (card !== lastCard) {
                if (lastCard) lastCard.classList.remove("touching");
                lastCard = card;
            }
            const rect = card.getBoundingClientRect();
            card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
            card.style.setProperty("--my", `${event.clientY - rect.top}px`);
            card.classList.add("touching");
        });
        container.addEventListener("pointerleave", () => {
            if (lastCard) lastCard.classList.remove("touching");
            lastCard = null;
        });
    }
}

// Gợn sóng cho nút bấm.
function bindButtonFeedback() {
    const selector = ".btn, .icon-btn, .mini-btn, .row-del, .card-minus, .stepper button, .sidebar-link";
    document.addEventListener(
        "pointerdown",
        (event) => {
            const host = event.target.closest(selector);
            if (!host || host.disabled) return;
            spawnRipple(host, event.clientX, event.clientY);
        },
        { passive: true }
    );
}

let scrollRaf = 0;

function updateScrollUi() {
    const container = $("#product-container");
    const bar = $("#top-bar");
    const fab = $("#scroll-top");
    if (!container) return;
    const y = container.scrollTop;
    if (bar) bar.classList.toggle("scrolled", y > 6);
    if (fab) fab.classList.toggle("show", y > 700);
}

function bindScrollUi() {
    const container = $("#product-container");
    if (!container) return;
    container.addEventListener(
        "scroll",
        () => {
            if (scrollRaf) return;
            scrollRaf = requestAnimationFrame(() => {
                scrollRaf = 0;
                updateScrollUi();
            });
        },
        { passive: true }
    );

    $("#scroll-top")?.addEventListener("click", () => {
        container.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
    });
}

function flyToCart(x, y) {
    if (reduceMotion.matches) return;
    const cartIcon = $("#cart-icon");
    if (!cartIcon || !document.body) return;

    const dot = el("div", "flying-item");
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    document.body.appendChild(dot);

    const target = cartIcon.getBoundingClientRect();
    const toX = target.left + target.width / 2;
    const toY = target.top + target.height / 2;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            dot.style.left = `${toX}px`;
            dot.style.top = `${toY}px`;
            dot.style.transform = "scale(0.2)";
            dot.style.opacity = "0";
        });
    });

    setTimeout(() => {
        dot.remove();
        cartIcon.classList.remove("shake");
        void cartIcon.offsetWidth;
        cartIcon.classList.add("shake");
        setTimeout(() => cartIcon.classList.remove("shake"), 450);
    }, 620);
}

/* ---------------- đồng hồ ---------------- */

const DAY_NAMES = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function updateClock() {
    const box = $("#current-time");
    if (!box) return;
    const now = new Date();
    const day = DAY_NAMES[now.getDay()];
    const date = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const time = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    box.textContent = `${day}, ${date}/${month} • ${time}`;
}

/* ---------------- PWA ---------------- */

function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (!location.protocol.startsWith("http")) return;

    navigator.serviceWorker
        .register("sw.js")
        .then((registration) => {
            registration.addEventListener("updatefound", () => {
                const worker = registration.installing;
                if (!worker) return;
                worker.addEventListener("statechange", () => {
                    if (worker.state === "installed" && navigator.serviceWorker.controller) {
                        toast(
                            "Đã có bản mới — bấm để tải lại",
                            "info",
                            12000,
                            () => {
                                worker.postMessage({ type: "SKIP_WAITING" });
                                window.location.reload();
                            }
                        );
                    }
                });
            });
        })
        .catch((err) => console.warn("Service worker không đăng ký được:", err));
}

async function forceUpdate() {
    showConfirm("Tải lại giao diện và mã nguồn mới nhất từ máy chủ?", async (ok) => {
        if (!ok) return;
        toast("Đang tải bản mới…", "info", 1400);

        try {
            if ("serviceWorker" in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map((r) => r.unregister()));
            }
        } catch {
            /* không có SW cũng không sao */
        }

        try {
            if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
            }
        } catch {
            /* bỏ qua */
        }

        setTimeout(() => {
            const base = location.origin + location.pathname;
            window.location.replace(`${base}?v=${Date.now()}`);
        }, 450);
    });
}

/* ---------------- sự kiện ---------------- */

function bindEvents() {
    const container = $("#product-container");
    container?.addEventListener("click", (event) => {
        const card = event.target.closest(".product");
        if (!card) return;
        const name = card.dataset.name;
        if (!name) return;
        if (event.target.closest("[data-act='dec']")) {
            event.stopPropagation();
            decProduct(name);
        } else {
            addProduct(name, card, event);
        }
    });

    container?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const card = event.target.closest(".product");
        if (!card) return;
        event.preventDefault();
        addProduct(card.dataset.name, card, null);
    });

    $("#menu-btn")?.addEventListener("click", openSidebar);
    $("#scrim")?.addEventListener("click", closeSidebar);
    $$("[data-close-sidebar]").forEach((btn) => btn.addEventListener("click", closeSidebar));

    const search = $("#search-box");
    const searchClear = $("#search-clear");
    const runSearch = debounce(() => {
        searchQuery = search.value;
        renderProducts();
    }, 90);

    search?.addEventListener("input", () => {
        if (searchClear) searchClear.hidden = search.value.length === 0;
        runSearch();
    });

    searchClear?.addEventListener("click", () => {
        search.value = "";
        searchClear.hidden = true;
        searchQuery = "";
        renderProducts();
        search.focus();
    });

    $("#empty-reset")?.addEventListener("click", () => {
        if (search) search.value = "";
        if (searchClear) searchClear.hidden = true;
        searchQuery = "";
        currentCategory = "Tất cả";
        renderCategories();
        renderProducts();
    });

    $("#cart-icon")?.addEventListener("click", () => openOverlay("cart-overlay", renderCart));
    $("#note-icon")?.addEventListener("click", () => openOverlay("note-overlay", renderChecking));
    $("#history-btn")?.addEventListener("click", () => {
        closeSidebar();
        openOverlay("history-overlay", renderHistory);
    });
    $("#update-btn")?.addEventListener("click", () => {
        closeSidebar();
        forceUpdate();
    });

    $("#clear-all-btn")?.addEventListener("click", clearAllCart);
    $("#copyBtn")?.addEventListener("click", copyList);
    $("#clear-all-note")?.addEventListener("click", clearAllNote);
    $("#clear-all-trash")?.addEventListener("click", clearAllTrash);
    $("#clear-history")?.addEventListener("click", () => {
        if (!historyLog.length) {
            toast("Lịch sử đang trống", "info");
            return;
        }
        showConfirm("Bạn có chắc muốn <strong>XÓA SẠCH</strong> toàn bộ lịch sử?", (ok) => {
            if (!ok) return;
            historyLog = [];
            writeJSON(STORE.history, historyLog);
            renderHistory();
            toast("Đã xoá sạch lịch sử", "success");
        });
    });

    $("#trash-btn")?.addEventListener("click", () => openOverlay("trash-overlay", renderTrash));
    $("#import-note")?.addEventListener("click", importNote);

    $("#note-input")?.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            importNote();
        }
    });

    $("#selected-list")?.addEventListener("click", (event) => {
        const row = event.target.closest(".cart-row");
        if (!row) return;
        const name = row.dataset.name;

        if (event.target.closest("[data-step='inc']")) return changeQtyBy(name, 1);
        if (event.target.closest("[data-step='dec']")) return changeQtyBy(name, -1);
        if (event.target.closest("[data-del]")) return removeProduct(name);
        if (event.target.closest(".thumb") || event.target.closest(".row-name")) {
            openZoom(imagePath(name), name);
        }
    });

    $("#selected-list")?.addEventListener("change", (event) => {
        const input = event.target.closest("input[data-qty]");
        if (!input) return;
        const row = input.closest(".cart-row");
        if (!row) return;
        setQty(row.dataset.name, input.value);
    });

    $("#selected-list")?.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target.matches("input[data-qty]")) {
            event.preventDefault();
            event.target.blur();
        }
    });

    $("#note-items-container")?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-done]");
        if (btn) checkDone(btn.dataset.done);
    });

    $("#trash-items-container")?.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-restore]");
        if (btn) restoreItem(btn.dataset.restore);
    });

    $("#confirm-yes")?.addEventListener("click", () => answerConfirm(true));
    $("#confirm-no")?.addEventListener("click", () => answerConfirm(false));
    $("#confirm-overlay")?.addEventListener("click", (event) => {
        if (event.target.id === "confirm-overlay") answerConfirm(false);
    });

    $("#image-zoom-overlay")?.addEventListener("click", closeZoom);

    $("#toast")?.addEventListener("click", () => {
        if (toastClick) {
            const fn = toastClick;
            toastClick = null;
            fn();
        }
    });

    $$("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const overlay = btn.closest(".overlay");
            if (overlay) closeOverlay(overlay.id);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeTopLayer();
    });

    // Đồng bộ khi mở nhiều tab
    window.addEventListener("storage", (event) => {
        if (event.key === STORE.cart) {
            cart = readJSON(STORE.cart, {});
            renderCart();
            for (const name of cardByName.keys()) syncCard(name);
            updateCartBadge();
        }
        if (event.key === STORE.checking || event.key === STORE.trash) {
            checkingList = migrateItems(readJSON(STORE.checking, []));
            trashList = migrateItems(readJSON(STORE.trash, []));
            renderChecking();
            renderTrash();
        }
    });
}

function changeQtyBy(name, delta) {
    const qty = (cart[name] || 0) + delta;
    if (qty <= 0) {
        removeProduct(name);
        return;
    }
    cart[name] = qty;
    logHistory(delta > 0 ? "tăng" : "giảm", name, qty);
    saveCart();
    syncCard(name);
    renderCart();
    updateCartBadge();
}

/* ---------------- khởi động ---------------- */

function init() {
    buildCatalog();
    renderCategories();
    renderProducts({ intro: true });
    renderCart();
    renderHistory();
    renderChecking();
    renderTrash();
    updateCartBadge();
    updateNoteBadges();
    bindEvents();

    bindCardFeedback();
    bindButtonFeedback();
    bindScrollUi();
    $$(".overlay").forEach(enableSwipeToClose);

    updateClock();
    setInterval(updateClock, 15000);

    registerServiceWorker();

    if (!catalog.length) {
        toast("Chưa nạp được danh sách sản phẩm", "error", 4000);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
