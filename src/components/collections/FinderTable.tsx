import { cloneElement, createContext, isValidElement, useContext } from "react";
import type { Context, JSX, ReactElement, ReactNode } from "react";
import { Column, Table, TableBody, TableLayout } from "react-aria-components";
import type {
  CellProps,
  ColumnProps,
  SelectionMode,
  TableBodyProps,
  TableHeaderProps,
  TableLayoutProps,
  TableProps,
} from "react-aria-components";

import type { FileItem, SortColumn } from "../../core/types.js";
import { useCollectionProps } from "../../hooks/internal/useCollectionProps.js";
import type {
  CollectionProps,
  DirectoryStatusInfo,
} from "../../hooks/internal/useCollectionProps.js";
import type { FinderDnDOptions } from "../../hooks/internal/useFinderDnD.js";
import { useFinder } from "../../hooks/useFinder.js";
import { useFinderStore } from "../../hooks/useFinderStore.js";
import { CollectionContext } from "../contexts.js";
import { FinderDragHandle } from "./FinderItem.js";
import { CollectionShell } from "./shared.js";

const SORT_COLUMNS: ReadonlySet<string> = new Set(["name", "size", "modifiedAt", "kind"]);

const TableCollectionContext: Context<CollectionProps | null> =
  createContext<CollectionProps | null>(null);

export interface FinderTableProps extends Omit<
  TableProps,
  | "children"
  | "selectedKeys"
  | "defaultSelectedKeys"
  | "onSelectionChange"
  | "onRowAction"
  | "dragAndDropHooks"
  | "sortDescriptor"
  | "onSortChange"
  | "selectionMode"
  | "selectionBehavior"
> {
  path?: string;
  selectionMode?: SelectionMode;
  dragAndDrop?: boolean | FinderDnDOptions;
  virtualized?: boolean;
  layoutOptions?: TableLayoutProps;
  /** `<Finder.TableHeader>` followed by `<Finder.TableBody>`. */
  children: ReactNode;
}

/**
 * A react-aria `Table`. Columns whose `id` is a sort column
 * (`name` | `size` | `modifiedAt` | `kind`) and `allowsSorting` drive the store's sort.
 */
export function FinderTable({
  path: pathProp,
  selectionMode,
  dragAndDrop,
  virtualized,
  layoutOptions,
  children,
  ...props
}: FinderTableProps): JSX.Element {
  const c = useCollectionProps({
    kind: "table",
    path: pathProp,
    selectionMode,
    dragAndDrop,
  });
  const store = useFinderStore();
  const sort = useFinder((s) => s.sort);

  const table = (
    <Table
      aria-label="Files"
      selectionMode={c.selectionMode}
      selectionBehavior={c.selectionBehavior}
      selectedKeys={c.selectedKeys}
      onSelectionChange={c.onSelectionChange}
      onRowAction={c.onAction}
      dragAndDropHooks={c.dragAndDropHooks}
      sortDescriptor={{ column: sort.column, direction: sort.direction }}
      onSortChange={(descriptor) => {
        const column = String(descriptor.column);
        if (SORT_COLUMNS.has(column)) {
          store.getState().setSort({
            column: column as SortColumn,
            direction: descriptor.direction,
          });
        }
      }}
      {...c.domProps}
      {...props}
    >
      {children}
    </Table>
  );

  return (
    <CollectionShell
      context={{
        kind: "table",
        path: c.path,
        dragAndDrop: Boolean(dragAndDrop),
      }}
      collection={c}
      virtualized={virtualized}
      layout={TableLayout}
      layoutOptions={layoutOptions}
    >
      <TableCollectionContext.Provider value={c}>{table}</TableCollectionContext.Provider>
    </CollectionShell>
  );
}

export interface FinderTableBodyProps extends Omit<
  TableBodyProps<FileItem>,
  "children" | "items" | "renderEmptyState"
> {
  children: (item: FileItem) => ReactElement;
  renderEmptyState?: (status: DirectoryStatusInfo) => ReactNode;
}

/**
 * Rows may only contain cells, so the default drag handle goes inside the
 * first `Finder.Cell` of each row (unless the item opts out with
 * `dragHandle={false}` or supplies its own).
 */
function withDragHandle(row: ReactElement): ReactElement {
  const rowProps = row.props as {
    children?: ReactNode;
    dragHandle?: ReactNode | false;
  };
  if (rowProps.dragHandle === false) return row;
  const handle = rowProps.dragHandle ?? <FinderDragHandle />;
  const rowChildren = rowProps.children;
  const cells: ReactNode[] = Array.isArray(rowChildren)
    ? (rowChildren as ReactNode[])
    : [rowChildren];
  let placed = false;
  // The cells are rebuilt into a new array, so every element needs a key.
  const nextCells = cells.map((cell, index) => {
    if (!isValidElement(cell)) return cell;
    const element = cell as ReactElement<{ children?: ReactNode }>;
    const key = element.key ?? `finder-cell-${index}`;
    if (placed) return cloneElement(element, { key });
    placed = true;
    return cloneElement(element, {
      key,
      children: (
        <>
          {element.props.children}
          {handle}
        </>
      ),
    });
  });
  return cloneElement(row as ReactElement<{ children?: ReactNode }>, {
    children: nextCells,
  });
}

export function FinderTableBody({
  children,
  renderEmptyState,
  ...props
}: FinderTableBodyProps): JSX.Element {
  const c = useContext(TableCollectionContext);
  const collection = useContext(CollectionContext);
  if (!c) throw new Error("Finder.TableBody must be inside Finder.Table");
  const render = collection?.dragAndDrop
    ? (item: FileItem) => withDragHandle(children(item))
    : children;
  return (
    <TableBody
      items={c.keyedItems}
      renderEmptyState={renderEmptyState ? () => renderEmptyState(c.status) : undefined}
      {...props}
    >
      {render}
    </TableBody>
  );
}

export interface FinderColumnProps extends Omit<ColumnProps, "id"> {
  /** Use a sort column id (`name`, `size`, `modifiedAt`, `kind`) with `allowsSorting`. */
  id: SortColumn | (string & Record<never, never>);
}

export function FinderColumn(props: FinderColumnProps): JSX.Element {
  return <Column {...props} />;
}

export type FinderTableHeaderProps = TableHeaderProps<object>;
export type FinderCellProps = CellProps;
export { Cell as FinderCell, TableHeader as FinderTableHeader } from "react-aria-components";
