import { describe, expect, it } from "vite-plus/test";

import { getCapabilities } from "../core/capabilities.js";
import { MemoryAdapter } from "./memory/memoryAdapter.js";
import { createLocalStorageAdapter, createStorageAdapter } from "./memory/persist.js";
import { readOnlyAdapter } from "./readOnly.js";

describe("readOnlyAdapter", () => {
  it("exposes only non-mutating methods and forwards calls", async () => {
    const inner = new MemoryAdapter({ seed: { "a.txt": "hi" } });
    const ro = readOnlyAdapter(inner);
    const caps = getCapabilities(ro);
    expect(caps).toMatchObject({
      readFile: true,
      search: true,
      watch: true,
      stat: true,
      createFile: false,
      delete: false,
      move: false,
      copy: false,
      writeFile: false,
    });
    expect((await ro.list("/")).items.map((i) => i.name)).toEqual(["a.txt"]);
    await expect((await ro.readFile?.("/a.txt"))?.text()).resolves.toBe("hi");
    // The underlying adapter still works.
    await inner.createFile("/b.txt");
    expect((await ro.list("/")).items).toHaveLength(2);
  });
});

describe("storage adapters", () => {
  it("createStorageAdapter falls back to plain memory without storage", async () => {
    const adapter = createStorageAdapter(undefined, { seed: { "x.txt": "" } });
    expect((await adapter.list("/")).items).toHaveLength(1);
  });

  it("createLocalStorageAdapter accepts an explicit storage", async () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    } as unknown as Storage;
    const adapter = createLocalStorageAdapter({ storage, key: "k", seed: {} });
    await adapter.createDirectory("/d");
    expect(map.get("k")).toContain('"/d"');
    const reloaded = createLocalStorageAdapter({ storage, key: "k" });
    expect((await reloaded.list("/")).items.map((i) => i.name)).toEqual(["d"]);
  });
});
