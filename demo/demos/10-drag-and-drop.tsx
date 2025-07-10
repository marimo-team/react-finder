import { createFinderStore, Finder, MemoryAdapter } from "@marimo-team/react-finder";
import type { FileSystemAdapter, FinderDragPayload } from "@marimo-team/react-finder";
import { useCallback, useEffect, useState } from "react";
import type { ReactElement } from "react";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { button, dropZone, emptyState, panel, row, toolbar } from "../shared/styles.js";

// Two independent explorers. Bringing your own store lets us name each
// finder so drops from the other one can be resolved to an adapter.
const adapters: Record<string, FileSystemAdapter> = {
  left: new MemoryAdapter({ seed: demoSeed }),
  right: new MemoryAdapter({ seed: { Inbox: {}, "Drop files here.txt": "" } }),
};
// Stores own their callbacks; the demo forwards operation events to whoever is listening.
const listeners = new Set<(line: string) => void>();
const emit = (line: string) => {
  for (const listener of listeners) listener(line);
};
const stores = {
  left: createFinderStore({
    adapter: adapters.left,
    finderId: "left",
    onOperation: (e) => {
      emit(`left: ${e.type} ${e.result.ok.length} ok, ${e.result.failed.length} failed`);
    },
  }),
  right: createFinderStore({
    adapter: adapters.right,
    finderId: "right",
    onOperation: (e) => {
      emit(`right: ${e.type} ${e.result.ok.length} ok, ${e.result.failed.length} failed`);
    },
  }),
};

/** Copy files between adapters by reading from one and writing to the other. */
async function copyAcross(
  payloads: FinderDragPayload[],
  targetPath: string,
  into: keyof typeof stores,
) {
  const target = stores[into].getState();
  for (const payload of payloads) {
    const source = adapters[payload.finderId];
    if (!source?.readFile || !source.stat) continue;
    const item = await source.stat(payload.path);
    if (item.kind !== "file") continue;
    const blob = await source.readFile(payload.path);
    await target.upload([new File([blob], item.name, { type: item.mimeType })], targetPath);
  }
}

function Explorer({ id, log }: { id: keyof typeof stores; log: (line: string) => void }) {
  return (
    <Finder
      store={stores[id]}
      onUpload={async (files, targetPath) => {
        log(`${id}: uploading ${files.map((f) => f.name).join(", ")} → ${targetPath}`);
        await stores[id].getState().upload(files, targetPath);
      }}
      className="flex flex-col gap-2 min-w-0 min-h-0"
    >
      <Finder.Toolbar className={toolbar}>
        <Finder.Button action="back" className={button}>
          ← Back
        </Finder.Button>
        <Finder.Button action="up" className={button}>
          ↑ Up
        </Finder.Button>
        <Finder.Button action="newFolder" className={button}>
          New folder
        </Finder.Button>
      </Finder.Toolbar>
      <Breadcrumbs />
      <Finder.DropZone className={`${dropZone} ${panel} flex flex-col`}>
        <Finder.List
          dragAndDrop={{
            onDropFromOtherFinder: (payloads, targetPath) => {
              log(`${id}: received ${payloads.length} item(s) from ${payloads[0]?.finderId}`);
              void copyAcross(payloads, targetPath, id);
            },
          }}
          className="outline-none flex-1"
          renderEmptyState={({ isLoading }) => (
            <div className={emptyState}>{isLoading ? "Loading…" : "Drop items or files here"}</div>
          )}
        >
          {(item) => (
            <Finder.Item item={item} className={row}>
              <Icon item={item} />
              <span className="text-sm">{item.name}</span>
            </Finder.Item>
          )}
        </Finder.List>
      </Finder.DropZone>
    </Finder>
  );
}

export default function DragAndDropDemo(): ReactElement {
  const [lines, setLines] = useState<string[]>([]);
  const log = useCallback((line: string) => {
    setLines((prev) => [line, ...prev].slice(0, 8));
  }, []);
  useEffect(() => {
    listeners.add(log);
    return () => {
      listeners.delete(log);
    };
  }, [log]);
  return (
    <DemoWrapper
      title="Drag and drop"
      description="dragAndDrop on a collection wires react-aria's useDragAndDrop: drag onto a folder to move (hold ⌥ to copy), drop on the background to move into the current folder, drop files from your OS to upload. Drops between the two explorers are handed to onDropFromOtherFinder, which copies via readFile/upload. Keyboard users can cut/copy/paste with ⌘X, ⌘C and ⌘V."
    >
      <div className="flex flex-col gap-3 h-full">
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <Explorer id="left" log={log} />
          <Explorer id="right" log={log} />
        </div>
        <pre className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-md p-2 h-28 overflow-auto">
          {lines.length > 0 ? lines.join("\n") : "Operation log"}
        </pre>
      </div>
    </DemoWrapper>
  );
}
