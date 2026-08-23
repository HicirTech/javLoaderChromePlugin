import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { probeVersion, submitMagnets } from "../src/shared/aria2";
import type { Aria2Settings, Magnet } from "../src/shared/types";

interface Capture {
  readonly url: string;
  readonly body: { method: string; params: unknown[] };
}

const originalFetch = globalThis.fetch;
let calls: Capture[] = [];

const magnet = (name: string, hash: string): Magnet => {
  return {
    id: hash,
    uri: `magnet:?xt=urn:btih:${hash}&dn=${name}`,
    name,
    sizeBytes: null,
    sizeText: "",
    fileCount: null,
    tags: [],
    dateText: "",
  };
};

const respondWith = (handler: (body: Capture["body"]) => unknown): void => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Capture["body"];
    calls.push({ url: String(input), body });
    return new Response(JSON.stringify(handler(body)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
};

const settings: Aria2Settings = {
  endpoint: "http://192.168.10.102:6800/jsonrpc",
  secret: "s3cret",
};

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("submitMagnets", () => {
  test("issues one addUri per magnet, each carrying exactly one URI", async () => {
    respondWith(() => ({ jsonrpc: "2.0", id: "x", result: "gid-1" }));

    const magnets = [magnet("first", "aa"), magnet("second", "bb"), magnet("third", "cc")];
    const outcomes = await submitMagnets(settings, magnets);

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.body.method).toBe("aria2.addUri");
      // params = [token, uris]; the uris array is a mirror list for ONE resource,
      // so more than one element here would silently discard downloads.
      const uris = call.body.params[1];
      expect(Array.isArray(uris)).toBe(true);
      expect(uris as unknown[]).toHaveLength(1);
    }
    expect(calls.map((call) => (call.body.params[1] as string[])[0])).toEqual(
      magnets.map((item) => item.uri),
    );
    expect(outcomes.every((outcome) => outcome.ok)).toBe(true);
  });

  test("prefixes the secret with token: and puts it first", async () => {
    respondWith(() => ({ result: "gid" }));
    await submitMagnets(settings, [magnet("only", "aa")]);
    expect(calls[0]?.body.params[0]).toBe("token:s3cret");
  });

  test("omits the secret parameter entirely when none is configured", async () => {
    respondWith(() => ({ result: "gid" }));
    await submitMagnets({ ...settings, secret: "  " }, [magnet("only", "aa")]);
    expect(calls[0]?.body.params).toHaveLength(1);
    expect(Array.isArray(calls[0]?.body.params[0])).toBe(true);
  });

  test("reports a per-magnet failure without abandoning the rest", async () => {
    respondWith((body) => {
      const uris = body.params[1] as string[];
      return uris[0]?.includes("bb")
        ? { error: { code: 1, message: "Duplicate download" } }
        : { result: "gid-ok" };
    });

    const outcomes = await submitMagnets(settings, [
      magnet("first", "aa"),
      magnet("second", "bb"),
      magnet("third", "cc"),
    ]);

    expect(outcomes.map((outcome) => outcome.ok)).toEqual([true, false, true]);
    expect(outcomes[1]?.error).toBe("Duplicate download");
    expect(outcomes[1]?.name).toBe("second");
    expect(calls).toHaveLength(3);
  });

  test("keeps the transport wording when the body read fails, not just the fetch", async () => {
    // fetch settles on headers; a timeout or dropped connection after them
    // rejects response.text() instead, which must reach the same diagnosis.
    globalThis.fetch = (async () =>
      ({
        ok: true,
        status: 200,
        text: () => Promise.reject(new DOMException("signal timed out", "TimeoutError")),
      }) as unknown as Response) as unknown as typeof fetch;

    const outcomes = await submitMagnets(settings, [magnet("only", "aa")]);
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.error).toContain("did not respond within");
  });

  test("treats a 200 with no result member as a failure, not a queued download", async () => {
    respondWith(() => ({ jsonrpc: "2.0", id: "x" }));
    const outcomes = await submitMagnets(settings, [magnet("only", "aa")]);
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.error).toContain("without a JSON-RPC result");
  });

  test("treats a non-object JSON body as a failure", async () => {
    respondWith(() => "ok");
    const outcomes = await submitMagnets(settings, [magnet("only", "aa")]);
    expect(outcomes[0]?.ok).toBe(false);
  });

  test("surfaces the daemon's message when the transport fails", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcomes = await submitMagnets(settings, [magnet("only", "aa")]);
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.error).toContain("Could not reach");
  });
});

describe("probeVersion", () => {
  test("returns the version string aria2 reports", async () => {
    respondWith(() => ({ result: { version: "1.37.0", enabledFeatures: [] } }));
    expect(await probeVersion(settings)).toBe("1.37.0");
    expect(calls[0]?.body.method).toBe("aria2.getVersion");
  });

  test("throws with the daemon's own wording on an RPC error", async () => {
    respondWith(() => ({ error: { code: 1, message: "Unauthorized" } }));
    expect(probeVersion(settings)).rejects.toThrow("Unauthorized");
  });
});
