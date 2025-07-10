/**
 * A file or directory entry. `path` is the identity of the item everywhere in
 * the library: it is normalized (leading slash, no trailing slash, `/` root).
 */
export interface FileItem {
  path: string;
  name: string;
  kind: "file" | "directory";
  size?: number;
  /** Epoch milliseconds. */
  modifiedAt?: number;
  /** Epoch milliseconds. */
  createdAt?: number;
  mimeType?: string;
  /** Adapter-specific data (backend ids, etags, handles, ...). */
  meta?: Record<string, unknown>;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface ListOptions extends RequestOptions {
  cursor?: string;
}

export interface ListResult {
  items: FileItem[];
  /** Present when there are more pages. Pass back to `list` to continue. */
  cursor?: string;
}

export interface CreateFileOptions extends RequestOptions {
  content?: Blob | string;
}

export interface SearchOptions extends RequestOptions {
  /** Restrict the search to this directory (recursively). */
  path?: string;
}

export interface WatchEvent {
  type: "changed";
  /** Directory whose listing changed. */
  path: string;
}

export type Unsubscribe = () => void;

/**
 * Pluggable data source. Only `list` is required; every other method is
 * optional and its presence is what enables the corresponding feature
 * (see `getCapabilities`).
 *
 * Rules:
 * - Paths passed in are normalized; items returned must have normalized paths.
 * - Throw `FinderError` (or a DOMException / Error that `toFinderError` can map).
 * - Honor `signal`; reject with a `FinderError("aborted")` when aborted.
 * - Do not sort results: the core sorts.
 */
export interface FileSystemAdapter {
  list(path: string, opts?: ListOptions): Promise<ListResult>;
  stat?(path: string, opts?: RequestOptions): Promise<FileItem>;
  createDirectory?(path: string, opts?: RequestOptions): Promise<FileItem>;
  /** Must reject with `exists` when the path already exists. */
  createFile?(path: string, opts?: CreateFileOptions): Promise<FileItem>;
  /** Recursive for directories. */
  delete?(path: string, opts?: RequestOptions): Promise<void>;
  move?(from: string, to: string, opts?: RequestOptions): Promise<FileItem>;
  copy?(from: string, to: string, opts?: RequestOptions): Promise<FileItem>;
  readFile?(path: string, opts?: RequestOptions): Promise<Blob>;
  /** Creates or overwrites. */
  writeFile?(path: string, data: Blob | string, opts?: RequestOptions): Promise<FileItem>;
  getDownloadUrl?(path: string, opts?: RequestOptions): Promise<string>;
  search?(query: string, opts?: SearchOptions): Promise<FileItem[]>;
  watch?(callback: (event: WatchEvent) => void): Unsubscribe;
  dispose?(): void;
}

export type CapabilityName =
  | "stat"
  | "createFile"
  | "createDirectory"
  | "delete"
  | "move"
  | "copy"
  | "readFile"
  | "writeFile"
  | "download"
  | "search"
  | "watch";

export type Capabilities = Readonly<Record<CapabilityName, boolean>>;

export interface Location {
  id: string;
  name: string;
  adapter: FileSystemAdapter;
  /** Path to open when the location is selected. Defaults to "/". */
  rootPath?: string;
  description?: string;
  icon?: string;
}

export type SortColumn = "name" | "size" | "modifiedAt" | "kind";
export type SortDirection = "ascending" | "descending";

export interface SortDescriptor {
  column: SortColumn;
  direction: SortDirection;
}
