'use strict';
// Generates PNG app icons + iPhone splash screens (no dependencies).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = { green: hex('#0F5132'), cream: hex('#FFF8ED'), gold: hex('#F4B942'), red: hex('#C0392B'), leaf: hex('#2e8b57'), crust: hex('#E9B66B') };

const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(w, h, px) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) { const [r, g, b] = px(x, y); const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const cover = (d, r) => Math.max(0, Math.min(1, r - d + 0.5)); // 1px anti-alias

/** Pizza drawn in a unit square, scale = pizza radius as fraction of min side. */
function pizza(cx, cy, R, bg) {
  const toppings = [[-.38, -.2, .16, C.red], [.3, -.34, .16, C.red], [.1, .36, .16, C.red], [-.3, .38, .13, C.red], [.46, .12, .13, C.red], [-.05, -.02, .12, C.red], [.0, -.5, .08, C.leaf], [-.52, .05, .08, C.leaf], [.2, .1, .08, C.leaf]];
  return (x, y) => {
    let col = bg;
    const d = Math.hypot(x - cx, y - cy);
    col = mix(col, C.crust, cover(d, R));
    col = mix(col, C.cream, cover(d, R * 0.86));
    col = mix(col, C.gold, cover(d, R * 0.80) * 0.55);
    for (const [tx, ty, tr, tc] of toppings) col = mix(col, tc, cover(Math.hypot(x - (cx + tx * R), y - (cy + ty * R)), tr * R));
    return col;
  };
}
const icon = (size, scale, bg = C.green) => png(size, size, pizza(size / 2, size / 2, size * scale, bg));
fs.writeFileSync(path.join(OUT, 'icon-192.png'), icon(192, 0.36));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), icon(512, 0.36));
fs.writeFileSync(path.join(OUT, 'icon-maskable-512.png'), icon(512, 0.27));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), icon(180, 0.34));
for (const [w, h] of [[1170, 2532], [1179, 2556], [1290, 2796]]) {
  fs.writeFileSync(path.join(OUT, `splash-${w}x${h}.png`), png(w, h, pizza(w / 2, h / 2 - h * 0.03, w * 0.22, C.green)));
}
fs.writeFileSync(path.join(OUT, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0F5132"/><circle cx="50" cy="50" r="36" fill="#E9B66B"/><circle cx="50" cy="50" r="31" fill="#FFF8ED"/><circle cx="50" cy="50" r="28" fill="#F4B942" opacity=".5"/><g fill="#C0392B"><circle cx="36" cy="40" r="6"/><circle cx="62" cy="36" r="6"/><circle cx="55" cy="63" r="6"/><circle cx="38" cy="62" r="5"/></g><g fill="#2e8b57"><circle cx="50" cy="28" r="3"/><circle cx="27" cy="52" r="3"/><circle cx="68" cy="52" r="3"/></g></svg>`);
console.log('icons written to', OUT);
