// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Input } from "react-aria-components";
import type { DropItem } from "react-aria-components";
import { describe, expect, it, vi } from "vite-plus/test";

import { MemoryAdapter } from "../../adapters/memory/memoryAdapter.js";
import type { FinderError } from "../../core/errors.js";
import { createFinderStore } from "../../core/store/createFinderStore.js";
import type { FileItem, Location } from "../../core/types.js";
import { useDropHandler } from "../../hooks/internal/useFinderDnD.js";
import { FinderItem } from "../collections/FinderItem.js";
import { Finder } from "../Finder.js";

const seed = {
  docs: { "a.md": "alpha" },
  "notes.txt": "hello notes",
  "zeta.txt": "z",
};

const List = () => (
  <Finder.List>
    {(item) => (
      <Finder.Item item={item}>
        <span data-testid={`name-${item.name}`}>{item.name}</span>
      </Finder.Item>
    )}
  </Finder.List>
);

const rowAt = (path: string) =>
  document.querySelector(`[role="row"][data-path="${path}"]`) as HTMLElement;

describe("scalability", () => {
  it("items do not subscribe to the store individually", async () => {
    const big: Record<string, string> = {};
    for (let i = 0; i < 500; i++) big[`file-${i}.txt`] = "";
    const store = createFinderStore({
      adapter: new MemoryAdapter({ seed: big }),
    });
    const subscribe = vi.spyOn(store, "subscribe");
    render(
      <Finder store={store}>
        <List />
      </Finder>,
    );
    await expect(screen.findByTestId("name-file-0.txt")).resolves.toBeInTheDocument();
    expect(document.querySelectorAll("[role=row]")).toHaveLength(500);
    // Root, collection glue and a few leaves: nowhere near one per item.
    expect(subscribe.mock.calls.length).toBeLessThan(25);
  });
});

describe("root options", () => {
  it("shortcuts={false} disables keyboard actions", async () => {
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })} shortcuts={false}>
        <List />
      </Finder>,
    );
    await user.click(await screen.findByTestId("name-notes.txt"));
    await user.keyboard("{Delete}");
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 20);
      });
    });
    expect(screen.getByTestId("name-notes.txt")).toBeInTheDocument();
  });

  it("custom shortcut map rebinds an action", async () => {
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })} shortcuts={{ delete: ["x"], up: null }}>
        <List />
      </Finder>,
    );
    await user.click(await screen.findByTestId("name-zeta.txt"));
    await user.keyboard("x");
    await waitFor(() => {
      expect(screen.queryByTestId("name-zeta.txt")).not.toBeInTheDocument();
    });
  });

  it("selectionBehavior=toggle: Space toggles selection", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn<(item: FileItem) => void>();
    render(
      <Finder adapter={new MemoryAdapter({ seed })} selectionBehavior="toggle" onOpen={onOpen}>
        <List />
        <Finder.State>
          {({ selectedItems }) => <output data-testid="n">{selectedItems.length}</output>}
        </Finder.State>
      </Finder>,
    );
    await screen.findByTestId("name-notes.txt");
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByTestId("n")).toHaveTextContent("1");
    await user.keyboard("{ArrowDown} ");
    expect(screen.getByTestId("n")).toHaveTextContent("2");
    await user.keyboard(" ");
    expect(screen.getByTestId("n")).toHaveTextContent("1");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("reports operation failures through onError", async () => {
    const user = userEvent.setup();
    const onError = vi.fn<(error: FinderError) => void>();
    class Locked extends MemoryAdapter {
      override async delete(): Promise<void> {
        throw new DOMException("locked", "NotAllowedError");
      }
    }
    render(
      <Finder adapter={new Locked({ seed })} onError={onError}>
        <List />
      </Finder>,
    );
    await user.click(await screen.findByTestId("name-notes.txt"));
    await user.keyboard("{Delete}");
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "permission" }));
    });
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ code: "permission" });
    expect(screen.getByTestId("name-notes.txt")).toBeInTheDocument();
  });

  it("Finder.Item throws outside a collection", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <Finder adapter={new MemoryAdapter({ seed })}>
          <FinderItem item={{ path: "/x", name: "x", kind: "file" }} />
        </Finder>,
      ),
    ).toThrow(/inside Finder\.List/u);
    spy.mockRestore();
  });
});

describe("Finder.Button", () => {
  it("trigger buttons reflect enablement without running", async () => {
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.Button action="delete" trigger>
          Delete…
        </Finder.Button>
        <List />
      </Finder>,
    );
    const button = screen.getByRole("button", { name: "Delete…" });
    expect(button).toBeDisabled();
    await user.click(await screen.findByTestId("name-notes.txt"));
    expect(button).toBeEnabled();
    await user.click(button);
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 10);
      });
    });
    expect(screen.getByTestId("name-notes.txt")).toBeInTheDocument();
  });

  it("targetPath applies the action to a specific item", async () => {
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.Button action="delete" targetPath="/zeta.txt">
          Delete zeta
        </Finder.Button>
        <List />
      </Finder>,
    );
    await screen.findByTestId("name-zeta.txt");
    await user.click(screen.getByRole("button", { name: "Delete zeta" }));
    await waitFor(() => {
      expect(screen.queryByTestId("name-zeta.txt")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("name-notes.txt")).toBeInTheDocument();
  });
});

