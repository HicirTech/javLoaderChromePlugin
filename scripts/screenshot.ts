/** Renders the real popup against tests/fixtures/ and screenshots it into docs/. */

import { Window } from "happy-dom";
import { mkdir, readFile, readdir, rm, cp } from "node:fs/promises";
import { join } from "node:path";

import { parsePage } from "../src/content/javdb";
import type { MovieSource } from "../src/shared/types";

const FIXTURES = join(import.meta.dir, "..", "tests", "fixtures");
const WORK = join(import.meta.dir, "..", ".screenshots");
const OUT = join(import.meta.dir, "..", "docs");
const CHROMIUM = process.env.CHROMIUM ?? "chromium";

/** Every fixture, parsed by the real parser, presented as if it were an open tab. */
const readSources = async (): Promise<MovieSource[]> => {
  const files = (await readdir(FIXTURES)).filter((name) => name.endsWith(".html")).sort();
  const sources: MovieSource[] = [];

  for (const [index, file] of files.entries()) {
    const html = await readFile(join(FIXTURES, file), "utf8");
    const url = `https://javdb.com/v/fixture${index}`;
    const window = new Window({ url });
    window.document.write(html);
    sources.push({ tabId: 100 + index, ...parsePage(window.document as unknown as Document, url) });
  }
  return sources;
};

const STATES = [
  { name: "popup-list", state: "list", take: 3 },
  { name: "popup-expanded", state: "expanded", take: 3 },
  { name: "popup-sent", state: "sent", take: 2 },
  { name: "popup-settings", state: "settings", take: 3 },
] as const;

const WIDTH = 520;
/** Tall enough that nothing is clipped while the harness measures itself. */
const MEASURE_HEIGHT = 900;

const run = async (args: readonly string[]): Promise<string> => {
  const proc = Bun.spawn([CHROMIUM, ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`chromium exited ${code}: ${stderr}`);
  return stdout;
};

const COMMON = [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=2",
  "--virtual-time-budget=8000",
];

const shoot = async (sources: readonly MovieSource[]): Promise<void> => {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  await mkdir(OUT, { recursive: true });

  for (const { name, state, take } of STATES) {
    const dir = join(WORK, name);
    await mkdir(dir, { recursive: true });

    const result = await Bun.build({
      entrypoints: [join(import.meta.dir, "harness", "main.tsx")],
      outdir: dir,
      target: "browser",
      format: "iife",
      throw: false,
      naming: { entry: "harness.[ext]" },
      define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
        FIXTURE_SOURCES: JSON.stringify(sources.slice(0, take)),
        HARNESS_STATE: JSON.stringify(state),
      },
    });
    if (!result.success) {
      for (const message of result.logs) console.error(String(message));
      throw new Error(`harness build failed for ${name}`);
    }

    await cp(join(import.meta.dir, "harness", "index.html"), join(dir, "index.html"));

    const page = `file://${join(dir, "index.html")}`;

    // Pass one measures; pass two shoots at that exact height so no screenshot
    // carries dead space below the popup.
    const dom = await run([...COMMON, `--window-size=${WIDTH},${MEASURE_HEIGHT}`, "--dump-dom", page]);
    const measured = Number(/<title>ready:(\d+)<\/title>/.exec(dom)?.[1]);
    if (!Number.isFinite(measured) || measured <= 0) {
      throw new Error(`${name}: harness did not report a height`);
    }

    const shot = join(OUT, `${name}.png`);
    await run([...COMMON, `--window-size=${WIDTH},${measured}`, `--screenshot=${shot}`, page]);
    console.log(`wrote docs/${name}.png (${WIDTH}x${measured})`);
  }

  await rm(WORK, { recursive: true, force: true });
};

await shoot(await readSources());
