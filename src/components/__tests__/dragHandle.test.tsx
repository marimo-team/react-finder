// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import { MemoryAdapter } from "../../adapters/memory/memoryAdapter.js";
import { Finder } from "../Finder.js";

const seed = { docs: { "a.md": "" }, "notes.txt": "" };

describe("drag handles", () => {
  it("list and tree items get a hidden drag handle only when dragAndDrop is on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.List dragAndDrop>
          {(item) => (
            <Finder.Item item={item}>
              <span data-testid={`l-${item.name}`}>{item.name}</span>
            </Finder.Item>
          )}
        </Finder.List>
        <Finder.Tree dragAndDrop>
          {(item) => (
            <Finder.Item item={item}>
              <span data-testid={`t-${item.name}`}>{item.name}</span>
            </Finder.Item>
          )}
        </Finder.Tree>
      </Finder>,
    );
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.List>
          {(item) => (
            <Finder.Item item={item}>
              <span data-testid={`p-${item.name}`}>{item.name}</span>
            </Finder.Item>
          )}
        </Finder.List>
      </Finder>,
    );
    await screen.findByTestId("l-notes.txt");
    await screen.findByTestId("t-notes.txt");
    await screen.findByTestId("p-notes.txt");
    const listRow = screen.getByTestId("l-notes.txt").closest("[role=row]") as HTMLElement;
    const treeRow = screen.getByTestId("t-notes.txt").closest("[role=row]") as HTMLElement;
    const plainRow = screen.getByTestId("p-notes.txt").closest("[role=row]") as HTMLElement;
    expect(listRow.querySelector("[slot=drag], [data-finder-drag-handle]")).not.toBeNull();
    expect(treeRow.querySelector("[slot=drag], [data-finder-drag-handle]")).not.toBeNull();
    expect(plainRow.querySelector("[data-finder-drag-handle]")).toBeNull();
    expect(warn.mock.calls.filter((c) => String(c[0]).includes("Draggable items"))).toHaveLength(0);
    warn.mockRestore();
  });

  it("table rows get the handle in their first cell; dragHandle={false} opts out", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.Table dragAndDrop>
          <Finder.TableHeader>
            <Finder.Column id="name" isRowHeader>
              Name
            </Finder.Column>
            <Finder.Column id="size">Size</Finder.Column>
          </Finder.TableHeader>
          <Finder.TableBody>
            {(item) => (
              <Finder.Item item={item} dragHandle={item.name === "docs" ? false : undefined}>
                <Finder.Cell>
                  <span data-testid={`c-${item.name}`}>{item.name}</span>
                </Finder.Cell>
                <Finder.Cell>{item.size}</Finder.Cell>
              </Finder.Item>
            )}
          </Finder.TableBody>
        </Finder.Table>
      </Finder>,
    );
    await screen.findByTestId("c-notes.txt");
    const row = screen.getByTestId("c-notes.txt").closest("[role=row]") as HTMLElement;
    const cells = row.querySelectorAll("[role=rowheader], [role=gridcell]");
    expect(cells[0]?.querySelector("[data-finder-drag-handle]")).not.toBeNull();
    expect(cells[1]?.querySelector("[data-finder-drag-handle]")).toBeNull();
    const docsRow = screen.getByTestId("c-docs").closest("[role=row]") as HTMLElement;
    expect(docsRow.querySelector("[data-finder-drag-handle]")).toBeNull();
    warn.mockRestore();
  });
});

describe("rename focus", () => {
  it("returns focus to the row after Escape so shortcuts keep working", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const { waitFor } = await import("@testing-library/react");
    const user = userEvent.setup();
    render(
      <Finder adapter={new MemoryAdapter({ seed })}>
        <Finder.List>
          {(item) => (
            <Finder.Item item={item}>
              {({ isEditing }) =>
                isEditing ? (
                  <Finder.RenameInput />
                ) : (
                  <span data-testid={`r-${item.name}`}>{item.name}</span>
                )
              }
            </Finder.Item>
          )}
        </Finder.List>
      </Finder>,
    );
    await user.click(await screen.findByTestId("r-notes.txt"));
    await user.keyboard("{F2}");
    await screen.findByRole("textbox", { name: "Rename" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(document.activeElement).toHaveAttribute("data-path", "/notes.txt");
    });
    await user.keyboard("{Delete}");
    await waitFor(() => {
      expect(screen.queryByTestId("r-notes.txt")).not.toBeInTheDocument();
    });
  });
});
