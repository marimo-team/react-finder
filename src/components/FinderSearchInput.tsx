import type { JSX, ReactNode } from "react";
import { Input, SearchField } from "react-aria-components";
import type { SearchFieldProps } from "react-aria-components";

import { useFinder } from "../hooks/useFinder.js";
import { useFinderStore } from "../hooks/useFinderStore.js";

export interface FinderSearchInputProps extends Omit<
  SearchFieldProps,
  "value" | "onChange" | "onClear" | "children"
> {
  /** Defaults to a react-aria `<Input />`. */
  children?: ReactNode;
  /** Placeholder for the default `<Input />`. */
  placeholder?: string;
}

/**
 * A react-aria `SearchField` bound to the store query. Uses `adapter.search`
 * when available, otherwise filters the current directory.
 * Emits `data-searching` while an adapter search is in flight.
 */
export function FinderSearchInput({
  children,
  placeholder,
  ...props
}: FinderSearchInputProps): JSX.Element {
  const store = useFinderStore();
  const { query, status } = useFinder((s) => ({
    query: s.search.query,
    status: s.search.status,
  }));
  return (
    <SearchField
      aria-label="Search files"
      value={query}
      onChange={(next) => {
        store.getState().setQuery(next);
      }}
      onClear={() => {
        store.getState().clearSearch();
      }}
      data-searching={status === "searching" || undefined}
      {...props}
    >
      {children ?? <Input placeholder={placeholder} />}
    </SearchField>
  );
}
