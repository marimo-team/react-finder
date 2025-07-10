import { toFinderError } from "../errors.js";
import { adapterFor, cacheFor } from "./context.js";
import type { GetState, SetState, StoreContext } from "./context.js";
import { EMPTY_SEARCH } from "./state.js";

export interface SearchActions {
  setQuery(query: string): void;
  clearSearch(): void;
}

/** Cancel any pending debounce timer and in-flight adapter search. */
export function cancelSearch(ctx: StoreContext): void {
  if (ctx.search.timer !== undefined) clearTimeout(ctx.search.timer);
  ctx.search.timer = undefined;
  ctx.search.controller?.abort();
  ctx.search.controller = undefined;
}

export function createSearchActions(
  set: SetState,
  get: GetState,
  ctx: StoreContext,
): SearchActions {
  const runSearch = async (query: string) => {
    const state = get();
    const adapter = adapterFor(state);
    if (!adapter.search) return;
    const locationId = state.currentLocationId;
    const path = state.currentPath;
    const controller = new AbortController();
    ctx.search.controller = controller;
    try {
      const items = await adapter.search(query, {
        path,
        signal: controller.signal,
      });
      if (controller.signal.aborted || get().search.query !== query) return;
      set((s) => {
        const cache = cacheFor(s, locationId);
        const entries = { ...cache.entries };
        for (const item of items) entries[item.path] = item;
        return {
          cache: { ...s.cache, [locationId]: { ...cache, entries } },
          search: { query, status: "done", results: items.map((i) => i.path) },
        };
      });
    } catch (error) {
      const finderError = toFinderError(error);
      if (finderError.code === "aborted" || get().search.query !== query) return;
      set({
        search: { query, status: "error", results: null, error: finderError },
      });
      ctx.options.onError?.(finderError);
    } finally {
      if (ctx.search.controller === controller) ctx.search.controller = undefined;
    }
  };

  return {
    setQuery: (query) => {
      cancelSearch(ctx);
      if (!query) {
        set({ search: EMPTY_SEARCH });
        return;
      }
      if (!get().capabilities.search) {
        set({ search: { query, status: "idle", results: null } });
        return;
      }
      set((s) => ({
        search: { query, status: "searching", results: s.search.results },
      }));
      ctx.search.timer = setTimeout(() => {
        ctx.search.timer = undefined;
        void runSearch(query);
      }, ctx.options.searchDebounceMs);
    },
    clearSearch: () => {
      cancelSearch(ctx);
      set({ search: EMPTY_SEARCH });
    },
  };
}
