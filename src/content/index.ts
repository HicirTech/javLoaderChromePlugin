/** Answers the popup's request. No state, no pushing, no observers -- reading the
 *  live DOM on demand is why a closed tab needs no cleanup. */

import { isCollectRequest, type CollectResponse } from "../shared/messages";
import { isVideoPage, parsePage } from "./javdb";

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isCollectRequest(message)) return false;

  let response: CollectResponse;
  try {
    response = isVideoPage(location.href)
      ? { ok: true, page: parsePage(document, location.href) }
      : { ok: false, error: "This tab is not a javdb video page." };
  } catch (cause) {
    response = {
      ok: false,
      error: `Could not read this page: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }

  sendResponse(response);
  // Already replied, so the channel need not stay open.
  return false;
});
