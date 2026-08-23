import { describe, expect, test } from "bun:test";

import { originPattern, validateEndpoint } from "../src/shared/settings";

describe("validateEndpoint", () => {
  test("accepts an http or https JSON-RPC URL", () => {
    expect(validateEndpoint("http://192.168.1.10:6800/jsonrpc")).toBeNull();
    expect(validateEndpoint("https://aria2.lan/jsonrpc")).toBeNull();
    expect(validateEndpoint("  http://host:6800/jsonrpc  ")).toBeNull();
  });

  test("rejects anything that is not a reachable web URL", () => {
    expect(validateEndpoint("")).not.toBeNull();
    expect(validateEndpoint("192.168.1.10:6800")).not.toBeNull();
    expect(validateEndpoint("ws://192.168.1.10:6800/jsonrpc")).not.toBeNull();
    expect(validateEndpoint("file:///etc/passwd")).not.toBeNull();
  });
});

describe("originPattern", () => {
  test("reduces an endpoint to the host permission it needs", () => {
    expect(originPattern("http://192.168.1.10:6800/jsonrpc")).toBe(
      "http://192.168.1.10:6800/*",
    );
    expect(originPattern("https://aria2.lan/rpc/path")).toBe("https://aria2.lan/*");
  });

  test("returns null for an unparseable endpoint", () => {
    expect(originPattern("not a url")).toBeNull();
  });
});
