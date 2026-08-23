/** JSON shapes that cross the extension messaging boundary. No classes, no functions. */

/** One magnet row on a javdb video page. */
export interface Magnet {
  /** Info hash when the URI has one, else the URI. React key and radio value. */
  readonly id: string;
  /** The URI exactly as the page gave it. This is what aria2 receives. */
  readonly uri: string;
  /** Row label, falling back to the URI's `dn` parameter. */
  readonly name: string;
  readonly sizeBytes: number | null;
  /** Size text as rendered, shown when sizeBytes is null. */
  readonly sizeText: string;
  /** javdb reuses the video code as every row's name, so this is the discriminator. */
  readonly fileCount: number | null;
  /** Row markers, in page order. */
  readonly tags: readonly string[];
  readonly dateText: string;
}

/** What one javdb video page offers. */
export interface PageMagnets {
  /** Video code, for example "SSIS-123". Empty when unreadable. */
  readonly code: string;
  /** Movie title, without the code or the site suffix. */
  readonly title: string;
  readonly url: string;
  /** Rows in page order. May be empty. */
  readonly magnets: readonly Magnet[];
}

/** A page plus the tab it came from. */
export interface MovieSource extends PageMagnets {
  readonly tabId: number;
}

/** A javdb tab that could not be read, usually because it predates the extension. */
export interface UnreadableTab {
  readonly tabId: number;
  readonly title: string;
  readonly url: string;
  readonly reason: string;
}

/** Connection details for the aria2 JSON-RPC endpoint. */
export interface Aria2Settings {
  /** Full JSON-RPC URL. */
  readonly endpoint: string;
  /** The daemon's `--rpc-secret`, without the "token:" prefix. Empty when unset. */
  readonly secret: string;
}

/** Result of submitting one magnet. */
export interface SubmitOutcome {
  readonly magnetId: string;
  readonly name: string;
  readonly ok: boolean;
  /** aria2's download id, only when ok. */
  readonly gid: string | null;
  /** Failure reason, only when not ok. */
  readonly error: string | null;
}
