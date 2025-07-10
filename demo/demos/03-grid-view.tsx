import { Finder, MemoryAdapter } from "@marimo-team/react-finder";
import { useState } from "react";
import type { ReactElement } from "react";
import { Size, SwitchButton, SwitchField } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { bigSeed } from "../shared/seed.js";
import { button, emptyState, gridCell, panel, toolbar } from "../shared/styles.js";

const adapter = new MemoryAdapter({ seed: bigSeed(5000) });

export default function GridViewDemo(): ReactElement {
  const [virtualized, setVirtualized] = useState(true);
  return (
    <DemoWrapper
      title="Grid view"
      description='Finder.List with layout="grid". Open "Many files" (5,000 entries) and toggle virtualization: a react-aria Virtualizer with GridLayout keeps it smooth.'
    >
      <Finder adapter={adapter} className="flex flex-col h-full gap-3">
        <Finder.Toolbar className={toolbar}>
          <Finder.Button action="back" className={button}>
            ← Back
          </Finder.Button>
          <Finder.Button action="up" className={button}>
            ↑ Up
          </Finder.Button>
          <SwitchField isSelected={virtualized} onChange={setVirtualized} className="ml-auto">
            <SwitchButton className="flex items-center gap-2 text-sm cursor-pointer group">
              <span className="w-9 h-5 rounded-full bg-border p-0.5 transition-colors group-data-[selected]:bg-primary">
                <span className="block w-4 h-4 rounded-full bg-white transition-transform group-data-[selected]:translate-x-4" />
              </span>
              Virtualized
            </SwitchButton>
          </SwitchField>
        </Finder.Toolbar>
        <Breadcrumbs />
        <div className={`${panel} overflow-hidden`}>
          <Finder.List
            key={virtualized ? "virtual" : "plain"}
            layout="grid"
            virtualized={virtualized}
            layoutOptions={{
              minItemSize: new Size(128, 112),
              minSpace: new Size(8, 8),
            }}
            className={
              virtualized
                ? "block h-full overflow-auto outline-none p-3"
                : "outline-none p-3 gap-2 grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))]"
            }
            renderEmptyState={({ isLoading }) => (
              <div className={emptyState}>{isLoading ? "Loading…" : "Empty folder"}</div>
            )}
          >
            {(item) => (
              <Finder.Item item={item} className={gridCell}>
                <Icon item={item} className="text-3xl leading-none" />
                <span className="text-xs w-full truncate">{item.name}</span>
              </Finder.Item>
            )}
          </Finder.List>
        </div>
        <Finder.State>
          {({ items, selectedItems }) => (
            <p className="text-xs text-muted-foreground">
              {items.length} items · {selectedItems.length} selected
            </p>
          )}
        </Finder.State>
      </Finder>
    </DemoWrapper>
  );
}
