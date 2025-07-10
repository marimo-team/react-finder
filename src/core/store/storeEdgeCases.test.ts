import { describe, expect, it, vi } from "vite-plus/test";

import { MemoryAdapter } from "../../adapters/memory/memoryAdapter.js";
import {
  createControlledAdapter,
  dir,
  file,
  flush,
  listing,
} from "../../adapters/testing/controlledAdapter.js";
import { FinderError } from "../errors.js";
import { createVisibleItemsSelector, selectChildren } from "../selectors.js";
import { createFinderStore } from "./createFinderStore.js";

describe("store edge cases", () => {
  it("requires an adapter or locations", () => {
    expect(() => createFinderStore({})).toThrow(/requires an adapter/u);
  });

  it("navigate to an unknown location throws synchronously", async () => {
    const store = createFinderStore({
      adapter: new MemoryAdapter(),
      autoLoad: false,
    });
    expect(() => store.getState().navigate("/", { locationId: "nope" })).toThrow(
      /Unknown location/u,
    );
  });

  it("hidden files and folder ordering follow the view options", async () => {
    const store = createFinderStore({
      adapter: new MemoryAdapter({
        seed: { ".hidden": "", b: {}, "a.txt": "" },
      }),
      foldersFirst: false,
      isHidden: (item) => item.name.startsWith("."),
    });
    await flush();
    const visible = createVisibleItemsSelector();
    expect(visible(store.getState()).map((i) => i.name)).toEqual(["a.txt", "b"]);
    store.getState().setFoldersFirst(true);
    expect(visible(store.getState()).map((i) => i.name)).toEqual(["b", "a.txt"]);
    store.getState().setShowHidden(true);
    expect(visible(store.getState()).map((i) => i.name)).toEqual(["b", ".hidden", "a.txt"]);
  });

  it("rejects unsupported readFile/upload and cross-location paste", async () => {
    const a = createControlledAdapter({ methods: ["list"] });
    const b = createControlledAdapter();
    const store = createFinderStore({
      locations: [
        { id: "a", name: "A", adapter: a.adapter },
        { id: "b", name: "B", adapter: b.adapter },
      ],
    });
    a.resolveNext("list", listing(file("/x.txt")));
    await flush();
    await expect(store.getState().readFile("/x.txt")).rejects.toSatisfy((e) =>
      FinderError.is(e, "unsupported"),
    );
    await expect(store.getState().upload([new File(["a"], "a.txt")])).rejects.toSatisfy((e) =>
      FinderError.is(e, "unsupported"),
    );
    store.getState().copyToClipboard(["/x.txt"]);
    const sw = store.getState().setLocation("b");
    b.resolveNext("list", listing());
    await sw;
    await expect(store.getState().paste()).rejects.toSatisfy((e) =>
      FinderError.is(e, "unsupported"),
    );
  });

  it("paste with an empty clipboard is a no-op", async () => {
    const store = createFinderStore({
      adapter: new MemoryAdapter(),
      autoLoad: false,
    });
    await expect(store.getState().paste()).resolves.toEqual({ ok: [], failed: [] });
  });

  it("search errors are surfaced and cleared", async () => {
    vi.useFakeTimers();
    try {
      const onError = vi.fn(() => {});
      const c = createControlledAdapter();
      const store = createFinderStore({
        adapter: c.adapter,
        searchDebounceMs: 5,
        onError,
      });
      c.resolveNext("list", listing(file("/a")));
      await vi.advanceTimersByTimeAsync(0);
      store.getState().setQuery("q");
      await vi.advanceTimersByTimeAsync(5);
      c.rejectNext("search", new FinderError("permission", "no"));
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getState().search.status).toBe("error");
      expect(onError).toHaveBeenCalledTimes(1);
      store.getState().clearSearch();
      expect(store.getState().search.status).toBe("idle");
      store.getState().clearError();
      expect(store.getState().lastError).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("adapter search results outside the current directory become visible", async () => {
    vi.useFakeTimers();
    try {
      const store = createFinderStore({
        adapter: new MemoryAdapter({
          seed: { deep: { inner: { "target.txt": "" } }, "top.txt": "" },
        }),
        searchDebounceMs: 1,
      });
      await vi.advanceTimersByTimeAsync(0);
      store.getState().setQuery("target");
      await vi.advanceTimersByTimeAsync(5);
      const visible = createVisibleItemsSelector();
      expect(visible(store.getState()).map((i) => i.path)).toEqual(["/deep/inner/target.txt"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("setLocations drops a removed current location and switches to the first", async () => {
    const a = createControlledAdapter();
    const b = createControlledAdapter();
    const store = createFinderStore({
      locations: [
        { id: "a", name: "A", adapter: a.adapter },
        { id: "b", name: "B", adapter: b.adapter, rootPath: "/b-root" },
      ],
    });
    a.resolveNext("list", listing());
    await flush();
    const change = store
      .getState()
      .setLocations([{ id: "b", name: "B", adapter: b.adapter, rootPath: "/b-root" }]);
    expect(store.getState().currentLocationId).toBe("b");
    expect(store.getState().currentPath).toBe("/b-root");
    expect(store.getState().cache.a).toBeUndefined();
    b.resolveNext("list", listing(dir("/b-root/x")));
    await change;
    expect(selectChildren(store.getState(), "/b-root").map((i) => i.name)).toEqual(["x"]);
  });

  it("destroy disposes adapters and stops watching", async () => {
    const dispose = vi.fn();
    const adapter = Object.assign(new MemoryAdapter({ seed: { "a.txt": "" } }), { dispose });
    const store = createFinderStore({ adapter });
    await flush();
    store.destroy();
    expect(dispose).toHaveBeenCalledTimes(1);
    await adapter.createFile("/b.txt");
    await flush();
    expect(selectChildren(store.getState(), "/").map((i) => i.name)).toEqual(["a.txt"]);
  });

  it("a reload prunes expanded descendants of vanished directories", async () => {
    const c = createControlledAdapter();
    const store = createFinderStore({ adapter: c.adapter });
    c.resolveNext("list", listing(dir("/a")));
    await flush();
    const expand = store.getState().expand("/a");
    c.resolveNext("list", listing(dir("/a/b")));
    await expand;
    const deeper = store.getState().expand("/a/b");
    c.resolveNext("list", listing());
    await deeper;
    const refresh = store.getState().refresh();
    c.resolveNext("list", listing());
    await refresh;
    expect(store.getState().expandedPaths.size).toBe(0);
    expect(store.getState().cache.default?.entries["/a/b"]).toBeUndefined();
  });

  it("editing state clears when the edited item disappears", async () => {
    const c = createControlledAdapter();
    const store = createFinderStore({ adapter: c.adapter });
    c.resolveNext("list", listing(file("/a.txt")));
    await flush();
    store.getState().startEditing("/a.txt");
    const refresh = store.getState().refresh();
    c.resolveNext("list", listing());
    await refresh;
    expect(store.getState().editingPath).toBeNull();
  });
});
