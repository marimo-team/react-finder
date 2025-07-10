// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Button, Link } from "react-aria-components";
import { describe, expect, it, vi } from "vite-plus/test";

import { MemoryAdapter } from "../../adapters/memory/memoryAdapter.js";
import type { FileItem } from "../../core/types.js";
import { Finder } from "../Finder.js";
import type { FinderProps } from "../FinderRoot.js";

const seed = {
  docs: { "a.md": "a", nested: { "deep.txt": "d" } },
  "notes.txt": "n",
  "zeta.txt": "z",
};

function ListApp(props: Partial<FinderProps> & { adapter?: MemoryAdapter }) {
  const adapter = props.adapter ?? new MemoryAdapter({ seed });
  return (
    <Finder adapter={adapter} {...props}>
      <Finder.Toolbar>
        <Finder.Button action="back">Back</Finder.Button>
        <Finder.Button action="newFolder">New folder</Finder.Button>
        <Finder.Button action="delete">Delete</Finder.Button>
      </Finder.Toolbar>
      <Finder.Breadcrumbs>
        {(crumb) => (
          <Finder.Breadcrumb crumb={crumb}>
            <Link>{crumb.isRoot ? "Home" : crumb.name}</Link>
          </Finder.Breadcrumb>
        )}
      </Finder.Breadcrumbs>
      <Finder.List renderEmptyState={({ isLoading }) => (isLoading ? "Loading" : "Empty")}>
        {(item) => (
          <Finder.Item item={item}>
            {({ isEditing, isSelected }) =>
              isEditing ? (
                <Finder.RenameInput />
              ) : (
                <span data-testid={`name-${item.name}`}>
                  {item.name}
                  {isSelected ? " (selected)" : ""}
                </span>
              )
            }
          </Finder.Item>
        )}
      </Finder.List>
      <Finder.ContextMenu>
        {({ target }) => (
          <>
            {target && <Finder.MenuItem action="rename">Rename</Finder.MenuItem>}
            <Finder.MenuItem action="delete">Delete item</Finder.MenuItem>
          </>
        )}
      </Finder.ContextMenu>
      <Finder.State>
        {({ items, selectedItems, currentPath }) => (
          <output data-testid="status">
            {currentPath}|{items.length}|{selectedItems.length}
          </output>
        )}
      </Finder.State>
    </Finder>
  );
}

const rowOf = (name: string) =>
  screen.getByTestId(`name-${name}`).closest("[data-path]") as HTMLElement;
const rowAt = (path: string) =>
  document.querySelector(`[role="row"][data-path="${path}"]`) as HTMLElement;

describe("Finder.List", () => {
  it("renders items with data attributes and an empty/loading state", async () => {
    render(<ListApp />);
    await expect(screen.findByTestId("name-docs")).resolves.toBeInTheDocument();
    const docs = rowOf("docs");
    expect(docs).toHaveAttribute("data-kind", "directory");
    expect(docs).toHaveAttribute("data-path", "/docs");
    expect(rowOf("notes.txt")).toHaveAttribute("data-kind", "file");
    expect(screen.getByTestId("status")).toHaveTextContent("/|3|0");
    expect(screen.getByRole("grid")).toHaveAttribute("data-path", "/");
  });

  it("shows the empty state for an empty directory", async () => {
    render(<ListApp adapter={new MemoryAdapter({ seed: {} })} />);
    await expect(screen.findByText("Empty")).resolves.toBeInTheDocument();
  });

  it("click selects and reports selection; double-click opens directories", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn<(items: FileItem[]) => void>();
    const onNavigate = vi.fn<(path: string, locationId: string) => void>();
    render(<ListApp onSelectionChange={onSelectionChange} onNavigate={onNavigate} />);
    await screen.findByTestId("name-notes.txt");

    await user.click(rowOf("notes.txt"));
    expect(rowOf("notes.txt")).toHaveAttribute("data-selected");
    expect(screen.getByTestId("status")).toHaveTextContent("/|3|1");
    expect(onSelectionChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ path: "/notes.txt" }),
    ]);

    await user.dblClick(rowOf("docs"));
    await expect(screen.findByTestId("name-a.md")).resolves.toBeInTheDocument();
    expect(onNavigate).toHaveBeenCalledWith("/docs", "default");
    expect(screen.getByTestId("status")).toHaveTextContent("/docs|2|0");
  });

  it("opens files with onOpen and respects selectionMode=single", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn<(item: FileItem) => void>();
    render(<ListApp onOpen={onOpen} selectionMode="single" />);
    await screen.findByTestId("name-notes.txt");
    await user.dblClick(rowOf("notes.txt"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: "/notes.txt" }));
    await user.click(rowOf("notes.txt"));
    await user.keyboard("{Shift>}");
    await user.click(rowOf("zeta.txt"));
    await user.keyboard("{/Shift}");
    expect(screen.getByTestId("status")).toHaveTextContent(/\|1$/u);
  });

  it("back button and breadcrumbs navigate", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-docs");
    const back = screen.getByRole("button", { name: "Back" });
    expect(back).toBeDisabled();
    await user.dblClick(rowOf("docs"));
    await screen.findByTestId("name-a.md");
    expect(back).toBeEnabled();
    await user.click(screen.getByRole("link", { name: "Home" }));
    await expect(screen.findByTestId("name-notes.txt")).resolves.toBeInTheDocument();
    expect(back).toBeEnabled(); // history: / -> /docs -> / (pushed)
  });
});

