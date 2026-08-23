import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isVideoPage, parsePage, readCode, readTitle } from "../src/content/javdb";
import type { PageMagnets } from "../src/shared/types";

const PAGE_URL = "https://javdb.com/v/4DEE4p";
const MIB = 1024 * 1024;

/** A whole javdb page saved from a browser. See tests/fixtures/README.md. */
const fixture = (name: string): Document => {
  const html = readFileSync(join(import.meta.dir, "fixtures", `${name}.html`), "utf8");
  const window = new Window({ url: PAGE_URL });
  window.document.write(html);
  return window.document as unknown as Document;
};

/** A document built from a fragment, for the degradation paths no fixture shows. */
const fragment = (html: string): Document => {
  const window = new Window({ url: PAGE_URL });
  window.document.body.innerHTML = html;
  return window.document as unknown as Document;
};

const parseFixture = (name: string): PageMagnets => {
  return parsePage(fixture(name), PAGE_URL);
};

describe("isVideoPage", () => {
  test("accepts javdb video paths only", () => {
    expect(isVideoPage("https://javdb.com/v/aBcDe")).toBe(true);
    expect(isVideoPage("https://javdb.com/search?q=x")).toBe(false);
    expect(isVideoPage("https://example.com/v/aBcDe")).toBe(false);
    expect(isVideoPage("not a url")).toBe(false);
  });
});

describe("against saved javdb pages", () => {
  test("reads a single-magnet page whole", () => {
    const page = parseFixture("nykd-145");

    expect(page.code).toBe("NYKD-145");
    expect(page.title).toBe("還暦で初撮り 石川桃子");
    expect(page.magnets).toHaveLength(1);

    const magnet = page.magnets[0];
    expect(magnet?.id).toBe("3694ed8b120da23f23415ae04f58b9a17fdf8a2f");
    expect(magnet?.uri).toBe(
      "magnet:?xt=urn:btih:3694ed8b120da23f23415ae04f58b9a17fdf8a2f&dn=[javdb.com]NYKD-145",
    );
    expect(magnet?.name).toBe("NYKD-145");
    // From data-size="5936", which is MiB, not from the "5.80GB" text.
    expect(magnet?.sizeBytes).toBe(5936 * MIB);
    expect(magnet?.fileCount).toBe(5);
    expect(magnet?.tags).toEqual(["高清"]);
    expect(magnet?.dateText).toBe("2026-08-22");
  });

  test("reads several magnets in page order, tags and all", () => {
    const page = parseFixture("jur-100");

    expect(page.code).toBe("JUR-100");
    expect(page.magnets).toHaveLength(3);

    // Page order is the selection model: the first row is what gets sent unless
    // the user picks another.
    expect(page.magnets.map((magnet) => magnet.sizeBytes)).toEqual([
      4594 * MIB,
      1316 * MIB,
      1189 * MIB,
    ]);
    expect(page.magnets.map((magnet) => magnet.fileCount)).toEqual([2, 2, 3]);
    expect(page.magnets.map((magnet) => magnet.tags)).toEqual([["高清"], [], []]);
  });

  test("every magnet of a movie carries the same name, so size is what distinguishes them", () => {
    const page = parseFixture("madv-641");

    expect(page.magnets.map((magnet) => magnet.name)).toEqual([
      "MADV-641",
      "MADV-641",
      "MADV-641",
    ]);
    expect(new Set(page.magnets.map((magnet) => magnet.id)).size).toBe(3);
    expect(page.magnets.map((magnet) => magnet.dateText)).toEqual([
      "2026-08-21",
      "2026-08-22",
      "2026-08-21",
    ]);
  });

  test("does not read rows twice even though #magnets wraps #magnets-content", () => {
    const doc = fixture("madv-641");
    // Both containers really are present, and one contains the other.
    expect(doc.querySelector("#magnets")).not.toBeNull();
    expect(doc.querySelector("#magnets #magnets-content")).not.toBeNull();

    // Three rows in the markup, three magnets out -- not six collapsed by dedupe.
    expect(doc.querySelectorAll("#magnets-content .item").length).toBe(3);
    expect(parsePage(doc, PAGE_URL).magnets).toHaveLength(3);
  });

  test("does not pick up tag elements from the download-help modal", () => {
    const doc = fixture("tcd-343");
    // The help modal on every page uses the same .tag class for a yes/no table.
    expect(doc.body.textContent).toContain("如何通過磁鏈下載影片");

    const page = parsePage(doc, PAGE_URL);
    expect(page.magnets[0]?.tags).toEqual(["高清"]);
    for (const magnet of page.magnets) {
      expect(magnet.tags).not.toContain("是");
      expect(magnet.tags).not.toContain("否");
    }
  });

  test("reads the code from the detail panel, where it is split across an anchor", () => {
    // The markup is <span class="value"><a>TCD</a>-343</span>.
    expect(readCode(fixture("tcd-343"))).toBe("TCD-343");
  });

  test("reads the title without the code or the site suffix", () => {
    const doc = fixture("tcd-343");
    expect(doc.title).toContain("JavDB");
    expect(readTitle(doc)).toBe("オトコノ娘・媚薬ガンギマリSEX vol.3 来栖らいら");
  });
});

