import { useContext } from "react";
import type { CSSProperties, JSX, ReactNode } from "react";
import {
  Button,
  Collection,
  GridListItem,
  Row,
  TreeItem,
  TreeItemContent,
  VisuallyHidden,
} from "react-aria-components";
import type {
  GridListItemRenderProps,
  RowRenderProps,
  SelectionMode,
  TreeItemContentRenderProps,
  TreeItemRenderProps,
} from "react-aria-components";

import type { FileItem } from "../../core/types.js";
import { CollectionContext, ItemContext, ItemStateContext } from "../contexts.js";
import type {
  CollectionContextValue,
  ItemStateContextValue,
  SelectionBehavior,
} from "../contexts.js";

/** Render-prop state shared by GridListItem, Row and TreeItem. */
export interface ItemRenderProps {
  isHovered: boolean;
  isPressed: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isFocusVisible: boolean;
  isDisabled: boolean;
  selectionMode: SelectionMode;
  selectionBehavior: SelectionBehavior;
  allowsDragging?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
}

export interface FinderItemRenderProps extends ItemRenderProps {
  item: FileItem;
  /** Inline rename is active for this item. */
  isEditing: boolean;
  /** The item is on the clipboard as a "cut". */
  isCut: boolean;
  /** The item's directory listing is loading (tree). */
  isLoading: boolean;
  /** 1 for list and table rows; nesting level in a tree. */
  level: number;
  isExpanded: boolean;
  hasChildItems: boolean;
}

type RenderFn<T> = (props: FinderItemRenderProps) => T;

export interface FinderItemProps {
  item: FileItem;
  /** In a table, children must be `Finder.Cell`s (render props are not available). */
  children?: ReactNode | RenderFn<ReactNode>;
  className?: string | RenderFn<string>;
  style?: CSSProperties | RenderFn<CSSProperties>;
  isDisabled?: boolean;
  /** Extra handler run when the item is activated (after the default open/navigate). */
  onAction?: () => void;
  /**
   * Drag handle rendered when the collection has drag and drop enabled. Defaults
   * to a visually hidden `<Button slot="drag">` so keyboard and screen-reader
   * users can start a drag. Pass `false` to render your own `<Button slot="drag">`.
   */
  dragHandle?: ReactNode | false;
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}

/** Default drag handle: invisible until focused, announced to assistive tech. */
export function FinderDragHandle({ label = "Drag" }: { label?: string }): JSX.Element {
  return (
    <VisuallyHidden isFocusable>
      <Button slot="drag" aria-label={label} data-finder-drag-handle="" />
    </VisuallyHidden>
  );
}

/**
 * One file or directory. Renders a `GridListItem`, `Row` or `TreeItem`
 * depending on the enclosing collection, so the same component works in
 * `Finder.List`, `Finder.Table` and `Finder.Tree`.
 *
 * Emits `data-kind`, `data-path`, `data-editing`, `data-cut`, `data-loading`
 * in addition to react-aria's `data-selected`, `data-focused`, `data-hovered`,
 * `data-dragging`, `data-drop-target`, `data-expanded`, `data-level`, ...
 *
 * Items hold no store subscriptions: per-item state comes from the enclosing
 * collection through `ItemStateContext`.
 */
export function FinderItem(props: FinderItemProps): JSX.Element {
  const collection = useContext(CollectionContext);
  if (!collection) {
    throw new Error("Finder.Item must be rendered inside Finder.List, Finder.Table or Finder.Tree");
  }
  if (collection.kind === "list") return <ListItem {...props} />;
  if (collection.kind === "table") return <TableRow {...props} />;
  return <TreeNode {...props} collection={collection} />;
}

interface Prepared {
  handle: ReactNode;
  shared: Record<string, unknown>;
  extend: (
    rp: ItemRenderProps &
      Partial<Pick<TreeItemRenderProps, "level" | "isExpanded" | "hasChildItems">>,
  ) => FinderItemRenderProps;
  wrap: <T>(value: T | RenderFn<T> | undefined) => T | ((rp: ItemRenderProps) => T) | undefined;
  staticChildren: ReactNode;
  renderChildren: RenderFn<ReactNode> | null;
  isEditing: boolean;
  isLoading: boolean;
}

