import { describe, expect, it } from "vite-plus/test";

import { MemoryAdapter } from "../adapters/memory/memoryAdapter.js";
import { dir, file } from "../adapters/testing/controlledAdapter.js";
import {
  compareItems,
  selectBreadcrumbs,
  selectCanGoUp,
  selectChildren,
  selectIsPending,
  selectSelectedItems,
  sortItems,
} from "./selectors.js";
import { createFinderStore } from "./store/createFinderStore.js";

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

describe("compareItems / sortItems", () => {
  const items = [
    file("/b.txt", { size: 20, modifiedAt: 2 }),
    dir("/z"),
    file("/a.txt", { size: 10, modifiedAt: 3 }),
    file("/c.TXT", { size: 5, modifiedAt: 1, mimeType: "text/plain" }),
  ];
  const names = (sorted: typeof items) => sorted.map((i) => i.name);

  it("sorts by name, case-insensitively, folders first", () => {
    expect(names(sortItems(items, { column: "name", direction: "ascending" }, true))).toEqual([
      "z",
      "a.txt",
      "b.txt",
      "c.TXT",
    ]);
    expect(names(sortItems(items, { column: "name", direction: "descending" }, false))).toEqual([
      "z",
      "c.TXT",
      "b.txt",
      "a.txt",
    ]);
  });

  it("sorts by size, date and kind with name as tie-breaker", () => {
    expect(names(sortItems(items, { column: "size", direction: "ascending" }, false))).toEqual([
      "z",
      "c.TXT",
      "a.txt",
      "b.txt",
    ]);
    expect(
      names(sortItems(items, { column: "modifiedAt", direction: "descending" }, false)),
    ).toEqual(["a.txt", "b.txt", "c.TXT", "z"]);
    expect(
      compareItems(dir("/d"), file("/f"), { column: "kind", direction: "ascending" }, false),
    ).toBeLessThan(0);
  });
});

describe("selectBreadcrumbs", () => {
  it("builds crumbs with stable identity per path", () => {
    const store = createFinderStore({
      adapter: new MemoryAdapter(),
      initialPath: "/a/b",
      autoLoad: false,
    });
    const crumbs = selectBreadcrumbs(store.getState());
    expect(crumbs.map((c) => [c.id, c.name, c.isRoot, c.isCurrent])).toEqual([
      ["/", "", true, false],
      ["/a", "a", false, false],
      ["/a/b", "b", false, true],
    ]);
    expect(selectBreadcrumbs(store.getState())).toBe(crumbs);
    expect(selectCanGoUp(store.getState())).toBe(true);
  });
});

describe("cache-backed selectors", () => {
  it("selectChildren and selectSelectedItems are referentially stable", async () => {
    const store = createFinderStore({
      adapter: new MemoryAdapter({
        seed: { docs: { "a.md": "" }, "b.txt": "" },
      }),
    });
    await flush();
    const children = selectChildren(store.getState(), "/");
    expect(children.map((i) => i.name).sort()).toEqual(["b.txt", "docs"]);
    expect(selectChildren(store.getState(), "/")).toBe(children);
    expect(selectChildren(store.getState(), "/missing")).toEqual([]);

    store.getState().setSelection(["/b.txt", "/ghost"]);
    const selected = selectSelectedItems(store.getState());
    expect(selected.map((i) => i.path)).toEqual(["/b.txt"]);
    expect(selectSelectedItems(store.getState())).toBe(selected);
    expect(selectIsPending(store.getState(), "/b.txt")).toBe(false);
  });
});
