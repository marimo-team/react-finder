import { FinderError, throwIfAborted, toFinderError } from "../../core/errors.js";
import { basename, dirname, isSameOrAncestor, normalizePath } from "../../core/path.js";
import type {
  CreateFileOptions,
  FileItem,
  FileSystemAdapter,
  ListOptions,
  ListResult,
  RequestOptions,
} from "../../core/types.js";
import { stripMutations } from "../readOnly.js";

export interface FileSystemAccessAdapterOptions {
  /** Directory handle from `window.showDirectoryPicker()`. */
  root: FileSystemDirectoryHandle;
  readOnly?: boolean;
}

type PermissionMode = "read" | "readwrite";

interface PermissionCapable {
  queryPermission?(desc: { mode: PermissionMode }): Promise<PermissionState>;
  requestPermission?(desc: { mode: PermissionMode }): Promise<PermissionState>;
}

interface MovableHandle {
  move?(target: FileSystemDirectoryHandle, name: string): Promise<void>;
}

/**
 * Adapter over the browser File System Access API. The consumer owns the
 * picker UI; this adapter only requests permission on the handle it is given.
 * Chromium-only for writes.
 */
export class FileSystemAccessAdapter implements FileSystemAdapter {
  private readonly root: FileSystemDirectoryHandle;
  private readonly readOnly: boolean;

  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function"
    );
  }

  constructor(options: FileSystemAccessAdapterOptions) {
    this.root = options.root;
    this.readOnly = options.readOnly ?? false;
    if (this.readOnly) {
      stripMutations(this);
    }
  }

  async list(path: string, opts: ListOptions = {}): Promise<ListResult> {
    throwIfAborted(opts.signal, path);
    await this.ensure("read");
    const dir = await this.directory(path);
    const items: FileItem[] = [];
    try {
      for await (const [name, handle] of dir.entries()) {
        throwIfAborted(opts.signal, path);
        items.push(await this.toItem(normalizePath(`${path}/${name}`), handle));
      }
    } catch (error) {
      throw toFinderError(error, path);
    }
    return { items };
  }

  async stat(path: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    await this.ensure("read");
    const handle = await this.handle(path);
    return this.toItem(normalizePath(path), handle);
  }

  async createDirectory(path: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    await this.ensure("readwrite");
    const target = normalizePath(path);
    const parent = await this.directory(dirname(target));
    await this.assertMissing(parent, basename(target), target);
    try {
      const handle = await parent.getDirectoryHandle(basename(target), {
        create: true,
      });
      return await this.toItem(target, handle);
    } catch (error) {
      throw toFinderError(error, target);
    }
  }

  async createFile(path: string, opts: CreateFileOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    await this.ensure("readwrite");
    const target = normalizePath(path);
    const parent = await this.directory(dirname(target));
    await this.assertMissing(parent, basename(target), target);
    return this.writeTo(parent, target, opts.content ?? "");
  }

  async delete(path: string, opts: RequestOptions = {}): Promise<void> {
    throwIfAborted(opts.signal, path);
    await this.ensure("readwrite");
    const target = normalizePath(path);
    if (target === "/") {
      throw new FinderError("permission", "Cannot delete the root directory", {
        path: target,
      });
    }
    const parent = await this.directory(dirname(target));
    await this.handle(target);
    try {
      await parent.removeEntry(basename(target), { recursive: true });
    } catch (error) {
      throw toFinderError(error, target);
    }
  }

  async move(from: string, to: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, from);
    await this.ensure("readwrite");
    const source = normalizePath(from);
    const target = normalizePath(to);
    if (isSameOrAncestor(source, target)) {
      throw new FinderError("unknown", `Cannot move ${source} into itself`, {
        path: source,
      });
    }
    const handle = await this.handle(source);
    const targetParent = await this.directory(dirname(target));
    await this.assertMissing(targetParent, basename(target), target);
    const movable = handle as unknown as MovableHandle;
    if (handle.kind === "file" && typeof movable.move === "function") {
      try {
        await movable.move(targetParent, basename(target));
        return await this.toItem(target, await this.handle(target));
      } catch (error) {
        throw toFinderError(error, source);
      }
    }
    await this.copyHandle(handle, targetParent, basename(target));
    await this.delete(source, opts);
    return this.toItem(target, await this.handle(target));
  }

  async copy(from: string, to: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, from);
    await this.ensure("readwrite");
    const source = normalizePath(from);
    const target = normalizePath(to);
    if (isSameOrAncestor(source, target)) {
      throw new FinderError("unknown", `Cannot copy ${source} into itself`, {
        path: source,
      });
    }
    const handle = await this.handle(source);
    const targetParent = await this.directory(dirname(target));
    await this.assertMissing(targetParent, basename(target), target);
    await this.copyHandle(handle, targetParent, basename(target));
    return this.toItem(target, await this.handle(target));
  }

  async readFile(path: string, opts: RequestOptions = {}): Promise<Blob> {
    throwIfAborted(opts.signal, path);
    await this.ensure("read");
    const handle = await this.handle(path);
    if (handle.kind !== "file") {
      throw new FinderError("unknown", `Is a directory: ${path}`, { path });
    }
    try {
      return await (handle as FileSystemFileHandle).getFile();
    } catch (error) {
      throw toFinderError(error, path);
    }
  }

  async writeFile(path: string, data: Blob | string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    await this.ensure("readwrite");
    const target = normalizePath(path);
    const parent = await this.directory(dirname(target));
    return this.writeTo(parent, target, data);
  }

  // ---- internals ---------------------------------------------------------

  private async ensure(mode: PermissionMode) {
    if (mode === "readwrite" && this.readOnly) {
      throw new FinderError("permission", "Adapter is read-only");
    }
    const root = this.root as unknown as PermissionCapable;
    if (typeof root.queryPermission !== "function") return;
    if ((await root.queryPermission({ mode })) === "granted") return;
    if (typeof root.requestPermission !== "function") {
      throw new FinderError("permission", `No ${mode} permission for this directory`);
    }
    if ((await root.requestPermission({ mode })) !== "granted") {
      throw new FinderError("permission", `${mode} permission was denied`);
    }
  }

  private async handle(path: string): Promise<FileSystemHandle> {
    const target = normalizePath(path);
    if (target === "/") return this.root;
    const parent = await this.directory(dirname(target));
    const name = basename(target);
    try {
      return await parent.getFileHandle(name);
    } catch {
      try {
        return await parent.getDirectoryHandle(name);
      } catch (error) {
        throw toFinderError(error, target);
      }
    }
  }

  private async directory(path: string): Promise<FileSystemDirectoryHandle> {
    const target = normalizePath(path);
    let current = this.root;
    if (target === "/") return current;
    for (const segment of target.split("/").slice(1)) {
      try {
        current = await current.getDirectoryHandle(segment);
      } catch (error) {
        throw toFinderError(error, target);
      }
    }
    return current;
  }

  /** True when `get` resolves; a rejection means "no such entry". */
  private async resolves(get: () => Promise<FileSystemHandle>): Promise<boolean> {
    try {
      await get();
      return true;
    } catch {
      return false;
    }
  }

  private async assertMissing(parent: FileSystemDirectoryHandle, name: string, path: string) {
    const exists =
      (await this.resolves(() => parent.getFileHandle(name))) ||
      (await this.resolves(() => parent.getDirectoryHandle(name)));
    if (exists) {
      throw new FinderError("exists", `Already exists: ${path}`, { path });
    }
  }

  private async writeTo(
    parent: FileSystemDirectoryHandle,
    path: string,
    data: Blob | string,
  ): Promise<FileItem> {
    try {
      const handle = await parent.getFileHandle(basename(path), {
        create: true,
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      return await this.toItem(path, handle);
    } catch (error) {
      throw toFinderError(error, path);
    }
  }

  private async copyHandle(
    source: FileSystemHandle,
    targetParent: FileSystemDirectoryHandle,
    name: string,
  ): Promise<void> {
    if (source.kind === "file") {
      const file = await (source as FileSystemFileHandle).getFile();
      const handle = await targetParent.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return;
    }
    const dir = await targetParent.getDirectoryHandle(name, { create: true });
    for await (const [childName, child] of (source as FileSystemDirectoryHandle).entries()) {
      await this.copyHandle(child, dir, childName);
    }
  }

  private async toItem(path: string, handle: FileSystemHandle): Promise<FileItem> {
    if (handle.kind === "directory") {
      return {
        path,
        name: basename(path),
        kind: "directory",
        meta: { handle },
      };
    }
    const file = await (handle as FileSystemFileHandle).getFile();
    return {
      path,
      name: basename(path),
      kind: "file",
      size: file.size,
      modifiedAt: file.lastModified,
      mimeType: file.type || undefined,
      meta: { handle },
    };
  }
}
