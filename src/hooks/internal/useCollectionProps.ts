import { useCallback, useContext, useMemo, useRef } from "react";
import type { DragAndDropHooks, Key, Selection, SelectionMode } from "react-aria-components";

import { FinderConfigContext } from "../../components/contexts.js";
import type {
  CollectionKind,
  ItemStateContextValue,
  SelectionBehavior,
} from "../../components/contexts.js";
import type { FinderError } from "../../core/errors.js";
import { createVisibleItemsSelector, selectDirectory } from "../../core/selectors.js";
import type { DirectoryStatus, LocationCache } from "../../core/store/state.js";
import type { FileItem } from "../../core/types.js";
import { useFinder } from "../useFinder.js";
import { useFinderStore } from "../useFinderStore.js";
import { useFinderDnD } from "./useFinderDnD.js";
import type { FinderDnDOptions } from "./useFinderDnD.js";
import { keyItems, useVisibleItems } from "./useVisibleItems.js";
import type { KeyedItem } from "./useVisibleItems.js";

export interface DirectoryStatusInfo {
  path: string;
  status: DirectoryStatus;
  isLoading: boolean;
  isEmpty: boolean;
  error: FinderError | null;
}

export interface UseCollectionPropsArgs {
  kind: CollectionKind;
  /** Directory shown; defaults to the current path. */
  path?: string;
  selectionMode?: SelectionMode;
  dragAndDrop?: boolean | FinderDnDOptions;
  /** Tree sidebar mode: selection mirrors `currentPath` and selecting navigates. */
  navigateOnSelect?: boolean;
}

