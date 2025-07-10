import { Finder, MemoryAdapter } from "@marimo-team/react-finder";
import type { ReactElement } from "react";

import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { emptyState, panel, row } from "../shared/styles.js";

const adapter = new MemoryAdapter({ seed: demoSeed });

export default function MinimalDemo(): ReactElement {
  return (
    <DemoWrapper
      title="Minimal"
      description="A list of the current directory. Double-click or press Enter on a folder to open it; Backspace goes up. Every state is styled through data-* attributes."
    >
      <Finder adapter={adapter} className="flex flex-col h-full">
        <div className={panel}>
          <Finder.List
            className="outline-none"
            renderEmptyState={({ isLoading }) => (
              <div className={emptyState}>{isLoading ? "Loading…" : "Empty folder"}</div>
            )}
          >
            {(item) => (
              <Finder.Item item={item} className={row}>
                <Icon item={item} />
                <span className="text-sm">{item.name}</span>
              </Finder.Item>
            )}
          </Finder.List>
        </div>
      </Finder>
    </DemoWrapper>
  );
}
