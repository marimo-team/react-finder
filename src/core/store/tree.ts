import { normalizePath } from "../path.js";
import type { CacheActions } from "./cache.js";
import type { GetState, SetState } from "./context.js";

export interface TreeActions {
  /** Replace the expanded set; newly expanded directories are loaded. */
  setExpanded(paths: Iterable<string>): void;
  expand(path: string): Promise<void>;
  collapse(path: string): void;
}

export function createTreeActions(set: SetState, get: GetState, cache: CacheActions): TreeActions {
  return {
    setExpanded: (paths) => {
      const next = new Set([...paths].map(normalizePath));
      const previous = get().expandedPaths;
      set({ expandedPaths: next });
      for (const path of next) {
        if (!previous.has(path)) void cache.loadDirectory(path);
      }
    },
    expand: (path) => {
      const target = normalizePath(path);
      set((s) => ({ expandedPaths: new Set([...s.expandedPaths, target]) }));
      return cache.loadDirectory(target);
    },
    collapse: (path) => {
      const target = normalizePath(path);
      set((s) => {
        const next = new Set(s.expandedPaths);
        next.delete(target);
        return { expandedPaths: next };
      });
    },
  };
}
