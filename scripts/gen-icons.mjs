// 生成 PWA 图标：零依赖 PNG 编码 + Canvas 风格的像素绘制
// 用法：node scripts/gen-icons.mjs  → 输出到 public/icons/
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../public/icons');

// ---------- 最小 PNG 编码器 ----------
const CRC_TABLE = (() => {
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
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
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

/** rgb: Uint8Array 长度 w*h*3（无透明，应用图标不需要 alpha） */
function encodePng(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: None
    rgb.copy
      ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3)
      : raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- 像素画布 ----------
function createCanvas(size) {
  const px = Buffer.alloc(size * size * 3);
  const blend = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= size || y >= size || a <= 0) return;
    const i = (y * size + x) * 3;
    px[i] = Math.round(px[i] * (1 - a) + r * a);
    px[i + 1] = Math.round(px[i + 1] * (1 - a) + g * a);
    px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a);
  };
  const fillCircle = (cx, cy, rad, color, alpha = 1) => {
    const [r, g, b] = color;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++)
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= rad - 0.5) blend(x, y, r, g, b, alpha);
        else if (d <= rad + 0.5) blend(x, y, r, g, b, alpha * (rad + 0.5 - d));
      }
  };
  const fillRoundRect = (x0, y0, w, h, rad, color, alpha = 1) => {
    const [r, g, b] = color;
    for (let y = Math.floor(y0); y < y0 + h; y++)
      for (let x = Math.floor(x0); x < x0 + w; x++) {
        const dx = Math.max(0, x0 - x, x - (x0 + w - 1));
        const dy = Math.max(0, y0 - y, y - (y0 + h - 1));
        if (dx > 0 && dy > 0) {
          // 角落外：仅弧线内填充（抗锯齿）
          const d = Math.hypot(dx, dy);
          if (d < rad) blend(x, y, r, g, b, alpha * (rad - d));
        } else if (dx === 0 && dy === 0) {
          blend(x, y, r, g, b, alpha);
        }
      }
  };
  return { px, blend, fillCircle, fillRoundRect };
}

// 主题色（与 style.css 变量一致）
const BG_TOP = [43, 36, 27]; // --panel2 #2b241b
const BG_BOT = [22, 19, 15]; // --bg #16130f
const GOLD = [232, 182, 76]; // --gold #e8b64c
const CREAM = [240, 228, 198];
const INK = [36, 28, 12];

/** 画一颗骰子：圆角底色 + 5 点；safe = 内容区占比（maskable 需留边） */
function drawDie(size, safe) {
  const c = createCanvas(size);
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = Math.round(BG_TOP[0] * (1 - t) + BG_BOT[0] * t);
    const g = Math.round(BG_TOP[1] * (1 - t) + BG_BOT[1] * t);
    const b = Math.round(BG_TOP[2] * (1 - t) + BG_BOT[2] * t);
    for (let x = 0; x < size; x++) c.blend(x, y, r, g, b, 1);
  }
  const area = size * safe;
  const off = (size - area) / 2;
  const rad = area * 0.18;
  c.fillRoundRect(off, off, area, area, rad, GOLD);
  // 骰面内阴影（顶部内侧一条暗边，增加立体感）
  c.fillRoundRect(off + area * 0.04, off + area * 0.04, area * 0.92, area * 0.1, rad * 0.6, INK, 0.25);
  const pipR = area * 0.085;
  const lo = off + area * 0.27;
  const hi = off + area * 0.73;
  const mid = off + area * 0.5;
  const pip = (x, y) => {
    c.fillCircle(x + pipR * 0.18, y + pipR * 0.22, pipR, INK, 0.35); // 投影
    c.fillCircle(x, y, pipR, CREAM);
  };
  pip(lo, lo);
  pip(hi, lo);
  pip(mid, mid);
  pip(lo, hi);
  pip(hi, hi);
  return c.px;
}

mkdirSync(OUT, { recursive: true });
for (const [name, size, safe] of [
  ['icon-192.png', 192, 0.82],
  ['icon-512.png', 512, 0.82],
  ['icon-maskable-512.png', 512, 0.62], // 安全区内缩，供 Android 圆形/方形裁切
  ['apple-touch-icon.png', 180, 0.82],
]) {
  writeFileSync(join(OUT, name), encodePng(size, size, drawDie(size, safe)));
  console.log('written', name);
}
