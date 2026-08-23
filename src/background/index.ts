/** The toolbar badge, and nothing else. Recomputed per event, never accumulated,
 *  so eviction loses nothing. No timer: an MV3 worker dies after ~30s idle. */

import { isVideoPage } from "../content/javdb";

const BADGE_COLOUR = "#37474f";

const refreshBadge = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: "https://javdb.com/v/*" });
  const count = tabs.filter((tab) => typeof tab.url === "string" && isVideoPage(tab.url)).length;

  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOUR });
  await chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
};

const refresh = (): void => {
  void refreshBadge();
};

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.tabs.onCreated.addListener(refresh);
chrome.tabs.onRemoved.addListener(refresh);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url !== undefined || changeInfo.status === "complete") refresh();
});

refresh();
