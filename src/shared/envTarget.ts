/**
 * The .env file this extension writes the cookie into.
 *
 * A page cannot be handed a path; it is handed a handle by the user through a
 * file picker, and that handle is what gets remembered. IndexedDB is the only
 * place a handle survives, which is why there is a database here for one value.
 *
 * Permission to write is asked for again each browser session, and asking needs
 * a click -- so every entry point here runs from a button.
 */

import { patchEnv } from "./envFile";

const DB_NAME = "avloader-env";
const STORE = "handles";
const KEY = "envFile";

/** Not in the DOM lib yet, though every Chromium that supports the picker has them. */
interface PermissionCapable {
  queryPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor: { mode: "readwrite" }) => Promise<PermissionState>;
}

type EnvHandle = FileSystemFileHandle & PermissionCapable;

/** Also missing from the DOM lib at this TypeScript version. */
interface FilePickerOptions {
  readonly multiple?: boolean;
  readonly types?: readonly { description: string; accept: Record<string, string[]> }[];
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FileSystemFileHandle[]>;
  }
}

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

export const rememberEnvFile = (handle: FileSystemFileHandle): Promise<IDBValidKey> =>
  withStore("readwrite", (store) => store.put(handle, KEY));

export const recallEnvFile = async (): Promise<EnvHandle | null> =>
  (await withStore<EnvHandle | undefined>("readonly", (store) => store.get(KEY))) ?? null;

export const forgetEnvFile = (): Promise<undefined> =>
  withStore("readwrite", (store) => store.delete(KEY));

/** Whether the picker is available at all. */
export const canPickFiles = (): boolean => typeof window.showOpenFilePicker === "function";

/** Ask the user which .env to write into. Returns null when they cancel. */
export const pickEnvFile = async (): Promise<FileSystemFileHandle | null> => {
  const picker = window.showOpenFilePicker;
  if (!picker) return null;

  try {
    const [handle] = await picker.call(window, {
      multiple: false,
      types: [{ description: "Environment file", accept: { "text/plain": [".env", ".example"] } }],
    });
    return handle ?? null;
  } catch {
    // The picker throws on cancel rather than resolving, which is not an error.
    return null;
  }
};

/** Confirm write access, prompting if the browser has forgotten. Needs a click. */
export const ensureWritable = async (handle: EnvHandle): Promise<boolean> => {
  const descriptor = { mode: "readwrite" } as const;
  if ((await handle.queryPermission?.(descriptor)) === "granted") return true;
  return (await handle.requestPermission?.(descriptor)) === "granted";
};

/**
 * Write the cookie into the file, replacing whatever that key held.
 *
 * The whole file is read, patched in memory and written back in one go, so a
 * failure part-way leaves the original intact rather than a half-written .env.
 */
export const writeCookieInto = async (
  handle: EnvHandle,
  key: string,
  cookie: string,
): Promise<void> => {
  const before = await (await handle.getFile()).text();
  const after = patchEnv(before, key, cookie);

  const writable = await handle.createWritable();
  try {
    await writable.write(after);
  } finally {
    await writable.close();
  }
};
