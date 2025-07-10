import { getCapabilities } from "../capabilities.js";
import { normalizePath } from "../path.js";
import type { Location } from "../types.js";
import type { CacheActions } from "./cache.js";
import { adapterFor, locationOf } from "./context.js";
import type { GetState, SetState, StoreContext } from "./context.js";
import { cancelSearch } from "./search.js";
import { EMPTY_SEARCH } from "./state.js";
import type { HistoryEntry } from "./state.js";

export interface NavigationActions {
  navigate(path: string, opts?: { locationId?: string; replace?: boolean }): Promise<void>;
  goBack(): Promise<void>;
  goForward(): Promise<void>;
  /** Reload the current directory. Never touches history or selection. */
  refresh(): Promise<void>;
  setLocation(locationId: string): Promise<void>;
  /** Replace the location list (e.g. when provider props change). */
  setLocations(locations: Location[]): Promise<void>;
}

type VisitMode = "push" | "replace" | "replay";

export function subscribeWatch(get: GetState, ctx: StoreContext, cache: CacheActions): void {
  ctx.watchUnsub?.();
  ctx.watchUnsub = undefined;
  const state = get();
  const adapter = adapterFor(state);
  if (!adapter.watch) return;
  const locationId = state.currentLocationId;
  ctx.watchUnsub = adapter.watch((event) => {
    const current = get();
    if (current.currentLocationId !== locationId) return;
    const path = normalizePath(event.path);
    // An in-flight operation will patch the cache itself; reloading now would
    // commit a listing before the operation remaps selection/expansion.
    if (Object.keys(current.pendingOperations).length > 0) {
      ctx.deferredInvalidations.add(path);
      return;
    }
    cache.invalidate([path]);
  });
}

export function createNavigationActions(
  set: SetState,
  get: GetState,
  ctx: StoreContext,
  cache: CacheActions,
): NavigationActions {
  const visit = (entry: HistoryEntry, mode: VisitMode): Promise<void> => {
    const state = get();
    const locationChanged = entry.locationId !== state.currentLocationId;
    set((s) => {
      let history = s.history;
      if (mode === "push") {
        const entries = [...s.history.entries.slice(0, s.history.index + 1), entry];
        history = { entries, index: entries.length - 1 };
      } else if (mode === "replace") {
        const entries = [...s.history.entries];
        entries[s.history.index] = entry;
        history = { entries, index: s.history.index };
      }
      return {
        currentPath: entry.path,
        currentLocationId: entry.locationId,
        capabilities: locationChanged
          ? getCapabilities(adapterFor(s, entry.locationId))
          : s.capabilities,
        history,
        selectedPaths: new Set<string>(),
        editingPath: null,
        search: EMPTY_SEARCH,
      };
    });
    cancelSearch(ctx);
    if (locationChanged) {
      subscribeWatch(get, ctx, cache);
    }
    return cache.loadDirectory(entry.path);
  };

  return {
    navigate: (path, opts = {}) => {
      const state = get();
      const locationId = opts.locationId ?? state.currentLocationId;
      locationOf(state, locationId);
      return visit({ locationId, path: normalizePath(path) }, opts.replace ? "replace" : "push");
    },

    goBack: () => {
      const { history } = get();
      if (history.index <= 0) return Promise.resolve();
      const index = history.index - 1;
      const entry = history.entries[index] as HistoryEntry;
      set({ history: { ...history, index } });
      return visit(entry, "replay");
    },

    goForward: () => {
      const { history } = get();
      if (history.index >= history.entries.length - 1) {
        return Promise.resolve();
      }
      const index = history.index + 1;
      const entry = history.entries[index] as HistoryEntry;
      set({ history: { ...history, index } });
      return visit(entry, "replay");
    },

    refresh: () => cache.loadDirectory(get().currentPath, { force: true }),

    setLocation: (locationId) => {
      const location = locationOf(get(), locationId);
      return visit({ locationId, path: normalizePath(location.rootPath ?? "/") }, "push");
    },

    setLocations: (locations) => {
      const state = get();
      const ids = new Set(locations.map((l) => l.id));
      const cacheCopy = { ...state.cache };
      for (const id of Object.keys(cacheCopy)) {
        if (!ids.has(id)) delete cacheCopy[id];
      }
      const entries = state.history.entries.filter((e) => ids.has(e.locationId));
      const index = Math.min(state.history.index, Math.max(0, entries.length - 1));
      set({ locations, cache: cacheCopy });
      const first = locations[0];
      if (!first) return Promise.resolve();
      if (!ids.has(state.currentLocationId)) {
        set({ history: { entries, index } });
        return visit(
          { locationId: first.id, path: normalizePath(first.rootPath ?? "/") },
          entries.length === 0 ? "push" : "replace",
        );
      }
      // Same location id but possibly a different adapter instance: refresh.
      const current = locationOf(state);
      const next = locations.find((l) => l.id === current.id);
      if (next && next.adapter !== current.adapter) {
        set({
          cache: {
            ...cacheCopy,
            [current.id]: { entries: {}, directories: {} },
          },
          capabilities: getCapabilities(next.adapter),
          selectedPaths: new Set<string>(),
          expandedPaths: new Set<string>(),
        });
        subscribeWatch(get, ctx, cache);
        return cache.loadDirectory(state.currentPath, { force: true });
      }
      set({ history: { entries, index } });
      return Promise.resolve();
    },
  };
}
