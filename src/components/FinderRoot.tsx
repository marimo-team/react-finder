import { useEffect, useMemo, useRef, useState } from "react";
import type { HTMLAttributes, JSX, ReactNode, RefObject } from "react";

import type { FinderError } from "../core/errors.js";
import { selectIsLoading, selectSelectedItems } from "../core/selectors.js";
import { createFinderStore } from "../core/store/createFinderStore.js";
import type {
  FinderStoreApi,
  FinderStoreOptions,
  OperationEvent,
} from "../core/store/createFinderStore.js";
import type { FileItem, FileSystemAdapter, Location } from "../core/types.js";
import { useContextMenuState } from "../hooks/internal/useContextMenu.js";
import { useRootHandlers } from "../hooks/internal/useRootHandlers.js";
import { useFinder } from "../hooks/useFinder.js";
import type { ShortcutMap } from "../keyboard/shortcuts.js";
import { ContextMenuContext, FinderConfigContext, FinderStoreContext } from "./contexts.js";
import type { FinderConfig, SelectionBehavior, SelectionMode } from "./contexts.js";

export interface FinderProps extends Omit<HTMLAttributes<HTMLDivElement>, "onError" | "children"> {
  /** Single data source. Mutually exclusive with `locations`. */
  adapter?: FileSystemAdapter;
  locations?: Location[];
  /**
   * Bring your own store (tests, or sharing one store between two Finders).
   * The store owns `onError`/`onOperation` and the initial location/path, so pass
   * those to `createFinderStore` instead of this component when using `store`.
   */
  store?: FinderStoreApi;
  defaultPath?: string;
  defaultLocationId?: string;
  selectionMode?: SelectionMode;
  /**
   * "replace" (default): click selects, double-click/Enter opens.
   * "toggle": click and Space toggle selection (checkbox-style), double-click/Enter opens.
   */
  selectionBehavior?: SelectionBehavior;
  onOpen?: (item: FileItem) => void;
  onNavigate?: (path: string, locationId: string) => void;
  onSelectionChange?: (items: FileItem[]) => void;
  onError?: (error: FinderError) => void;
  onOperation?: (event: OperationEvent) => void;
  onUpload?: (files: File[], targetPath: string) => void | Promise<void>;
  /** Override or disable keyboard shortcuts. */
  shortcuts?: ShortcutMap | false;
  sort?: FinderStoreOptions["sort"];
  showHidden?: boolean;
  foldersFirst?: boolean;
  isHidden?: (item: FileItem) => boolean;
  children?: ReactNode;
}

function resolveLocations(
  adapter: FileSystemAdapter | undefined,
  locations: Location[] | undefined,
): Location[] {
  if (locations) return locations;
  if (adapter) return [{ id: "default", name: "Files", adapter }];
  return [];
}

/** Keep the latest value of a callback prop without re-subscribing. */
function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export function FinderRoot({
  adapter,
  locations,
  store: storeProp,
  defaultPath,
  defaultLocationId,
  selectionMode = "multiple",
  selectionBehavior = "replace",
  onOpen,
  onNavigate,
  onSelectionChange,
  onError,
  onOperation,
  onUpload,
  shortcuts,
  sort,
  showHidden,
  foldersFirst,
  isHidden,
  children,
  onKeyDown,
  onContextMenu,
  ...divProps
}: FinderProps): JSX.Element {
  const callbacks = useLatest({
    onError,
    onOperation,
    onNavigate,
    onSelectionChange,
  });

  // The store is created once per mount and never replaced, which is what
  // `useState`'s lazy initializer is for; there is no setter to destructure.
  // oxlint-disable-next-line react/hook-use-state -- lazy init-once idiom, no setter needed
  const [store] = useState<FinderStoreApi>(
    () =>
      storeProp ??
      createFinderStore({
        locations: resolveLocations(adapter, locations),
        initialLocationId: defaultLocationId,
        initialPath: defaultPath,
        sort,
        showHidden,
        foldersFirst,
        isHidden,
        onError: (error) => callbacks.current.onError?.(error),
        onOperation: (event) => callbacks.current.onOperation?.(event),
      }),
  );

  // Destroy the store we created when unmounting.
  useEffect(
    () => () => {
      if (!storeProp) store.destroy();
    },
    [store, storeProp],
  );

  // Adapter / locations prop changes after mount.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (storeProp) return;
    const next = resolveLocations(adapter, locations);
    if (next.length > 0) void store.getState().setLocations(next);
  }, [adapter, locations, store, storeProp]);

  // Event callbacks via subscription (no re-render of this component).
  useEffect(
    () =>
      store.subscribe((state, prev) => {
        if (
          state.currentPath !== prev.currentPath ||
          state.currentLocationId !== prev.currentLocationId
        ) {
          callbacks.current.onNavigate?.(state.currentPath, state.currentLocationId);
        }
        if (state.selectedPaths !== prev.selectedPaths) {
          callbacks.current.onSelectionChange?.(selectSelectedItems(state));
        }
      }),
    [store, callbacks],
  );

  const config = useMemo<FinderConfig>(
    () => ({
      selectionMode,
      selectionBehavior,
      onOpen,
      onUpload,
      shortcuts: shortcuts ?? {},
    }),
    [selectionMode, selectionBehavior, onOpen, onUpload, shortcuts],
  );

  const contextMenu = useContextMenuState();
  const rootRef = useRef<HTMLDivElement>(null);
  const { handleKeyDown, handleContextMenu } = useRootHandlers({
    store,
    config,
    shortcuts,
    contextMenu,
    rootRef,
    onKeyDown,
    onContextMenu,
  });

  return (
    <FinderStoreContext.Provider value={store}>
      <FinderConfigContext.Provider value={config}>
        <ContextMenuContext.Provider value={contextMenu}>
          <RootElement
            ref={rootRef}
            selectionMode={selectionMode}
            onKeyDown={handleKeyDown}
            onContextMenu={handleContextMenu}
            {...divProps}
          >
            {children}
          </RootElement>
        </ContextMenuContext.Provider>
      </FinderConfigContext.Provider>
    </FinderStoreContext.Provider>
  );
}

interface RootElementProps extends HTMLAttributes<HTMLDivElement> {
  ref: React.Ref<HTMLDivElement>;
  selectionMode: SelectionMode;
}

function RootElement({ ref, selectionMode, ...props }: RootElementProps): JSX.Element {
  const { currentPath, isLoading } = useFinder((s) => ({
    currentPath: s.currentPath,
    isLoading: selectIsLoading(s),
  }));
  return (
    <div
      ref={ref}
      data-finder=""
      data-path={currentPath}
      data-loading={isLoading || undefined}
      data-selection-mode={selectionMode}
      {...props}
    />
  );
}
