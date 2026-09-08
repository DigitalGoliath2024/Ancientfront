/**
 * Builds map-generator/assets/maps/centralsouthflorida/image.png from the
 * source relief JPEG/PNG: water = blue 106, land stays plains (blue 140–148).
 * Keeps the source coastline, Keys, and winding rivers. Only punches a few
 * pixels where a river mouth is blocked from the sea or from the east-coast
 * lagoon.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(
  root,
  "map-generator/assets/maps/_florida-src.png",
);
const OUT_DIR = path.join(
  root,
  "map-generator/assets/maps/centralsouthflorida",
);
const SCALE = 2;
const WATER_BLUE = 106;
// Source ocean ~110–120; shallows / river cuts ~125–155; Keys land ~170+.
const WATER_MAX = 152;
const LAKE_MAX = 158;
const MOUTH_GAP = 10; // max land pixels to punch at a blocked mouth

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

function idx(x, y, w) {
  return y * w + x;
}

function flood(w, h, start, isOpen) {
  const seen = new Uint8Array(w * h);
  const q = [];
  for (const [x, y] of start) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = idx(x, y, w);
    if (!isOpen(x, y) || seen[i]) continue;
    seen[i] = 1;
    q.push(i);
  }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    const x = i % w;
    const y = (i - x) / w;
    const nbs = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of nbs) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny, w);
      if (seen[ni] || !isOpen(nx, ny)) continue;
      seen[ni] = 1;
      q.push(ni);
    }
  }
  return { seen, cells: q };
}

function paintDisk(water, w, h, cx, cy, r) {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) water[idx(x, y, w)] = 1;
    }
  }
}

function punchRiverMouths(water, w, h, oceanSeen, fromSeen, maxLand, splitX) {
  const parent = new Int32Array(w * h);
  const depth = new Int16Array(w * h);

  function landBridge(sx, sy) {
    const start = idx(sx, sy, w);
    if (water[start]) return null;
    parent.fill(-1);
    depth.fill(-1);
    const q = [start];
    depth[start] = 1;
    let qi = 0;
    let found = -1;
    while (qi < q.length) {
      const i = q[qi++];
      if (depth[i] > maxLand) continue;
      const x = i % w;
      const y = (i - x) / w;
      const nbs = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of nbs) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = idx(nx, ny, w);
        if (oceanSeen[ni] && water[ni]) {
          found = i;
          qi = q.length;
          break;
        }
        if (water[ni] || depth[ni] >= 0) continue;
        depth[ni] = depth[i] + 1;
        parent[ni] = i;
        q.push(ni);
      }
    }
    if (found < 0) return null;
    const path = [];
    let cur = found;
    while (cur >= 0) {
      path.push(cur);
      cur = parent[cur];
    }
    return path;
  }

  let west = null;
  let east = null;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(x, y, w);
      if (!water[i] || oceanSeen[i] || !fromSeen[i]) continue;
      const nbs = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [lx, ly] of nbs) {
        const li = idx(lx, ly, w);
        if (water[li]) continue;
        const path = landBridge(lx, ly);
        if (!path) continue;
        const side = x < splitX ? "west" : "east";
        if (side === "west" && (!west || path.length < west.length)) west = path;
        if (side === "east" && (!east || path.length < east.length)) east = path;
      }
    }
  }
  let mouths = 0;
  for (const path of [west, east]) {
    if (!path) continue;
    for (const pi of path) {
      const px = pi % w;
      const py = (pi - px) / w;
      paintDisk(water, w, h, px, py, 1);
    }
    mouths++;
  }
  return mouths;
}

const src = decodePng(fs.readFileSync(SRC));
const { w, h, rgba } = src;
const water = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  if (rgba[i * 4 + 2] <= WATER_MAX) water[i] = 1;
}

const border = [];
for (let x = 0; x < w; x++) {
  border.push([x, 0], [x, h - 1]);
}
for (let y = 0; y < h; y++) {
  border.push([0, y], [w - 1, y]);
}

const seedX = Math.round(w * 0.574);
const seedY = Math.round(h * 0.443);
let seed = null;
for (let r = 0; r <= 40 && !seed; r++) {
  for (let dy = -r; dy <= r && !seed; dy++) {
    for (let dx = -r; dx <= r && !seed; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const x = seedX + dx;
      const y = seedY + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      if (rgba[idx(x, y, w) * 4 + 2] <= LAKE_MAX) seed = [x, y];
    }
  }
}
if (!seed) {
  throw new Error("no Okeechobee seed pixel");
}
const lakeGrow = flood(
  w,
  h,
  [seed],
  (x, y) => {
    if (rgba[idx(x, y, w) * 4 + 2] > LAKE_MAX) return false;
    const dx = x - seedX;
    const dy = y - seedY;
    return dx * dx + dy * dy <= 75 * 75;
  },
);
if (lakeGrow.cells.length < 400) {
  throw new Error(`Okeechobee fill too small: ${lakeGrow.cells.length}`);
}
const lake = {
  cells: lakeGrow.cells,
  cx: seed[0],
  cy: seed[1],
};
for (const i of lake.cells) water[i] = 1;

const lakeSeeds = [];
for (const i of lake.cells) {
  lakeSeeds.push([i % w, (i - (i % w)) / w]);
}

let mouths = 0;
for (let pass = 0; pass < 3; pass++) {
  const ocean = flood(w, h, border, (x, y) => water[idx(x, y, w)] === 1);
  const rivers = flood(w, h, lakeSeeds, (x, y) => water[idx(x, y, w)] === 1);
  const n = punchRiverMouths(
    water,
    w,
    h,
    ocean.seen,
    rivers.seen,
    MOUTH_GAP,
    lake.cx,
  );
  mouths += n;
  if (n === 0) break;
}

const ocean2 = flood(w, h, border, (x, y) => water[idx(x, y, w)] === 1);
let lakeTouchesOcean = false;
for (const i of lake.cells) {
  if (ocean2.seen[i]) {
    lakeTouchesOcean = true;
    break;
  }
}

const outW = w * SCALE;
const outH = h * SCALE;
const out = Buffer.alloc(outW * outH * 4);
for (let y = 0; y < outH; y++) {
  for (let x = 0; x < outW; x++) {
    const sx = Math.min(w - 1, Math.floor(x / SCALE));
    const sy = Math.min(h - 1, Math.floor(y / SCALE));
    const si = idx(sx, sy, w);
    const di = (y * outW + x) * 4;
    if (water[si]) {
      out[di] = 0;
      out[di + 1] = 0;
      out[di + 2] = WATER_BLUE;
      out[di + 3] = 255;
    } else {
      const srcB = rgba[si * 4 + 2];
      // Plains only: blue 140–148. White relief would otherwise become mountains.
      const t = Math.max(0, Math.min(1, (srcB - 160) / 95));
      const b = 140 + Math.round(t * 8);
      out[di] = b;
      out[di + 1] = b;
      out[di + 2] = b;
      out[di + 3] = 255;
    }
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "image.png"), encodePng(outW, outH, out));

console.log(
  JSON.stringify(
    {
      source: `${w}x${h}`,
      out: `${outW}x${outH}`,
      lake: { n: lake.cells.length, cx: lake.cx, cy: lake.cy },
      mouths,
      lakeTouchesOcean,
    },
    null,
    2,
  ),
);
