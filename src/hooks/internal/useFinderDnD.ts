import { useCallback, useContext, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";
import { useDragAndDrop } from "react-aria-components";
import type { DragAndDropHooks, DropItem, DropOperation, Key } from "react-aria-components";

import { FinderConfigContext } from "../../components/contexts.js";
import type { FileItem } from "../../core/types.js";
import {
  collectDroppedFiles,
  parseDropItems,
  resolveDropOperation,
  serializeDragItems,
} from "../../dnd/dragData.js";
import type { FinderDragPayload } from "../../dnd/dragData.js";
import { useFinderStore } from "../useFinderStore.js";

export interface FinderDnDOptions {
  /** Operation when no modifier key forces one. Default "move". */
  operation?: "move" | "copy";
  /** Accept files dragged from the OS. Default: true when uploads are possible. */
  acceptExternalFiles?: boolean;
  /** Items dragged from another `<Finder>` instance or location. */
  onDropFromOtherFinder?: (
    payloads: FinderDragPayload[],
    targetPath: string,
    operation: DropOperation,
  ) => void;
  renderDragPreview?: (items: FileItem[]) => React.JSX.Element;
}

/** Keep the latest value in a ref so stable callbacks can read it. */
function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

export interface DropHandler {
  handleDrop: (items: DropItem[], targetPath: string, operation: DropOperation) => Promise<void>;
  /** Whether files dragged from the OS are accepted. */
  acceptExternal: boolean;
  /** Operation used when no modifier key forces one. */
  preferred: "move" | "copy";
}

/** Shared drop handling for collections and drop zones. */
export function useDropHandler(options: FinderDnDOptions = {}): DropHandler {
  const store = useFinderStore();
  const config = useContext(FinderConfigContext);
  const optionsRef = useLatest(options);
  const configRef = useLatest(config);

  const handleDrop = useCallback(
    async (items: DropItem[], targetPath: string, operation: DropOperation) => {
      const parsed = await parseDropItems(items);
      const state = store.getState();
      const own: string[] = [];
      const foreign: FinderDragPayload[] = [];
      for (const payload of parsed.internal) {
        if (payload.finderId === state.finderId && payload.locationId === state.currentLocationId) {
          own.push(payload.path);
        } else {
          foreign.push(payload);
        }
      }
      if (own.length > 0) {
        await (operation === "copy" ? state.copy(own, targetPath) : state.move(own, targetPath));
      }
      if (foreign.length > 0) {
        optionsRef.current.onDropFromOtherFinder?.(foreign, targetPath, operation);
      }
      if (parsed.files.length > 0 || parsed.directories.length > 0) {
        const files = await collectDroppedFiles(parsed);
        if (files.length === 0) return;
        const { onUpload } = configRef.current;
        if (onUpload) await onUpload(files, targetPath);
        else if (state.capabilities.writeFile) {
          await state.upload(files, targetPath);
        }
      }
    },
    [store, optionsRef, configRef],
  );

  const canUpload = Boolean(config.onUpload) || store.getState().capabilities.writeFile;
  return {
    handleDrop,
    acceptExternal: options.acceptExternalFiles ?? canUpload,
    preferred: options.operation ?? "move",
  };
}

export interface UseFinderDnDArgs {
  enabled: boolean;
  /** Directory receiving drops on the collection background. */
  rootTargetPath: string;
  getItem: (key: Key) => FileItem | undefined;
  options?: FinderDnDOptions;
}

/**
 * Build react-aria `dragAndDropHooks` for a collection: drag selected items,
 * drop onto directories (move/copy), drop OS files (upload).
 *
 * The options object handed to `useDragAndDrop` is memoized: react-aria keys
 * its hooks on that object's identity, and collections re-render whenever the
 * hooks change, so a fresh object per render would spin.
 */
export function useFinderDnD({
  enabled,
  rootTargetPath,
  getItem,
  options = {},
}: UseFinderDnDArgs): DragAndDropHooks | undefined {
  const store = useFinderStore();
  const { handleDrop, acceptExternal, preferred } = useDropHandler(options);
  const latest = useLatest({
    getItem,
    rootTargetPath,
    handleDrop,
    acceptExternal,
    preferred,
    options,
  });
  const draggedPaths = useRef<string[]>([]);
  const hasPreview = options.renderDragPreview !== undefined;

  const dndOptions = useMemo<Parameters<typeof useDragAndDrop>[0]>(
    () => ({
      isDisabled: !enabled,
      getItems: (keys) => {
        const state = store.getState();
        const items: FileItem[] = [];
        for (const key of keys) {
          const item = latest.current.getItem(key);
          if (item) items.push(item);
        }
        draggedPaths.current = items.map((i) => i.path);
        return serializeDragItems(
          { finderId: state.finderId, locationId: state.currentLocationId },
          items,
        );
      },
      onDragEnd: () => {
        draggedPaths.current = [];
      },
      acceptedDragTypes: "all",
      shouldAcceptItemDrop: (target) => latest.current.getItem(target.key)?.kind === "directory",
      getDropOperation: (target, types, allowedOperations) => {
        if (target.type === "item" && target.dropPosition !== "on") return "cancel";
        const targetPath =
          target.type === "root"
            ? latest.current.rootTargetPath
            : (latest.current.getItem(target.key)?.path ?? null);
        const isOwnDrag = draggedPaths.current.length > 0;
        return resolveDropOperation({
          targetPath,
          draggedPaths: isOwnDrag ? draggedPaths.current : undefined,
          types,
          allowedOperations,
          preferred: latest.current.preferred,
          acceptExternal: latest.current.acceptExternal,
        });
      },
      onItemDrop: (event) => {
        const target = latest.current.getItem(event.target.key);
        if (!target) return;
        void latest.current.handleDrop(event.items, target.path, event.dropOperation);
      },
      onRootDrop: (event) => {
        void latest.current.handleDrop(
          event.items,
          latest.current.rootTargetPath,
          event.dropOperation,
        );
      },
      renderDragPreview: hasPreview
        ? (dragItems) => {
            const items: FileItem[] = [];
            for (const dragItem of dragItems) {
              const path = dragItem["text/plain"];
              const item = path ? latest.current.getItem(path) : undefined;
              if (item) items.push(item);
            }
            return (
              latest.current.options.renderDragPreview as NonNullable<
                FinderDnDOptions["renderDragPreview"]
              >
            )(items);
          }
        : undefined,
    }),
    [enabled, store, latest, hasPreview],
  );

  const { dragAndDropHooks } = useDragAndDrop(dndOptions);
  return enabled ? dragAndDropHooks : undefined;
}
