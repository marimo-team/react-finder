import type { JSX, ReactNode } from "react";

import type { FinderError } from "../core/errors.js";
import {
  selectCanGoBack,
  selectCanGoForward,
  selectDirectory,
  selectHasMore,
  selectSelectedItems,
} from "../core/selectors.js";
import type { ClipboardState, DirectoryStatus, SearchState } from "../core/store/state.js";
import type { Capabilities, FileItem } from "../core/types.js";
import { useVisibleItems } from "../hooks/internal/useVisibleItems.js";
import { useFinder } from "../hooks/useFinder.js";

export interface FinderStateSnapshot {
  currentPath: string;
  locationId: string;
  items: FileItem[];
  selectedItems: FileItem[];
  status: DirectoryStatus;
  isLoading: boolean;
  isEmpty: boolean;
  error: FinderError | null;
  canGoBack: boolean;
  canGoForward: boolean;
  /** The listing is paginated and another page is available. */
  hasMore: boolean;
  clipboard: ClipboardState | null;
  capabilities: Capabilities;
  search: SearchState;
  editingPath: string | null;
}

export interface FinderStateProps {
  /** Directory to describe; defaults to the current one. */
  path?: string;
  children: (state: FinderStateSnapshot) => ReactNode;
}

/** Render-prop access to the explorer state, for status bars, footers, etc. */
export function FinderState({ path, children }: FinderStateProps): JSX.Element {
  const items = useVisibleItems(path);
  const rest = useFinder((s) => {
    const dir = selectDirectory(s, path);
    return {
      currentPath: s.currentPath,
      locationId: s.currentLocationId,
      selectedItems: selectSelectedItems(s),
      status: dir?.status ?? "idle",
      isLoading: dir?.status === "loading",
      error: dir?.error ?? null,
      canGoBack: selectCanGoBack(s),
      canGoForward: selectCanGoForward(s),
      hasMore: selectHasMore(s, path),
      clipboard: s.clipboard,
      capabilities: s.capabilities,
      search: s.search,
      editingPath: s.editingPath,
    };
  });
  return <>{children({ ...rest, items, isEmpty: items.length === 0 })}</>;
}
