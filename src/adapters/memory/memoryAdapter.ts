import { blobToText } from "../../core/blob.js";
import { FinderError, throwIfAborted } from "../../core/errors.js";
import type {
  CreateFileOptions,
  FileItem,
  FileSystemAdapter,
  ListOptions,
  ListResult,
  RequestOptions,
  SearchOptions,
  Unsubscribe,
  WatchEvent,
} from "../../core/types.js";
import { VirtualFS } from "./virtualFs.js";
import type { SeedTree } from "./virtualFs.js";

export interface MemoryPersistence {
  load(): string | null;
  save(json: string): void;
}

export interface MemoryAdapterOptions {
  /** Share one filesystem between adapters (they stay in sync via `watch`). */
  fs?: VirtualFS;
  /** Initial contents. Ignored when `persist.load()` returns a snapshot. */
  seed?: SeedTree;
  /** Load on construction, save after every mutation. */
  persist?: MemoryPersistence;
  /** Simulated delay per operation in ms (honors `signal`). */
  latency?: number;
  /** Page size for `list`; enables cursor pagination. */
  pageSize?: number;
}

/**
 * In-memory adapter. Implements every optional method of `FileSystemAdapter`,
 * which makes it the reference implementation for the adapter contract.
 */
export class MemoryAdapter implements FileSystemAdapter {
  readonly fs: VirtualFS;
  private readonly latency: number;
  private readonly pageSize: number | undefined;

  constructor(options: MemoryAdapterOptions = {}) {
    this.latency = options.latency ?? 0;
    this.pageSize = options.pageSize;
    this.fs = options.fs ?? createFs(options);
    if (options.persist) {
      const persist = options.persist;
      this.fs.subscribe(() => {
        persist.save(JSON.stringify(this.fs.toJSON()));
      });
    }
  }

  async list(path: string, opts: ListOptions = {}): Promise<ListResult> {
    await this.wait(opts, path);
    const items = this.fs.list(path);
    if (this.pageSize === undefined || this.pageSize <= 0) return { items };
    const start = opts.cursor ? Math.trunc(Number(opts.cursor)) : 0;
    const page = items.slice(start, start + this.pageSize);
    const next = start + this.pageSize;
    return next < items.length ? { items: page, cursor: String(next) } : { items: page };
  }

  async stat(path: string, opts: RequestOptions = {}): Promise<FileItem> {
    await this.wait(opts, path);
    return this.fs.stat(path);
  }

  async createDirectory(path: string, opts: RequestOptions = {}): Promise<FileItem> {
    await this.wait(opts, path);
    return this.fs.createDirectory(path);
  }

  async createFile(path: string, opts: CreateFileOptions = {}): Promise<FileItem> {
    await this.wait(opts, path);
    return this.fs.createFile(path, await toText(opts.content));
  }

  async delete(path: string, opts: RequestOptions = {}): Promise<void> {
    await this.wait(opts, path);
    this.fs.delete(path);
  }

  async move(from: string, to: string, opts: RequestOptions = {}): Promise<FileItem> {
    await this.wait(opts, from);
    return this.fs.move(from, to);
  }

  async copy(from: string, to: string, opts: RequestOptions = {}): Promise<FileItem> {
    await this.wait(opts, from);
    return this.fs.copy(from, to);
  }

  async readFile(path: string, opts: RequestOptions = {}): Promise<Blob> {
    await this.wait(opts, path);
    const item = this.fs.stat(path);
    return new Blob([this.fs.read(path)], {
      type: item.mimeType ?? "text/plain",
    });
  }

  async writeFile(path: string, data: Blob | string, opts: RequestOptions = {}): Promise<FileItem> {
    await this.wait(opts, path);
    return this.fs.write(path, await toText(data));
  }

  async search(query: string, opts: SearchOptions = {}): Promise<FileItem[]> {
    await this.wait(opts, opts.path);
    return this.fs.search(query, opts.path ?? "/");
  }

  watch(callback: (event: WatchEvent) => void): Unsubscribe {
    return this.fs.subscribe((path) => {
      callback({ type: "changed", path });
    });
  }

  private async wait(opts: RequestOptions, path?: string) {
    throwIfAborted(opts.signal, path);
    if (this.latency <= 0) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        opts.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, this.latency);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new FinderError("aborted", "Operation aborted", { path }));
      };
      opts.signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}

function createFs(options: MemoryAdapterOptions): VirtualFS {
  const stored = options.persist?.load();
  if (stored) {
    try {
      return VirtualFS.fromJSON(stored);
    } catch {
      // Corrupt snapshot: fall through to the seed.
    }
  }
  return new VirtualFS({ seed: options.seed });
}

async function toText(data: Blob | string | undefined): Promise<string> {
  return data === undefined ? "" : blobToText(data);
}
