import { useCallback, useContext } from "react";

import { finderActions } from "../../actions/actions.js";
import type { ActionContext, FinderActionName } from "../../actions/actions.js";
import { FinderConfigContext } from "../../components/contexts.js";
import { useFinder } from "../useFinder.js";
import { useFinderStore } from "../useFinderStore.js";

export interface FinderActionHandle {
  run: () => void;
  isEnabled: boolean;
}

export function useFinderAction(
  name: FinderActionName,
  ctx: ActionContext = {},
): FinderActionHandle {
  const store = useFinderStore();
  const config = useContext(FinderConfigContext);
  const def = finderActions[name];
  const targetPath = ctx.targetPath ?? null;
  const isEnabled = useFinder((state) => def.isEnabled(state, config, { targetPath }));
  const run = useCallback(() => {
    if (!def.isEnabled(store.getState(), config, { targetPath })) return;
    void def.run(store, config, { targetPath });
  }, [def, store, config, targetPath]);
  return { run, isEnabled };
}
