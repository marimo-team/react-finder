import type { JSX, ReactNode } from "react";
import { GridLayout, GridList, ListLayout } from "react-aria-components";
import type {
  GridLayoutOptions,
  GridListProps,
  ListLayoutOptions,
  SelectionMode,
} from "react-aria-components";

import type { FileItem } from "../../core/types.js";
import { useCollectionProps } from "../../hooks/internal/useCollectionProps.js";
import type { DirectoryStatusInfo } from "../../hooks/internal/useCollectionProps.js";
import type { FinderDnDOptions } from "../../hooks/internal/useFinderDnD.js";
import { CollectionShell } from "./shared.js";
import type { OmitCollectionInternals, RenderItem } from "./shared.js";

export type { OmitCollectionInternals } from "./shared.js";

export interface FinderListProps extends OmitCollectionInternals<GridListProps<FileItem>> {
  /** Directory to show; defaults to the current path. */
  path?: string;
  /** "stack" (default) or "grid". */
  layout?: "stack" | "grid";
  children: RenderItem;
  /** Overrides the root `selectionMode`. */
  selectionMode?: SelectionMode;
  dragAndDrop?: boolean | FinderDnDOptions;
  /** Wrap in a react-aria `Virtualizer` (set `layoutOptions.rowHeight` / `minItemSize`). */
  virtualized?: boolean;
  layoutOptions?: ListLayoutOptions | GridLayoutOptions;
  renderEmptyState?: (status: DirectoryStatusInfo) => ReactNode;
}

/** A react-aria `GridList` of the current (or given) directory. */
export function FinderList({
  path: pathProp,
  layout = "stack",
  children,
  selectionMode,
  dragAndDrop,
  virtualized,
  layoutOptions,
  renderEmptyState,
  ...props
}: FinderListProps): JSX.Element {
  const c = useCollectionProps({
    kind: "list",
    path: pathProp,
    selectionMode,
    dragAndDrop,
  });

  return (
    <CollectionShell
      context={{
        kind: "list",
        path: c.path,
        dragAndDrop: Boolean(dragAndDrop),
      }}
      collection={c}
      virtualized={virtualized}
      layout={layout === "grid" ? GridLayout : ListLayout}
      layoutOptions={layoutOptions}
    >
      <GridList
        aria-label="Files"
        layout={layout}
        items={c.keyedItems}
        selectionMode={c.selectionMode}
        selectionBehavior={c.selectionBehavior}
        selectedKeys={c.selectedKeys}
        onSelectionChange={c.onSelectionChange}
        onAction={c.onAction}
        dragAndDropHooks={c.dragAndDropHooks}
        renderEmptyState={renderEmptyState ? () => renderEmptyState(c.status) : undefined}
        {...c.domProps}
        {...props}
      >
        {children}
      </GridList>
    </CollectionShell>
  );
}
