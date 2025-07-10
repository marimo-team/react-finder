import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { FinderStore } from "../core/store/createFinderStore.js";
import { useFinderStore } from "./useFinderStore.js";

/**
 * Subscribe to a slice of Finder state. The selector result is compared
 * shallowly, so returning a fresh object literal is fine.
 *
 * @example
 * const { currentPath, navigate } = useFinder((s) => ({ currentPath: s.currentPath, navigate: s.navigate }));
 */
export function useFinder<T>(selector: (state: FinderStore) => T): T {
  const store = useFinderStore();
  return useStore(store, useShallow(selector));
}
