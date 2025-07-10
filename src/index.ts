// ---- Components -----------------------------------------------------------

// ---- Actions, keyboard, drag data ----------------------------------------
export {
  type ActionContext,
  FINDER_ACTION_NAMES,
  type FinderActionDef,
  type FinderActionName,
  finderActions,
} from "./actions/actions.js";
export {
  FileSystemAccessAdapter,
  type FileSystemAccessAdapterOptions,
} from "./adapters/fileSystemAccess/fileSystemAccessAdapter.js";
// ---- Adapters -------------------------------------------------------------
export {
  MemoryAdapter,
  type MemoryAdapterOptions,
  type MemoryPersistence,
} from "./adapters/memory/memoryAdapter.js";
export {
  createLocalStorageAdapter,
  createSessionStorageAdapter,
  createStorageAdapter,
  type StorageAdapterOptions,
  storagePersist,
} from "./adapters/memory/persist.js";
export {
  type SeedTree,
  type VfsSnapshot,
  VirtualFS,
  type VirtualFSOptions,
} from "./adapters/memory/virtualFs.js";
export { readOnlyAdapter } from "./adapters/readOnly.js";
export {
  FinderDragHandle,
  FinderItem,
  type FinderItemProps,
  type FinderItemRenderProps,
  type ItemRenderProps,
} from "./components/collections/FinderItem.js";
export { FinderList, type FinderListProps } from "./components/collections/FinderList.js";
export {
  FinderCell,
  type FinderCellProps,
  FinderColumn,
  type FinderColumnProps,
  FinderTable,
  FinderTableBody,
  type FinderTableBodyProps,
  FinderTableHeader,
  type FinderTableHeaderProps,
  type FinderTableProps,
} from "./components/collections/FinderTable.js";
export { FinderTree, type FinderTreeProps } from "./components/collections/FinderTree.js";
export type {
  FinderConfig,
  ItemStateContextValue,
  SelectionBehavior,
  SelectionMode,
} from "./components/contexts.js";
export { Finder } from "./components/Finder.js";
export {
  type FinderBreadcrumb,
  FinderBreadcrumbItem,
  type FinderBreadcrumbItemProps,
  FinderBreadcrumbs,
  type FinderBreadcrumbsProps,
} from "./components/FinderBreadcrumbs.js";
export { FinderButton, type FinderButtonProps } from "./components/FinderButton.js";
export {
  FinderContextMenu,
  type FinderContextMenuProps,
  type FinderContextMenuRenderProps,
  FinderMenuItem,
  type FinderMenuItemProps,
  FinderMenuSeparator,
  type FinderMenuSeparatorProps,
} from "./components/FinderContextMenu.js";
export { FinderDropZone, type FinderDropZoneProps } from "./components/FinderDropZone.js";
export {
  FinderLocationItem,
  type FinderLocationItemProps,
  FinderLocations,
  type FinderLocationsProps,
} from "./components/FinderLocations.js";
export {
  FinderPreview,
  type FinderPreviewProps,
  type PreviewContent,
} from "./components/FinderPreview.js";
export { FinderRenameInput, type FinderRenameInputProps } from "./components/FinderRenameInput.js";
export { type FinderProps, FinderRoot } from "./components/FinderRoot.js";
export { FinderSearchInput, type FinderSearchInputProps } from "./components/FinderSearchInput.js";
export {
  FinderState,
  type FinderStateProps,
  type FinderStateSnapshot,
} from "./components/FinderState.js";
export { FinderToolbar, type FinderToolbarProps } from "./components/FinderToolbar.js";
export { getCapabilities } from "./core/capabilities.js";
export { FinderError, type FinderErrorCode, throwIfAborted, toFinderError } from "./core/errors.js";
export { formatDate, formatFileSize } from "./core/format.js";
export { isHiddenName, splitExtension, uniqueName, validateName } from "./core/naming.js";
export {
  ancestorsOf,
  basename,
  dirname,
  isAncestor,
  isRoot,
  isSameOrAncestor,
  joinPath,
  normalizePath,
  pathDepth,
  rebasePath,
} from "./core/path.js";
export {
  type Breadcrumb,
  compareItems,
  createVisibleItemsSelector,
  selectBreadcrumbs,
  selectCanGoBack,
  selectCanGoForward,
  selectCanGoUp,
  selectChildren,
  selectDirectory,
  selectDirectoryError,
  selectHasMore,
  selectIsLoading,
  selectIsPending,
  selectItem,
  selectLocation,
  selectSelectedItems,
  sortItems,
} from "./core/selectors.js";
// ---- Core -----------------------------------------------------------------
export {
  createFinderStore,
  type FinderActions,
  type FinderStore,
  type FinderStoreApi,
  type FinderStoreOptions,
  type OperationEvent,
  type OperationResult,
} from "./core/store/createFinderStore.js";
export type {
  ClipboardState,
  DirectoryState,
  DirectoryStatus,
  FinderState as FinderStateShape,
  HistoryEntry,
  LocationCache,
  OperationType,
  PendingOperation,
  SearchState,
  SearchStatus,
} from "./core/store/state.js";
export type {
  Capabilities,
  CapabilityName,
  CreateFileOptions,
  FileItem,
  FileSystemAdapter,
  ListOptions,
  ListResult,
  Location,
  RequestOptions,
  SearchOptions,
  SortColumn,
  SortDescriptor,
  SortDirection,
  Unsubscribe,
  WatchEvent,
} from "./core/types.js";
export { FINDER_DRAG_TYPE, type FinderDragPayload } from "./dnd/dragData.js";
export type { DirectoryStatusInfo } from "./hooks/internal/useCollectionProps.js";
export type { FinderDnDOptions } from "./hooks/internal/useFinderDnD.js";
// ---- Hooks (escape hatch) -------------------------------------------------
export { useFinder } from "./hooks/useFinder.js";
export { useFinderStore } from "./hooks/useFinderStore.js";
export { DEFAULT_SHORTCUTS, matchShortcut, type ShortcutMap } from "./keyboard/shortcuts.js";