function usePrepared(
  {
    item,
    children,
    className,
    style,
    isDisabled,
    onAction,
    dragHandle,
    ...dataProps
  }: FinderItemProps,
  state: ItemStateContextValue,
  allowsDragging: boolean,
): Prepared {
  const isEditing = state.editingPath === item.path;
  const isCut = state.cutPaths.has(item.path);
  const isLoading = state.loadingPaths.has(item.path);
  const isDirectory = item.kind === "directory";
  const extend: Prepared["extend"] = (rp) => ({
    ...rp,
    item,
    isEditing,
    isCut,
    isLoading,
    level: rp.level ?? 1,
    isExpanded: rp.isExpanded ?? false,
    hasChildItems: rp.hasChildItems ?? isDirectory,
  });
  const wrap: Prepared["wrap"] = (value) =>
    typeof value === "function"
      ? (rp: ItemRenderProps) => (value as RenderFn<never>)(extend(rp))
      : value;
  const renderChildren = typeof children === "function" ? children : null;
  const handle =
    !allowsDragging || dragHandle === false ? null : (dragHandle ?? <FinderDragHandle />);
  return {
    handle,
    shared: {
      id: item.path,
      textValue: item.name,
      value: item,
      isDisabled,
      onAction,
      className: wrap(className),
      style: wrap(style),
      "data-kind": item.kind,
      "data-path": item.path,
      "data-editing": isEditing || undefined,
      "data-cut": isCut || undefined,
      "data-loading": isLoading || undefined,
      ...dataProps,
    },
    extend,
    wrap,
    staticChildren: renderChildren ? null : (children as ReactNode),
    renderChildren,
    isEditing,
    isLoading,
  };
}

function ListItem(props: FinderItemProps) {
  const collection = useContext(CollectionContext);
  const p = usePrepared(props, useContext(ItemStateContext), collection?.dragAndDrop ?? false);
  return (
    <GridListItem
      {...p.shared}
      textValue={props.item.name}
      className={
        p.shared.className as string | ((rp: GridListItemRenderProps) => string) | undefined
      }
      style={
        p.shared.style as
          | CSSProperties
          | ((rp: GridListItemRenderProps) => CSSProperties)
          | undefined
      }
    >
      {p.renderChildren ? (
        (rp: GridListItemRenderProps) => (
          <ItemContext.Provider value={props.item}>
            {p.handle}
            {p.renderChildren?.(p.extend(rp))}
          </ItemContext.Provider>
        )
      ) : (
        <ItemContext.Provider value={props.item}>
          {p.handle}
          {p.staticChildren}
        </ItemContext.Provider>
      )}
    </GridListItem>
  );
}

function TableRow(props: FinderItemProps) {
  // Table rows may only contain cells; `Finder.TableBody` places the handle in the first cell.
  const p = usePrepared(props, useContext(ItemStateContext), false);
  return (
    <Row
      {...p.shared}
      textValue={props.item.name}
      className={p.shared.className as string | ((rp: RowRenderProps) => string) | undefined}
      style={p.shared.style as CSSProperties | ((rp: RowRenderProps) => CSSProperties) | undefined}
    >
      <ItemContext.Provider value={props.item}>{p.staticChildren}</ItemContext.Provider>
    </Row>
  );
}

function TreeNode(props: FinderItemProps & { collection: CollectionContextValue }) {
  const state = useContext(ItemStateContext);
  const { collection, ...itemProps } = props;
  const p = usePrepared(itemProps, state, collection.dragAndDrop ?? false);
  const isDirectory = props.item.kind === "directory";
  const children = isDirectory && state.childrenOf ? state.childrenOf(props.item.path) : undefined;
  return (
    <TreeItem
      {...(p.shared as Record<string, never>)}
      textValue={props.item.name}
      hasChildItems={isDirectory}
      className={p.shared.className as string | ((rp: TreeItemRenderProps) => string) | undefined}
      style={
        p.shared.style as CSSProperties | ((rp: TreeItemRenderProps) => CSSProperties) | undefined
      }
    >
      <TreeItemContent>
        {p.renderChildren ? (
          (rp: TreeItemContentRenderProps) => (
            <ItemContext.Provider value={props.item}>
              {p.renderChildren?.(p.extend(rp))}
              {p.handle}
            </ItemContext.Provider>
          )
        ) : (
          <ItemContext.Provider value={props.item}>
            {p.handle}
            {p.staticChildren}
          </ItemContext.Provider>
        )}
      </TreeItemContent>
      {children && collection.renderItem && (
        <Collection items={children}>{collection.renderItem}</Collection>
      )}
    </TreeItem>
  );
}
