import { describe, expect, it } from "vite-plus/test";

import { FinderError } from "../../core/errors.js";
import { CONTRACT_SEED, describeAdapterContract } from "../testing/adapterContract.js";
import { MemoryAdapter } from "./memoryAdapter.js";
import type { MemoryPersistence } from "./memoryAdapter.js";
import { createSessionStorageAdapter } from "./persist.js";
import { VirtualFS } from "./virtualFs.js";

describeAdapterContract("MemoryAdapter", {
  create: () => new MemoryAdapter({ seed: CONTRACT_SEED }),
});

describeAdapterContract("MemoryAdapter (latency)", {
  create: () => new MemoryAdapter({ seed: CONTRACT_SEED, latency: 1 }),
});

describeAdapterContract("MemoryAdapter (paginated)", {
  create: () => new MemoryAdapter({ seed: CONTRACT_SEED, pageSize: 1 }),
});

function fakePersistence(): MemoryPersistence & { saves: number } {
  let json: string | null = null;
  return {
    saves: 0,
    load: () => json,
    save(value) {
      json = value;
      this.saves++;
    },
  };
}

describe("MemoryAdapter persistence", () => {
  it("saves after mutations and reloads from the snapshot", async () => {
    const persist = fakePersistence();
    const first = new MemoryAdapter({ seed: CONTRACT_SEED, persist });
    await first.createFile("/docs/saved.txt", { content: "keep me" });
    expect(persist.saves).toBe(1);

    const second = new MemoryAdapter({ seed: {}, persist });
    await expect((await second.readFile("/docs/saved.txt")).text()).resolves.toBe("keep me");
    expect((await second.list("/")).items.map((i) => i.name).sort()).toEqual(["docs", "notes.txt"]);
  });

  it("falls back to the seed when the snapshot is corrupt", async () => {
    const persist: MemoryPersistence = { load: () => "{oops", save() {} };
    const adapter = new MemoryAdapter({ seed: CONTRACT_SEED, persist });
    expect((await adapter.list("/")).items).toHaveLength(2);
  });

  it("createSessionStorageAdapter uses the given storage", async () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    } as unknown as Storage;
    const adapter = createSessionStorageAdapter({
      storage,
      key: "k",
      seed: CONTRACT_SEED,
    });
    await adapter.createDirectory("/x");
    expect([...map.keys()]).toContain("k");
  });
});

describe("MemoryAdapter latency + abort", () => {
  it("rejects with aborted when the signal fires mid-flight", async () => {
    const adapter = new MemoryAdapter({ seed: CONTRACT_SEED, latency: 50 });
    const controller = new AbortController();
    const promise = adapter.list("/", { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toSatisfy((e) => FinderError.is(e, "aborted"));
  });
});

describe("VirtualFS", () => {
  it("does not treat /foo2 as a child of /foo", () => {
    const fs = new VirtualFS({ seed: { foo: { a: "1" }, foo2: "2" } });
    expect(fs.list("/foo").map((i) => i.name)).toEqual(["a"]);
    expect(
      fs
        .list("/")
        .map((i) => i.name)
        .sort(),
    ).toEqual(["foo", "foo2"]);
  });

  it("round-trips through JSON", () => {
    const fs = new VirtualFS({ seed: { a: { b: { c: "deep" } }, top: "t" } });
    const clone = VirtualFS.fromJSON(JSON.stringify(fs.toJSON()));
    expect(clone.read("/a/b/c")).toBe("deep");
    expect(clone.list("/a").map((i) => i.name)).toEqual(["b"]);
    expect(clone.get("/")?.kind).toBe("directory");
  });

  it("moving a directory rewrites every descendant", () => {
    const fs = new VirtualFS({ seed: { a: { b: { c: "x" } } } });
    fs.move("/a", "/z");
    expect(fs.get("/a")).toBeUndefined();
    expect(fs.get("/a/b/c")).toBeUndefined();
    expect(fs.read("/z/b/c")).toBe("x");
    expect(fs.get("/z/b/c")?.name).toBe("c");
  });

  it("refuses to delete or move the root", () => {
    const fs = new VirtualFS();
    expect(() => {
      fs.delete("/");
    }).toThrow(FinderError);
    expect(() => fs.move("/", "/x")).toThrow(FinderError);
  });
});
