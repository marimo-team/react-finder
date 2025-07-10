import { createContext } from "react";
import type { Context, ReactElement } from "react";

import type { FinderStoreApi } from "../core/store/createFinderStore.js";
import type { FileItem } from "../core/types.js";
import type { ShortcutMap } from "../keyboard/shortcuts.js";

export type SelectionMode = "none" | "single" | "multiple";
export type SelectionBehavior = "replace" | "toggle";

export interface FinderConfig {
  selectionMode: SelectionMode;
  selectionBehavior: SelectionBehavior;
  /** Called when a file is activated (double-click / Enter). */
  onOpen?: (item: FileItem) => void;
  /** Called when OS files are dropped. Defaults to `store.upload` when the adapter can write. */
  onUpload?: (files: File[], targetPath: string) => void | Promise<void>;
  shortcuts: ShortcutMap | false;
}

export const DEFAULT_CONFIG: FinderConfig = {
  selectionMode: "multiple",
  selectionBehavior: "replace",
  shortcuts: {},
};

export const FinderStoreContext: Context<FinderStoreApi | null> =
  createContext<FinderStoreApi | null>(null);
export const FinderConfigContext: Context<FinderConfig> =
  createContext<FinderConfig>(DEFAULT_CONFIG);

export type CollectionKind = "list" | "table" | "tree";

export interface CollectionContextValue {
  kind: CollectionKind;
  /** Directory shown by the collection (tree: its root). */
  path: string;
  /** Tree only: used to render nested levels recursively. */
  renderItem?: (item: FileItem) => ReactElement;
  /** Whether items are draggable (adds the default drag handle). */
  dragAndDrop?: boolean;
}

export const CollectionContext: Context<CollectionContextValue | null> =
  createContext<CollectionContextValue | null>(null);

/**
 * Per-item state, published once per collection instead of subscribing every
 * item to the store (react-aria renders every item, virtualized or not, to
 * build its collection, so per-item subscriptions do not scale).
 */
export interface ItemStateContextValue {
  editingPath: string | null;
  cutPaths: ReadonlySet<string>;
  /** Directories whose listing is loading. */
  loadingPaths: ReadonlySet<string>;
  /** Tree only: sorted, filtered children of a directory (stable references). */
  childrenOf?: (path: string) => (FileItem & { id: string })[];
}

export const EMPTY_ITEM_STATE: ItemStateContextValue = {
  editingPath: null,
  cutPaths: new Set(),
  loadingPaths: new Set(),
};

export const ItemStateContext: Context<ItemStateContextValue> =
  createContext<ItemStateContextValue>(EMPTY_ITEM_STATE);

export const ItemContext: Context<FileItem | null> = createContext<FileItem | null>(null);

export interface ContextMenuState {
  x: number;
  y: number;
  /** Item under the pointer, or null for the directory background. */
  targetPath: string | null;
}

export interface ContextMenuContextValue {
  state: ContextMenuState | null;
  open: (state: ContextMenuState) => void;
  close: () => void;
  /** Called by `Finder.ContextMenu` on mount so the root knows to intercept right-clicks. */
  register: () => () => void;
}

export const ContextMenuContext: Context<ContextMenuContextValue | null> =
  createContext<ContextMenuContextValue | null>(null);
