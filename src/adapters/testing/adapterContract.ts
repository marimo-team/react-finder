import { describe, expect, it } from "vite-plus/test";

import { FinderError } from "../../core/errors.js";
import type { FileItem, FileSystemAdapter } from "../../core/types.js";

export interface AdapterContractOptions {
  /**
   * Create a fresh adapter whose root contains exactly:
   *   /docs/            (directory)
   *   /docs/readme.md   (file, content "hello")
   *   /docs/nested/     (directory)
   *   /docs/nested/deep.txt (file)
   *   /notes.txt        (file)
   */
  create: () => FileSystemAdapter | Promise<FileSystemAdapter>;
  /** Called after each test. */
  destroy?: (adapter: FileSystemAdapter) => void | Promise<void>;
}

export const CONTRACT_SEED = {
  docs: {
    "readme.md": "hello",
    nested: { "deep.txt": "deep" },
  },
  "notes.txt": "notes",
};

async function listAll(adapter: FileSystemAdapter, path: string): Promise<FileItem[]> {
  const items: FileItem[] = [];
  let cursor: string | undefined;
  do {
    const page = await adapter.list(path, { cursor });
    items.push(...page.items);
    cursor = page.cursor;
  } while (cursor);
  return items;
}

const names = (items: FileItem[]) => items.map((i) => i.name).sort();

/**
 * The `FinderError` code `promise` rejected with, for `expect(...).toBe(code)`.
 * A non-`FinderError` rejection is returned as-is and a resolution reports
 * `"<resolved>"`, so either shows up in the failure message.
 */
async function rejectionCode(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return FinderError.is(error) ? error.code : error;
  }
  return "<resolved>";
}

/**
 * Conformance suite for `FileSystemAdapter` implementations. Sections for
 * optional methods are skipped when the adapter does not implement them.
 */
