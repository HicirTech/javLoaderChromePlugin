/**
 * Reading javdb's cookies out of the browser this extension runs in.
 *
 * Two queries, not one. Cloudflare now sets cf_clearance with the Partitioned
 * attribute, and a partitioned cookie is invisible to every unpartitioned query
 * -- including `getAll({})` with no filter at all. Only a query naming the
 * partition returns it, and that query in turn excludes the unpartitioned ones.
 * A browser sending a top-level request to javdb sends both, so both are read.
 */

const DOMAIN = "javdb.com";
const SITE = "https://javdb.com";

/** The one that matters: without it every javdb request gets a challenge. */
const CLEARANCE = "cf_clearance";

export interface JavdbCookie {
  /** The whole Cookie header, ready to paste or write to a file. */
  readonly header: string;
  readonly hasClearance: boolean;
  /** When the clearance expires, or null when it is absent or has no expiry. */
  readonly clearanceExpiresAt: Date | null;
  /** Whether the clearance was found only in a partition. Useful when diagnosing. */
  readonly clearanceIsPartitioned: boolean;
}

type Query = chrome.cookies.GetAllDetails;

const safeGetAll = async (query: Query): Promise<chrome.cookies.Cookie[]> => {
  try {
    return await chrome.cookies.getAll(query);
  } catch {
    // An older Chrome rejects an unknown partitionKey rather than ignoring it.
    return [];
  }
};

export const readJavdbCookie = async (): Promise<JavdbCookie> => {
  const [plain, partitioned] = await Promise.all([
    safeGetAll({ domain: DOMAIN }),
    safeGetAll({ domain: DOMAIN, partitionKey: { topLevelSite: SITE } } as Query),
  ]);

  // Partitioned wins a name clash: for a top-level javdb request the browser
  // sends both, and the partitioned one is the more specific.
  const byName = new Map<string, chrome.cookies.Cookie>();
  for (const cookie of [...plain, ...partitioned]) byName.set(cookie.name, cookie);

  const clearance = byName.get(CLEARANCE);

  return {
    header: [...byName.values()].map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
    hasClearance: clearance !== undefined,
    clearanceExpiresAt:
      clearance?.expirationDate !== undefined ? new Date(clearance.expirationDate * 1000) : null,
    clearanceIsPartitioned:
      clearance !== undefined && !plain.some((cookie) => cookie.name === CLEARANCE),
  };
};

/** How long is left on the clearance, in plain words. */
export const describeExpiry = (expiresAt: Date | null): string => {
  if (!expiresAt) return "no expiry recorded";

  const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60_000);
  if (minutes <= 0) return "already expired";
  if (minutes < 60) return `expires in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `expires in ${hours} h` : `expires in ${Math.floor(hours / 24)} days`;
};
