import { Finder, formatFileSize, MemoryAdapter } from "@marimo-team/react-finder";
import type { FileItem } from "@marimo-team/react-finder";
import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { button, emptyState, panel, row } from "../shared/styles.js";

const adapter = new MemoryAdapter({ seed: demoSeed });

function Picker({ onPick }: { onPick: (item: FileItem) => void }) {
  const [candidate, setCandidate] = useState<FileItem | null>(null);
  return (
    <Finder
      adapter={adapter}
      selectionMode="single"
      onSelectionChange={(items) => {
        setCandidate(items[0]?.kind === "file" ? items[0] : null);
      }}
      onOpen={onPick}
      className="flex flex-col gap-3 h-[420px]"
    >
      <Breadcrumbs />
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
              <span className="text-sm flex-1">{item.name}</span>
              {item.kind === "file" && (
                <span className="text-xs text-muted-foreground">{formatFileSize(item.size)}</span>
              )}
            </Finder.Item>
          )}
        </Finder.List>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground truncate">
          {candidate ? candidate.path : "Select a file"}
        </span>
        <Button
          className={`${button} bg-primary text-primary-foreground border-primary`}
          isDisabled={!candidate}
          onPress={() => {
            if (candidate) {
              onPick(candidate);
            }
          }}
        >
          Choose
        </Button>
      </div>
    </Finder>
  );
}

export default function FilePickerDemo(): ReactElement {
  const [picked, setPicked] = useState<FileItem | null>(null);
  return (
    <DemoWrapper
      title="File picker"
      description='selectionMode="single" plus onOpen turns the explorer into a picker. The dialog is a plain react-aria Modal; double-clicking a file or pressing Choose returns it.'
    >
      <div className="flex flex-col gap-4 items-start">
        <DialogTrigger>
          <Button className={button}>Attach file…</Button>
          <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <Modal className="bg-white rounded-lg shadow-xl p-5 w-[560px] outline-none">
              <Dialog className="outline-none">
                {({ close }) => (
                  <div className="flex flex-col gap-3">
                    <Heading slot="title" className="font-semibold">
                      Choose a file
                    </Heading>
                    <Picker
                      onPick={(item) => {
                        setPicked(item);
                        close();
                      }}
                    />
                  </div>
                )}
              </Dialog>
            </Modal>
          </ModalOverlay>
        </DialogTrigger>
        <div className="text-sm">
          {picked ? (
            <>
              Attached: <code className="bg-muted px-1.5 py-0.5 rounded">{picked.path}</code>
            </>
          ) : (
            <span className="text-muted-foreground">Nothing attached yet.</span>
          )}
        </div>
      </div>
    </DemoWrapper>
  );
}
