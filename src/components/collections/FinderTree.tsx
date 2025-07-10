import { useEffect, useMemo } from "react";
import type { JSX, ReactNode } from "react";
import { ListLayout, Tree } from "react-aria-components";
import type { Key, ListLayoutOptions, SelectionMode, TreeProps } from "react-aria-components";

import { normalizePath } from "../../core/path.js";
import type { FileItem } from "../../core/types.js";
import { useCollectionProps } from "../../hooks/internal/useCollectionProps.js";
import type { DirectoryStatusInfo } from "../../hooks/internal/useCollectionProps.js";
import type { FinderDnDOptions } from "../../hooks/internal/useFinderDnD.js";
import { useFinder } from "../../hooks/useFinder.js";
import { useFinderStore } from "../../hooks/useFinderStore.js";
import { CollectionShell } from "./shared.js";
import type { OmitCollectionInternals, RenderItem } from "./shared.js";

export interface FinderTreeProps extends Omit<
  OmitCollectionInternals<TreeProps<FileItem>>,
  "expandedKeys" | "defaultExpandedKeys" | "onExpandedChange"
> {
  /** Directory whose children form the top level. Default "/". */
  rootPath?: string;
  /** Rendered for every node at every level; must return `<Finder.Item>`. */
  children: RenderItem;
  /** Sidebar mode: the selected node mirrors `currentPath` and selecting navigates. */
  navigateOnSelect?: boolean;
  selectionMode?: SelectionMode;
  dragAndDrop?: boolean | FinderDnDOptions;
  virtualized?: boolean;
  layoutOptions?: ListLayoutOptions;
  renderEmptyState?: (status: DirectoryStatusInfo) => ReactNode;
}

/** A react-aria `Tree` with lazily loaded children from the shared directory cache. */
export function FinderTree({
  rootPath = "/",
  children,
  navigateOnSelect,
  selectionMode,
  dragAndDrop,
  virtualized,
  layoutOptions,
  renderEmptyState,
  ...props
}: FinderTreeProps): JSX.Element {
  const root = normalizePath(rootPath);
  const store = useFinderStore();
  const c = useCollectionProps({
    kind: "tree",
    path: root,
    selectionMode,
    dragAndDrop,
    navigateOnSelect,
  });
  const expandedPaths = useFinder((s) => s.expandedPaths);

  useEffect(() => {
    void store.getState().loadDirectory(root);
  }, [store, root]);

  const context = useMemo(
    () => ({
      kind: "tree" as const,
      path: root,
      renderItem: children,
      dragAndDrop: Boolean(dragAndDrop),
    }),
    [root, children, dragAndDrop],
  );

  return (
    <CollectionShell
      context={context}
      collection={c}
      virtualized={virtualized}
      layout={ListLayout}
      layoutOptions={layoutOptions}
    >
      <Tree
        aria-label="Folders"
        items={c.keyedItems}
        selectionMode={c.selectionMode}
        selectionBehavior={c.selectionBehavior}
        selectedKeys={c.selectedKeys}
        onSelectionChange={c.onSelectionChange}
        onAction={c.onAction}
        dragAndDropHooks={c.dragAndDropHooks}
        expandedKeys={expandedPaths as Set<Key>}
        onExpandedChange={(keys) => {
          store.getState().setExpanded([...keys].map(String));
        }}
        renderEmptyState={renderEmptyState ? () => renderEmptyState(c.status) : undefined}
        {...c.domProps}
        {...props}
      >
        {children}
      </Tree>
    </CollectionShell>
  );
}
