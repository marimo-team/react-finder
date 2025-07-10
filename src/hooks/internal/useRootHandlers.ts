import { useCallback, useMemo } from "react";
import type { KeyboardEvent, MouseEvent, RefObject } from "react";

import { finderActions } from "../../actions/actions.js";
import type { ContextMenuContextValue, FinderConfig } from "../../components/contexts.js";
import type { FinderStoreApi } from "../../core/store/createFinderStore.js";
import { isEditableTarget, matchShortcut, mergeShortcuts } from "../../keyboard/shortcuts.js";
import type { ShortcutMap } from "../../keyboard/shortcuts.js";

interface RootHandlerArgs {
  store: FinderStoreApi;
  config: FinderConfig;
  shortcuts: ShortcutMap | false | undefined;
  contextMenu: ContextMenuContextValue & { hasMenu: () => boolean };
  rootRef: RefObject<HTMLElement | null>;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

export interface RootHandlers {
  handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  handleContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
}

/** Keyboard shortcuts and context-menu delegation for the `<Finder>` root element. */
export function useRootHandlers({
  store,
  config,
  shortcuts,
  contextMenu,
  rootRef,
  onKeyDown,
  onContextMenu,
}: RootHandlerArgs): RootHandlers {
  const shortcutMap = useMemo(() => mergeShortcuts(shortcuts), [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;
      const isMenuKey = event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
      if (isMenuKey && contextMenu.hasMenu()) {
        const focused =
          rootRef.current?.querySelector<HTMLElement>("[data-path][data-focused]") ??
          (document.activeElement as HTMLElement | null);
        const rect = focused?.getBoundingClientRect();
        event.preventDefault();
        contextMenu.open({
          x: rect ? rect.left : 0,
          y: rect ? rect.bottom : 0,
          targetPath: focused?.closest<HTMLElement>("[data-path]")?.dataset.path ?? null,
        });
        return;
      }
      if (isEditableTarget(event.target)) return;
      const name = matchShortcut(event, shortcutMap);
      if (!name) return;
      const def = finderActions[name];
      if (!def.isEnabled(store.getState(), config, {})) return;
      event.preventDefault();
      void def.run(store, config, {});
    },
    [onKeyDown, contextMenu, shortcutMap, store, config, rootRef],
  );

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      onContextMenu?.(event);
      if (event.defaultPrevented || !contextMenu.hasMenu()) return;
      if (isEditableTarget(event.target)) return;
      const itemElement = (event.target as Element).closest<HTMLElement>("[data-path]");
      const targetPath =
        itemElement && rootRef.current?.contains(itemElement)
          ? (itemElement.dataset.path ?? null)
          : null;
      event.preventDefault();
      const state = store.getState();
      if (targetPath && !state.selectedPaths.has(targetPath)) {
        state.setSelection([targetPath]);
      }
      contextMenu.open({ x: event.clientX, y: event.clientY, targetPath });
    },
    [onContextMenu, contextMenu, store, rootRef],
  );

  return { handleKeyDown, handleContextMenu };
}
