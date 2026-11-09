// Reads rendered PNGs directly, so frames can be compared and inspected without an image library.
import { readFileSync } from "node:fs";
import zlib from "node:zlib";

export type Image = { width: number; height: number; channels: number; data: Buffer };

const PNG_HEADER = 8;
const RGBA = 6;

/** Decodes an 8-bit, non-interlaced RGB or RGBA PNG. */
export const decodePng = (bytes: Buffer): Image => {
  let pos = PNG_HEADER;
  const chunks: Buffer[] = [];
  let width = 0;
  let height = 0;
  let colourType = 0;
  while (pos < bytes.length) {
    const length = bytes.readUInt32BE(pos);
    const type = bytes.toString("latin1", pos + 4, pos + 8);
    const body = bytes.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      colourType = body[9];
    }
    if (type === "IDAT") chunks.push(body);
    pos += 12 + length;
  }
  const channels = colourType === RGBA ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const data = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const start = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? data[y * stride + x - channels] : 0;
      const b = y > 0 ? data[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels] : 0;
      let v = raw[start + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      data[y * stride + x] = v & 255;
    }
  }
  return { width, height, channels, data };
};

export const readPng = (file: string) => decodePng(readFileSync(file));

export type FrameDiff = { pixels: number; share: number; maxDelta: number };

/** How many pixels differ between two images of the same size, and by how much at most. */
export const diffImages = (a: Image, b: Image): FrameDiff => {
  if (a.width !== b.width || a.height !== b.height) throw new Error("Images are different sizes");
  let pixels = 0;
  let maxDelta = 0;
  const total = a.width * a.height;
  for (let i = 0; i < total; i++) {
    let delta = 0;
    for (let k = 0; k < 3; k++) delta = Math.max(delta, Math.abs(a.data[i * a.channels + k] - b.data[i * b.channels + k]));
    if (delta > 0) {
      pixels++;
      maxDelta = Math.max(maxDelta, delta);
    }
  }
  return { pixels, share: pixels / total, maxDelta };
};

// Set from measurements on f1-v8: identical code can differ by up to 0.0033% of pixels. Which frames vary changes over
// time on the same computer, and a handful of pixels in a frame can move by up to 58 levels.
const NOISE_SHARE = 0.0001;
const NOISE_DELTA = 64;

/** "identical", "noise" for render jitter, or "changed" for a real difference. */
export const classifyDiff = (d: FrameDiff) => (d.pixels === 0 ? "identical" : d.share <= NOISE_SHARE && d.maxDelta <= NOISE_DELTA ? "noise" : "changed");

/** The share of a region's pixels taken by its most common colour. Near 1 means the region is empty. */
export const dominantShare = (img: Image, region: { x: number; y: number; w: number; h: number }) => {
  const counts = new Map<number, number>();
  let total = 0;
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      const i = (y * img.width + x) * img.channels;
      const key = ((img.data[i] >> 3) << 10) | ((img.data[i + 1] >> 3) << 5) | (img.data[i + 2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total++;
    }
  }
  return Math.max(...counts.values()) / total;
};
