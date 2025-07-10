import { describe, expect, it } from "vite-plus/test";

import { dir, file } from "../../adapters/testing/controlledAdapter.js";
import type { FileItem } from "../types.js";
import { createDraft, insertEntry, isCircular, moveSubtrees, removeSubtrees } from "./draft.js";
import type { Draft } from "./draft.js";

function draft(items: FileItem[], listings: Record<string, string[]>): Draft {
  const entries: Record<string, FileItem> = {};
  for (const item of items) entries[item.path] = item;
  return createDraft(
    {
      entries,
      directories: Object.fromEntries(
        Object.entries(listings).map(([path, paths]) => [
          path,
          { status: "loaded" as const, paths },
        ]),
      ),
    },
    new Set(),
    new Set(),
    null,
  );
}

const tree = () =>
  draft([dir("/a"), dir("/a/b"), file("/a/b/c.txt"), file("/a/x.txt"), file("/other.txt")], {
    "/": ["/a", "/other.txt"],
    "/a": ["/a/b", "/a/x.txt"],
    "/a/b": ["/a/b/c.txt"],
  });

describe("insertEntry", () => {
  it("adds to a loaded parent listing once", () => {
    const d = tree();
    insertEntry(d, file("/a/new.txt"));
    insertEntry(d, file("/a/new.txt"));
    expect(d.directories["/a"]?.paths).toEqual(["/a/b", "/a/x.txt", "/a/new.txt"]);
    insertEntry(d, file("/unknown/y.txt")); // parent not loaded: entry only
    expect(d.entries["/unknown/y.txt"]).toBeDefined();
    expect(d.directories["/unknown"]).toBeUndefined();
  });
});

describe("removeSubtrees", () => {
  it("prunes entries, listings, selection, expansion and editing", () => {
    const d = tree();
    d.selectedPaths = new Set(["/a/b/c.txt", "/other.txt"]);
    d.expandedPaths = new Set(["/a", "/a/b"]);
    d.editingPath = "/a/x.txt";
    removeSubtrees(d, ["/a"]);
    expect(Object.keys(d.entries).sort()).toEqual(["/other.txt"]);
    expect(Object.keys(d.directories).sort()).toEqual(["/"]);
    expect(d.directories["/"]?.paths).toEqual(["/other.txt"]);
    expect([...d.selectedPaths]).toEqual(["/other.txt"]);
    expect(d.expandedPaths.size).toBe(0);
    expect(d.editingPath).toBeNull();
  });

  it("does not confuse /a with /ab", () => {
    const d = draft([dir("/a"), file("/ab")], { "/": ["/a", "/ab"] });
    removeSubtrees(d, ["/a"]);
    expect(Object.keys(d.entries)).toEqual(["/ab"]);
  });
});

describe("moveSubtrees", () => {
  it("rebases descendants, listings, selection and expansion", () => {
    const d = tree();
    d.selectedPaths = new Set(["/a/b"]);
    d.expandedPaths = new Set(["/a", "/a/b"]);
    moveSubtrees(d, new Map([["/a", dir("/z")]]));
    expect(Object.keys(d.entries).sort()).toEqual([
      "/other.txt",
      "/z",
      "/z/b",
      "/z/b/c.txt",
      "/z/x.txt",
    ]);
    expect(d.entries["/z/b/c.txt"]?.name).toBe("c.txt");
    expect(d.directories["/z"]?.paths).toEqual(["/z/b", "/z/x.txt"]);
    expect(d.directories["/z/b"]?.paths).toEqual(["/z/b/c.txt"]);
    expect(d.directories["/"]?.paths).toEqual(["/other.txt", "/z"]);
    expect([...d.selectedPaths]).toEqual(["/z/b"]);
    expect([...d.expandedPaths].sort()).toEqual(["/z", "/z/b"]);
  });

  it("handles several moves at once", () => {
    const d = tree();
    moveSubtrees(
      d,
      new Map([
        ["/a/x.txt", file("/x.txt")],
        ["/other.txt", file("/a/other.txt")],
      ]),
    );
    expect(d.directories["/"]?.paths).toEqual(["/a", "/x.txt"]);
    expect(d.directories["/a"]?.paths).toEqual(["/a/b", "/a/other.txt"]);
  });
});

describe("isCircular", () => {
  it("detects self and descendant targets", () => {
    expect(isCircular("/a", "/a")).toBe(true);
    expect(isCircular("/a", "/a/b")).toBe(true);
    expect(isCircular("/a", "/ab")).toBe(false);
    expect(isCircular("/a", "/")).toBe(false);
  });
});
