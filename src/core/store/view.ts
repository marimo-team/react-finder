import { normalizePath } from "../path.js";
import type { SortDescriptor } from "../types.js";
import type { SetState } from "./context.js";

export interface ViewActions {
  setSort(sort: SortDescriptor): void;
  setShowHidden(showHidden: boolean): void;
  setFoldersFirst(foldersFirst: boolean): void;
}

export interface EditingActions {
  startEditing(path: string): void;
  stopEditing(): void;
}

export function createViewActions(set: SetState): ViewActions {
  return {
    setSort: (sort) => {
      set({ sort });
    },
    setShowHidden: (showHidden) => {
      set({ showHidden });
    },
    setFoldersFirst: (foldersFirst) => {
      set({ foldersFirst });
    },
  };
}

export function createEditingActions(set: SetState): EditingActions {
  return {
    startEditing: (path) => {
      set({ editingPath: normalizePath(path) });
    },
    stopEditing: () => {
      set({ editingPath: null });
    },
  };
}
