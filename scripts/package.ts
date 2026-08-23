/**
 * Packs dist/ into a zip both Chrome and Edge accept.
 *
 * Written by hand because there is no zip dependency and the format is short:
 * a local header plus deflated data per file, a central directory, an end
 * record. Entries use forward slashes and a fixed timestamp, so the same input
 * always produces the same archive.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

import { crc32 } from "./crc32";

const ROOT = join(import.meta.dir, "..");
const DIST = join(ROOT, "dist");
const RELEASE = join(ROOT, "release");

/** 1980-01-01, the earliest a DOS timestamp can express. Keeps archives reproducible. */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

interface Entry {
  readonly name: string;
  readonly data: Uint8Array;
}

const listFiles = async (dir: string): Promise<string[]> => {
  const found: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, item.name);
    if (item.isDirectory()) found.push(...(await listFiles(full)));
    else found.push(full);
  }
  return found.sort();
};

const u16 = (value: number): Uint8Array => new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);

const u32 = (value: number): Uint8Array =>
  new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};

const zip = (entries: readonly Entry[]): Uint8Array => {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const deflated = new Uint8Array(deflateRawSync(entry.data, { level: 9 }));
    // Deflate can grow incompressible data; store it verbatim when it does.
    const stored = deflated.length >= entry.data.length;
    const body = stored ? entry.data : deflated;
    const method = stored ? 0 : 8;
    const sum = crc32(entry.data);

    const header = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(DOS_TIME),
      u16(DOS_DATE),
      u32(sum),
      u32(body.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
    ]);

    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(method),
        u16(DOS_TIME),
        u16(DOS_DATE),
        u32(sum),
        u32(body.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );

    local.push(header, body);
    offset += header.length + body.length;
  }

  const directory = concat(central);
  return concat([
    concat(local),
    directory,
    concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(entries.length),
      u16(entries.length),
      u32(directory.length),
      u32(offset),
      u16(0),
    ]),
  ]);
};

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const pack = async (): Promise<void> => {
  await stat(DIST).catch(() => {
    throw new Error("dist/ is missing. Run `bun run build` first.");
  });

  const manifest = JSON.parse(await readFile(join(DIST, "manifest.json"), "utf8")) as {
    name: string;
    version: string;
  };

  const files = await listFiles(DIST);
  const entries: Entry[] = [];
  for (const file of files) {
    entries.push({
      // Zip paths are always forward-slashed, whatever built the archive.
      name: relative(DIST, file).split(sep).join("/"),
      data: new Uint8Array(await readFile(file)),
    });
  }

  if (!entries.some((entry) => entry.name === "manifest.json")) {
    throw new Error("manifest.json must sit at the archive root");
  }

  await rm(RELEASE, { recursive: true, force: true });
  await mkdir(RELEASE, { recursive: true });

  const archive = zip(entries);
  const target = join(RELEASE, `${slug(manifest.name)}-${manifest.version}.zip`);
  await writeFile(target, archive);

  const digest = createHash("sha256").update(archive).digest("hex");
  await writeFile(`${target}.sha256`, `${digest}  ${slug(manifest.name)}-${manifest.version}.zip\n`);

  console.log(`${relative(ROOT, target)}  ${archive.length} bytes  ${entries.length} files`);
  console.log(`sha256  ${digest}`);
  for (const entry of entries) console.log(`  ${entry.name}`);
};

await pack();
