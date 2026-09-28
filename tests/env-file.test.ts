import { describe, expect, test } from "bun:test";

import { patchEnv } from "../src/shared/envFile";

const COOKIE = "list_mode=h; over18=1; cf_clearance=aB.cD-eF_1234%2F5+6=";

describe("patchEnv", () => {
  test("replaces the value and leaves the rest of the file untouched", () => {
    const before = [
      "# The library folder.",
      "TARGET_PATH=Z:\\Garage",
      "",
      "JAVDB_COOKIE=stale",
      "FETCH_DELAY_MS=5000",
      "",
    ].join("\n");

    expect(patchEnv(before, "JAVDB_COOKIE", COOKIE)).toBe(
      before.replace("JAVDB_COOKIE=stale", `JAVDB_COOKIE=${COOKIE}`),
    );
  });

  test("appends the key when the file does not have it", () => {
    expect(patchEnv("TARGET_PATH=Z:\\Garage\n", "JAVDB_COOKIE", COOKIE)).toBe(
      `TARGET_PATH=Z:\\Garage\nJAVDB_COOKIE=${COOKIE}\n`,
    );
  });

  test("writes into an empty file", () => {
    expect(patchEnv("", "JAVDB_COOKIE", "x")).toBe("JAVDB_COOKIE=x\n");
  });

  test("keeps CRLF endings, since the file is edited on Windows", () => {
    const before = "TARGET_PATH=Z:\\Garage\r\nJAVDB_COOKIE=stale\r\n";
    expect(patchEnv(before, "JAVDB_COOKIE", "fresh")).toBe(
      "TARGET_PATH=Z:\\Garage\r\nJAVDB_COOKIE=fresh\r\n",
    );
    expect(patchEnv("TARGET_PATH=x\r\n", "JAVDB_COOKIE", "fresh")).toBe(
      "TARGET_PATH=x\r\nJAVDB_COOKIE=fresh\r\n",
    );
  });

  test("finds the key through indentation and an export prefix", () => {
    expect(patchEnv("  export JAVDB_COOKIE=stale\n", "JAVDB_COOKIE", "fresh")).toBe(
      "JAVDB_COOKIE=fresh\n",
    );
  });

  test("replaces a stale duplicate too, so the wrong one cannot win", () => {
    const before = "JAVDB_COOKIE=one\nOTHER=x\nJAVDB_COOKIE=two\n";
    expect(patchEnv(before, "JAVDB_COOKIE", "fresh")).toBe(
      "JAVDB_COOKIE=fresh\nOTHER=x\nJAVDB_COOKIE=fresh\n",
    );
  });

  test("does not touch a key that merely starts the same way", () => {
    const before = "JAVDB_COOKIE_BACKUP=keep\nJAVDB_COOKIE=stale\n";
    expect(patchEnv(before, "JAVDB_COOKIE", "fresh")).toBe(
      "JAVDB_COOKIE_BACKUP=keep\nJAVDB_COOKIE=fresh\n",
    );
  });

  test("writes a value containing regexp replacement syntax verbatim", () => {
    expect(patchEnv("K=old\n", "K", "a$&b$1c")).toBe("K=a$&b$1c\n");
  });

  test("refuses a value with a line break rather than corrupting the file", () => {
    expect(() => patchEnv("K=old\n", "K", "a\nB=evil")).toThrow(/line break/);
  });
});
