import { createVisibleItemsSelector } from "../selectors.js";
import type { GetState, SetState } from "./context.js";

export interface SelectionActions {
  setSelection(paths: Iterable<string>): void;
  clearSelection(): void;
  /** Select every visible item in the current directory. */
  selectAll(): void;
}

export function createSelectionActions(set: SetState, get: GetState): SelectionActions {
  const visible = createVisibleItemsSelector();
  return {
    setSelection: (paths) => {
      set({ selectedPaths: new Set(paths) });
    },
    clearSelection: () => {
      set({ selectedPaths: new Set() });
    },
    selectAll: () => {
      const paths = visible(get()).map((i) => i.path);
      set({ selectedPaths: new Set(paths) });
    },
  };
}
