import { Finder, MemoryAdapter } from "@marimo-team/react-finder";
import type { FinderError } from "@marimo-team/react-finder";
import { useState } from "react";
import type { ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Modal,
  ModalOverlay,
} from "react-aria-components";

import { Breadcrumbs } from "../shared/Breadcrumbs.js";
import { DemoWrapper } from "../shared/DemoWrapper.js";
import { Icon } from "../shared/Icon.js";
import { demoSeed } from "../shared/seed.js";
import { button, dangerButton, emptyState, input, panel, row, toolbar } from "../shared/styles.js";

const adapter = new MemoryAdapter({ seed: demoSeed });

export default function WithToolbarDemo(): ReactElement {
  const [error, setError] = useState<FinderError | null>(null);
  return (
    <DemoWrapper
      title="Toolbar & breadcrumbs"
      description="Finder.Button binds a react-aria Button to an action and disables itself when the action is unavailable. Delete confirmation is the consumer's business: wrap the trigger in a DialogTrigger."
    >
      <Finder adapter={adapter} onError={setError} className="flex flex-col h-full gap-3">
        <Finder.Toolbar className={toolbar}>
          <Finder.Button action="back" className={button}>
            ← Back
          </Finder.Button>
          <Finder.Button action="forward" className={button}>
            Forward →
          </Finder.Button>
          <Finder.Button action="up" className={button}>
            ↑ Up
          </Finder.Button>
          <Finder.Button action="refresh" className={button}>
            Refresh
          </Finder.Button>
          <div className="w-px h-5 bg-border" />
          <Finder.Button action="newFolder" className={button}>
            New folder
          </Finder.Button>
          <Finder.Button action="newFile" className={button}>
            New file
          </Finder.Button>
          <Finder.Button action="rename" className={button}>
            Rename
          </Finder.Button>
          <DialogTrigger>
            <Finder.Button action="delete" trigger className={dangerButton}>
              Delete…
            </Finder.Button>
            <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <Modal className="bg-white rounded-lg shadow-xl p-5 w-80 outline-none">
                <Dialog className="outline-none">
                  {({ close }) => (
                    <div className="flex flex-col gap-4">
                      <Heading slot="title" className="font-semibold">
                        Delete selected items?
                      </Heading>
                      <p className="text-sm text-muted-foreground">This cannot be undone.</p>
                      <div className="flex justify-end gap-2">
                        <Button className={button} onPress={close}>
                          Cancel
                        </Button>
                        <Finder.Button action="delete" className={dangerButton} onPress={close}>
                          Delete
                        </Finder.Button>
                      </div>
                    </div>
                  )}
                </Dialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </Finder.Toolbar>

        <Breadcrumbs />

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            <strong>{error.code}:</strong> {error.message}
          </div>
        )}

        <div className={panel}>
          <Finder.List
            className="outline-none"
            renderEmptyState={({ isLoading }) => (
              <div className={emptyState}>{isLoading ? "Loading…" : "Empty folder"}</div>
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
        <p className="text-xs text-muted-foreground">
          Shortcuts: F2 rename · Delete · ⌘⇧N new folder · Backspace up · ⌘C/⌘X/⌘V clipboard.
        </p>
      </Finder>
    </DemoWrapper>
  );
}
