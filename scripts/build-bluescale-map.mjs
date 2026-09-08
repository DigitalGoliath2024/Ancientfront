/**
 * Converts a black-ocean bluescale PNG into map-generator image.png:
 * dark pixels → water (blue 106), lighter pixels → plains.
 *
 * usage: node scripts/build-bluescale-map.mjs <src.png> <out-folder> [scale]
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WATER_BLUE = 106;
const WATER_MAX = 38;

function paeth(a, b, c) {
  const x = a + b - c;
  const pa = Math.abs(x - a);
  const pb = Math.abs(x - b);
  const pc = Math.abs(x - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePng(buf) {
  let off = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idats = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      ct = data[9];
    } else if (type === "IDAT") idats.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = w * bpp;
  const rgba = Buffer.alloc(w * h * 4);
  let src = 0;
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[src++];
    raw.copy(cur, 0, src, src + stride);
    src += stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? cur[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 1) cur[i] = (cur[i] + left) & 255;
      else if (filter === 2) cur[i] = (cur[i] + up) & 255;
      else if (filter === 3)
        cur[i] = (cur[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) cur[i] = (cur[i] + paeth(left, up, upLeft)) & 255;
    }
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      const si = x * bpp;
      rgba[di] = cur[si];
      rgba[di + 1] = cur[si + 1];
      rgba[di + 2] = cur[si + 2];
      rgba[di + 3] = bpp === 4 ? cur[si + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, rgba };
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])];
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td), 0);
    chunks.push(len, td, crc);
  }
  chunk("IHDR", ihdr);
  chunk("IDAT", compressed);
  chunk("IEND", Buffer.alloc(0));
  return Buffer.concat(chunks);
}

function largestIslands(land, w, h, minSize, limit) {
  const vis = new Uint8Array(w * h);
  const blobs = [];
  const idx = (x, y) => x + y * w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (!land[i] || vis[i]) continue;
      const q = [[x, y]];
      vis[i] = 1;
      let sx = 0;
      let sy = 0;
      let n = 0;
      let cx = x;
      let cy = y;
      while (q.length) {
        const [px, py] = q.pop();
        sx += px;
        sy += py;
        n++;
        cx = px;
        cy = py;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = idx(nx, ny);
          if (!land[ni] || vis[ni]) continue;
          vis[ni] = 1;
          q.push([nx, ny]);
        }
      }
      if (n >= minSize) {
        blobs.push({
          n,
          x: Math.round(sx / n),
          y: Math.round(sy / n),
          seed: [cx, cy],
        });
      }
    }
  }
  blobs.sort((a, b) => b.n - a.n);
  return blobs.slice(0, limit);
}

const srcPath = path.resolve(process.argv[2]);
const folder = process.argv[3];
const SCALE = Number(process.argv[4] ?? 2);
if (!srcPath || !folder) {
  console.error(
    "usage: node scripts/build-bluescale-map.mjs <src.png> <folder> [scale]",
  );
  process.exit(1);
}

const src = decodePng(fs.readFileSync(srcPath));
const { w, h, rgba } = src;
const outW = w * SCALE;
const outH = h * SCALE;
const out = Buffer.alloc(outW * outH * 4);
const landMask = new Uint8Array(outW * outH);
let water = 0;
let land = 0;
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const sx = Math.min(w - 1, Math.floor(x / SCALE));
    const sy = Math.min(h - 1, Math.floor(y / SCALE));
    const si = (sy * w + sx) * 4;
    const di = (y * outW + x) * 4;
    const lum = (rgba[si] + rgba[si + 1] + rgba[si + 2]) / 3;
    const isWater = lum <= WATER_MAX;
    if (isWater) {
      out[di] = 0;
      out[di + 1] = 0;
      out[di + 2] = WATER_BLUE;
      out[di + 3] = 255;
      water++;
    } else {
      const t = Math.max(0, Math.min(1, (lum - WATER_MAX) / 180));
      const pb = 140 + Math.round(t * 8);
      out[di] = pb;
      out[di + 1] = pb;
      out[di + 2] = pb;
      out[di + 3] = 255;
      landMask[x + y * outW] = 1;
      land++;
    }
  }
}

const outDir = path.join(root, "map-generator/assets/maps", folder);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "image.png"), encodePng(outW, outH, out));
const islands = largestIslands(landMask, outW, outH, 400, 12);
console.log({
  folder,
  source: `${w}x${h}`,
  out: `${outW}x${outH}`,
  water,
  land,
  islands: islands.map((b) => ({ n: b.n, x: b.x, y: b.y })),
});