describe("readCode fallbacks", () => {
  test("falls back to the document title, which javdb writes as CODE Title", () => {
    const window = new Window({ url: PAGE_URL });
    window.document.title = "MIDV-456 A Title | JavDB";
    expect(readCode(window.document as unknown as Document)).toBe("MIDV-456");
  });

  test("returns an empty string rather than throwing when nothing is there", () => {
    expect(readCode(fragment(""))).toBe("");
  });
});

describe("degradation", () => {
  test("falls back to loose anchors when the magnet table is absent", () => {
    const page = parsePage(
      fragment(`<div class="something-else">
        <a href="magnet:?xt=urn:btih:DDDD4444&amp;dn=Fallback%20Name">click</a>
      </div>`),
      PAGE_URL,
    );

    expect(page.magnets).toHaveLength(1);
    expect(page.magnets[0]?.name).toBe("click");
    expect(page.magnets[0]?.sizeBytes).toBeNull();
    expect(page.magnets[0]?.fileCount).toBeNull();
  });

  test("names a fallback magnet from its dn parameter when the anchor has no text", () => {
    const page = parsePage(
      fragment(`<a href="magnet:?xt=urn:btih:EEEE5555&amp;dn=From%20Dn"></a>`),
      PAGE_URL,
    );
    expect(page.magnets[0]?.name).toBe("From Dn");
  });

  test("reads size and file count from the rendered text when the attributes are gone", () => {
    const page = parsePage(
      fragment(`<div id="magnets-content"><div class="item">
        <a href="magnet:?xt=urn:btih:AAAA1111"><span class="name">n</span>
          <span class="meta">5.21GB, 3個文件</span></a>
        <span class="time">2026-01-16</span>
      </div></div>`),
      PAGE_URL,
    );

    expect(page.magnets[0]?.sizeBytes).toBe(Math.round(5.21 * 1024 ** 3));
    expect(page.magnets[0]?.fileCount).toBe(3);
    expect(page.magnets[0]?.dateText).toBe("2026-01-16");
  });

  test("keeps the page's own URI bytes rather than a re-serialised form", () => {
    const page = parsePage(
      fragment(`<div id="magnets-content"><div class="item">
        <a href="magnet:?xt=urn:btih:CCCC3333&amp;dn=A B C"><span class="name">spaced</span></a>
      </div></div>`),
      PAGE_URL,
    );
    expect(page.magnets[0]?.uri).toBe("magnet:?xt=urn:btih:CCCC3333&dn=A B C");
  });

  test("collapses the same torrent listed twice, keeping the first occurrence", () => {
    const page = parsePage(
      fragment(`<div id="magnets-content">
        <div class="item"><a href="magnet:?xt=urn:btih:FFFF6666"><span class="name">first</span></a></div>
        <div class="item"><a href="magnet:?xt=urn:btih:ffff6666&amp;tr=udp://x"><span class="name">second</span></a></div>
      </div>`),
      PAGE_URL,
    );

    expect(page.magnets).toHaveLength(1);
    expect(page.magnets[0]?.name).toBe("first");
  });

  test("returns an empty list, not an error, for a page with no magnets", () => {
    expect(parsePage(fragment(`<div id="magnets-content"></div>`), PAGE_URL).magnets).toEqual([]);
  });
});
