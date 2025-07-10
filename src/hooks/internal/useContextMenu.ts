import { useCallback, useContext, useMemo, useRef, useState } from "react";

import { ContextMenuContext } from "../../components/contexts.js";
import type { ContextMenuContextValue, ContextMenuState } from "../../components/contexts.js";

/** Owns context-menu state for a Finder root. */
export function useContextMenuState(): ContextMenuContextValue & {
  hasMenu: () => boolean;
} {
  const [state, setState] = useState<ContextMenuState | null>(null);
  const mounted = useRef(0);
  const open = useCallback((next: ContextMenuState) => {
    setState(next);
  }, []);
  const close = useCallback(() => {
    setState(null);
  }, []);
  const register = useCallback(() => {
    mounted.current += 1;
    return () => {
      mounted.current -= 1;
    };
  }, []);
  const hasMenu = useCallback(() => mounted.current > 0, []);
  return useMemo(
    () => ({ state, open, close, register, hasMenu }),
    [state, open, close, register, hasMenu],
  );
}

export function useContextMenu(): ContextMenuContextValue {
  const value = useContext(ContextMenuContext);
  if (!value) {
    throw new Error("Finder.ContextMenu must be rendered inside <Finder>");
  }
  return value;
}
