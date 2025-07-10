import {
  createSessionStorageAdapter,
  Finder,
  formatDate,
  formatFileSize,
  MemoryAdapter,
} from "@marimo-team/react-finder";
import type { FinderError, Location } from "@marimo-team/react-finder";
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Input, Size, ToggleButton, ToggleButtonGroup } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { chevronGlyph, Icon } from "../shared/Icon.js";
import { bigSeed } from "../shared/seed.js";
import {
  button,
  cell,
  chevron,
  column,
  dropZone,
  emptyState,
  gridCell,
  input,
  locationItem,
  menu,
  menuItem,
  menuSeparator,
  panel,
  row,
  statusBar,
  tableRow,
  toolbar,
  treeRow,
} from "../shared/styles.js";

const locations: Location[] = [
  {
    id: "home",
    name: "Home",
    icon: "🏠",
    // 5,000 files in "Many files", served 500 per page (see the Load more button).
    adapter: new MemoryAdapter({ seed: bigSeed(5000), pageSize: 500 }),
  },
  {
    id: "session",
    name: "Session",
    icon: "💾",
    adapter: createSessionStorageAdapter({
      key: "react-finder-kitchen-sink",
      seed: { Notes: {} },
    }),
  },
];

type View = "list" | "grid" | "table";

function isView(value: unknown): value is View {
  return value === "list" || value === "grid" || value === "table";
}

const toggle = `${button} data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:border-primary`;

const empty = ({ isLoading }: { isLoading: boolean }) => (
  <div className={emptyState}>{isLoading ? "Loading…" : "Empty folder"}</div>
);

function Items({ view }: { view: View }) {
  if (view === "table") {
    return (
      <Finder.Table
        dragAndDrop
        virtualized
        layoutOptions={{ rowHeight: 36, headingHeight: 36 }}
        // A virtualized collection must be the scroll container.
        className="block h-full overflow-auto outline-none border-separate border-spacing-0"
        style={{ scrollPaddingTop: 36 }}
      >
        <Finder.TableHeader className="w-full">
          <Finder.Column id="name" isRowHeader allowsSorting className={column}>
            Name
          </Finder.Column>
          <Finder.Column id="size" allowsSorting className={`${column} w-28`}>
            Size
          </Finder.Column>
          <Finder.Column id="modifiedAt" allowsSorting className={`${column} w-44`}>
            Modified
          </Finder.Column>
        </Finder.TableHeader>
        <Finder.TableBody renderEmptyState={empty}>
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
            </Finder.Item>
          )}
        </Finder.TableBody>
      </Finder.Table>
    );
  }
  const grid = view === "grid";
  return (
    <Finder.List
      key={view}
      layout={grid ? "grid" : "stack"}
      dragAndDrop
      virtualized
      layoutOptions={
        grid ? { minItemSize: new Size(120, 104), minSpace: new Size(8, 8) } : { rowSize: 36 }
      }
      className={`block h-full overflow-auto outline-none ${grid ? "p-3" : ""}`}
      renderEmptyState={empty}
    >
      {(item) => (
        <Finder.Item item={item} className={grid ? gridCell : row}>
          {({ isEditing }) => (
            <>
              <Icon
                item={item}
                className={grid ? "text-3xl leading-none" : "text-base leading-none"}
              />
              {isEditing ? (
                <Finder.RenameInput className="flex-1 min-w-0">
                  <Input className={input} />
                </Finder.RenameInput>
              ) : (
                <span className={grid ? "text-xs w-full truncate" : "text-sm flex-1 truncate"}>
                  {item.name}
                </span>
              )}
              {!grid && item.kind === "file" && (
                <span className="text-xs text-muted-foreground w-20 text-right">
                  {formatFileSize(item.size)}
                </span>
              )}
            </>
          )}
        </Finder.Item>
      )}
    </Finder.List>
  );
}

