import { useMemo } from "react";
import { useStore } from "zustand";

import { createVisibleItemsSelector } from "../../core/selectors.js";
import type { FileItem } from "../../core/types.js";
import { useFinderStore } from "../useFinderStore.js";

/** Sorted, filtered items of a directory (defaults to the current one). Referentially stable. */
export function useVisibleItems(path?: string): FileItem[] {
  const store = useFinderStore();
  const selector = useMemo(() => createVisibleItemsSelector(), []);
  return useStore(store, (state) => selector(state, path));
}

export type KeyedItem = FileItem & { id: string };

const keyedCache = new WeakMap<FileItem[], KeyedItem[]>();

/**
 * react-aria derives collection keys from `item.id` when using dynamic
 * `items`, so hand it a view of each item that carries `id = path`.
 * Memoized per input array so identity stays stable.
 */
export function keyItems(items: FileItem[]): KeyedItem[] {
  let keyed = keyedCache.get(items);
  if (!keyed) {
    keyed = items.map((item) => ({ ...item, id: item.path }));
    keyedCache.set(items, keyed);
  }
  return keyed;
}
