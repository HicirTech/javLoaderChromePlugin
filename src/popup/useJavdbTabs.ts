import { useCallback, useEffect, useState } from "react";

import { requestMagnets } from "../shared/messages";
import type { MovieSource, UnreadableTab } from "../shared/types";

export interface TabScan {
  readonly sources: readonly MovieSource[];
  readonly unreadable: readonly UnreadableTab[];
  readonly loading: boolean;
  readonly rescan: () => void;
}

/** Every javdb video tab open right now. Nothing persisted: each session asks the
 *  tabs, so there is no cache to expire and no stale entry to reappear. */
export const useJavdbTabs = (): TabScan => {
  const [sources, setSources] = useState<readonly MovieSource[]>([]);
  const [unreadable, setUnreadable] = useState<readonly UnreadableTab[]>([]);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const rescan = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const tabs = await chrome.tabs.query({ url: "https://javdb.com/v/*" });
      const replies = await Promise.all(
        tabs.map(async (tab) => ({ tab, reply: await requestMagnets(tab.id ?? -1) })),
      );
      if (cancelled) return;

      const readable: MovieSource[] = [];
      const failed: UnreadableTab[] = [];

      for (const { tab, reply } of replies) {
        const tabId = tab.id;
        if (tabId === undefined) continue;

        if (reply.ok) {
          readable.push({ tabId, ...reply.page });
        } else {
          failed.push({ tabId, title: tab.title ?? "", url: tab.url ?? "", reason: reply.error });
        }
      }

      setSources(readable);
      setUnreadable(failed);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { sources, unreadable, loading, rescan };
};
