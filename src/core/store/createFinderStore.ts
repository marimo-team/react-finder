import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import { getCapabilities } from "../capabilities.js";
import type { FileItem, FileSystemAdapter, Location, SortDescriptor } from "../types.js";
import { createCacheActions } from "./cache.js";
import type { CacheActions } from "./cache.js";
import { createClipboardActions } from "./clipboard.js";
import type { ClipboardActions } from "./clipboard.js";
import { createStoreContext } from "./context.js";
import type { StoreCallbacks } from "./context.js";
import { createNavigationActions, subscribeWatch } from "./navigation.js";
import type { NavigationActions } from "./navigation.js";
import { createOperationActions } from "./operations.js";
import type { OperationActions } from "./operations.js";
import { createSearchActions } from "./search.js";
import type { SearchActions } from "./search.js";
import { createSelectionActions } from "./selection.js";
import type { SelectionActions } from "./selection.js";
import { createInitialState } from "./state.js";
import type { FinderState } from "./state.js";
import { createTreeActions } from "./tree.js";
import type { TreeActions } from "./tree.js";
import { createEditingActions, createViewActions } from "./view.js";
import type { EditingActions, ViewActions } from "./view.js";

export type FinderActions = NavigationActions &
  CacheActions &
  SelectionActions &
  TreeActions &
  EditingActions &
  ViewActions &
  SearchActions &
  ClipboardActions &
  OperationActions;

export type FinderStore = FinderState & FinderActions;

export interface FinderStoreApi extends StoreApi<FinderStore> {
  /** Abort in-flight work, unsubscribe watchers, dispose the adapter. */
  destroy(): void;
}

export interface FinderStoreOptions extends StoreCallbacks {
  /** Shorthand for a single location with id "default". */
  adapter?: FileSystemAdapter;
  locations?: Location[];
  initialLocationId?: string;
  initialPath?: string;
  sort?: SortDescriptor;
  showHidden?: boolean;
  foldersFirst?: boolean;
  isHidden?: (item: FileItem) => boolean;
  /** Max concurrent adapter calls per multi-item operation. Default 4. */
  concurrency?: number;
  /** Debounce for `adapter.search`. Default 250ms. */
  searchDebounceMs?: number;
  /** Load the initial directory immediately. Default true. */
  autoLoad?: boolean;
  finderId?: string;
}

export type { OperationEvent, OperationResult } from "./context.js";

export function createFinderStore(options: FinderStoreOptions = {}): FinderStoreApi {
  const locations: Location[] =
    options.locations ??
    (options.adapter ? [{ id: "default", name: "Files", adapter: options.adapter }] : []);
  if (locations.length === 0) {
    throw new Error("createFinderStore requires an adapter or locations");
  }

  const ctx = createStoreContext({
    concurrency: options.concurrency ?? 4,
    searchDebounceMs: options.searchDebounceMs ?? 250,
    onError: options.onError,
    onOperation: options.onOperation,
  });

  const store = createStore<FinderStore>()((set, get) => {
    const cache = createCacheActions(set, get, ctx);
    const navigation = createNavigationActions(set, get, ctx, cache);
    const operations = createOperationActions(set, get, ctx, cache);
    return {
      ...createInitialState({ ...options, locations }),
      ...cache,
      ...navigation,
      ...operations,
      ...createSelectionActions(set, get),
      ...createTreeActions(set, get, cache),
      ...createEditingActions(set),
      ...createViewActions(set),
      ...createSearchActions(set, get, ctx),
      ...createClipboardActions(set, get, operations),
    };
  });

  const initial = store.getState();
  store.setState({
    capabilities: getCapabilities(
      (locations.find((l) => l.id === initial.currentLocationId) ?? locations[0])
        ?.adapter as FileSystemAdapter,
    ),
  });
  subscribeWatch(store.getState, ctx, store.getState());

  if (options.autoLoad !== false) {
    void store.getState().loadDirectory(initial.currentPath);
  }

  const destroy = () => {
    for (const inflight of ctx.inflight.values()) inflight.controller.abort();
    ctx.inflight.clear();
    if (ctx.search.timer !== undefined) clearTimeout(ctx.search.timer);
    ctx.search.controller?.abort();
    ctx.watchUnsub?.();
    ctx.watchUnsub = undefined;
    for (const location of store.getState().locations) {
      location.adapter.dispose?.();
    }
  };

  return Object.assign(store, { destroy });
}
