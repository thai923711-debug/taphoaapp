import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

// Generates the PWA icons (192 + 512) with no external deps.
// Run: node tools/make-icons.mjs
const OUT_DIR = path.join(import.meta.dirname, "..", "icons");

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Signed distance to a rounded rectangle (negative = inside).
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const dx = Math.abs(px - cx) - (w / 2 - r);
  const dy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}

function drawIcon(size) {
  const S = size / 512; // design grid is 512
  const px = Buffer.alloc(size * size * 4);
  const aa = 1.6 / S; // antialias band in design units

  const paint = (x, y, r, g, b, a) => {
    if (a <= 0) return;
    const i = (y * size + x) * 4;
    const dstA = px[i + 3] / 255;
    const outA = a + dstA * (1 - a);
    if (outA <= 0) return;
    px[i] = Math.round((r * a + px[i] * dstA * (1 - a)) / outA);
    px[i + 1] = Math.round((g * a + px[i + 1] * dstA * (1 - a)) / outA);
    px[i + 2] = Math.round((b * a + px[i + 2] * dstA * (1 - a)) / outA);
    px[i + 3] = Math.round(outA * 255);
  };

  // Bag geometry (design units, 512 grid), kept inside the maskable safe zone.
  // Two straight straps read as a paper bag; a full ring reads as a padlock.
  const bag = { x: 146, y: 214, w: 220, h: 186, r: 34 };
  const straps = [
    { x: 198, y: 150, w: 30, h: 92, r: 15 },
    { x: 284, y: 150, w: 30, h: 92, r: 15 },
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / S;
      const dy = (y + 0.5) / S;

      // Background: diagonal orange gradient, full bleed for maskable icons.
      const t = clamp01((dx / 512) * 0.45 + (dy / 512) * 0.55);
      paint(x, y, lerp(255, 226, t), lerp(186, 96, t), lerp(72, 8, t), 1);

      // Soft top-left highlight.
      const glow = Math.hypot(dx - 120, dy - 90) / 300;
      if (glow < 1) paint(x, y, 255, 235, 200, 0.18 * (1 - glow) ** 2);

      // Bag straps (drawn before the body so the body hides their feet).
      for (const s of straps) {
        const d = sdRoundRect(dx, dy, s.x, s.y, s.w, s.h, s.r);
        if (d < aa) paint(x, y, 255, 255, 255, clamp01(-d / aa));
      }

      // Bag body.
      const d = sdRoundRect(dx, dy, bag.x, bag.y, bag.w, bag.h, bag.r);
      if (d < aa) paint(x, y, 255, 255, 255, clamp01(-d / aa));

      // Fold line across the body keeps it from reading as a plain box.
      const fold = sdRoundRect(dx, dy, bag.x + 26, bag.y + 34, bag.w - 52, 12, 6);
      if (fold < aa) paint(x, y, 226, 96, 8, clamp01(-fold / aa) * 0.85);
    }
  }
  return encodePng(size, size, px);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, drawIcon(size));
  console.log(`wrote ${file}`);
}