export default function KitchenSinkDemo(): ReactElement {
  const [view, setView] = useState<View>("list");
  const [error, setError] = useState<FinderError | null>(null);
  return (
    <DemoWrapper
      title="Kitchen sink"
      description="Locations, tree sidebar, toolbar, breadcrumbs, search, list/grid/table views (virtualized), rename, context menu, drag and drop, uploads, status bar and keyboard shortcuts — all styled with data-* attributes."
    >
      <Finder
        locations={locations}
        onError={setError}
        onOpen={(item) => {
          alert(`Open ${item.path}`);
        }}
        className="grid grid-cols-[240px_1fr] gap-3 h-full"
      >
        <div className="flex flex-col gap-3 min-h-0">
          <Finder.Locations className="outline-none flex flex-col gap-1">
            {(location) => (
              <Finder.LocationItem location={location} className={locationItem}>
                <span className="text-sm font-medium">
                  {location.icon} {location.name}
                </span>
              </Finder.LocationItem>
            )}
          </Finder.Locations>
          <div className={`${panel} p-2 overflow-hidden`}>
            <Finder.Tree
              navigateOnSelect
              dragAndDrop
              virtualized
              layoutOptions={{ rowSize: 28 }}
              className="block h-full overflow-auto outline-none"
            >
              {(item) => (
                <Finder.Item item={item} className={treeRow}>
                  {({ hasChildItems, isExpanded, isLoading, level }) => (
                    <div
                      className="flex items-center gap-1 min-w-0"
                      style={{ paddingInlineStart: (level - 1) * 14 }}
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
        </div>

        <div className="flex flex-col gap-3 min-w-0 min-h-0">
          <Finder.Toolbar className={toolbar}>
            <Finder.Button action="back" className={button}>
              ←
            </Finder.Button>
            <Finder.Button action="forward" className={button}>
              →
            </Finder.Button>
            <Finder.Button action="up" className={button}>
              ↑
            </Finder.Button>
            <Finder.Button action="refresh" className={button}>
              ⟳
            </Finder.Button>
            <div className="w-px h-5 bg-border" />
            <Finder.Button action="newFolder" className={button}>
              New folder
            </Finder.Button>
            <Finder.Button action="rename" className={button}>
              Rename
            </Finder.Button>
            <Finder.Button action="delete" className={`${button} text-destructive`}>
              Delete
            </Finder.Button>
            <div className="w-px h-5 bg-border" />
            <Finder.SearchInput className="flex-1 min-w-[160px]">
              <Input className={input} placeholder="Search…" />
            </Finder.SearchInput>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[view]}
              onSelectionChange={(keys) => {
                const [key] = keys;
                if (isView(key)) {
                  setView(key);
                }
              }}
              className="flex gap-1"
            >
              <ToggleButton id="list" className={toggle}>
                List
              </ToggleButton>
              <ToggleButton id="grid" className={toggle}>
                Grid
              </ToggleButton>
              <ToggleButton id="table" className={toggle}>
                Table
              </ToggleButton>
            </ToggleButtonGroup>
          </Finder.Toolbar>

          <Breadcrumbs />

          {error && (
            <div className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive flex justify-between">
              <span>
                <strong>{error.code}:</strong> {error.message}
              </span>
              <Button
                className="underline"
                onPress={() => {
                  setError(null);
                }}
              >
                dismiss
              </Button>
            </div>
          )}

          <Finder.DropZone className={`${dropZone} ${panel} flex flex-col overflow-hidden`}>
            <Items view={view} />
          </Finder.DropZone>

          <Finder.State>
            {({ items, selectedItems, clipboard, currentPath, isLoading, hasMore }) => (
              <div className={statusBar}>
                <span>{items.length} items</span>
                {hasMore && (
                  <Finder.Button action="loadMore" className="underline">
                    Load more
                  </Finder.Button>
                )}
                {selectedItems.length > 0 && <span>{selectedItems.length} selected</span>}
                {clipboard && (
                  <span>
                    {clipboard.paths.length} on clipboard ({clipboard.mode})
                  </span>
                )}
                {isLoading && <span>Loading…</span>}
                <span className="ml-auto truncate">{currentPath}</span>
              </div>
            )}
          </Finder.State>
        </div>

        <Finder.ContextMenu className={menu} popoverProps={{ className: "z-50" }}>
          {({ target }) => (
            <>
              {target && (
                <Finder.MenuItem action="open" className={menuItem}>
                  Open
                </Finder.MenuItem>
              )}
              {target && (
                <Finder.MenuItem action="rename" className={menuItem}>
                  Rename
                </Finder.MenuItem>
              )}
              <Finder.MenuSeparator className={menuSeparator} />
              <Finder.MenuItem action="copy" className={menuItem}>
                Copy
              </Finder.MenuItem>
              <Finder.MenuItem action="cut" className={menuItem}>
                Cut
              </Finder.MenuItem>
              <Finder.MenuItem action="paste" className={menuItem}>
                Paste
              </Finder.MenuItem>
              <Finder.MenuSeparator className={menuSeparator} />
              <Finder.MenuItem action="newFolder" className={menuItem}>
                New folder
              </Finder.MenuItem>
              <Finder.MenuItem action="newFile" className={menuItem}>
                New file
              </Finder.MenuItem>
              {target && (
                <>
                  <Finder.MenuSeparator className={menuSeparator} />
                  <Finder.MenuItem action="delete" className={`${menuItem} text-destructive`}>
                    Delete
                  </Finder.MenuItem>
                </>
              )}
            </>
          )}
        </Finder.ContextMenu>
      </Finder>
    </DemoWrapper>
  );
}