export interface CollectionProps {
  path: string;
  items: FileItem[];
  /** `items` with `id = path`, for react-aria's dynamic collections. */
  keyedItems: KeyedItem[];
  status: DirectoryStatusInfo;
  selectionMode: SelectionMode;
  selectionBehavior: SelectionBehavior;
  selectedKeys: Set<Key>;
  onSelectionChange: (keys: Selection) => void;
  onAction: (key: Key) => void;
  dragAndDropHooks: DragAndDropHooks | undefined;
  /** Value for `ItemStateContext`; changes only when item-visible state changes. */
  itemState: ItemStateContextValue;
  domProps: {
    "data-path": string;
    "data-loading": true | undefined;
    "data-error": true | undefined;
  };
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const loadingCache = new WeakMap<LocationCache["directories"], ReadonlySet<string>>();
function loadingPathsOf(directories: LocationCache["directories"]): ReadonlySet<string> {
  let set = loadingCache.get(directories);
  if (!set) {
    const loading = new Set<string>();
    for (const [path, dir] of Object.entries(directories)) {
      if (dir.status === "loading") loading.add(path);
    }
    set = loading.size === 0 ? EMPTY_SET : loading;
    loadingCache.set(directories, set);
  }
  return set;
}

const cutCache = new WeakMap<object, ReadonlySet<string>>();
function cutPathsOf(clipboard: { mode: string; paths: string[] } | null): ReadonlySet<string> {
  if (!clipboard || clipboard.mode !== "cut") return EMPTY_SET;
  let set = cutCache.get(clipboard);
  if (!set) {
    set = new Set(clipboard.paths);
    cutCache.set(clipboard, set);
  }
  return set;
}

/** Shared glue between the store and react-aria collections. */
export function useCollectionProps(args: UseCollectionPropsArgs): CollectionProps {
  const store = useFinderStore();
  const config = useContext(FinderConfigContext);
  const isTree = args.kind === "tree";
  const {
    currentPath,
    selectedPaths,
    entries,
    directories,
    dirStatus,
    dirError,
    editingPath,
    cutPaths,
    loadingPaths,
    treeVersion,
  } = useFinder((s) => {
    const path = args.path ?? s.currentPath;
    const dir = selectDirectory(s, path);
    const cache = s.cache[s.currentLocationId];
    return {
      currentPath: s.currentPath,
      selectedPaths: s.selectedPaths,
      entries: cache?.entries,
      directories: cache?.directories,
      dirStatus: dir?.status ?? "idle",
      dirError: dir?.error ?? null,
      editingPath: s.editingPath,
      cutPaths: cutPathsOf(s.clipboard),
      loadingPaths: cache ? loadingPathsOf(cache.directories) : EMPTY_SET,
      // Tree children depend on the cache plus everything that affects visible ordering.
      treeVersion: isTree
        ? `${s.sort.column}:${s.sort.direction}:${s.showHidden}:${s.foldersFirst}:${s.search.query}`
        : "",
    };
  });
  const path = args.path ?? currentPath;
  const items = useVisibleItems(path);
  const navigateOnSelect = args.navigateOnSelect ?? false;

  const getItem = useCallback((key: Key) => entries?.[String(key)], [entries]);

  const onSelectionChange = useCallback(
    (keys: Selection) => {
      const state = store.getState();
      if (navigateOnSelect) {
        const first = keys === "all" ? undefined : [...keys][0];
        if (first !== undefined && String(first) !== state.currentPath) {
          void state.navigate(String(first));
        }
        return;
      }
      if (keys === "all") {
        state.setSelection(items.map((i) => i.path));
      } else {
        state.setSelection([...keys].map(String));
      }
    },
    [store, items, navigateOnSelect],
  );

  const onAction = useCallback(
    (key: Key) => {
      const state = store.getState();
      const item = state.cache[state.currentLocationId]?.entries[String(key)];
      if (!item) return;
      if (item.kind === "directory") void state.navigate(item.path);
      else config.onOpen?.(item);
    },
    [store, config],
  );

  const dndOptions = typeof args.dragAndDrop === "object" ? args.dragAndDrop : undefined;
  const dragAndDropHooks = useFinderDnD({
    enabled: Boolean(args.dragAndDrop),
    rootTargetPath: path,
    getItem,
    options: dndOptions,
  });

  // Tree: one memoized visible-items selector per directory, so nested levels
  // get stable arrays without subscribing each node to the store.
  const selectors = useRef(new Map<string, ReturnType<typeof createVisibleItemsSelector>>());
  const childrenOf = useCallback(
    (dirPath: string): KeyedItem[] => {
      let selector = selectors.current.get(dirPath);
      if (!selector) {
        selector = createVisibleItemsSelector();
        selectors.current.set(dirPath, selector);
      }
      return keyItems(selector(store.getState(), dirPath));
    },
    [store],
  );

  const itemState = useMemo<ItemStateContextValue>(() => {
    // Tree items call `childrenOf` while rendering, so the results are only
    // valid for the generation of store data captured here: binding the
    // callback to `directories` (the cache) and `treeVersion` (sort/filter) is
    // what makes the context value - and therefore the items - update.
    const generation = { childrenOf, directories, treeVersion };
    return {
      editingPath,
      cutPaths,
      loadingPaths,
      childrenOf: isTree ? (dirPath: string) => generation.childrenOf(dirPath) : undefined,
    };
  }, [editingPath, cutPaths, loadingPaths, isTree, childrenOf, directories, treeVersion]);

  const selectionMode = navigateOnSelect ? "single" : (args.selectionMode ?? config.selectionMode);
  const navigateKeys = useMemo(() => new Set<Key>([currentPath]), [currentPath]);
  const selectedKeys = navigateOnSelect ? navigateKeys : (selectedPaths as Set<Key>);

  return {
    path,
    items,
    keyedItems: keyItems(items),
    status: {
      path,
      status: dirStatus,
      isLoading: dirStatus === "loading",
      isEmpty: items.length === 0,
      error: dirError,
    },
    selectionMode,
    selectionBehavior: config.selectionBehavior,
    selectedKeys,
    onSelectionChange,
    onAction,
    dragAndDropHooks,
    itemState,
    domProps: {
      "data-path": path,
      "data-loading": dirStatus === "loading" || undefined,
      "data-error": dirStatus === "error" || undefined,
    },
  };
}
