import { describe, expect, test } from "bun:test";

import {
  displayName,
  formatCompactDate,
  formatSize,
  infoHash,
  parseCount,
  parseSize,
} from "../src/shared/format";

describe("parseSize", () => {
  test("reads the binary units javdb writes", () => {
    expect(parseSize("5.21GB")).toBe(Math.round(5.21 * 1024 ** 3));
    expect(parseSize("700 MB")).toBe(700 * 1024 ** 2);
    expect(parseSize("1.5TB")).toBe(Math.round(1.5 * 1024 ** 4));
  });

  test("tolerates the surrounding text of a real row", () => {
    expect(parseSize("5.21GB, 3 files")).toBe(Math.round(5.21 * 1024 ** 3));
    expect(parseSize("1,024MB")).toBe(1024 * 1024 ** 2);
  });

  test("returns null rather than guessing", () => {
    expect(parseSize("")).toBeNull();
    expect(parseSize("three gigabytes")).toBeNull();
    expect(parseSize("GB")).toBeNull();
  });
});

describe("formatSize", () => {
  test("renders two decimals in the largest fitting unit", () => {
    expect(formatSize(5 * 1024 ** 3)).toBe("5.00 GB");
    expect(formatSize(1536)).toBe("1.50 KB");
    expect(formatSize(512)).toBe("512 B");
  });

  test("renders nothing for an absent size", () => {
    expect(formatSize(null)).toBe("");
    expect(formatSize(Number.NaN)).toBe("");
  });
});

describe("infoHash", () => {
  test("reads both the hex and base32 forms, lower-cased", () => {
    const hex = "8F4D0C1E2A3B4C5D6E7F80910A1B2C3D4E5F6071";
    expect(infoHash(`magnet:?xt=urn:btih:${hex}&dn=x`)).toBe(hex.toLowerCase());
    expect(infoHash("magnet:?xt=urn:btih:MFRGGZDFMZTWQ2LKNNWG23TPOA")).toBe(
      "mfrggzdfmztwq2lknnwg23tpoa",
    );
  });

  test("returns null when the URI carries no hash", () => {
    expect(infoHash("magnet:?dn=nothing")).toBeNull();
  });
});

describe("displayName", () => {
  test("decodes percent escapes and plus-encoded spaces", () => {
    expect(displayName("magnet:?xt=urn:btih:aa&dn=SSIS-123%20FHD")).toBe("SSIS-123 FHD");
    expect(displayName("magnet:?dn=SSIS+123")).toBe("SSIS 123");
  });

  test("falls back to the raw value on a broken encoding", () => {
    expect(displayName("magnet:?dn=100%")).toBe("100%");
  });

  test("returns an empty string when there is no name", () => {
    expect(displayName("magnet:?xt=urn:btih:aa")).toBe("");
  });
});

describe("parseCount", () => {
  test("reads javdb's data-files and data-size attributes", () => {
    expect(parseCount("5936")).toBe(5936);
    expect(parseCount("0")).toBe(0);
  });

  test("rejects anything that is not a non-negative integer", () => {
    expect(parseCount(null)).toBeNull();
    expect(parseCount("")).toBeNull();
    expect(parseCount("5.5")).toBeNull();
    expect(parseCount("-1")).toBeNull();
    expect(parseCount("many")).toBeNull();
  });
});

describe("formatCompactDate", () => {
  test("expands javdb's data-date form", () => {
    expect(formatCompactDate("20260822")).toBe("2026-08-22");
  });

  test("returns an empty string for anything that is not eight digits", () => {
    expect(formatCompactDate(null)).toBe("");
    expect(formatCompactDate("2026-08-22")).toBe("");
    expect(formatCompactDate("202608")).toBe("");
  });
});
