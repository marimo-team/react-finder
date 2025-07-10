import { describe, expect, it } from "vite-plus/test";

import {
  ancestorsOf,
  basename,
  dirname,
  isAncestor,
  joinPath,
  normalizePath,
  pathDepth,
  rebasePath,
} from "./path.js";

describe("normalizePath", () => {
  it("normalizes slashes, dots and empties", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("a/b")).toBe("/a/b");
    expect(normalizePath("//a///b/")).toBe("/a/b");
    expect(normalizePath("/a/./b/../c")).toBe("/a/c");
    expect(normalizePath("/../a")).toBe("/a");
  });
});

describe("dirname / basename / join", () => {
  it("works at every depth", () => {
    expect(dirname("/")).toBe("/");
    expect(dirname("/a")).toBe("/");
    expect(dirname("/a/b")).toBe("/a");
    expect(basename("/a/b.txt")).toBe("b.txt");
    expect(basename("/")).toBe("");
    expect(joinPath("/", "a", "b")).toBe("/a/b");
    expect(joinPath("/a/", "/b")).toBe("/a/b");
  });
});

describe("isAncestor", () => {
  it("uses segment boundaries, not string prefixes", () => {
    expect(isAncestor("/foo", "/foo/bar")).toBe(true);
    expect(isAncestor("/foo", "/foo2")).toBe(false);
    expect(isAncestor("/foo", "/foo")).toBe(false);
    expect(isAncestor("/", "/foo")).toBe(true);
    expect(isAncestor("/", "/")).toBe(false);
  });
});

describe("rebasePath", () => {
  it("rewrites subtree paths on move", () => {
    expect(rebasePath("/a/b/c", "/a/b", "/x")).toBe("/x/c");
    expect(rebasePath("/a/b", "/a/b", "/x/y")).toBe("/x/y");
    expect(rebasePath("/other", "/a/b", "/x")).toBe("/other");
  });
});

describe("pathDepth / ancestorsOf", () => {
  it("computes depth and ancestors", () => {
    expect(pathDepth("/")).toBe(0);
    expect(pathDepth("/a/b")).toBe(2);
    expect(ancestorsOf("/")).toEqual([]);
    expect(ancestorsOf("/a")).toEqual(["/"]);
    expect(ancestorsOf("/a/b/c")).toEqual(["/", "/a", "/a/b"]);
  });
});
