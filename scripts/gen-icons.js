// Generates the PWA/home-screen icons as real PNGs with no image dependencies.
// A minimal PNG is: signature + IHDR + IDAT(zlib-deflated scanlines) + IEND.
// Run: node scripts/gen-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const NAVY = [31, 46, 173];   // #1F2EAD — the brand primary
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  // Raw RGB scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A simple building mark: white tower on navy, with punched-out windows and a door.
// Drawn in normalised units so it scales to any icon size.
function drawIcon(maskable) {
  // "maskable" icons must keep art inside a safe circle, so shrink the glyph.
  const scale = maskable ? 0.62 : 0.78;
  return (x, y, size) => {
    const u = (v) => v * size;               // normalised -> px
    const cx = size / 2;
    const w = u(0.46) * scale, h = u(0.56) * scale;
    const left = cx - w / 2, right = cx + w / 2;
    const top = size / 2 - h / 2, bottom = size / 2 + h / 2;

    const inBody = x >= left && x < right && y >= top && y < bottom;
    if (!inBody) return NAVY;

    // Door: centred notch at the base.
    const dw = w * 0.22, dh = h * 0.26;
    if (x >= cx - dw / 2 && x < cx + dw / 2 && y >= bottom - dh) return NAVY;

    // Window grid: 3 columns x 3 rows in the upper portion.
    const cols = 3, rows = 3;
    const padX = w * 0.14, padY = h * 0.12;
    const gridW = w - padX * 2, gridH = h * 0.62 - padY;
    const cellW = gridW / cols, cellH = gridH / rows;
    const gx = x - (left + padX), gy = y - (top + padY);
    if (gx >= 0 && gy >= 0 && gx < gridW && gy < gridH) {
      const ix = gx % cellW, iy = gy % cellH;
      if (ix < cellW * 0.58 && iy < cellH * 0.58) return NAVY;
    }
    return WHITE;
  };
}

const outDir = path.join(__dirname, "..", "public");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, false], // iOS home screen
  ["favicon-32.png", 32, false],
];

for (const [name, size, maskable] of targets) {
  fs.writeFileSync(path.join(outDir, name), png(size, drawIcon(maskable)));
  console.log("wrote", name, `${size}x${size}`);
}
