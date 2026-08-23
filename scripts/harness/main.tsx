/** Renders the real popup against fixture data, for the README screenshots. */

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { createRoot } from "react-dom/client";

import { App } from "../../src/popup/App";
import { theme } from "../../src/popup/theme";
import type { MovieSource } from "../../src/shared/types";

declare const FIXTURE_SOURCES: readonly MovieSource[];
declare const HARNESS_STATE: string;

const tabs = FIXTURE_SOURCES.map((source) => ({
  id: source.tabId,
  url: source.url,
  title: `${source.code} ${source.title}`,
}));

const store: Record<string, unknown> = {
  aria2Settings: { endpoint: "http://192.168.10.102:6800/jsonrpc", secret: "shown-as-dots" },
};

(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    query: async () => tabs,
    sendMessage: async (tabId: number) => {
      const source = FIXTURE_SOURCES.find((candidate) => candidate.tabId === tabId);
      return source ? { ok: true, page: source } : { ok: false, error: "not found" };
    },
  },
  storage: {
    local: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (patch: Record<string, unknown>) => Object.assign(store, patch),
    },
  },
  permissions: {
    contains: async () => true,
    request: async () => true,
  },
};

let gid = 0;
globalThis.fetch = (async () => {
  gid += 1;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: "x", result: `2089b05ecca3d8${gid}9` }), {
    headers: { "Content-Type": "application/json" },
  });
}) as unknown as typeof fetch;

const container = document.getElementById("root");
if (!container) throw new Error("harness.html is missing #root");

createRoot(container).render(
  <ThemeProvider theme={theme} defaultMode="system">
    <CssBaseline />
    <App />
  </ThemeProvider>,
);

const until = async <T,>(find: () => T | null | undefined): Promise<T> => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const found = find();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error("harness: element never appeared");
};

const byText = (selector: string, text: string): HTMLElement | null =>
  [...document.querySelectorAll<HTMLElement>(selector)].find((node) =>
    node.textContent?.includes(text),
  ) ?? null;

/** Enabled only once the selection effect has run, which is what makes it clickable. */
const enabledButton = (text: string): HTMLButtonElement | null => {
  const found = byText("button", text);
  return found instanceof HTMLButtonElement && !found.disabled ? found : null;
};

const drive = async (): Promise<void> => {
  await until(() => document.querySelector(".MuiPaper-root"));

  if (HARNESS_STATE === "expanded") {
    (await until(() => byText("button", "+"))).click();
  }
  if (HARNESS_STATE === "settings") {
    (await until(() => document.querySelector<HTMLElement>('[aria-label="Settings"]'))).click();
  }
  if (HARNESS_STATE === "sent") {
    (await until(() => enabledButton("Send to aria2"))).click();
    await until(() => byText("div", "aria2 accepted"));
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
  // The screenshot pass reads this to size the window to the rendered popup.
  const panel = document.querySelector("#root > div");
  document.title = `ready:${Math.ceil(panel?.getBoundingClientRect().height ?? 0)}`;
};

void drive();