describe("keyboard shortcuts and rename", () => {
  it("Delete removes the selection and Backspace goes up", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-docs");
    await user.dblClick(rowOf("docs"));
    await screen.findByTestId("name-a.md");
    await user.click(rowOf("a.md"));
    await user.keyboard("{Delete}");
    await waitFor(() => {
      expect(screen.queryByTestId("name-a.md")).not.toBeInTheDocument();
    });
    await user.keyboard("{Backspace}");
    await expect(screen.findByTestId("name-notes.txt")).resolves.toBeInTheDocument();
  });

  it("F2 enters editing, Enter commits and keeps the selection", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-notes.txt");
    await user.click(rowOf("notes.txt"));
    await user.keyboard("{F2}");
    const input = await screen.findByRole("textbox", { name: "Rename" });
    expect(rowAt("/notes.txt")).toHaveAttribute("data-editing");
    expect(input).toHaveFocus();
    await user.clear(input);
    await user.type(input, "renamed.txt{Enter}");
    await expect(screen.findByTestId("name-renamed.txt")).resolves.toBeInTheDocument();
    expect(screen.queryByTestId("name-notes.txt")).not.toBeInTheDocument();
    expect(rowOf("renamed.txt")).toHaveAttribute("data-selected");
  });

  it("Escape cancels a rename", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-notes.txt");
    await user.click(rowOf("notes.txt"));
    await user.keyboard("{F2}");
    const input = await screen.findByRole("textbox", { name: "Rename" });
    await user.type(input, "xyz{Escape}");
    await expect(screen.findByTestId("name-notes.txt")).resolves.toBeInTheDocument();
  });

  it("New folder creates an item in edit mode", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-docs");
    await user.click(screen.getByRole("button", { name: "New folder" }));
    const input = await screen.findByRole("textbox", { name: "Rename" });
    expect(input).toHaveValue("untitled folder");
    await user.clear(input);
    await user.type(input, "Projects{Enter}");
    await expect(screen.findByTestId("name-Projects")).resolves.toBeInTheDocument();
  });

  it("shortcuts are ignored while typing in the rename input", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-notes.txt");
    await user.click(rowOf("notes.txt"));
    await user.keyboard("{F2}");
    const input = await screen.findByRole("textbox", { name: "Rename" });
    await user.type(input, "{Backspace}");
    expect(screen.getByTestId("status")).toHaveTextContent(/^\//u);
    expect(input).toBeInTheDocument();
  });
});

