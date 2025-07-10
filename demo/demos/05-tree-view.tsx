import { Finder, MemoryAdapter } from "@marimo-team/react-finder";
import type { ReactElement } from "react";
import { Button } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { chevronGlyph, Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { chevron, emptyState, panel, row, treeRow } from "../shared/styles.js";

const adapter = new MemoryAdapter({ seed: demoSeed });

export default function TreeViewDemo(): ReactElement {
  return (
    <DemoWrapper
      title="Tree sidebar"
      description="Finder.Tree lazily loads children from the same directory cache the list uses. navigateOnSelect keeps the tree selection in sync with the current path. Drag items between the tree and the list."
    >
      <Finder adapter={adapter} className="grid grid-cols-[260px_1fr] gap-3 h-full">
        <div className={`${panel} p-2`}>
          <Finder.Tree navigateOnSelect dragAndDrop className="outline-none">
            {(item) => (
              <Finder.Item item={item} className={treeRow}>
                {({ hasChildItems, isExpanded, isLoading, level }) => (
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingInlineStart: (level - 1) * 16 }}
                  >
                    {hasChildItems ? (
                      <Button slot="chevron" className={chevron}>
                        {chevronGlyph(isLoading, isExpanded)}
                      </Button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <Icon item={item} />
                    <span className="text-sm truncate">{item.name}</span>
                  </div>
                )}
              </Finder.Item>
            )}
          </Finder.Tree>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <Breadcrumbs />
          <div className={panel}>
            <Finder.List
              dragAndDrop
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
        </div>
      </Finder>
    </DemoWrapper>
  );
}
