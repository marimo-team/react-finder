import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createControlledAdapter,
  dir,
  file,
  flush,
  listing,
} from "../../adapters/testing/controlledAdapter.js";
import { FinderError } from "../errors.js";
import {
  createVisibleItemsSelector,
  selectCanGoBack,
  selectCanGoForward,
  selectChildren,
  selectDirectory,
} from "../selectors.js";
import { createFinderStore } from "./createFinderStore.js";
import type { FinderStoreOptions } from "./createFinderStore.js";

function setup(options: Partial<FinderStoreOptions> & { methods?: readonly string[] } = {}) {
  const { methods, ...rest } = options;
  const controlled = createControlledAdapter({ methods });
  const store = createFinderStore({
    adapter: controlled.adapter,
    searchDebounceMs: 10,
    ...rest,
  });
  const visible = createVisibleItemsSelector();
  return {
    c: controlled,
    store,
    state: () => store.getState(),
    visible: (path?: string) => visible(store.getState(), path),
    async loadRoot(items = [dir("/docs"), file("/notes.txt"), file("/.hidden")]) {
      controlled.resolveNext("list", listing(...items));
      await flush();
    },
  };
}

describe("initial load", () => {
  it("lists the initial path on creation and caches it", async () => {
    const t = setup();
    expect(t.c.pending("list")).toHaveLength(1);
    expect(t.c.pending("list")[0]?.args[0]).toBe("/");
    await t.loadRoot();
    expect(selectDirectory(t.state())?.status).toBe("loaded");
    expect(t.visible().map((i) => i.name)).toEqual(["docs", "notes.txt"]);
    expect(t.state().capabilities.move).toBe(true);
  });

  it("respects initialPath and autoLoad=false", () => {
    const t = setup({ initialPath: "a/b/", autoLoad: false });
    expect(t.state().currentPath).toBe("/a/b");
    expect(t.c.pending()).toHaveLength(0);
  });
});

