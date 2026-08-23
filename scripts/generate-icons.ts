/** Draws the toolbar icons. Chrome needs raster, so generate rather than commit
 *  binaries. PNG written by hand: header, one deflated chunk, terminator. */

import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SIZES = [16, 32, 48, 128] as const;

/** Blue-grey 800, matching the popup's primary colour. */
const FOREGROUND = { r: 255, g: 255, b: 255 } as const;
const BACKGROUND = { r: 0x37, g: 0x47, b: 0x4f } as const;

/** Samples per axis when deciding a pixel's coverage. */
const SUPERSAMPLE = 4;

interface Point {
  readonly x: number;
  readonly y: number;
}

const insideRoundedSquare = ({ x, y }: Point, radius: number): boolean => {
  const nearestX = Math.min(Math.max(x, radius), 1 - radius);
  const nearestY = Math.min(Math.max(y, radius), 1 - radius);
  const inCorner = x < radius || x > 1 - radius;
  const inCornerY = y < radius || y > 1 - radius;
  if (!inCorner || !inCornerY) return x >= 0 && x <= 1 && y >= 0 && y <= 1;
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
};

const insideRect = ({ x, y }: Point, x0: number, y0: number, x1: number, y1: number): boolean => {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
};

/** A downward-pointing isoceles triangle spanning [x0,x1] at the top, apex at (cx, y1). */
const insideArrowHead = ({ x, y }: Point, x0: number, x1: number, y0: number, y1: number): boolean => {
  if (y < y0 || y > y1) return false;
  const progress = (y - y0) / (y1 - y0);
  const halfWidth = ((x1 - x0) / 2) * (1 - progress);
  const centre = (x0 + x1) / 2;
  return Math.abs(x - centre) <= halfWidth;
};

const isForeground = (point: Point): boolean => {
  return (
    insideRect(point, 0.435, 0.17, 0.565, 0.5) ||
    insideArrowHead(point, 0.29, 0.71, 0.44, 0.7) ||
    insideRect(point, 0.25, 0.76, 0.75, 0.845)
  );
};

/** Returns RGBA scanlines, each already prefixed with its PNG filter byte. */
const render = (size: number): Uint8Array => {
  const stride = size * 4 + 1;
  const raw = new Uint8Array(stride * size);
  const step = 1 / (SUPERSAMPLE + 1);

  for (let row = 0; row < size; row += 1) {
    const rowStart = row * stride;
    raw[rowStart] = 0; // filter type: none

    for (let column = 0; column < size; column += 1) {
      let inside = 0;
      let covered = 0;

      for (let sy = 1; sy <= SUPERSAMPLE; sy += 1) {
        for (let sx = 1; sx <= SUPERSAMPLE; sx += 1) {
          const point = { x: (column + sx * step) / size, y: (row + sy * step) / size };
          if (!insideRoundedSquare(point, 0.16)) continue;
          covered += 1;
          if (isForeground(point)) inside += 1;
        }
      }

      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const alpha = Math.round((covered / samples) * 255);
      const mix = covered === 0 ? 0 : inside / covered;
      const offset = rowStart + 1 + column * 4;
      raw[offset] = Math.round(BACKGROUND.r + (FOREGROUND.r - BACKGROUND.r) * mix);
      raw[offset + 1] = Math.round(BACKGROUND.g + (FOREGROUND.g - BACKGROUND.g) * mix);
      raw[offset + 2] = Math.round(BACKGROUND.b + (FOREGROUND.b - BACKGROUND.b) * mix);
      raw[offset + 3] = alpha;
    }
  }

  return raw;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type: string, body: Uint8Array): Uint8Array => {
  const typeBytes = new TextEncoder().encode(type);
  const payload = new Uint8Array(typeBytes.length + body.length);
  payload.set(typeBytes, 0);
  payload.set(body, typeBytes.length);

  const out = new Uint8Array(payload.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, body.length);
  out.set(payload, 4);
  view.setUint32(out.length - 4, crc32(payload));
  return out;
};

const encodePng = (size: number, raw: Uint8Array): Uint8Array => {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlacing

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk("IEND", new Uint8Array(0)),
  ];

  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
};

export const generateIcons = async (outDir: string): Promise<void> => {
  await mkdir(outDir, { recursive: true });
  for (const size of SIZES) {
    await writeFile(join(outDir, `icon-${size}.png`), encodePng(size, render(size)));
  }
};

if (import.meta.main) {
  await generateIcons("dist/icons");
  console.log(`wrote ${SIZES.length} icons to dist/icons`);
}
