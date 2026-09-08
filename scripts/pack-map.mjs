/**
 * Packs map-generator/assets/maps/<name>/image.png into resources/maps/<name>
 * (map.bin, map4x.bin, map16x.bin, manifest.json, thumbnail.webp).
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIN_ISLAND = 30;
const MIN_LAKE = 200;
const WATER = 0;
const LAND = 1;

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
  const compressed = zlib.deflateSync(raw, { level: 6 });
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

function at(grid, w, x, y) {
  return grid[x * grid.h + y];
}

function makeGrid(w, h) {
  return { w, h, type: new Uint8Array(w * h), mag: new Float32Array(w * h), shore: new Uint8Array(w * h), ocean: new Uint8Array(w * h) };
}

function ti(g, x, y) {
  return x * g.h + y;
}

function neighbors(g, x, y, out) {
  let n = 0;
  if (x > 0) out[n++] = [x - 1, y];
  if (x < g.w - 1) out[n++] = [x + 1, y];
  if (y > 0) out[n++] = [x, y - 1];
  if (y < g.h - 1) out[n++] = [x, y + 1];
  return n;
}

function getArea(g, x, y, visited, target) {
  const area = [];
  const q = [[x, y]];
  visited[ti(g, x, y)] = 1;
  const buf = [];
  while (q.length) {
    const [cx, cy] = q.pop();
    if (g.type[ti(g, cx, cy)] !== target) continue;
    area.push([cx, cy]);
    const n = neighbors(g, cx, cy, buf);
    for (let i = 0; i < n; i++) {
      const [nx, ny] = buf[i];
      const id = ti(g, nx, ny);
      if (!visited[id]) {
        visited[id] = 1;
        q.push([nx, ny]);
      }
    }
  }
  return area;
}

function removeSmall(g, minSize, fromType, toType) {
  const visited = new Uint8Array(g.w * g.h);
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y < g.h; y++) {
      if (g.type[ti(g, x, y)] !== fromType || visited[ti(g, x, y)]) continue;
      const area = getArea(g, x, y, visited, fromType);
      if (area.length < minSize) {
        for (const [ax, ay] of area) {
          g.type[ti(g, ax, ay)] = toType;
          g.mag[ti(g, ax, ay)] = 0;
        }
      }
    }
  }
}

function processWater(g, removeLakes) {
  g.ocean.fill(0);
  const visited = new Uint8Array(g.w * g.h);
  const bodies = [];
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y < g.h; y++) {
      if (g.type[ti(g, x, y)] !== WATER || visited[ti(g, x, y)]) continue;
      bodies.push(getArea(g, x, y, visited, WATER));
    }
  }
  bodies.sort((a, b) => b.length - a.length);
  if (bodies.length === 0) return;
  for (const [x, y] of bodies[0]) g.ocean[ti(g, x, y)] = 1;
  if (removeLakes) {
    for (let i = 1; i < bodies.length; i++) {
      if (bodies[i].length >= MIN_LAKE) continue;
      for (const [x, y] of bodies[i]) {
        g.type[ti(g, x, y)] = LAND;
        g.mag[ti(g, x, y)] = 0;
      }
    }
  }
  const buf = [];
  const shoreWater = [];
  g.shore.fill(0);
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y < g.h; y++) {
      const id = ti(g, x, y);
      const n = neighbors(g, x, y, buf);
      if (g.type[id] === LAND) {
        for (let i = 0; i < n; i++) {
          if (g.type[ti(g, buf[i][0], buf[i][1])] === WATER) {
            g.shore[id] = 1;
            break;
          }
        }
      } else if (g.type[id] === WATER) {
        for (let i = 0; i < n; i++) {
          if (g.type[ti(g, buf[i][0], buf[i][1])] === LAND) {
            g.shore[id] = 1;
            shoreWater.push([x, y]);
            break;
          }
        }
      }
    }
  }
  const seen = new Uint8Array(g.w * g.h);
  const q = [];
  for (const [x, y] of shoreWater) {
    const id = ti(g, x, y);
    g.mag[id] = 0;
    seen[id] = 1;
    q.push(x, y, 0);
  }
  for (let qi = 0; qi < q.length; ) {
    const x = q[qi++];
    const y = q[qi++];
    const dist = q[qi++];
    const n = neighbors(g, x, y, buf);
    for (let i = 0; i < n; i++) {
      const nx = buf[i][0];
      const ny = buf[i][1];
      const nid = ti(g, nx, ny);
      if (seen[nid] || g.type[nid] !== WATER) continue;
      seen[nid] = 1;
      g.mag[nid] = dist + 1;
      q.push(nx, ny, dist + 1);
    }
  }
}

function miniMap(g) {
  const w = Math.floor(g.w / 2);
  const h = Math.floor(g.h / 2);
  const m = makeGrid(w, h);
  // Go's TerrainType zero-value is Land. WATER is 0 here, so dest must start
  // as land or the "water already wins" skip leaves the whole mini-map empty.
  m.type.fill(LAND);
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y < g.h; y++) {
      const mx = Math.floor(x / 2);
      const my = Math.floor(y / 2);
      if (mx >= w || my >= h) continue;
      const sid = ti(g, x, y);
      const did = mx * h + my;
      if (m.type[did] === WATER) continue;
      if (g.type[sid] === WATER) {
        m.type[did] = WATER;
        m.mag[did] = g.mag[sid];
        m.shore[did] = g.shore[sid];
        m.ocean[did] = g.ocean[sid];
        continue;
      }
      m.type[did] = LAND;
      m.mag[did] = g.mag[sid];
      m.shore[did] = g.shore[sid];
    }
  }
  return m;
}

function writeBits(bw, value, n) {
  bw.cur |= (value & ((1 << n) - 1)) << bw.used;
  bw.used += n;
  while (bw.used >= 8) {
    bw.bytes.push(bw.cur & 255);
    bw.cur >>>= 8;
    bw.used -= 8;
  }
}

function storeSimpleHuffman(bw, symbols) {
  writeBits(bw, 1, 1);
  writeBits(bw, symbols.length === 2 ? 1 : 0, 1);
  const first = symbols[0];
  if (first <= 1) {
    writeBits(bw, 0, 1);
    writeBits(bw, first, 1);
  } else {
    writeBits(bw, 1, 1);
    writeBits(bw, first, 8);
  }
  if (symbols.length === 2) writeBits(bw, symbols[1], 8);
}

function encodeLosslessWebp(width, height, rgba) {
  const bw = { bytes: [], cur: 0, used: 0 };
  writeBits(bw, 0x2f, 8);
  writeBits(bw, width - 1, 14);
  writeBits(bw, height - 1, 14);
  writeBits(bw, 1, 1);
  writeBits(bw, 0, 3);
  writeBits(bw, 0, 1);
  writeBits(bw, 0, 1);
  writeBits(bw, 0, 1);
  storeSimpleHuffman(bw, [0, 220]);
  storeSimpleHuffman(bw, [0, 190]);
  storeSimpleHuffman(bw, [0, 138]);
  storeSimpleHuffman(bw, [0, 255]);
  storeSimpleHuffman(bw, [0]);
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3];
    const bit = a === 0 ? 0 : 1;
    writeBits(bw, bit, 1);
    writeBits(bw, bit, 1);
    writeBits(bw, bit, 1);
    writeBits(bw, bit, 1);
  }
  if (bw.used > 0) bw.bytes.push(bw.cur & 255);
  let payload = Buffer.from(bw.bytes);
  const chunkSize = payload.length;
  if (payload.length % 2 === 1) {
    payload = Buffer.concat([payload, Buffer.from([0])]);
  }
  const out = Buffer.alloc(20 + payload.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(12 + payload.length, 4);
  out.write("WEBP", 8);
  out.write("VP8L", 12);
  out.writeUInt32LE(chunkSize, 16);
  payload.copy(out, 20);
  return out;
}

function pack(g) {
  const data = Buffer.alloc(g.w * g.h);
  let land = 0;
  for (let x = 0; x < g.w; x++) {
    for (let y = 0; y < g.h; y++) {
      const id = ti(g, x, y);
      let b = 0;
      if (g.type[id] === LAND) {
        b |= 0b10000000;
        land++;
        b |= Math.min(31, Math.ceil(g.mag[id]));
      } else {
        b |= Math.min(31, Math.ceil(g.mag[id] / 2));
      }
      if (g.shore[id]) b |= 0b01000000;
      if (g.ocean[id]) b |= 0b00100000;
      data[y * g.w + x] = b;
    }
  }
  return { data, land };
}

function thumbRgba(g, quality) {
  const tw = Math.max(1, Math.floor(g.w * quality));
  const th = Math.max(1, Math.floor(g.h * quality));
  const rgba = Buffer.alloc(tw * th * 4);
  for (let x = 0; x < tw; x++) {
    for (let y = 0; y < th; y++) {
      const sx = Math.min(g.w - 1, Math.floor(x / quality));
      const sy = Math.min(g.h - 1, Math.floor(y / quality));
      const id = ti(g, sx, sy);
      const di = (y * tw + x) * 4;
      let r = 0;
      let gb = 0;
      let b = 0;
      let a = 255;
      if (g.type[id] === WATER) {
        a = 0;
        if (g.shore[id]) {
          r = 100;
          gb = 143;
          b = 255;
        } else {
          const adj = 11 - Math.min(g.mag[id] / 2, 10) - 10;
          r = Math.max(70 + adj, 0);
          gb = Math.max(132 + adj, 0);
          b = Math.max(180 + adj, 0);
        }
      } else if (g.shore[id]) {
        r = 204;
        gb = 203;
        b = 158;
      } else {
        const mag = g.mag[id];
        r = 190;
        gb = 220 - 2 * mag;
        b = 138;
      }
      rgba[di] = r;
      rgba[di + 1] = gb;
      rgba[di + 2] = b;
      rgba[di + 3] = a;
    }
  }
  return { w: tw, h: th, rgba };
}

function packMap(folder, minIsland = MIN_ISLAND) {
  const infoPath = path.join(root, "map-generator/assets/maps", folder, "info.json");
  const imgPath = path.join(root, "map-generator/assets/maps", folder, "image.png");
  const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
  const img = decodePng(fs.readFileSync(imgPath));
  const w = img.w - (img.w % 4);
  const h = img.h - (img.h % 4);
  const g = makeGrid(w, h);
  g.h = h;
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const b = img.rgba[(y * img.w + x) * 4 + 2];
      const id = ti(g, x, y);
      if (b === 106) {
        g.type[id] = WATER;
      } else {
        g.type[id] = LAND;
        const mag = Math.min(200, Math.max(140, b)) - 140;
        g.mag[id] = mag / 2;
      }
    }
  }
  removeSmall(g, minIsland, LAND, WATER);
  processWater(g, true);
  let g4 = miniMap(g);
  g4.h = g4.h;
  removeSmall(g4, Math.max(1, Math.floor(minIsland / 2)), LAND, WATER);
  processWater(g4, false);
  let g16 = miniMap(g4);
  processWater(g16, false);
  const p = pack(g);
  const p4 = pack(g4);
  const p16 = pack(g16);
  const outDir = path.join(root, "resources/maps", folder);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "map.bin"), p.data);
  fs.writeFileSync(path.join(outDir, "map4x.bin"), p4.data);
  fs.writeFileSync(path.join(outDir, "map16x.bin"), p16.data);
  const thumb = thumbRgba(g4, 0.5);
  const png = encodePng(thumb.w, thumb.h, thumb.rgba);
  fs.writeFileSync(path.join(outDir, "thumbnail.png"), png);
  fs.writeFileSync(
    path.join(outDir, "thumbnail.webp"),
    encodeLosslessWebp(thumb.w, thumb.h, thumb.rgba),
  );
  const manifest = {
    ...info,
    map: { width: w, height: h, num_land_tiles: p.land },
    map4x: { width: g4.w, height: g4.h, num_land_tiles: p4.land },
    map16x: { width: g16.w, height: g16.h, num_land_tiles: p16.land },
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(folder, {
    w,
    h,
    land: p.land,
    land4x: p4.land,
    land16x: p16.land,
    thumb: `${thumb.w}x${thumb.h}`,
  });
  return { folder, thumb, png };
}

const names = [];
let minIsland = MIN_ISLAND;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--min-island=")) {
    minIsland = Number(arg.slice("--min-island=".length));
  } else {
    names.push(arg);
  }
}
if (names.length === 0) {
  console.error("usage: node scripts/pack-map.mjs [--min-island=N] <folder>...");
  process.exit(1);
}
for (const name of names) packMap(name, minIsland);
