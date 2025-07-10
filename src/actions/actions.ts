import type { FinderConfig } from "../components/contexts.js";
import { dirname, isRoot } from "../core/path.js";
import { selectCanGoBack, selectCanGoForward, selectHasMore } from "../core/selectors.js";
import type { FinderStoreApi } from "../core/store/createFinderStore.js";
import type { FinderState } from "../core/store/state.js";

export type FinderActionName =
  | "back"
  | "forward"
  | "up"
  | "refresh"
  | "open"
  | "newFile"
  | "newFolder"
  | "rename"
  | "delete"
  | "copy"
  | "cut"
  | "paste"
  | "selectAll"
  | "clearSelection"
  | "loadMore";

export interface ActionContext {
  /** Item the action was invoked on (context menu); otherwise the selection is used. */
  targetPath?: string | null;
}

export interface FinderActionDef {
  isEnabled(state: FinderState, config: FinderConfig, ctx: ActionContext): boolean;
  run(store: FinderStoreApi, config: FinderConfig, ctx: ActionContext): unknown;
}

/** Paths an action applies to: the context target if it is outside the selection, else the selection. */
export function actionTargets(state: FinderState, ctx: ActionContext): string[] {
  const target = ctx.targetPath ?? undefined;
  if (target && !state.selectedPaths.has(target)) return [target];
  if (state.selectedPaths.size > 0) return [...state.selectedPaths];
  return target ? [target] : [];
}

const entry = (state: FinderState, path: string) =>
  state.cache[state.currentLocationId]?.entries[path];

export const finderActions: Record<FinderActionName, FinderActionDef> = {
  back: {
    isEnabled: (s) => selectCanGoBack(s),
    run: (store) => store.getState().goBack(),
  },
  forward: {
    isEnabled: (s) => selectCanGoForward(s),
    run: (store) => store.getState().goForward(),
  },
  up: {
    isEnabled: (s) => !isRoot(s.currentPath),
    run: (store) => store.getState().navigate(dirname(store.getState().currentPath)),
  },
  refresh: {
    isEnabled: () => true,
    run: (store) => store.getState().refresh(),
  },
  open: {
    isEnabled: (s, config, ctx) => {
      const targets = actionTargets(s, ctx);
      if (targets.length !== 1) return false;
      const item = entry(s, targets[0] as string);
      if (!item) return false;
      return item.kind === "directory" || Boolean(config.onOpen);
    },
    run: async (store, config, ctx) => {
      const state = store.getState();
      const path = actionTargets(state, ctx)[0];
      const item = path ? entry(state, path) : undefined;
      if (!item) return;
      if (item.kind === "directory") {
        await state.navigate(item.path);
        return;
      }
      config.onOpen?.(item);
    },
  },
  newFile: {
    isEnabled: (s) => s.capabilities.createFile,
    run: async (store) => {
      const item = await store.getState().createFile();
      store.getState().setSelection([item.path]);
      store.getState().startEditing(item.path);
    },
  },
  newFolder: {
    isEnabled: (s) => s.capabilities.createDirectory,
    run: async (store) => {
      const item = await store.getState().createDirectory();
      store.getState().setSelection([item.path]);
      store.getState().startEditing(item.path);
    },
  },
  rename: {
    isEnabled: (s, _c, ctx) => s.capabilities.move && actionTargets(s, ctx).length === 1,
    run: (store, _c, ctx) => {
      const path = actionTargets(store.getState(), ctx)[0];
      if (path) store.getState().startEditing(path);
    },
  },
  delete: {
    isEnabled: (s, _c, ctx) => s.capabilities.delete && actionTargets(s, ctx).length > 0,
    run: (store, _c, ctx) => store.getState().deleteItems(actionTargets(store.getState(), ctx)),
  },
  copy: {
    isEnabled: (s, _c, ctx) => actionTargets(s, ctx).length > 0,
    run: (store, _c, ctx) => {
      store.getState().copyToClipboard(actionTargets(store.getState(), ctx));
    },
  },
  cut: {
    isEnabled: (s, _c, ctx) => s.capabilities.move && actionTargets(s, ctx).length > 0,
    run: (store, _c, ctx) => {
      store.getState().cutToClipboard(actionTargets(store.getState(), ctx));
    },
  },
  paste: {
    isEnabled: (s) => {
      const clipboard = s.clipboard;
      if (!clipboard || clipboard.paths.length === 0) return false;
      return clipboard.mode === "copy" ? s.capabilities.copy : s.capabilities.move;
    },
    run: (store, _c, ctx) => {
      const state = store.getState();
      const target = ctx.targetPath ? entry(state, ctx.targetPath) : undefined;
      const dest = target?.kind === "directory" ? target.path : state.currentPath;
      return state.paste(dest);
    },
  },
  selectAll: {
    isEnabled: (s, config) =>
      config.selectionMode === "multiple" &&
      (s.cache[s.currentLocationId]?.directories[s.currentPath]?.paths.length ?? 0) > 0,
    run: (store) => {
      store.getState().selectAll();
    },
  },
  clearSelection: {
    isEnabled: (s) => s.selectedPaths.size > 0,
    run: (store) => {
      store.getState().clearSelection();
    },
  },
  loadMore: {
    isEnabled: (s) => selectHasMore(s),
    run: (store) => store.getState().loadMore(store.getState().currentPath),
  },
};

export const FINDER_ACTION_NAMES = Object.keys(finderActions) as FinderActionName[];
