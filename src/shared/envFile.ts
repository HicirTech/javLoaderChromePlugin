/** Rewriting one key in a .env file, leaving everything else exactly as it was. */

/** Matches `KEY=`, with optional indentation and an optional `export`. */
const lineFor = (key: string): RegExp =>
  new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*=.*$`, "gm");

/**
 * Set `key` to `value`, in place if it is already there and appended if not.
 *
 * Comments, ordering, spacing and line endings survive, because this file is
 * hand-maintained and the point is to touch one line of it.
 *
 * Every occurrence is replaced, not just the first: a stale duplicate further
 * down the file would otherwise be the one that wins when it is read back.
 */
export const patchEnv = (contents: string, key: string, value: string): string => {
  if (/[\r\n]/.test(value)) {
    throw new Error(`refusing to write a ${key} containing a line break`);
  }

  const pattern = lineFor(key);
  // A function replacer, so a value containing "$&" or "$1" is written verbatim.
  if (pattern.test(contents)) return contents.replace(lineFor(key), () => `${key}=${value}`);

  const eol = contents.includes("\r\n") ? "\r\n" : "\n";
  const body = contents.replace(/[\r\n]+$/, "");
  return body ? `${body}${eol}${key}=${value}${eol}` : `${key}=${value}${eol}`;
};