describe("context menu", () => {
  it("right-click selects the item, opens the menu and runs actions", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-zeta.txt");
    await user.pointer({ keys: "[MouseRight]", target: rowOf("zeta.txt") });
    const menu = await screen.findByRole("menu");
    expect(rowOf("zeta.txt")).toHaveAttribute("data-selected");
    expect(within(menu).getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Delete item" }));
    await waitFor(() => {
      expect(screen.queryByTestId("name-zeta.txt")).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("background right-click has no target and Escape closes", async () => {
    const user = userEvent.setup();
    render(<ListApp />);
    await screen.findByTestId("name-zeta.txt");
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getByTestId("status"),
    });
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });
});

function TableApp() {
  return (
    <Finder adapter={new MemoryAdapter({ seed })}>
      <Finder.Table>
        <Finder.TableHeader>
          <Finder.Column id="name" isRowHeader allowsSorting>
            Name
          </Finder.Column>
          <Finder.Column id="size" allowsSorting>
            Size
          </Finder.Column>
        </Finder.TableHeader>
        <Finder.TableBody>
          {(item: FileItem) => (
            <Finder.Item item={item}>
              <Finder.Cell>{item.name}</Finder.Cell>
              <Finder.Cell>{item.size ?? "-"}</Finder.Cell>
            </Finder.Item>
          )}
        </Finder.TableBody>
      </Finder.Table>
      <Finder.State>
        {({ items }) => <output data-testid="order">{items.map((i) => i.name).join(",")}</output>}
      </Finder.State>
    </Finder>
  );
}

describe("Finder.Table", () => {
  it("renders rows and sorts via column headers", async () => {
    const user = userEvent.setup();
    render(<TableApp />);
    await screen.findByText("notes.txt");
    expect(screen.getByTestId("order")).toHaveTextContent("docs,notes.txt,zeta.txt");
    const header = screen.getByRole("columnheader", { name: /Name/u });
    expect(header).toHaveAttribute("aria-sort", "ascending");
    await user.click(header);
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByTestId("order")).toHaveTextContent("docs,zeta.txt,notes.txt");
  });
});

function TreeApp({ navigateOnSelect = false }: { navigateOnSelect?: boolean }) {
  return (
    <Finder adapter={new MemoryAdapter({ seed })}>
      <Finder.Tree navigateOnSelect={navigateOnSelect}>
        {(item) => (
          <Finder.Item item={item}>
            {({ hasChildItems, isExpanded }) => (
              <>
                {hasChildItems && (
                  <Button slot="chevron" aria-label={`toggle ${item.name}`}>
                    {isExpanded ? "-" : "+"}
                  </Button>
                )}
                <span data-testid={`node-${item.name}`}>{item.name}</span>
              </>
            )}
          </Finder.Item>
        )}
      </Finder.Tree>
      <Finder.State>
        {({ currentPath }) => <output data-testid="path">{currentPath}</output>}
      </Finder.State>
    </Finder>
  );
}

describe("Finder.Tree", () => {
  it("expands lazily to deeper levels", async () => {
    const user = userEvent.setup();
    render(<TreeApp />);
    const docs = (await screen.findByTestId("node-docs")).closest("[data-path]");
    expect(docs).toHaveAttribute("data-level", "1");
    await user.click(within(docs as HTMLElement).getByRole("button"));
    const nested = (await screen.findByTestId("node-nested")).closest("[data-path]");
    expect(nested).toHaveAttribute("data-level", "2");
    await user.click(within(nested as HTMLElement).getByRole("button"));
    const deep = (await screen.findByTestId("node-deep.txt")).closest("[data-path]");
    expect(deep).toHaveAttribute("data-level", "3");
  });

  it("navigateOnSelect navigates when a node is selected", async () => {
    const user = userEvent.setup();
    render(<TreeApp navigateOnSelect />);
    await user.click(await screen.findByTestId("node-docs"));
    await waitFor(() => {
      expect(screen.getByTestId("path")).toHaveTextContent("/docs");
    });
  });
});

describe("adapter swap", () => {
  it("reloads when the adapter prop changes", async () => {
    const first = new MemoryAdapter({ seed: { "one.txt": "1" } });
    const second = new MemoryAdapter({ seed: { "two.txt": "2" } });
    const { rerender } = render(<ListApp adapter={first} />);
    await expect(screen.findByTestId("name-one.txt")).resolves.toBeInTheDocument();
    await act(async () => {
      rerender(<ListApp adapter={second} />);
    });
    await expect(screen.findByTestId("name-two.txt")).resolves.toBeInTheDocument();
  });
});
