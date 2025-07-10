import { dirname, Finder, MemoryAdapter } from "@marimo-team/react-finder";
import type { ReactElement } from "react";
import { Input } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { button, emptyState, input, panel, row, toolbar } from "../shared/styles.js";

// A little latency makes the debounced "searching" state visible.
const adapter = new MemoryAdapter({ seed: demoSeed, latency: 150 });

export default function SearchDemo(): ReactElement {
  return (
    <DemoWrapper
      title="Search"
      description="Finder.SearchInput is a react-aria SearchField bound to the store. MemoryAdapter implements search(), so results come from the whole subtree (debounced, aborted on each keystroke). Adapters without search() fall back to client-side filtering."
    >
      <Finder adapter={adapter} className="flex flex-col h-full gap-3">
        <Finder.Toolbar className={toolbar}>
          <Finder.Button action="up" className={button}>
            ↑ Up
          </Finder.Button>
          <Finder.SearchInput className="flex-1 min-w-[200px] group">
            <Input
              placeholder="Search this folder and below…"
              className={`${input} group-data-[searching]:animate-pulse`}
            />
          </Finder.SearchInput>
          <Finder.State>
            {({ search }) => {
              let label = "";
              if (search.status === "searching") label = "Searching…";
              else if (search.results) label = `${search.results.length} hits`;
              return <span className="text-xs text-muted-foreground w-20">{label}</span>;
            }}
          </Finder.State>
        </Finder.Toolbar>
        <Breadcrumbs />
        <div className={panel}>
          <Finder.State>
            {({ search }) => (
              <Finder.List
                className="outline-none"
                renderEmptyState={({ isLoading }) => {
                  let label = "Empty folder";
                  if (isLoading || search.status === "searching") label = "Loading…";
                  else if (search.query) label = "No matches";
                  return <div className={emptyState}>{label}</div>;
                }}
              >
                {(item) => (
                  <Finder.Item item={item} className={row}>
                    <Icon item={item} />
                    <span className="text-sm">{item.name}</span>
                    {search.results && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {dirname(item.path)}
                      </span>
                    )}
                  </Finder.Item>
                )}
              </Finder.List>
            )}
          </Finder.State>
        </div>
      </Finder>
    </DemoWrapper>
  );
}