describe("Finder.SearchInput", () => {
  it("filters and clears", async () => {
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.SearchInput>
          <Input />
        </Finder.SearchInput>
        <List />
      </Finder>,
    );
    await screen.findByTestId("name-notes.txt");
    const input = screen.getByRole("searchbox");
    await user.type(input, "zeta");
    await waitFor(() => {
      expect(screen.queryByTestId("name-notes.txt")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("name-zeta.txt")).toBeInTheDocument();
    await user.clear(input);
    await expect(screen.findByTestId("name-notes.txt")).resolves.toBeInTheDocument();
  });
});

describe("Finder.Locations", () => {
  it("switches adapters", async () => {
    const user = userEvent.setup();
    const locations: Location[] = [
      {
        id: "a",
        name: "Alpha",
        adapter: new MemoryAdapter({ seed: { "alpha.txt": "" } }),
      },
      {
        id: "b",
        name: "Beta",
        adapter: new MemoryAdapter({ seed: { "beta.txt": "" } }),
        rootPath: "/",
      },
    ];
    render(
      <Finder locations={locations}>
        <Finder.Locations>
          {(location) => (
            <Finder.LocationItem location={location}>{location.name}</Finder.LocationItem>
          )}
        </Finder.Locations>
        <List />
      </Finder>,
    );
    await expect(screen.findByTestId("name-alpha.txt")).resolves.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Alpha" })).toHaveAttribute("data-active");
    await user.click(screen.getByRole("option", { name: "Beta" }));
    await expect(screen.findByTestId("name-beta.txt")).resolves.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute("data-active");
  });
});

describe("Finder.Preview", () => {
  it("reads the selected file's content", async () => {
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <List />
        <Finder.Preview read>
          {({ item, content }) => (
            <output data-testid="preview">
              {item ? `${item.name}:${content.status}:${content.blob?.size ?? "-"}` : "none"}
            </output>
          )}
        </Finder.Preview>
      </Finder>,
    );
    await expect(screen.findByTestId("preview")).resolves.toHaveTextContent("none");
    await user.click(await screen.findByTestId("name-notes.txt"));
    await waitFor(() => {
      expect(screen.getByTestId("preview")).toHaveTextContent(
        `notes.txt:loaded:${"hello notes".length}`,
      );
    });
    await user.click(screen.getByTestId("name-docs"));
    await waitFor(() => {
      expect(screen.getByTestId("preview")).toHaveTextContent("docs:idle:-");
    });
  });
});

describe("drops", () => {
  const fakeFileItem = (file: File): DropItem => ({
    kind: "file",
    type: file.type,
    name: file.name,
    getFile: async () => file,
    getText: async () => file.text(),
  });

  function Harness({ target }: { target: string }) {
    const { handleDrop } = useDropHandler();
    return (
      <button
        type="button"
        data-testid="drop"
        onClick={() =>
          void handleDrop(
            [fakeFileItem(new File(["payload"], "dropped.txt", { type: "text/plain" }))],
            target,
            "copy",
          )
        }
      >
        drop
      </button>
    );
  }

  it("routes OS files to onUpload when provided", async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(
      <Finder adapter={new MemoryAdapter({ seed })} onUpload={onUpload}>
        <Harness target="/docs" />
      </Finder>,
    );
    await user.click(screen.getByTestId("drop"));
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith(expect.any(Array), "/docs");
    });
    const [files, target] = onUpload.mock.calls[0] as [File[], string];
    expect(files.map((f) => f.name)).toEqual(["dropped.txt"]);
    expect(target).toBe("/docs");
  });

  it("falls back to store.upload when the adapter can write", async () => {
    const user = userEvent.setup();
    const adapter = new MemoryAdapter({ seed });
    render(
      <Finder adapter={adapter}>
        <Harness target="/" />
        <List />
      </Finder>,
    );
    await screen.findByTestId("name-notes.txt");
    await user.click(screen.getByTestId("drop"));
    await expect(screen.findByTestId("name-dropped.txt")).resolves.toBeInTheDocument();
    expect((await adapter.stat("/dropped.txt")).size).toBe("payload".length);
  });

  it("Finder.DropZone renders a react-aria drop zone for the current path", async () => {
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.DropZone>
          <span>Drop here</span>
        </Finder.DropZone>
      </Finder>,
    );
    const zone = screen.getByText("Drop here").closest("[data-path]");
    expect(zone).toHaveAttribute("data-path", "/");
  });
});

describe("Finder.State", () => {
  it("exposes history and clipboard", async () => {
    const user = userEvent.setup();
    const snapshots: { canGoBack: boolean; clipboard: unknown }[] = [];
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <List />
        <Finder.State>
          {({ canGoBack, clipboard, items }) => {
            snapshots.push({ canGoBack, clipboard });
            return <output data-testid="count">{items.length}</output>;
          }}
        </Finder.State>
      </Finder>,
    );
    await screen.findByTestId("name-docs");
    await user.click(screen.getByTestId("name-notes.txt"));
    await user.keyboard("{Meta>}c{/Meta}");
    await waitFor(() => {
      expect(snapshots.at(-1)?.clipboard).toMatchObject({ mode: "copy" });
    });
    await user.click(rowAt("/docs"));
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });
    expect(snapshots.at(-1)?.canGoBack).toBe(true);
    const _typeCheck: FileItem | undefined = undefined;
    expect(_typeCheck).toBeUndefined();
  });
});
