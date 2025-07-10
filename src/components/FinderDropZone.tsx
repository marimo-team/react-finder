import type { JSX, ReactNode } from "react";
import { DropZone } from "react-aria-components";
import type { DropZoneProps, DropZoneRenderProps } from "react-aria-components";

import { normalizePath } from "../core/path.js";
import { resolveDropOperation } from "../dnd/dragData.js";
import { useDropHandler } from "../hooks/internal/useFinderDnD.js";
import type { FinderDnDOptions } from "../hooks/internal/useFinderDnD.js";
import { useFinder } from "../hooks/useFinder.js";

export interface FinderDropZoneProps
  extends
    Omit<DropZoneProps, "onDrop" | "getDropOperation" | "children">,
    Pick<FinderDnDOptions, "operation" | "acceptExternalFiles" | "onDropFromOtherFinder"> {
  /** Directory receiving the drop; defaults to the current path. */
  targetPath?: string;
  children?: ReactNode | ((props: DropZoneRenderProps & { targetPath: string }) => ReactNode);
}

/** A react-aria `DropZone` that accepts Finder items (move/copy) and OS files (upload). */
export function FinderDropZone({
  targetPath: targetProp,
  operation,
  acceptExternalFiles,
  onDropFromOtherFinder,
  children,
  ...props
}: FinderDropZoneProps): JSX.Element {
  const currentPath = useFinder((s) => s.currentPath);
  const targetPath = normalizePath(targetProp ?? currentPath);
  const { handleDrop, acceptExternal, preferred } = useDropHandler({
    operation,
    acceptExternalFiles,
    onDropFromOtherFinder,
  });

  return (
    <DropZone
      data-path={targetPath}
      getDropOperation={(types, allowedOperations) =>
        resolveDropOperation({
          targetPath,
          types,
          allowedOperations,
          preferred,
          acceptExternal,
        })
      }
      onDrop={(event) => {
        void handleDrop(event.items, targetPath, event.dropOperation);
      }}
      {...props}
    >
      {typeof children === "function"
        ? (rp: DropZoneRenderProps) => children({ ...rp, targetPath })
        : children}
    </DropZone>
  );
}