export function describeAdapterContract(name: string, options: AdapterContractOptions): void {
  describe(`${name} adapter contract`, () => {
    const withAdapter = async (fn: (adapter: FileSystemAdapter) => Promise<void>) => {
      const adapter = await options.create();
      try {
        await fn(adapter);
      } finally {
        await options.destroy?.(adapter);
      }
    };

    it("lists the root with normalized paths", () =>
      withAdapter(async (adapter) => {
        const items = await listAll(adapter, "/");
        expect(names(items)).toEqual(["docs", "notes.txt"]);
        for (const item of items) {
          expect(item.path).toBe(`/${item.name}`);
          expect(["file", "directory"]).toContain(item.kind);
        }
        expect(items.find((i) => i.name === "docs")?.kind).toBe("directory");
        expect(items.find((i) => i.name === "notes.txt")?.kind).toBe("file");
      }));

    it("lists nested directories", () =>
      withAdapter(async (adapter) => {
        expect(names(await listAll(adapter, "/docs"))).toEqual(["nested", "readme.md"]);
        expect(names(await listAll(adapter, "/docs/nested"))).toEqual(["deep.txt"]);
      }));

    it("rejects listing a missing path or a file with not_found", () =>
      withAdapter(async (adapter) => {
        await expect(rejectionCode(adapter.list("/missing"))).resolves.toBe("not_found");
        await expect(rejectionCode(adapter.list("/notes.txt"))).resolves.toBe("not_found");
      }));

    it("rejects with aborted when the signal is already aborted", () =>
      withAdapter(async (adapter) => {
        const controller = new AbortController();
        controller.abort();
        await expect(rejectionCode(adapter.list("/", { signal: controller.signal }))).resolves.toBe(
          "aborted",
        );
      }));

    it("stat returns the item", () =>
      withAdapter(async (adapter) => {
        if (!adapter.stat) return;
        const item = await adapter.stat("/docs/readme.md");
        expect(item.path).toBe("/docs/readme.md");
        expect(item.kind).toBe("file");
        await expect(rejectionCode(adapter.stat("/nope"))).resolves.toBe("not_found");
      }));

    it("creates directories and files", () =>
      withAdapter(async (adapter) => {
        if (!adapter.createDirectory || !adapter.createFile) return;
        const dir = await adapter.createDirectory("/new");
        expect(dir).toMatchObject({
          path: "/new",
          name: "new",
          kind: "directory",
        });
        const file = await adapter.createFile("/new/a.txt", { content: "abc" });
        expect(file).toMatchObject({
          path: "/new/a.txt",
          name: "a.txt",
          kind: "file",
        });
        expect(names(await listAll(adapter, "/new"))).toEqual(["a.txt"]);
        await expect(rejectionCode(adapter.createFile("/new/a.txt"))).resolves.toBe("exists");
        await expect(rejectionCode(adapter.createDirectory("/new"))).resolves.toBe("exists");
        await expect(rejectionCode(adapter.createFile("/nope/x.txt"))).resolves.toBe("not_found");
      }));

    it("reads and writes file content", () =>
      withAdapter(async (adapter) => {
        if (!adapter.readFile || !adapter.writeFile) return;
        await expect((await adapter.readFile("/docs/readme.md")).text()).resolves.toBe("hello");
        const written = await adapter.writeFile("/docs/readme.md", "updated");
        expect(written.path).toBe("/docs/readme.md");
        await expect((await adapter.readFile("/docs/readme.md")).text()).resolves.toBe("updated");
        await adapter.writeFile("/docs/blob.bin", new Blob(["xyz"]));
        await expect((await adapter.readFile("/docs/blob.bin")).text()).resolves.toBe("xyz");
        await expect(rejectionCode(adapter.readFile("/nope"))).resolves.toBe("not_found");
      }));

    it("moves files and directory subtrees", () =>
      withAdapter(async (adapter) => {
        if (!adapter.move) return;
        const renamed = await adapter.move("/notes.txt", "/renamed.txt");
        expect(renamed).toMatchObject({
          path: "/renamed.txt",
          name: "renamed.txt",
        });
        expect(names(await listAll(adapter, "/"))).toEqual(["docs", "renamed.txt"]);

        const moved = await adapter.move("/docs", "/archive");
        expect(moved.path).toBe("/archive");
        expect(names(await listAll(adapter, "/archive/nested"))).toEqual(["deep.txt"]);
        await expect(rejectionCode(adapter.list("/docs"))).resolves.toBe("not_found");

        await expect(rejectionCode(adapter.move("/archive", "/archive/nested/x"))).resolves.toBe(
          "unknown",
        );
        await expect(rejectionCode(adapter.move("/nope", "/x"))).resolves.toBe("not_found");
        await expect(rejectionCode(adapter.move("/renamed.txt", "/archive"))).resolves.toBe(
          "exists",
        );
      }));

    it("copies files and directory subtrees", () =>
      withAdapter(async (adapter) => {
        if (!adapter.copy) return;
        const copied = await adapter.copy("/docs", "/docs-copy");
        expect(copied.path).toBe("/docs-copy");
        expect(names(await listAll(adapter, "/docs-copy/nested"))).toEqual(["deep.txt"]);
        expect(names(await listAll(adapter, "/docs/nested"))).toEqual(["deep.txt"]);
        if (adapter.readFile) {
          await expect((await adapter.readFile("/docs-copy/readme.md")).text()).resolves.toBe(
            "hello",
          );
        }
        await expect(rejectionCode(adapter.copy("/docs", "/docs/inner"))).resolves.toBe("unknown");
      }));

    it("deletes recursively", () =>
      withAdapter(async (adapter) => {
        if (!adapter.delete) return;
        await adapter.delete("/docs");
        expect(names(await listAll(adapter, "/"))).toEqual(["notes.txt"]);
        await expect(rejectionCode(adapter.list("/docs/nested"))).resolves.toBe("not_found");
        await expect(rejectionCode(adapter.delete("/docs"))).resolves.toBe("not_found");
      }));

    it("searches by name", () =>
      withAdapter(async (adapter) => {
        if (!adapter.search) return;
        expect(names(await adapter.search("txt"))).toEqual(["deep.txt", "notes.txt"]);
        expect(names(await adapter.search("txt", { path: "/docs" }))).toEqual(["deep.txt"]);
      }));

    it("notifies watchers with the changed directory", () =>
      withAdapter(async (adapter) => {
        if (!adapter.watch || !adapter.createFile) return;
        const events: string[] = [];
        const stop = adapter.watch((e) => {
          events.push(e.path);
        });
        await adapter.createFile("/docs/new.txt");
        stop();
        await adapter.createFile("/docs/other.txt");
        expect(events).toEqual(["/docs"]);
      }));
  });
}
