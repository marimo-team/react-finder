import { Finder, formatDate, formatFileSize, MemoryAdapter } from "@marimo-team/react-finder";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Input } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { emptyState, input, menu, menuItem, menuSeparator, panel, row } from "../shared/styles.js";

const adapter = new MemoryAdapter({ seed: demoSeed });

const Shortcut = ({ children }: { children: string }) => (
  <kbd className="text-xs text-muted-foreground">{children}</kbd>
);

export default function ContextMenuDemo(): ReactElement {
  return (
    <DemoWrapper
      title="Context menu & preview"
      description="Right-click an item or the background (or press Shift+F10). Finder.ContextMenu is a react-aria Menu in a Popover anchored at the pointer; Finder.MenuItem binds to actions. Finder.Preview reads the selected file through adapter.readFile."
    >
      <Finder adapter={adapter} className="grid grid-cols-[1fr_280px] gap-3 h-full">
        <div className="flex flex-col gap-3 min-w-0">
          <Breadcrumbs />
          <div className={panel}>
            <Finder.List
              className="outline-none min-h-full"
              renderEmptyState={({ isLoading }) => (
                <div className={emptyState}>
                  {isLoading ? "Loading…" : "Empty folder — right-click to create"}
                </div>
              )}
            >
              {(item) => (
                <Finder.Item item={item} className={row}>
                  {({ isEditing }) => (
                    <>
                      <Icon item={item} />
                      {isEditing ? (
                        <Finder.RenameInput className="flex-1">
                          <Input className={input} />
                        </Finder.RenameInput>
                      ) : (
                        <span className="text-sm">{item.name}</span>
                      )}
                    </>
                  )}
                </Finder.Item>
              )}
            </Finder.List>
          </div>
        </div>

        <Finder.Preview read>
          {({ item, content }) => (
            <aside className={`${panel} p-4 text-sm flex flex-col gap-2`}>
              {item ? (
                <>
                  <div className="text-3xl">
                    <Icon item={item} className="text-3xl" />
                  </div>
                  <div className="font-medium break-all">{item.name}</div>
                  <dl className="text-xs text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt>Kind</dt>
                    <dd className="capitalize">{item.kind}</dd>
                    <dt>Size</dt>
                    <dd>{formatFileSize(item.size)}</dd>
                    <dt>Modified</dt>
                    <dd>{formatDate(item.modifiedAt)}</dd>
                    <dt>Path</dt>
                    <dd className="break-all">{item.path}</dd>
                  </dl>
                  {content.status === "loaded" && content.blob && (
                    <PreviewBody blob={content.blob} />
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Select a single item to preview it.</span>
              )}
            </aside>
          )}
        </Finder.Preview>

        <Finder.ContextMenu className={menu} popoverProps={{ className: "z-50" }}>
          {({ target }) => (
            <>
              {target && (
                <Finder.MenuItem action="open" className={menuItem}>
                  {target.kind === "directory" ? "Open" : "Open file"}
                </Finder.MenuItem>
              )}
              {target && (
                <Finder.MenuItem action="rename" className={menuItem}>
                  Rename <Shortcut>F2</Shortcut>
                </Finder.MenuItem>
              )}
              <Finder.MenuSeparator className={menuSeparator} />
              <Finder.MenuItem action="copy" className={menuItem}>
                Copy <Shortcut>⌘C</Shortcut>
              </Finder.MenuItem>
              <Finder.MenuItem action="cut" className={menuItem}>
                Cut <Shortcut>⌘X</Shortcut>
              </Finder.MenuItem>
              <Finder.MenuItem action="paste" className={menuItem}>
                Paste <Shortcut>⌘V</Shortcut>
              </Finder.MenuItem>
              <Finder.MenuSeparator className={menuSeparator} />
              <Finder.MenuItem action="newFolder" className={menuItem}>
                New folder <Shortcut>⌘⇧N</Shortcut>
              </Finder.MenuItem>
              <Finder.MenuItem action="newFile" className={menuItem}>
                New file
              </Finder.MenuItem>
              {target && (
                <>
                  <Finder.MenuSeparator className={menuSeparator} />
                  <Finder.MenuItem action="delete" className={`${menuItem} text-destructive`}>
                    Delete <Shortcut>⌫</Shortcut>
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

function PreviewBody({ blob }: { blob: Blob }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const value = await blob.text();
      if (!cancelled) {
        setText(value || "(empty file)");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob]);
  return (
    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap">
      {text ?? "…"}
    </pre>
  );
}
