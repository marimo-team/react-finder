import type { JSX } from "react";
import { Toolbar } from "react-aria-components";
import type { ToolbarProps } from "react-aria-components";

export type FinderToolbarProps = ToolbarProps;

/** A react-aria `Toolbar` (arrow-key navigation between buttons). */
export function FinderToolbar(props: FinderToolbarProps): JSX.Element {
  return <Toolbar aria-label="File actions" data-finder-toolbar="" {...props} />;
}
