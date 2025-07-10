import { NO_CAPABILITIES } from "../capabilities.js";
import type { FinderError } from "../errors.js";
import { isHiddenName } from "../naming.js";
import { normalizePath } from "../path.js";
import type { Capabilities, FileItem, Location, SortDescriptor } from "../types.js";

export type DirectoryStatus = "idle" | "loading" | "loaded" | "error";

export interface DirectoryState {
  status: DirectoryStatus;
  /** Child paths in adapter order (unsorted). */
  paths: string[];
  /** Pagination cursor when more pages are available. */
  cursor?: string;
  /** Number of pages merged into `paths` (reloads re-fetch the same depth). */
  pages?: number;
  error?: FinderError;
  fetchedAt?: number;
  /** Loaded but known to be out of date; keeps showing `paths` while reloading. */
  stale?: boolean;
}

export interface LocationCache {
  entries: Record<string, FileItem>;
  directories: Record<string, DirectoryState>;
}

export interface HistoryEntry {
  locationId: string;
  path: string;
}

export type SearchStatus = "idle" | "searching" | "done" | "error";

export interface SearchState {
  query: string;
  status: SearchStatus;
  /** Result paths from `adapter.search`, or `null` for client-side filtering. */
  results: string[] | null;
  error?: FinderError;
}

export interface ClipboardState {
  mode: "copy" | "cut";
  locationId: string;
  paths: string[];
}

export type OperationType =
  | "createFile"
  | "createDirectory"
  | "rename"
  | "move"
  | "copy"
  | "delete"
  | "writeFile"
  | "upload";

export interface PendingOperation {
  type: OperationType;
  paths: string[];
  startedAt: number;
}

export interface FinderState {
  /** Unique per store; identifies the origin of drag payloads. */
  finderId: string;
  locations: Location[];
  currentLocationId: string;
  capabilities: Capabilities;
  cache: Record<string, LocationCache>;
  currentPath: string;
  history: { entries: HistoryEntry[]; index: number };
  selectedPaths: ReadonlySet<string>;
  expandedPaths: ReadonlySet<string>;
  editingPath: string | null;
  search: SearchState;
  clipboard: ClipboardState | null;
  pendingOperations: Record<string, PendingOperation>;
  lastError: FinderError | null;
  sort: SortDescriptor;
  showHidden: boolean;
  foldersFirst: boolean;
  isHidden: (item: FileItem) => boolean;
}

export const EMPTY_SEARCH: SearchState = {
  query: "",
  status: "idle",
  results: null,
};

export const EMPTY_CACHE: LocationCache = Object.freeze({
  entries: {},
  directories: {},
});

export const DEFAULT_SORT: SortDescriptor = {
  column: "name",
  direction: "ascending",
};

export interface InitialStateOptions {
  locations: Location[];
  initialLocationId?: string;
  initialPath?: string;
  sort?: SortDescriptor;
  showHidden?: boolean;
  foldersFirst?: boolean;
  isHidden?: (item: FileItem) => boolean;
  finderId?: string;
}

let finderCounter = 0;

export function createInitialState(options: InitialStateOptions): FinderState {
  const location =
    options.locations.find((l) => l.id === options.initialLocationId) ?? options.locations[0];
  const locationId = location?.id ?? "default";
  const path = normalizePath(options.initialPath ?? location?.rootPath ?? "/");
  return {
    finderId: options.finderId ?? `finder-${++finderCounter}`,
    locations: options.locations,
    currentLocationId: locationId,
    capabilities: NO_CAPABILITIES,
    cache: {},
    currentPath: path,
    history: { entries: [{ locationId, path }], index: 0 },
    selectedPaths: new Set(),
    expandedPaths: new Set(),
    editingPath: null,
    search: EMPTY_SEARCH,
    clipboard: null,
    pendingOperations: {},
    lastError: null,
    sort: options.sort ?? DEFAULT_SORT,
    showHidden: options.showHidden ?? false,
    foldersFirst: options.foldersFirst ?? true,
    isHidden: options.isHidden ?? ((item) => isHiddenName(item.name)),
  };
}
