import type { FinderError } from "./errors.js";
import { basename, isRoot } from "./path.js";
import { cacheFor } from "./store/context.js";
import type { DirectoryState, FinderState } from "./store/state.js";
import type { FileItem, Location, SortDescriptor } from "./types.js";

const EMPTY_ITEMS: FileItem[] = [];

export const selectLocation = (state: FinderState): Location | undefined =>
  state.locations.find((l) => l.id === state.currentLocationId);

export const selectDirectory = (
  state: FinderState,
  path: string = state.currentPath,
): DirectoryState | undefined => cacheFor(state).directories[path];

export const selectIsLoading = (state: FinderState, path: string = state.currentPath): boolean =>
  selectDirectory(state, path)?.status === "loading";

export const selectDirectoryError = (
  state: FinderState,
  path: string = state.currentPath,
): FinderError | null => selectDirectory(state, path)?.error ?? null;

export const selectCanGoBack = (state: FinderState): boolean => state.history.index > 0;

export const selectCanGoForward = (state: FinderState): boolean =>
  state.history.index < state.history.entries.length - 1;

export const selectCanGoUp = (state: FinderState): boolean => !isRoot(state.currentPath);

/** True when the directory listing is paginated and has another page. */
export const selectHasMore = (state: FinderState, path: string = state.currentPath): boolean => {
  const dir = selectDirectory(state, path);
  if (!dir?.cursor) return false;
  return dir.status !== "loading";
};

export const selectItem = (state: FinderState, path: string): FileItem | undefined =>
  cacheFor(state).entries[path];

/**
 * Selectors that return arrays must be referentially stable for a given
 * input, otherwise `useSyncExternalStore` (via `useFinder`) re-renders
 * forever. These caches key on the identity of the inputs they read.
 */
const childrenCache = new WeakMap<
  DirectoryState,
  { entries: Record<string, FileItem>; items: FileItem[] }
>();

/** Raw (unsorted, unfiltered) children of a directory from the cache. */
export const selectChildren = (state: FinderState, path: string): FileItem[] => {
  const cache = cacheFor(state);
  const dir = cache.directories[path];
  if (!dir) return EMPTY_ITEMS;
  const cached = childrenCache.get(dir);
  if (cached && cached.entries === cache.entries) return cached.items;
  const items: FileItem[] = [];
  for (const p of dir.paths) {
    const item = cache.entries[p];
    if (item) items.push(item);
  }
  childrenCache.set(dir, { entries: cache.entries, items });
  return items;
};

const selectedCache = new WeakMap<
  ReadonlySet<string>,
  { entries: Record<string, FileItem>; items: FileItem[] }
>();

export const selectSelectedItems = (state: FinderState): FileItem[] => {
  const cache = cacheFor(state);
  const cached = selectedCache.get(state.selectedPaths);
  if (cached && cached.entries === cache.entries) return cached.items;
  const items: FileItem[] = [];
  for (const p of state.selectedPaths) {
    const item = cache.entries[p];
    if (item) items.push(item);
  }
  selectedCache.set(state.selectedPaths, { entries: cache.entries, items });
  return items;
};

export const selectIsPending = (state: FinderState, path: string): boolean => {
  for (const op of Object.values(state.pendingOperations)) {
    if (op.paths.includes(path)) return true;
  }
  return false;
};

export interface Breadcrumb {
  /** Same as `path`; react-aria collections key on `id`. */
  id: string;
  path: string;
  name: string;
  isRoot: boolean;
  isCurrent: boolean;
}

let breadcrumbCache: { path: string; crumbs: Breadcrumb[] } | undefined;

export const selectBreadcrumbs = (
  state: FinderState,
  path: string = state.currentPath,
): Breadcrumb[] => {
  if (breadcrumbCache?.path === path) return breadcrumbCache.crumbs;
  const crumbs: Breadcrumb[] = [
    { id: "/", path: "/", name: "", isRoot: true, isCurrent: path === "/" },
  ];
  if (path !== "/") {
    let current = "";
    for (const segment of path.split("/").slice(1)) {
      current += `/${segment}`;
      crumbs.push({
        id: current,
        path: current,
        name: segment,
        isRoot: false,
        isCurrent: current === path,
      });
    }
  }
  breadcrumbCache = { path, crumbs };
  return crumbs;
};

// ---- sorting / filtering --------------------------------------------------

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function compareItems(
  a: FileItem,
  b: FileItem,
  sort: SortDescriptor,
  foldersFirst: boolean,
): number {
  if (foldersFirst && a.kind !== b.kind) {
    return a.kind === "directory" ? -1 : 1;
  }
  let result = 0;
  switch (sort.column) {
    case "name": {
      result = collator.compare(a.name, b.name);
      break;
    }
    case "size": {
      result = (a.size ?? -1) - (b.size ?? -1);
      break;
    }
    case "modifiedAt": {
      result = (a.modifiedAt ?? 0) - (b.modifiedAt ?? 0);
      break;
    }
    case "kind": {
      const byKind = collator.compare(a.kind, b.kind);
      result = byKind === 0 ? collator.compare(a.mimeType ?? "", b.mimeType ?? "") : byKind;
      break;
    }
    default: {
      // `sort.column` is exhaustive above; fall back to the name tiebreak below.
      result = 0;
      break;
    }
  }
  if (result === 0) result = collator.compare(a.name, b.name);
  return sort.direction === "ascending" ? result : -result;
}

export function sortItems(
  items: FileItem[],
  sort: SortDescriptor,
  foldersFirst: boolean,
): FileItem[] {
  return [...items].sort((a, b) => compareItems(a, b, sort, foldersFirst));
}

function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Create a memoized selector for the sorted, filtered items of a directory.
 * One instance per subscriber: it returns the same array reference until the
 * underlying items, sort, hidden flag or query actually change.
 */
export function createVisibleItemsSelector() {
  let lastItems: FileItem[] = [];
  let lastKey = "";
  let lastOutput: FileItem[] = EMPTY_ITEMS;

  return (state: FinderState, path: string = state.currentPath): FileItem[] => {
    const cache = cacheFor(state);
    const useSearch = path === state.currentPath && state.search.results !== null;
    const source = useSearch
      ? (state.search.results as string[])
      : (cache.directories[path]?.paths ?? []);
    const items: FileItem[] = [];
    for (const p of source) {
      const item = cache.entries[p];
      if (item) items.push(item);
    }
    const query =
      path === state.currentPath && !useSearch ? state.search.query.trim().toLowerCase() : "";
    const key = `${sortKey(state.sort)}|${state.foldersFirst}|${state.showHidden}|${query}`;
    if (key === lastKey && shallowArrayEqual(items, lastItems)) {
      return lastOutput;
    }
    lastItems = items;
    lastKey = key;
    let filtered = state.showHidden ? items : items.filter((item) => !state.isHidden(item));
    if (query) {
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(query));
    }
    lastOutput = sortItems(filtered, state.sort, state.foldersFirst);
    return lastOutput;
  };
}

function sortKey(sort: SortDescriptor) {
  return `${sort.column}:${sort.direction}`;
}

export function nameOf(path: string): string {
  return basename(path);
}