describe("navigation history (B1/B2)", () => {
  it("back replays without pushing, so forward still works", async () => {
    const t = setup();
    await t.loadRoot();
    const nav = t.store.getState().navigate("/docs");
    t.c.resolveNext("list", listing(file("/docs/a.md")));
    await nav;
    expect(t.state().history.entries.map((e) => e.path)).toEqual(["/", "/docs"]);

    await t.store.getState().goBack();
    expect(t.state().currentPath).toBe("/");
    expect(t.c.pending("list")).toHaveLength(0); // cached, no refetch
    expect(selectCanGoForward(t.state())).toBe(true);
    expect(selectCanGoBack(t.state())).toBe(false);

    await t.store.getState().goForward();
    expect(t.state().currentPath).toBe("/docs");
    expect(t.state().history.entries).toHaveLength(2);
    expect(t.visible().map((i) => i.name)).toEqual(["a.md"]);
  });

  it("navigating after going back truncates forward history", async () => {
    const t = setup();
    await t.loadRoot();
    const nav = t.store.getState().navigate("/docs");
    t.c.resolveNext("list", listing());
    await nav;
    await t.store.getState().goBack();
    const nav2 = t.store.getState().navigate("/other");
    t.c.resolveNext("list", listing());
    await nav2;
    expect(t.state().history.entries.map((e) => e.path)).toEqual(["/", "/other"]);
    expect(t.state().history.index).toBe(1);
  });

  it("refresh keeps history and selection", async () => {
    const t = setup();
    await t.loadRoot();
    t.store.getState().setSelection(["/notes.txt"]);
    const refresh = t.store.getState().refresh();
    expect(t.c.pending("list")).toHaveLength(1);
    t.c.resolveNext("list", listing(dir("/docs"), file("/notes.txt")));
    await refresh;
    expect(t.state().history.entries).toHaveLength(1);
    expect([...t.state().selectedPaths]).toEqual(["/notes.txt"]);
  });

  it("navigate clears selection, editing and search (B4)", async () => {
    const t = setup({ methods: ["list"] });
    await t.loadRoot();
    t.store.getState().setSelection(["/notes.txt"]);
    t.store.getState().startEditing("/notes.txt");
    t.store.getState().setQuery("note");
    expect(t.visible().map((i) => i.name)).toEqual(["notes.txt"]);
    const nav = t.store.getState().navigate("/docs");
    t.c.resolveNext("list", listing(file("/docs/x")));
    await nav;
    expect(t.state().selectedPaths.size).toBe(0);
    expect(t.state().editingPath).toBeNull();
    expect(t.state().search.query).toBe("");
    expect(t.visible().map((i) => i.name)).toEqual(["x"]);
  });

  it("records a listing error and calls onError", async () => {
    const onError = vi.fn(() => {});
    const t = setup({ onError });
    t.c.rejectNext("list", new FinderError("permission", "nope"));
    await flush();
    expect(selectDirectory(t.state())?.status).toBe("error");
    expect(selectDirectory(t.state())?.error?.code).toBe("permission");
    expect(t.state().lastError?.code).toBe("permission");
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("directory cache (B3)", () => {
  it("dedupes concurrent loads of the same path", async () => {
    const t = setup();
    void t.store.getState().loadDirectory("/");
    void t.store.getState().loadDirectory("/");
    expect(t.c.pending("list")).toHaveLength(1);
  });

  it("force reload aborts the previous request", async () => {
    const t = setup();
    const first = t.c.pending("list")[0];
    void t.store.getState().refresh();
    expect(first?.signal?.aborted).toBe(true);
    expect(t.c.pending("list")).toHaveLength(1);
    t.c.resolveNext("list", listing(file("/late.txt")));
    await flush();
    expect(t.visible().map((i) => i.name)).toEqual(["late.txt"]);
  });

  it("a slow response for an earlier path never overwrites the current path", async () => {
    const t = setup();
    await t.loadRoot();
    void t.store.getState().navigate("/docs");
    void t.store.getState().navigate("/notes");
    const [docs, notes] = t.c.pending("list");
    expect(t.state().currentPath).toBe("/notes");
    notes?.resolve(listing(file("/notes/n.txt")));
    await flush();
    docs?.resolve(listing(file("/docs/d.txt")));
    await flush();
    expect(t.state().currentPath).toBe("/notes");
    expect(t.visible().map((i) => i.name)).toEqual(["n.txt"]);
    expect(selectChildren(t.state(), "/docs").map((i) => i.name)).toEqual(["d.txt"]);
  });

  it("keeps stale items visible while reloading", async () => {
    const t = setup();
    await t.loadRoot();
    void t.store.getState().refresh();
    expect(selectDirectory(t.state())?.status).toBe("loading");
    expect(t.visible()).toHaveLength(2);
  });

  it("loadMore appends the next page", async () => {
    const t = setup();
    t.c.resolveNext("list", { items: [file("/a")], cursor: "1" });
    await flush();
    const more = t.store.getState().loadMore("/");
    expect(t.c.pending("list")[0]?.args[1]).toMatchObject({ cursor: "1" });
    t.c.resolveNext("list", listing(file("/b")));
    await more;
    expect(t.visible().map((i) => i.name)).toEqual(["a", "b"]);
    expect(selectDirectory(t.state())?.cursor).toBeUndefined();
  });

  it("reloading a paginated directory re-fetches every loaded page", async () => {
    const t = setup();
    t.c.resolveNext("list", { items: [file("/a")], cursor: "1" });
    await flush();
    const more = t.store.getState().loadMore("/");
    t.c.resolveNext("list", { items: [file("/b")], cursor: "2" });
    await more;
    expect(t.visible().map((i) => i.name)).toEqual(["a", "b"]);
    const refresh = t.store.getState().refresh();
    t.c.resolveNext("list", { items: [file("/a")], cursor: "1" });
    await flush();
    expect(t.c.pending("list")[0]?.args[1]).toMatchObject({ cursor: "1" });
    t.c.resolveNext("list", { items: [file("/b2")], cursor: "2" });
    await refresh;
    expect(t.visible().map((i) => i.name)).toEqual(["a", "b2"]);
    expect(selectDirectory(t.state())?.cursor).toBe("2");
  });

  it("prunes vanished entries and their selection on reload", async () => {
    const t = setup();
    await t.loadRoot();
    t.store.getState().setSelection(["/notes.txt", "/docs"]);
    const refresh = t.store.getState().refresh();
    t.c.resolveNext("list", listing(dir("/docs")));
    await refresh;
    expect([...t.state().selectedPaths]).toEqual(["/docs"]);
    expect(t.state().cache.default?.entries["/notes.txt"]).toBeUndefined();
  });

  it("defers watch events emitted while an operation is pending", async () => {
    const t = setup();
    await t.loadRoot();
    t.store.getState().setSelection(["/notes.txt"]);
    const rename = t.store.getState().rename("/notes.txt", "renamed.txt");
    t.c.emitChange("/"); // adapter notices its own mutation
    expect(t.c.pending("list")).toHaveLength(0);
    t.c.resolveNext("move", file("/renamed.txt"));
    await rename;
    expect([...t.state().selectedPaths]).toEqual(["/renamed.txt"]);
    expect(t.c.pending("list").map((c) => c.args[0])).toEqual(["/"]);
  });

  it("watch events invalidate the current directory", async () => {
    const t = setup();
    await t.loadRoot();
    t.c.emitChange("/");
    expect(t.c.pending("list")).toHaveLength(1);
    t.c.emitChange("/elsewhere");
    expect(t.c.pending("list")).toHaveLength(1);
  });
});

describe("tree (B5/B6)", () => {
  it("expands nested directories from the shared cache", async () => {
    const t = setup();
    await t.loadRoot();
    const expand = t.store.getState().expand("/docs");
    t.c.resolveNext("list", listing(dir("/docs/deep")));
    await expand;
    const deeper = t.store.getState().expand("/docs/deep");
    t.c.resolveNext("list", listing(file("/docs/deep/leaf.txt")));
    await deeper;
    expect(selectChildren(t.state(), "/docs/deep").map((i) => i.name)).toEqual(["leaf.txt"]);
    expect([...t.state().expandedPaths]).toEqual(["/docs", "/docs/deep"]);
  });

  it("setExpanded loads only newly expanded directories", async () => {
    const t = setup();
    await t.loadRoot();
    t.store.getState().setExpanded(["/docs"]);
    expect(t.c.pending("list").map((c) => c.args[0])).toEqual(["/docs"]);
    t.c.resolveNext("list", listing());
    await flush();
    t.store.getState().setExpanded(["/docs"]);
    expect(t.c.pending("list")).toHaveLength(0);
    t.store.getState().collapse("/docs");
    expect(t.state().expandedPaths.size).toBe(0);
  });

  it("deleting an expanded directory prunes it and reloads its parent", async () => {
    const t = setup();
    await t.loadRoot();
    const expand = t.store.getState().expand("/docs");
    t.c.resolveNext("list", listing(file("/docs/a")));
    await expand;
    const del = t.store.getState().deleteItems(["/docs"]);
    t.c.resolveNext("delete");
    await del;
    expect(t.state().expandedPaths.has("/docs")).toBe(false);
    expect(selectChildren(t.state(), "/docs")).toEqual([]);
    expect(t.state().cache.default?.entries["/docs/a"]).toBeUndefined();
    expect(t.c.pending("list").map((c) => c.args[0])).toEqual(["/"]);
  });
});

describe("operations", () => {
  it("createDirectory picks a unique default name and patches the cache", async () => {
    const t = setup();
    await t.loadRoot([dir("/untitled folder")]);
    const create = t.store.getState().createDirectory();
    const call = t.c.pending("createDirectory")[0];
    expect(call?.args[0]).toBe("/untitled folder (1)");
    call?.resolve(dir("/untitled folder (1)"));
    const item = await create;
    expect(item.path).toBe("/untitled folder (1)");
    expect(t.visible().map((i) => i.name)).toContain("untitled folder (1)");
    expect(t.c.pending("list").map((c) => c.args[0])).toEqual(["/"]);
  });

  it("rename remaps selection, expansion and descendants", async () => {
    const t = setup();
    await t.loadRoot();
    const expand = t.store.getState().expand("/docs");
    t.c.resolveNext("list", listing(file("/docs/a.md")));
    await expand;
    t.store.getState().setSelection(["/docs"]);
    const rename = t.store.getState().rename("/docs", "papers");
    const call = t.c.pending("move")[0];
    expect(call?.args.slice(0, 2)).toEqual(["/docs", "/papers"]);
    call?.resolve(dir("/papers"));
    await rename;
    expect([...t.state().selectedPaths]).toEqual(["/papers"]);
    expect([...t.state().expandedPaths]).toEqual(["/papers"]);
    expect(selectChildren(t.state(), "/papers").map((i) => i.path)).toEqual(["/papers/a.md"]);
    expect(t.state().cache.default?.entries["/docs/a.md"]).toBeUndefined();
  });

  it("rename validates the name and short-circuits no-ops", async () => {
    const t = setup();
    await t.loadRoot();
    await expect(t.store.getState().rename("/docs", "a/b")).rejects.toBeInstanceOf(FinderError);
    const same = await t.store.getState().rename("/docs", "docs");
    expect(same.path).toBe("/docs");
    expect(t.c.pending("move")).toHaveLength(0);
  });

  it("reports partial failures per item", async () => {
    const onError = vi.fn(() => {});
    const t = setup({ onError });
    await t.loadRoot();
    const del = t.store.getState().deleteItems(["/docs", "/notes.txt"]);
    t.c.rejectNext("delete", new FinderError("permission", "locked"));
    t.c.resolveNext("delete");
    const result = await del;
    expect(result.ok).toEqual(["/notes.txt"]);
    expect(result.failed.map((f) => [f.path, f.error.code])).toEqual([["/docs", "permission"]]);
    expect(t.state().lastError?.code).toBe("permission");
    expect(onError).toHaveBeenCalledTimes(1);
    expect(t.visible().map((i) => i.name)).toEqual(["docs"]);
  });

  it("rejects unsupported operations before touching the adapter", async () => {
    const t = setup({ methods: ["list"] });
    await t.loadRoot();
    await expect(t.store.getState().deleteItems(["/docs"])).rejects.toSatisfy((e) =>
      FinderError.is(e, "unsupported"),
    );
    expect(t.c.pending()).toHaveLength(0);
  });

  it("limits concurrency", async () => {
    const t = setup({ concurrency: 2 });
    await t.loadRoot([file("/1"), file("/2"), file("/3"), file("/4")]);
    const del = t.store.getState().deleteItems(["/1", "/2", "/3", "/4"]);
    expect(t.c.pending("delete")).toHaveLength(2);
    t.c.resolveNext("delete");
    await flush();
    expect(t.c.pending("delete")).toHaveLength(2);
    t.c.resolveNext("delete");
    await flush();
    t.c.resolveNext("delete");
    await flush();
    t.c.resolveNext("delete");
    await del;
    expect(t.visible()).toHaveLength(0);
  });

  it("move skips same-directory targets and rejects moves into self", async () => {
    const t = setup();
    await t.loadRoot();
    const result = await t.store.getState().move(["/notes.txt"], "/");
    expect(result.ok).toEqual(["/notes.txt"]);
    expect(t.c.pending("move")).toHaveLength(0);
    const bad = await t.store.getState().move(["/docs"], "/docs/inner");
    expect(bad.failed[0]?.path).toBe("/docs");
    expect(t.c.pending("move")).toHaveLength(0);
  });

  it("copy into the same directory picks a unique name", async () => {
    const t = setup();
    await t.loadRoot();
    const copy = t.store.getState().copy(["/notes.txt"], "/");
    const call = t.c.pending("copy")[0];
    expect(call?.args.slice(0, 2)).toEqual(["/notes.txt", "/notes (1).txt"]);
    call?.resolve(file("/notes (1).txt"));
    await copy;
    expect(t.visible().map((i) => i.name)).toContain("notes (1).txt");
  });

  it("upload writes each file under a unique name", async () => {
    const t = setup();
    await t.loadRoot();
    const up = t.store
      .getState()
      .upload([new File(["a"], "notes.txt"), new File(["b"], "new.txt")]);
    const paths = t.c.pending("writeFile").map((c) => c.args[0]);
    expect(paths).toEqual(["/notes (1).txt", "/new.txt"]);
    t.c.resolveNext("writeFile", file("/notes (1).txt"));
    t.c.resolveNext("writeFile", file("/new.txt"));
    const result = await up;
    expect(result.ok).toHaveLength(2);
  });

  it("emits onOperation events", async () => {
    const onOperation = vi.fn(() => {});
    const t = setup({ onOperation });
    await t.loadRoot();
    const del = t.store.getState().deleteItems(["/notes.txt"]);
    t.c.resolveNext("delete");
    await del;
    expect(onOperation).toHaveBeenCalledWith(
      expect.objectContaining({ type: "delete", targets: ["/notes.txt"] }),
    );
  });
});

describe("search", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("filters client-side when the adapter cannot search", async () => {
    const t = setup({ methods: ["list"] });
    t.c.resolveNext("list", listing(file("/apple"), file("/banana")));
    await vi.advanceTimersByTimeAsync(0);
    t.store.getState().setQuery("APP");
    expect(t.state().search.results).toBeNull();
    expect(t.visible().map((i) => i.name)).toEqual(["apple"]);
    t.store.getState().clearSearch();
    expect(t.visible()).toHaveLength(2);
  });

  it("debounces, aborts superseded queries and merges adapter results", async () => {
    const t = setup();
    t.c.resolveNext("list", listing(file("/apple")));
    await vi.advanceTimersByTimeAsync(0);
    t.store.getState().setQuery("a");
    expect(t.state().search.status).toBe("searching");
    await vi.advanceTimersByTimeAsync(10);
    const first = t.c.pending("search")[0];
    expect(first?.args[0]).toBe("a");
    t.store.getState().setQuery("ab");
    await vi.advanceTimersByTimeAsync(10);
    expect(first?.signal?.aborted).toBe(true);
    t.c.resolveNext("search", [file("/deep/abc.txt")]);
    await vi.advanceTimersByTimeAsync(0);
    expect(t.state().search.status).toBe("done");
    expect(t.visible().map((i) => i.path)).toEqual(["/deep/abc.txt"]);
  });
});

describe("clipboard", () => {
  it("copy/paste copies and cut/paste moves then clears", async () => {
    const t = setup();
    await t.loadRoot();
    t.store.getState().copyToClipboard(["/notes.txt"]);
    const paste = t.store.getState().paste("/docs");
    const copy = t.c.pending("copy")[0];
    expect(copy?.args.slice(0, 2)).toEqual(["/notes.txt", "/docs/notes.txt"]);
    copy?.resolve(file("/docs/notes.txt"));
    await paste;
    expect(t.state().clipboard?.mode).toBe("copy");

    t.store.getState().cutToClipboard(["/notes.txt"]);
    const paste2 = t.store.getState().paste("/docs");
    t.c.resolveNext("move", file("/docs/notes.txt"));
    await paste2;
    expect(t.state().clipboard).toBeNull();
  });
});

describe("selectors", () => {
  it("visible items keep their identity across unrelated updates", async () => {
    const t = setup();
    await t.loadRoot();
    const a = t.visible();
    t.store.getState().setSelection(["/docs"]);
    expect(t.visible()).toBe(a);
    t.store.getState().setShowHidden(true);
    expect(t.visible()).not.toBe(a);
    expect(t.visible().map((i) => i.name)).toEqual(["docs", ".hidden", "notes.txt"]);
    t.store.getState().setSort({ column: "name", direction: "descending" });
    expect(t.visible().map((i) => i.name)).toEqual(["docs", "notes.txt", ".hidden"]);
  });

  it("selectAll selects only visible items", async () => {
    const t = setup();
    await t.loadRoot();
    t.store.getState().selectAll();
    expect([...t.state().selectedPaths].sort()).toEqual(["/docs", "/notes.txt"]);
  });
});

describe("locations", () => {
  it("switches location and keeps per-location caches and history", async () => {
    const a = createControlledAdapter();
    const b = createControlledAdapter({ methods: ["list"] });
    const store = createFinderStore({
      locations: [
        { id: "a", name: "A", adapter: a.adapter },
        { id: "b", name: "B", adapter: b.adapter, rootPath: "/root" },
      ],
    });
    a.resolveNext("list", listing(file("/a.txt")));
    await flush();
    const sw = store.getState().setLocation("b");
    expect(store.getState().currentLocationId).toBe("b");
    expect(store.getState().currentPath).toBe("/root");
    expect(store.getState().capabilities.delete).toBe(false);
    b.resolveNext("list", listing(file("/root/b.txt")));
    await sw;
    await store.getState().goBack();
    expect(store.getState().currentLocationId).toBe("a");
    expect(store.getState().capabilities.delete).toBe(true);
    expect(a.pending("list")).toHaveLength(0);
  });

  it("setLocations with a new adapter instance reloads", async () => {
    const t = setup();
    await t.loadRoot();
    const next = createControlledAdapter();
    const change = t.store
      .getState()
      .setLocations([{ id: "default", name: "Files", adapter: next.adapter }]);
    expect(next.pending("list")).toHaveLength(1);
    next.resolveNext("list", listing(file("/fresh")));
    await change;
    expect(t.visible().map((i) => i.name)).toEqual(["fresh"]);
  });
});

describe("destroy", () => {
  it("aborts in-flight requests", () => {
    const t = setup();
    const call = t.c.pending("list")[0];
    t.store.destroy();
    expect(call?.signal?.aborted).toBe(true);
  });
});
