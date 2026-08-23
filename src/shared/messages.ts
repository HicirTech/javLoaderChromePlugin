/** The extension's only message. `runtime.sendMessage` broadcasts to every
 *  context, so the popup pulls per tab rather than anyone pushing. */

import type { PageMagnets } from "./types";

export const COLLECT_MAGNETS = "collect-magnets" as const;

export interface CollectRequest {
  readonly type: typeof COLLECT_MAGNETS;
}

export type CollectResponse =
  | { readonly ok: true; readonly page: PageMagnets }
  | { readonly ok: false; readonly error: string };

export const collectRequest: CollectRequest = { type: COLLECT_MAGNETS };

export const isCollectRequest = (value: unknown): value is CollectRequest =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === COLLECT_MAGNETS;

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/** Ask one tab for its magnets. A tab with no content script is a failed reply, not a throw. */
export const requestMagnets = async (tabId: number): Promise<CollectResponse> => {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, collectRequest);
    if (
      typeof response === "object" &&
      response !== null &&
      typeof (response as { ok?: unknown }).ok === "boolean"
    ) {
      return response as CollectResponse;
    }
    return { ok: false, error: "The page returned an unrecognised response." };
  } catch (cause) {
    return {
      ok: false,
      error:
        cause instanceof Error && cause.message.includes("Receiving end does not exist")
          ? "No content script in this tab. Reload the page and try again."
          : describe(cause),
    };
  }
};
