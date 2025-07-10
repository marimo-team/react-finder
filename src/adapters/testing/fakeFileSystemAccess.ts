import type { SeedTree } from "../memory/virtualFs.js";

/** The subset of `FileSystemWritableFileStream` the adapter uses. */
export interface FakeWritable {
  write: (chunk: BlobPart) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * In-memory stand-ins for the File System Access API handles, close enough
 * to run the adapter contract in node. Errors use the same DOMException names
 * as browsers.
 */
export class FakeFileHandle {
  readonly kind = "file" as const;
  lastModified: number = Date.now();
  constructor(
    public name: string,
    public data: Blob = new Blob([]),
    public parent: FakeDirectoryHandle | null = null,
  ) {}

  async getFile(): Promise<File> {
    return new File([this.data], this.name, {
      lastModified: this.lastModified,
      type: this.data.type,
    });
  }

  async createWritable(): Promise<FakeWritable> {
    const chunks: BlobPart[] = [];
    return {
      write: async (chunk: BlobPart) => {
        chunks.push(chunk);
      },
      close: async () => {
        this.data = new Blob(chunks);
        this.lastModified = Date.now();
      },
    };
  }

  async isSameEntry(other: unknown): Promise<boolean> {
    return other === this;
  }
}

export interface FakeDirectoryOptions {
  /** Implement the (Chromium) `move()` on file handles. */
  supportsMove?: boolean;
  /** What `queryPermission` returns. */
  permission?: PermissionState;
}

export class FakeDirectoryHandle {
  readonly kind = "directory" as const;
  readonly children: Map<string, FakeFileHandle | FakeDirectoryHandle> = new Map<
    string,
    FakeFileHandle | FakeDirectoryHandle
  >();
  requested = 0;

  constructor(
    public name: string,
    private readonly options: FakeDirectoryOptions = {},
    public parent: FakeDirectoryHandle | null = null,
  ) {}

  async *entries(): AsyncGenerator<[string, FakeFileHandle | FakeDirectoryHandle]> {
    for (const entry of this.children) yield entry;
  }

  async *values(): AsyncGenerator<FakeFileHandle | FakeDirectoryHandle> {
    for (const child of this.children.values()) yield child;
  }

  async *keys(): AsyncGenerator<string> {
    for (const key of this.children.keys()) yield key;
  }

  async getFileHandle(name: string, opts: { create?: boolean } = {}): Promise<FakeFileHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== "file") {
        throw new DOMException(`${name} is a directory`, "TypeMismatchError");
      }
      return existing;
    }
    if (!opts.create) {
      throw new DOMException(`${name} not found`, "NotFoundError");
    }
    const handle = new FakeFileHandle(name, new Blob([]), this);
    if (this.options.supportsMove) {
      (handle as FakeFileHandle & { move?: unknown }).move = async (
        target: FakeDirectoryHandle,
        newName: string,
      ) => {
        handle.parent?.children.delete(handle.name);
        handle.name = newName;
        handle.parent = target;
        target.children.set(newName, handle);
      };
    }
    this.children.set(name, handle);
    return handle;
  }

  async getDirectoryHandle(
    name: string,
    opts: { create?: boolean } = {},
  ): Promise<FakeDirectoryHandle> {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== "directory") {
        throw new DOMException(`${name} is a file`, "TypeMismatchError");
      }
      return existing;
    }
    if (!opts.create) {
      throw new DOMException(`${name} not found`, "NotFoundError");
    }
    const handle = new FakeDirectoryHandle(name, this.options, this);
    this.children.set(name, handle);
    return handle;
  }

  async removeEntry(name: string, opts: { recursive?: boolean } = {}): Promise<void> {
    const existing = this.children.get(name);
    if (!existing) throw new DOMException(`${name} not found`, "NotFoundError");
    if (existing.kind === "directory" && existing.children.size > 0 && !opts.recursive) {
      throw new DOMException("Directory not empty", "InvalidModificationError");
    }
    this.children.delete(name);
  }

  async queryPermission(): Promise<PermissionState> {
    return this.options.permission ?? "granted";
  }

  async requestPermission(): Promise<PermissionState> {
    this.requested++;
    return this.options.permission ?? "granted";
  }

  async isSameEntry(other: unknown): Promise<boolean> {
    return other === this;
  }
}

/** Build a fake directory tree from the same seed shape `MemoryAdapter` uses. */
export function fakeDirectoryFromSeed(
  seed: SeedTree,
  options: FakeDirectoryOptions = {},
  name = "root",
): FakeDirectoryHandle {
  const dir = new FakeDirectoryHandle(name, options);
  for (const [childName, value] of Object.entries(seed)) {
    if (typeof value === "string") {
      dir.children.set(
        childName,
        new FakeFileHandle(childName, new Blob([value], { type: "text/plain" }), dir),
      );
    } else {
      const child = fakeDirectoryFromSeed(value, options, childName);
      child.parent = dir;
      dir.children.set(childName, child);
    }
  }
  return dir;
}
