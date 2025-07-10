import { Finder, formatDate, formatFileSize, MemoryAdapter } from "@marimo-team/react-finder";
import { useState } from "react";
import type { ReactElement } from "react";
import { SwitchButton, SwitchField } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { bigSeed } from "../shared/seed.js";
import { button, cell, column, emptyState, panel, tableRow, toolbar } from "../shared/styles.js";

// "Many files" holds 2,000 entries: try the toggles in there.
const adapter = new MemoryAdapter({ seed: bigSeed(2000) });

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <SwitchField isSelected={value} onChange={onChange}>
      <SwitchButton className="flex items-center gap-2 text-sm cursor-pointer group">
        <span className="w-9 h-5 rounded-full bg-border p-0.5 transition-colors group-data-[selected]:bg-primary">
          <span className="block w-4 h-4 rounded-full bg-white transition-transform group-data-[selected]:translate-x-4" />
        </span>
        {label}
      </SwitchButton>
    </SwitchField>
  );
}

export default function TableViewDemo(): ReactElement {
  const [virtualized, setVirtualized] = useState(false);
  const [dragAndDrop, setDragAndDrop] = useState(false);
  return (
    <DemoWrapper
      title="Table view"
      description="A react-aria Table. Columns whose id is a sort field (name, size, modifiedAt, kind) and allowsSorting drive the store's sort; headers expose aria-sort and data-sort-direction. Virtualized tables must be their own scroll container."
    >
      <Finder adapter={adapter} className="flex flex-col h-full gap-3">
        <Finder.Toolbar className={toolbar}>
          <Finder.Button action="back" className={button}>
            ← Back
          </Finder.Button>
          <Finder.Button action="up" className={button}>
            ↑ Up
          </Finder.Button>
          <div className="ml-auto flex items-center gap-4">
            <Toggle label="Virtualize" value={virtualized} onChange={setVirtualized} />
            <Toggle label="Drag and drop" value={dragAndDrop} onChange={setDragAndDrop} />
          </div>
        </Finder.Toolbar>
        <Breadcrumbs />
        <div className={`${panel} overflow-hidden`}>
          <Finder.Table
            key={String(virtualized)}
            virtualized={virtualized}
            dragAndDrop={dragAndDrop}
            layoutOptions={{ rowHeight: 37, headingHeight: 37 }}
            className="block h-full w-full overflow-auto outline-none border-separate border-spacing-0"
            style={{ scrollPaddingTop: 37 }}
          >
            <Finder.TableHeader className="w-full">
              <Finder.Column id="name" isRowHeader allowsSorting className={column}>
                Name
              </Finder.Column>
              <Finder.Column id="size" allowsSorting className={`${column} w-28`}>
                Size
              </Finder.Column>
              <Finder.Column id="modifiedAt" allowsSorting className={`${column} w-48`}>
                Modified
              </Finder.Column>
              <Finder.Column id="kind" allowsSorting className={`${column} w-28`}>
                Kind
              </Finder.Column>
            </Finder.TableHeader>
            <Finder.TableBody
              renderEmptyState={({ isLoading }) => (
                <div className={emptyState}>{isLoading ? "Loading…" : "Empty folder"}</div>
              )}
            >
              {(item) => (
                <Finder.Item
                  item={item}
                  className={tableRow}
                  style={{ width: "inherit", height: "inherit" }}
                >
                  <Finder.Cell className={cell}>
                    <span className="flex items-center gap-2">
                      <Icon item={item} />
                      {item.name}
                    </span>
                  </Finder.Cell>
                  <Finder.Cell className={`${cell} text-muted-foreground tabular-nums`}>
                    {item.kind === "file" ? formatFileSize(item.size) : "—"}
                  </Finder.Cell>
                  <Finder.Cell className={`${cell} text-muted-foreground`}>
                    {formatDate(item.modifiedAt)}
                  </Finder.Cell>
                  <Finder.Cell className={`${cell} text-muted-foreground capitalize`}>
                    {item.kind}
                  </Finder.Cell>
                </Finder.Item>
              )}
            </Finder.TableBody>
          </Finder.Table>
        </div>
      </Finder>
    </DemoWrapper>
  );
}
