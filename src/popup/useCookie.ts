import { useCallback, useEffect, useState } from "react";

import { describeExpiry, readJavdbCookie, type JavdbCookie } from "../shared/cookies";
import {
  ensureWritable,
  recallEnvFile,
  writeCookieInto,
} from "../shared/envTarget";

/** The key avLoaderClient reads the cookie from. */
export const ENV_KEY = "JAVDB_COOKIE";

export interface CookieState {
  readonly cookie: JavdbCookie | null;
  /** Name of the chosen .env file, or null when none has been chosen. */
  readonly envName: string | null;
  /** One line describing the cookie, ready to show. */
  readonly summary: string;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly problem: string | null;
  readonly refresh: () => void;
  readonly copy: () => Promise<void>;
  readonly writeToEnv: () => Promise<void>;
  readonly openSettingsPage: () => void;
}

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/**
 * `chrome.cookies` missing means the browser is still running this extension
 * under its old permission set. Reloading is not always enough for a permission
 * that was added after the extension was first loaded.
 */
const cookiesUnavailable = (cause: unknown): string =>
  chrome.cookies === undefined
    ? "This extension is loaded without the cookies permission. Remove it from chrome://extensions and Load unpacked again."
    : `Could not read the browser's cookies: ${describe(cause)}`;

/**
 * The javdb cookie and where it gets written.
 *
 * Shared by the popup footer, the popup's settings pane and the settings page,
 * so all three agree on what the browser currently holds.
 */
export const useCookie = (): CookieState => {
  const [cookie, setCookie] = useState<JavdbCookie | null>(null);
  const [envName, setEnvName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        // Reported rather than swallowed: a missing permission used to leave
        // this stuck on "reading" with nothing to act on.
        const [fresh, handle] = await Promise.all([readJavdbCookie(), recallEnvFile()]);
        if (cancelled) return;
        setCookie(fresh);
        setEnvName(handle?.name ?? null);
        setProblem(null);
      } catch (cause) {
        if (!cancelled) setProblem(cookiesUnavailable(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const summary =
    problem !== null
      ? "unavailable"
      : cookie === null
        ? "reading"
        : cookie.hasClearance
          ? `cf_clearance ${describeExpiry(cookie.clearanceExpiresAt)}`
          : "no cf_clearance yet";

  const copy = async (): Promise<void> => {
    setNotice(null);
    setProblem(null);
    try {
      const fresh = await readJavdbCookie();
      setCookie(fresh);
      if (!fresh.header) {
        setProblem("The browser holds no javdb cookies. Load javdb.com once.");
        return;
      }
      await navigator.clipboard.writeText(fresh.header);
      setNotice("Cookie copied.");
    } catch (cause) {
      setProblem(describe(cause));
    }
  };

  const writeToEnv = async (): Promise<void> => {
    setBusy(true);
    setNotice(null);
    setProblem(null);
    try {
      const handle = await recallEnvFile();
      if (!handle) {
        setProblem("No .env file chosen yet. Open the settings page and choose one.");
        return;
      }

      // The prompt this can raise closes the popup, which is why the settings
      // page exists; where access is still granted the write goes straight through.
      if (!(await ensureWritable(handle))) {
        setProblem("The browser has forgotten write access. Choose the file again on the settings page.");
        return;
      }

      const fresh = await readJavdbCookie();
      if (!fresh.hasClearance) {
        setProblem("No cf_clearance in the browser. Load javdb.com once, then try again.");
        return;
      }

      await writeCookieInto(handle, ENV_KEY, fresh.header);
      setCookie(fresh);
      setEnvName(handle.name);
      setNotice(`Wrote ${ENV_KEY} to ${handle.name}.`);
    } catch (cause) {
      setProblem(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  // Not openOptionsPage: it resolves to nothing when the manifest key is missing
  // or the build is stale, and a button that does nothing is worse than an error.
  const openSettingsPage = (): void => {
    void chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  };

  return {
    cookie,
    envName,
    summary,
    busy,
    notice,
    problem,
    refresh,
    copy,
    writeToEnv,
    openSettingsPage,
  };
};
