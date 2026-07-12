import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Renders the L-beat mark (white L + green pulse on a black tile) to PNG at
 * the PWA sizes — a dependency-free rasterizer so icons regenerate from code,
 * not from a binary blob. Run: node scripts/generate-icons.mjs
 */

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public');

// Stroke polylines in the 24×24 viewBox of the app logo (see index.html).
const L_PATH = [
  [7, 4],
  [7, 17],
  [10, 17],
];
const PULSE_PATH = [
  [10, 17],
  [13, 11],
  [15, 21],
  [17, 17],
  [20, 17],
];
const STROKE = 2;

function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function pathDistance(px, py, path) {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i += 1) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];
    min = Math.min(min, segmentDistance(px, py, x1, y1, x2, y2));
  }
  return min;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon(size, cornerFrac) {
  const s = size / 24;
  const half = (STROKE * s) / 2;
  const radius = size * cornerFrac;
  const pixels = Buffer.alloc(size * size * 4);
  // 2×2 supersampling for smooth edges.
  const SS = 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          // Rounded-corner tile test.
          const cx = Math.max(radius - px, px - (size - radius), 0);
          const cy = Math.max(radius - py, py - (size - radius), 0);
          const inTile = Math.hypot(cx, cy) <= radius;
          if (!inTile) continue;
          let cr = 0;
          let cg = 0;
          let cb = 0;
          if (pathDistance(px / s, py / s, PULSE_PATH) * s <= half) {
            cr = 0x00;
            cg = 0xff;
            cb = 0x88;
          } else if (pathDistance(px / s, py / s, L_PATH) * s <= half) {
            cr = cg = cb = 0xff;
          }
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }
      const n = SS * SS;
      const o = (y * size + x) * 4;
      pixels[o] = Math.round(r / n);
      pixels[o + 1] = Math.round(g / n);
      pixels[o + 2] = Math.round(b / n);
      pixels[o + 3] = Math.round(a / n);
    }
  }
  return encodePng(size, pixels);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), renderIcon(192, 0.2));
writeFileSync(join(outDir, 'icon-512.png'), renderIcon(512, 0.2));
// iOS applies its own mask — full-bleed square.
writeFileSync(join(outDir, 'apple-touch-icon.png'), renderIcon(180, 0));
console.log('icons written to', outDir);
