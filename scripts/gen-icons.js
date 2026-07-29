// Generates the PWA/home-screen icons as real PNGs with no image dependencies.
// A minimal PNG is: signature + IHDR + IDAT(zlib-deflated scanlines) + IEND.
// Run: node scripts/gen-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const NAVY = [13, 27, 51];    // #0D1B33 — brand navy
const GOLD = [200, 161, 90];  // #C8A15A brand gold
const SAND = [242, 240, 235]; // #F2F0EB
const WHITE = [242, 240, 235]; // #F2F0EB sand, so the mark reads warm not stark

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

// The Fleming mark from the brand guide: a gold square frame enclosing an "F",
// on navy. Drawn in normalised units so it scales to any icon size.
function drawIcon(maskable) {
  // Maskable icons get cropped to a circle by Android, so inset the art.
  const s = maskable ? 0.72 : 1;
  return (x, y, size) => {
    // Work in 0..1 space relative to the centre so `s` scales everything.
    const n = (v) => 0.5 + (v - 0.5) * s;
    const px = x / size, py = y / size;
    const inRect = (x0, y0, x1, y1) =>
      px >= n(x0) && px < n(x1) && py >= n(y0) && py < n(y1);

    // Gold square frame — four bars rather than a stroked path.
    const f0 = 0.235, f1 = 0.765, t = 0.026 * s;
    const onFrame =
      (inRect(f0, f0, f1, f0 + t / s)) ||          // top
      (inRect(f0, f1 - t / s, f1, f1)) ||          // bottom
      (inRect(f0, f0, f0 + t / s, f1)) ||          // left
      (inRect(f1 - t / s, f0, f1, f1));            // right
    if (onFrame) return GOLD;

    // The "F": vertical stem, full top arm, shorter middle arm.
    const stem = inRect(0.395, 0.345, 0.443, 0.655);
    const top = inRect(0.395, 0.345, 0.617, 0.393);
    const mid = inRect(0.395, 0.475, 0.578, 0.521);
    if (stem || top || mid) return SAND;

    return NAVY;
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
