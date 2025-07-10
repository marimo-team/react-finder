import { toFinderError } from "../errors.js";
import { closestIn } from "../path.js";
import type { FileItem, ListResult } from "../types.js";
import { adapterFor, cacheFor, inflightKey } from "./context.js";
import type { GetState, SetState, StoreContext } from "./context.js";
import type { DirectoryState, FinderState, LocationCache } from "./state.js";

export interface CacheActions {
  /** Load a directory listing into the cache (deduped, superseding, race-safe). */
  loadDirectory(path: string, opts?: { force?: boolean }): Promise<void>;
  /** Fetch the next page of a paginated directory. */
  loadMore(path: string): Promise<void>;
  /** Mark directories stale and reload the ones currently on screen. */
  invalidate(paths: string[]): void;
}

export function patchDirectory(
  set: SetState,
  locationId: string,
  path: string,
  patch: Partial<DirectoryState>,
): void {
  set((state) => {
    const cache = cacheFor(state, locationId);
    const existing: DirectoryState = cache.directories[path] ?? {
      status: "idle",
      paths: [],
    };
    return {
      cache: {
        ...state.cache,
        [locationId]: {
          ...cache,
          directories: {
            ...cache.directories,
            [path]: { ...existing, ...patch },
          },
        },
      },
    };
  });
}

/** Merge a listing into the cache, pruning entries that vanished. */
export function commitListing(
  state: FinderState,
  locationId: string,
  path: string,
  result: ListResult & { pages?: number },
  append: boolean,
): Partial<FinderState> {
  const cache = cacheFor(state, locationId);
  const previous = cache.directories[path];
  const entries: Record<string, FileItem> = { ...cache.entries };
  const directories: Record<string, DirectoryState> = { ...cache.directories };

  const newPaths = result.items.map((item) => item.path);
  const paths = append ? [...(previous?.paths ?? []), ...newPaths] : newPaths;
  const pages = append ? (previous?.pages ?? 1) + 1 : (result.pages ?? 1);
  const keep = new Set(paths);

  const removed = new Set(append ? [] : (previous?.paths ?? []).filter((p) => !keep.has(p)));
  if (removed.size > 0) {
    pruneRemoved(removed, entries, directories);
  }

  for (const item of result.items) {
    entries[item.path] = item;
  }

  directories[path] = {
    status: "loaded",
    paths,
    cursor: result.cursor,
    pages,
    fetchedAt: Date.now(),
    stale: false,
  };

  const nextCache: LocationCache = { entries, directories };
  const patch: Partial<FinderState> = {
    cache: { ...state.cache, [locationId]: nextCache },
  };

  if (!append && locationId === state.currentLocationId) {
    reconcileUiState(state, path, entries, removed, patch);
  }

  return patch;
}

/** Drop cached entries and directory listings that live under a removed path. */
function pruneRemoved(
  removed: Set<string>,
  entries: Record<string, FileItem>,
  directories: Record<string, DirectoryState>,
) {
  for (const key of Object.keys(entries)) {
    if (closestIn(removed, key)) delete entries[key];
  }
  for (const key of Object.keys(directories)) {
    if (closestIn(removed, key)) delete directories[key];
  }
}

/** Forget selection, expansion and editing state that points at vanished entries. */
function reconcileUiState(
  state: FinderState,
  path: string,
  entries: Record<string, FileItem>,
  removed: Set<string>,
  patch: Partial<FinderState>,
) {
  const selected = new Set<string>();
  for (const p of state.selectedPaths) {
    if (entries[p]) selected.add(p);
  }
  if (selected.size !== state.selectedPaths.size) {
    patch.selectedPaths = selected;
  }
  if (removed.size > 0) {
    const expanded = new Set<string>();
    for (const p of state.expandedPaths) {
      if (!closestIn(removed, p)) expanded.add(p);
    }
    if (expanded.size !== state.expandedPaths.size) {
      patch.expandedPaths = expanded;
    }
  }
  if (state.editingPath && !entries[state.editingPath] && path === state.currentPath) {
    patch.editingPath = null;
  }
}

export function createCacheActions(set: SetState, get: GetState, ctx: StoreContext): CacheActions {
  const load = (
    locationId: string,
    path: string,
    opts: { force?: boolean; cursor?: string; previousPages?: number },
  ): Promise<void> => {
    const key = inflightKey(locationId, path);
    const existing = ctx.inflight.get(key);
    if (existing && !opts.force && !opts.cursor) {
      return existing.promise;
    }
    existing?.controller.abort();

    const controller = new AbortController();
    const seq = ++ctx.seq;
    const isCurrent = () => ctx.inflight.get(key)?.seq === seq;

    const promise = (async () => {
      patchDirectory(set, locationId, path, {
        status: "loading",
        error: undefined,
      });
      try {
        const adapter = adapterFor(get(), locationId);
        const result = await adapter.list(path, {
          signal: controller.signal,
          cursor: opts.cursor,
        });
        if (!isCurrent()) return;
        // A reload of a paginated directory re-fetches as many pages as were
        // loaded before, so the user does not lose their place.
        let pages = 1;
        const target = opts.cursor ? 1 : (opts.previousPages ?? 1);
        while (pages < target && result.cursor) {
          const next = await adapter.list(path, {
            signal: controller.signal,
            cursor: result.cursor,
          });
          if (!isCurrent()) return;
          result.items = [...result.items, ...next.items];
          result.cursor = next.cursor;
          pages++;
        }
        set((state) =>
          commitListing(state, locationId, path, { ...result, pages }, Boolean(opts.cursor)),
        );
      } catch (error) {
        const finderError = toFinderError(error, path);
        if (finderError.code === "aborted" || !isCurrent()) return;
        patchDirectory(set, locationId, path, {
          status: "error",
          error: finderError,
        });
        set({ lastError: finderError });
        ctx.options.onError?.(finderError);
      } finally {
        if (isCurrent()) ctx.inflight.delete(key);
      }
    })();

    ctx.inflight.set(key, { controller, seq, promise });
    return promise;
  };

  return {
    loadDirectory: (path, opts = {}) => {
      const state = get();
      const dir = cacheFor(state).directories[path];
      if (!opts.force && dir?.status === "loaded" && !dir.stale) {
        return Promise.resolve();
      }
      if (!opts.force && dir?.status === "loading") {
        const inflight = ctx.inflight.get(inflightKey(state.currentLocationId, path));
        if (inflight) return inflight.promise;
      }
      return load(state.currentLocationId, path, {
        force: opts.force,
        previousPages: dir?.pages,
      });
    },

    loadMore: (path) => {
      const state = get();
      const dir = cacheFor(state).directories[path];
      if (!dir?.cursor || dir.status === "loading") return Promise.resolve();
      return load(state.currentLocationId, path, { cursor: dir.cursor });
    },

    invalidate: (paths) => {
      const state = get();
      const locationId = state.currentLocationId;
      const cache = cacheFor(state);
      const toReload: string[] = [];
      for (const path of new Set(paths)) {
        const dir = cache.directories[path];
        if (!dir || dir.status === "idle") continue;
        if (path === state.currentPath || state.expandedPaths.has(path)) {
          toReload.push(path);
        } else {
          patchDirectory(set, locationId, path, { stale: true });
        }
      }
      for (const path of toReload) {
        void load(locationId, path, {
          force: true,
          previousPages: cache.directories[path]?.pages,
        });
      }
    },
  };
}
