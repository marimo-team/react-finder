import { useEffect, useRef } from "react";
import type { JSX, ReactNode } from "react";
import { Menu, MenuItem, Popover, Separator } from "react-aria-components";
import type { MenuItemProps, MenuProps, PopoverProps, SeparatorProps } from "react-aria-components";

import type { FinderActionName } from "../actions/actions.js";
import { selectSelectedItems } from "../core/selectors.js";
import type { FileItem } from "../core/types.js";
import { useContextMenu } from "../hooks/internal/useContextMenu.js";
import { useFinderAction } from "../hooks/internal/useFinderAction.js";
import { useFinder } from "../hooks/useFinder.js";

export interface FinderContextMenuRenderProps {
  /** Item that was right-clicked, or null for the directory background. */
  target: FileItem | null;
  selection: FileItem[];
  close: () => void;
}

export interface FinderContextMenuProps extends Omit<MenuProps<object>, "children"> {
  children: ReactNode | ((props: FinderContextMenuRenderProps) => ReactNode);
  popoverProps?: Omit<PopoverProps, "triggerRef" | "isOpen" | "onOpenChange">;
}

/**
 * A react-aria `Menu` in a `Popover` anchored at the pointer. Opened by the
 * `<Finder>` root on right-click / Shift+F10 / the Menu key. Rendering this
 * component is what enables the custom context menu.
 */
export function FinderContextMenu({
  children,
  popoverProps,
  ...menuProps
}: FinderContextMenuProps): JSX.Element {
  const menu = useContextMenu();
  const { register } = menu;
  const anchorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => register(), [register]);

  const { target, selection } = useFinder((s) => ({
    target: menu.state?.targetPath
      ? (s.cache[s.currentLocationId]?.entries[menu.state.targetPath] ?? null)
      : null,
    selection: selectSelectedItems(s),
  }));

  const content =
    typeof children === "function" ? children({ target, selection, close: menu.close }) : children;

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        data-finder-context-anchor=""
        style={{
          position: "fixed",
          left: menu.state?.x ?? 0,
          top: menu.state?.y ?? 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      />
      <Popover
        triggerRef={anchorRef}
        isOpen={menu.state !== null}
        onOpenChange={(open) => {
          if (!open) menu.close();
        }}
        placement="bottom start"
        offset={0}
        shouldFlip
        data-finder-context-menu=""
        {...popoverProps}
      >
        {/* oxlint-disable-next-line jsx-a11y/no-autofocus -- react-aria's `autoFocus` moves
            virtual focus to the first menu item (the WAI-ARIA menu pattern); it is not the
            DOM `autofocus` attribute. */}
        <Menu aria-label="Context menu" autoFocus="first" onClose={menu.close} {...menuProps}>
          {content}
        </Menu>
      </Popover>
    </>
  );
}

export interface FinderMenuItemProps extends Omit<MenuItemProps, "onAction"> {
  /** Bind to a Finder action; enablement and `data-action` come for free. */
  action?: FinderActionName;
  onAction?: () => void;
}

export function FinderMenuItem({
  action,
  onAction,
  isDisabled,
  ...props
}: FinderMenuItemProps): JSX.Element {
  const menu = useContextMenu();
  const handle = useFinderAction(action ?? "refresh", {
    targetPath: menu.state?.targetPath ?? null,
  });
  const enabled = action ? handle.isEnabled : true;
  return (
    <MenuItem
      data-action={action}
      isDisabled={isDisabled === true || !enabled}
      onAction={() => {
        if (action) handle.run();
        onAction?.();
      }}
      {...props}
    />
  );
}

export type FinderMenuSeparatorProps = SeparatorProps;

export function FinderMenuSeparator(props: FinderMenuSeparatorProps): JSX.Element {
  return <Separator {...props} />;
}
