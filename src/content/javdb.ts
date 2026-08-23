/** Reads the magnet table off a javdb video page. Every site-specific selector is
 *  in SELECTORS, pinned by saved pages in tests/fixtures/. Fields degrade
 *  independently; a structured pass that finds nothing falls back to loose anchors. */

import {
  displayName,
  formatCompactDate,
  infoHash,
  parseCount,
  parseSize,
} from "../shared/format";
import type { Magnet, PageMagnets } from "../shared/types";

const SELECTORS = {
  /** In preference order. `#magnets` is an ANCESTOR of `#magnets-content`, so a
   *  comma list would match both and read every row twice. */
  magnetList: ["#magnets-content", "#magnets"],
  magnetRow: ".item",
  magnetLink: 'a[href^="magnet:"]',
  magnetName: ".name",
  magnetMeta: ".meta",
  /** Scoped: the download-help modal on every page uses `.tag` for a yes/no table. */
  magnetTag: ".tags .tag",
  /** In preference order. */
  magnetDate: [".time", ".date"],
  panelBlock: ".panel-block",
  panelLabel: "strong",
  panelValue: ".value",
  /** Holds the title alone, without the code. */
  title: [".current-title", "h2.title"],
} as const;

/** Row attributes. Exact and language-independent; the rendered text is not. */
const ROW_DATA = { size: "data-size", files: "data-files", date: "data-date" } as const;

/** The unit of `data-size`. */
const MIB = 1024 * 1024;

/** Labels javdb uses for the video code across its language settings. */
const CODE_LABELS = ["番號", "番号", "id", "code"];

const VIDEO_PATH = /^\/v\//;

export const isVideoPage = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("javdb.com") && VIDEO_PATH.test(parsed.pathname);
  } catch {
    return false;
  }
};

const text = (node: Element | null | undefined): string => node?.textContent?.trim() ?? "";

/** First match by list order. `querySelector` would return document order instead. */
const firstMatch = (root: ParentNode, selectors: readonly string[]): Element | null => {
  for (const selector of selectors) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
  return null;
};

const leadingCode = (value: string): string =>
  /^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)/.exec(value)?.[1] ?? "";

/**
 * The video code. The panel is authoritative; the document title is next because
 * javdb writes it as "CODE Title | JavDB", while the heading has no code at all.
 */
export const readCode = (doc: Document): string => {
  for (const block of doc.querySelectorAll(SELECTORS.panelBlock)) {
    const label = text(block.querySelector(SELECTORS.panelLabel))
      .replace(/[:：]/g, "")
      .trim()
      .toLowerCase();
    if (!CODE_LABELS.includes(label)) continue;

    const value = text(block.querySelector(SELECTORS.panelValue));
    if (value) return value;
  }

  return leadingCode(doc.title.trim()) || leadingCode(text(firstMatch(doc, SELECTORS.title)));
};

/** The title without the code or the site suffix. */
export const readTitle = (doc: Document): string => {
  const heading = text(firstMatch(doc, SELECTORS.title));
  if (heading) return heading;

  const documentTitle = doc.title.trim();
  const withoutSite = documentTitle.split(" | ")[0] ?? documentTitle;
  const code = leadingCode(withoutSite);
  return code ? withoutSite.slice(code.length).trim() : withoutSite;
};

/** Last resort file count. Wording follows the site language, so give up rather than guess. */
const parseFileCount = (meta: string): number | null => {
  const match = /(\d+)\s*(?:個文件|个文件|files?|檔案)/i.exec(meta);
  return match ? parseCount(match[1]) : null;
};

const dedupe = (values: readonly string[]): string[] => [...new Set(values)];

const readRow = (row: Element): Magnet | null => {
  const anchor = row.querySelector<HTMLAnchorElement>(SELECTORS.magnetLink);
  // getAttribute, not .href: the URL parser re-encodes spaces and non-ASCII in `dn`.
  const uri = anchor?.getAttribute("href") ?? "";
  if (!uri.startsWith("magnet:")) return null;

  const meta = text(row.querySelector(SELECTORS.magnetMeta));
  const tags = [...row.querySelectorAll(SELECTORS.magnetTag)]
    .map((tag) => text(tag))
    .filter((label) => label.length > 0);

  const sizeMib = parseCount(row.getAttribute(ROW_DATA.size));
  const date = formatCompactDate(row.getAttribute(ROW_DATA.date));

  return {
    id: infoHash(uri) ?? uri,
    uri,
    name: text(row.querySelector(SELECTORS.magnetName)) || text(anchor) || displayName(uri) || uri,
    sizeBytes: sizeMib !== null ? sizeMib * MIB : parseSize(meta),
    sizeText: meta,
    fileCount: parseCount(row.getAttribute(ROW_DATA.files)) ?? parseFileCount(meta),
    tags: dedupe(tags),
    dateText: date || text(firstMatch(row, SELECTORS.magnetDate)),
  };
};

/** Fallback when the structured pass finds nothing: only the name is recoverable. */
const readLooseAnchors = (doc: Document): Magnet[] => {
  const magnets: Magnet[] = [];
  for (const anchor of doc.querySelectorAll<HTMLAnchorElement>(SELECTORS.magnetLink)) {
    const uri = anchor.getAttribute("href") ?? "";
    if (!uri.startsWith("magnet:")) continue;
    magnets.push({
      id: infoHash(uri) ?? uri,
      uri,
      name: text(anchor) || displayName(uri) || uri,
      sizeBytes: null,
      sizeText: "",
      fileCount: null,
      tags: [],
      dateText: "",
    });
  }
  return magnets;
};

/** Drop repeats, keep page order. Identity is the info hash, so tracker lists may differ. */
const dedupeMagnets = (magnets: readonly Magnet[]): Magnet[] => {
  const seen = new Set<string>();
  const unique: Magnet[] = [];
  for (const magnet of magnets) {
    if (seen.has(magnet.id)) continue;
    seen.add(magnet.id);
    unique.push(magnet);
  }
  return unique;
};

export const parsePage = (doc: Document, url: string): PageMagnets => {
  const rows: Magnet[] = [];
  const list = firstMatch(doc, SELECTORS.magnetList);
  if (list) {
    for (const row of list.querySelectorAll(SELECTORS.magnetRow)) {
      const magnet = readRow(row);
      if (magnet) rows.push(magnet);
    }
  }

  return {
    code: readCode(doc),
    title: readTitle(doc),
    url,
    magnets: dedupeMagnets(rows.length > 0 ? rows : readLooseAnchors(doc)),
  };
};
