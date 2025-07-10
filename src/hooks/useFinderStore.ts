import { useContext } from "react";

import { FinderStoreContext } from "../components/contexts.js";
import type { FinderStoreApi } from "../core/store/createFinderStore.js";

/** The raw store API. Prefer `useFinder(selector)` for reading state. */
export function useFinderStore(): FinderStoreApi {
  const store = useContext(FinderStoreContext);
  if (!store) {
    throw new Error("react-finder components must be rendered inside <Finder>");
  }
  return store;
}
