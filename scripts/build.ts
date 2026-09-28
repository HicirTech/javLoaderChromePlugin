/** Bundles the extension into dist/. Each entry is its own IIFE: a manifest
 *  content script cannot be an ES module, and per-entry builds avoid shared chunks. */

import { cp, mkdir, rm, watch } from "node:fs/promises";

import { generateIcons } from "./generate-icons";

const OUT_DIR = "dist";

const ENTRIES = [
  { entry: "src/background/index.ts", name: "background" },
  { entry: "src/content/index.ts", name: "content" },
  { entry: "src/popup/main.tsx", name: "popup" },
  { entry: "src/options/main.tsx", name: "options" },
] as const;

const development = process.argv.includes("--dev") || process.argv.includes("--watch");

const bundle = async (): Promise<boolean> => {
  let ok = true;

  for (const { entry, name } of ENTRIES) {
    const result = await Bun.build({
      entrypoints: [entry],
      outdir: OUT_DIR,
      throw: false,
      target: "browser",
      format: "iife",
      minify: !development,
      sourcemap: development ? "linked" : "none",
      naming: { entry: `${name}.[ext]` },
      define: {
        "process.env.NODE_ENV": JSON.stringify(development ? "development" : "production"),
      },
    });

    if (!result.success) {
      ok = false;
      console.error(`build failed: ${entry}`);
      for (const message of result.logs) console.error(String(message));
    }
  }

  return ok;
};

const build = async (): Promise<boolean> => {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const ok = await bundle();
  if (!ok) return false;

  await cp("src/manifest.json", `${OUT_DIR}/manifest.json`);
  await cp("src/popup/index.html", `${OUT_DIR}/popup.html`);
  await cp("src/options/index.html", `${OUT_DIR}/options.html`);
  await generateIcons(`${OUT_DIR}/icons`);
  return true;
};

const succeeded = await build();
console.log(succeeded ? `built ${OUT_DIR}` : "build failed");

if (!process.argv.includes("--watch")) {
  process.exit(succeeded ? 0 : 1);
}

console.log("watching src/ for changes");

let rebuilding = false;
let pending = false;

/** Build until nothing new arrived. `pending` defers a mid-build save instead of
 *  dropping it; `finally` stops one failure wedging the watcher. */
const rebuildUntilQuiet = async (): Promise<void> => {
  rebuilding = true;
  try {
    do {
      pending = false;
      // Editors write a file in several syscalls; coalesce the burst into one build.
      await Bun.sleep(120);
      try {
        console.log((await build()) ? "rebuilt" : "rebuild failed");
      } catch (cause) {
        console.error("rebuild failed:", cause);
      }
    } while (pending);
  } finally {
    rebuilding = false;
  }
};

for await (const _event of watch("src", { recursive: true })) {
  if (rebuilding) {
    pending = true;
    continue;
  }
  void rebuildUntilQuiet();
}
