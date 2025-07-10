import { FinderError } from "../errors.js";
import { normalizePath } from "../path.js";
import type { GetState, OperationResult, SetState } from "./context.js";
import type { OperationActions } from "./operations.js";

export interface ClipboardActions {
  copyToClipboard(paths: string[]): void;
  cutToClipboard(paths: string[]): void;
  paste(toDir?: string): Promise<OperationResult>;
  clearClipboard(): void;
}

export function createClipboardActions(
  set: SetState,
  get: GetState,
  ops: OperationActions,
): ClipboardActions {
  const put = (mode: "copy" | "cut", paths: string[]) => {
    set((s) => ({
      clipboard: {
        mode,
        locationId: s.currentLocationId,
        paths: paths.map(normalizePath),
      },
    }));
  };
  return {
    copyToClipboard: (paths) => {
      put("copy", paths);
    },
    cutToClipboard: (paths) => {
      put("cut", paths);
    },
    clearClipboard: () => {
      set({ clipboard: null });
    },
    paste: async (toDir) => {
      const state = get();
      const clipboard = state.clipboard;
      const dest = normalizePath(toDir ?? state.currentPath);
      if (!clipboard || clipboard.paths.length === 0) {
        return { ok: [], failed: [] };
      }
      if (clipboard.locationId !== state.currentLocationId) {
        throw new FinderError("unsupported", "Pasting between locations is not supported");
      }
      if (clipboard.mode === "copy") {
        return ops.copy(clipboard.paths, dest);
      }
      const result = await ops.move(clipboard.paths, dest);
      if (result.failed.length === 0) set({ clipboard: null });
      return result;
    },
  };
}
