/** Parsing and display helpers shared by the parser and the popup. */

const UNITS = [
  { suffix: "TB", scale: 1024 ** 4 },
  { suffix: "GB", scale: 1024 ** 3 },
  { suffix: "MB", scale: 1024 ** 2 },
  { suffix: "KB", scale: 1024 },
] as const;

/** Bytes from "5.21GB" or "1,024 MB". javdb writes binary units. Null if unparseable. */
export const parseSize = (text: string): number | null => {
  const match = /(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|KB|B)\b/i.exec(text);
  if (!match) return null;

  const rawAmount = match[1];
  const rawUnit = match[2];
  if (rawAmount === undefined || rawUnit === undefined) return null;

  const amount = Number(rawAmount.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;

  const unit = rawUnit.toUpperCase();
  const known = UNITS.find((candidate) => candidate.suffix === unit);
  return Math.round(amount * (known ? known.scale : 1));
};

/** "5.21 GB". Empty string for null. */
export const formatSize = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return "";
  for (const unit of UNITS) {
    if (bytes >= unit.scale) return `${(bytes / unit.scale).toFixed(2)} ${unit.suffix}`;
  }
  return `${bytes} B`;
};

/** Non-negative integer from an attribute value, else null. */
export const parseCount = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

/** "20260822" to "2026-08-22". Empty string for anything else. */
export const formatCompactDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
};

/** Lower-cased info hash, hex or base32. Null when the URI has none. */
export const infoHash = (uri: string): string | null => {
  const match = /xt=urn:btih:([a-z0-9]+)/i.exec(uri);
  return match?.[1]?.toLowerCase() ?? null;
};

/** The `dn` parameter, decoded as a query value. Raw value on a broken encoding. */
export const displayName = (uri: string): string => {
  const raw = /[?&]dn=([^&]*)/i.exec(uri)?.[1];
  if (!raw) return "";
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
};
