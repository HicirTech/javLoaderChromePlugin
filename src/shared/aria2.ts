/** aria2 JSON-RPC client. `addUri` takes a mirror list for ONE resource, so a
 *  magnet must be its only element -- extras are discarded silently. One call each. */

import type { Aria2Settings, Magnet, SubmitOutcome } from "./types";

const TIMEOUT_MS = 15_000;

let callCounter = 0;

interface RpcSuccess {
  readonly result: unknown;
}

interface RpcFailure {
  readonly error: { readonly code?: number; readonly message?: string };
}

const nextId = (): string => {
  callCounter += 1;
  return `avloader-${callCounter}`;
};

/** aria2 rejects the token parameter when the daemon has no secret, so omit it. */
const withSecret = (secret: string, params: readonly unknown[]): unknown[] => {
  const trimmed = secret.trim();
  return trimmed ? [`token:${trimmed}`, ...params] : [...params];
};

const unreachable = (endpoint: string, cause: unknown): string => {
  if (cause instanceof DOMException && cause.name === "TimeoutError") {
    return `${endpoint} did not respond within ${TIMEOUT_MS / 1000} seconds.`;
  }
  // A missing permission, a stopped daemon and a wrong port are one opaque
  // network failure at this layer.
  return `Could not reach ${endpoint}. Check that aria2 is running, that the URL is correct, and that the extension has permission for this host.`;
};

const call = async (
  settings: Aria2Settings,
  method: string,
  params: readonly unknown[],
): Promise<unknown> => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: nextId(),
    method,
    params: withSecret(settings.secret, params),
  });

  let response: Response;
  try {
    response = await fetch(settings.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new Error(unreachable(settings.endpoint, cause));
  }

  // fetch settles on headers, so a timeout after them rejects here instead.
  let text: string;
  try {
    text = await response.text();
  } catch (cause) {
    throw new Error(unreachable(settings.endpoint, cause));
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      response.ok
        ? `The endpoint returned a non-JSON body. Check that ${settings.endpoint} is the JSON-RPC path.`
        : `HTTP ${response.status} from ${settings.endpoint}.`,
    );
  }

  // Parse before branching on status: the daemon's own message is the only
  // useful diagnosis, and it arrives with either a 200 or a 401 depending on build.
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const { error } = payload as RpcFailure;
    throw new Error(error?.message ?? `aria2 reported error code ${error?.code ?? "unknown"}.`);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status} from ${settings.endpoint}.`);

  // Without this a body like {"jsonrpc":"2.0","id":"x"} reads as undefined and
  // is reported as a queued download with no GID.
  if (typeof payload !== "object" || payload === null || !("result" in payload)) {
    throw new Error(
      `${settings.endpoint} answered without a JSON-RPC result. Check that this URL is the aria2 JSON-RPC path.`,
    );
  }

  return (payload as RpcSuccess).result;
};

/** The daemon's version. Used to test a connection. */
export const probeVersion = async (settings: Aria2Settings): Promise<string> => {
  const result = await call(settings, "aria2.getVersion", []);
  if (typeof result === "object" && result !== null) {
    const version = (result as { version?: unknown }).version;
    if (typeof version === "string") return version;
  }
  return "unknown";
};

/** One addUri each, in order, so aria2's queue matches the popup. Failures do not stop the rest. */
export const submitMagnets = async (
  settings: Aria2Settings,
  magnets: readonly Magnet[],
): Promise<SubmitOutcome[]> => {
  const outcomes: SubmitOutcome[] = [];

  for (const magnet of magnets) {
    try {
      const result = await call(settings, "aria2.addUri", [[magnet.uri]]);
      outcomes.push({
        magnetId: magnet.id,
        name: magnet.name,
        ok: true,
        gid: typeof result === "string" ? result : null,
        error: null,
      });
    } catch (cause) {
      outcomes.push({
        magnetId: magnet.id,
        name: magnet.name,
        ok: false,
        gid: null,
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
  }

  return outcomes;
};
