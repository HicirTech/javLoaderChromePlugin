/** aria2 connection details. Stored local, not sync: a LAN credential must not leave the machine. */

import type { Aria2Settings } from "./types";

const STORAGE_KEY = "aria2Settings";

/** Shipped default, and the one origin granted statically in the manifest. */
export const DEFAULT_ENDPOINT = "http://192.168.10.102:6800/jsonrpc";

export const DEFAULT_SETTINGS: Aria2Settings = { endpoint: DEFAULT_ENDPOINT, secret: "" };

export const loadSettings = async (): Promise<Aria2Settings> => {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value: unknown = stored[STORAGE_KEY];
  if (typeof value !== "object" || value === null) return DEFAULT_SETTINGS;

  const candidate = value as Partial<Aria2Settings>;
  return {
    endpoint:
      typeof candidate.endpoint === "string" && candidate.endpoint.trim()
        ? candidate.endpoint.trim()
        : DEFAULT_ENDPOINT,
    secret: typeof candidate.secret === "string" ? candidate.secret : "",
  };
};

export const saveSettings = async (settings: Aria2Settings): Promise<void> => {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { endpoint: settings.endpoint.trim(), secret: settings.secret },
  });
};

/** Null when valid, otherwise the reason. */
export const validateEndpoint = (endpoint: string): string | null => {
  const trimmed = endpoint.trim();
  if (!trimmed) return "Enter the aria2 JSON-RPC URL.";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "That is not a valid URL.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "The URL must start with http:// or https://.";
  }
  return null;
};

/** The host permission pattern covering an endpoint. */
export const originPattern = (endpoint: string): string | null => {
  try {
    return `${new URL(endpoint).origin}/*`;
  } catch {
    return null;
  }
};

export const hasEndpointPermission = async (endpoint: string): Promise<boolean> => {
  const pattern = originPattern(endpoint);
  return pattern ? chrome.permissions.contains({ origins: [pattern] }) : false;
};

/** Must be the first await in a click handler: Chrome spends the activation on it.
 *  No `contains` pre-check -- `request` resolves true without prompting if held. */
export const requestEndpointPermission = async (endpoint: string): Promise<boolean> => {
  const pattern = originPattern(endpoint);
  return pattern ? chrome.permissions.request({ origins: [pattern] }) : false;
};
