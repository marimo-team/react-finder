import type { JSX, ReactElement, ReactNode } from "react";
import { Virtualizer } from "react-aria-components";
import type { VirtualizerProps } from "react-aria-components";

import type { FileItem } from "../../core/types.js";
import type { CollectionProps } from "../../hooks/internal/useCollectionProps.js";
import { CollectionContext, ItemStateContext } from "../contexts.js";
import type { CollectionContextValue } from "../contexts.js";

export type OmitCollectionInternals<P> = Omit<
  P,
  | "children"
  | "items"
  | "selectedKeys"
  | "defaultSelectedKeys"
  | "onSelectionChange"
  | "onAction"
  | "dragAndDropHooks"
  | "renderEmptyState"
  | "selectionMode"
  | "selectionBehavior"
>;

export interface CollectionShellProps<O> {
  context: CollectionContextValue;
  collection: CollectionProps;
  virtualized?: boolean;
  layout: VirtualizerProps<O>["layout"];
  layoutOptions?: O;
  children: ReactElement;
}

/** Contexts every collection provides, plus the optional react-aria Virtualizer. */
export function CollectionShell<O>({
  context,
  collection,
  virtualized,
  layout,
  layoutOptions,
  children,
}: CollectionShellProps<O>): JSX.Element {
  return (
    <CollectionContext.Provider value={context}>
      <ItemStateContext.Provider value={collection.itemState}>
        {virtualized ? (
          <Virtualizer layout={layout} layoutOptions={layoutOptions}>
            {children}
          </Virtualizer>
        ) : (
          children
        )}
      </ItemStateContext.Provider>
    </CollectionContext.Provider>
  );
}

export type RenderItem = (item: FileItem) => ReactElement;
export type EmptyStateRenderer<S> = ((status: S) => ReactNode) | undefined;
