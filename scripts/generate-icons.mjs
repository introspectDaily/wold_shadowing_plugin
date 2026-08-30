// Generates extension icons (16/32/48/128) as PNGs without any dependency.
// Draws a rounded indigo tile with white audio-wave bars.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icon');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function renderIcon(size) {
  const px = new Float64Array(size * size * 4);
  const set = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
    px[i + 3] = a;
  };
  const mix = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    const da = a / 255;
    px[i] = px[i] * (1 - da) + r * da;
    px[i + 1] = px[i + 1] * (1 - da) + g * da;
    px[i + 2] = px[i + 2] * (1 - da) + b * da;
    px[i + 3] = Math.min(255, px[i + 3] + a);
  };
  const s = size;
  const rr = s * 0.22; // corner radius
  // Rounded-square background
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const cx = Math.min(Math.max(x, rr), s - rr);
      const cy = Math.min(Math.max(y, rr), s - rr);
      const d = Math.hypot(x - cx, y - cy);
      const edge = rr;
      const alpha = d <= edge ? 1 : Math.max(0, 1 - (d - edge) * 2);
      // Indigo gradient (#4f46e5 -> #6366f1)
      const t = (x + y) / (2 * s);
      const r = 0x4f + (0x63 - 0x4f) * t;
      const g = 0x46 + (0x66 - 0x46) * t;
      const b = 0xe5 + (0xf1 - 0xe5) * t;
      set(x, y, r, g, b, alpha * 255);
    }
  }
  // Audio-wave bars (white)
  const barColor = [255, 255, 255];
  const barW = Math.max(1, Math.round(s * 0.09));
  const gap = Math.max(1, Math.round(s * 0.08));
  const bars = 5;
  const heights = [0.32, 0.6, 0.42, 0.72, 0.3];
  const totalW = bars * barW + (bars - 1) * gap;
  const startX = (s - totalW) / 2;
  const centerY = s / 2;
  for (let b = 0; b < bars; b++) {
    const h = Math.round(s * heights[b]);
    const x0 = Math.round(startX + b * (barW + gap));
    const y0 = Math.round(centerY - h / 2);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + barW; x++) {
        mix(x, y, barColor[0], barColor[1], barColor[2], 255);
      }
    }
  }
  // Round corners a bit more for anti-aliasing
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = px[i * 4];
    rgba[i * 4 + 1] = px[i * 4 + 1];
    rgba[i * 4 + 2] = px[i * 4 + 2];
    rgba[i * 4 + 3] = px[i * 4 + 3];
  }
  return encodePng(size, size, rgba);
}

for (const size of [16, 32, 48, 128]) {
  const file = join(outDir, `${size}.png`);
  writeFileSync(file, renderIcon(size));
  console.log('wrote', file);
}
