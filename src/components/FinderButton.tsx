import type { JSX } from "react";
import { Button } from "react-aria-components";
import type { ButtonProps } from "react-aria-components";

import type { FinderActionName } from "../actions/actions.js";
import { useFinderAction } from "../hooks/internal/useFinderAction.js";

export interface FinderButtonProps extends ButtonProps {
  action: FinderActionName;
  /** Only reflect enablement, do not run the action on press (e.g. as a DialogTrigger). */
  trigger?: boolean;
  /** Apply the action to this item instead of the selection. */
  targetPath?: string;
}

/**
 * A react-aria `Button` bound to a Finder action. Disabled automatically when
 * the action is not available. Emits `data-action`.
 */
export function FinderButton({
  action,
  trigger,
  targetPath,
  isDisabled,
  onPress,
  ...props
}: FinderButtonProps): JSX.Element {
  const { run, isEnabled } = useFinderAction(action, { targetPath });
  return (
    <Button
      data-action={action}
      isDisabled={isDisabled === true || !isEnabled}
      onPress={(event) => {
        if (!trigger) run();
        onPress?.(event);
      }}
      {...props}
    />
  );
}
