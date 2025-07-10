import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";

import { blobToArrayBuffer } from "../../core/blob.js";
import { FinderError, throwIfAborted, toFinderError } from "../../core/errors.js";
import { basename, isSameOrAncestor, normalizePath } from "../../core/path.js";
import type {
  CreateFileOptions,
  FileItem,
  FileSystemAdapter,
  ListOptions,
  ListResult,
  RequestOptions,
} from "../../core/types.js";
import { stripMutations } from "../readOnly.js";

export interface S3AdapterOptions {
  /** A configured `S3Client` (credentials, region, endpoint are the consumer's concern). */
  client: S3Client;
  bucket: string;
  /** Key prefix acting as the root ("" = bucket root). */
  prefix?: string;
  /** Omit write operations (default true). */
  readOnly?: boolean;
  /** Page size for `list` (default 1000). */
  pageSize?: number;
}

/** The single method `S3Adapter` uses from the SDK's streaming response body. */
interface StreamingBody {
  transformToByteArray: () => Promise<Uint8Array>;
}

/** Join a normalized directory with a child name ("/" stays a single slash). */
function childPath(dir: string, name: string): string {
  return `${dir === "/" ? "" : dir}/${name}`;
}

/** Common prefixes returned alongside a delimited listing become directories. */
function directoryItems(
  commonPrefixes: readonly { Prefix?: string }[],
  prefix: string,
  dir: string,
): FileItem[] {
  const items: FileItem[] = [];
  for (const common of commonPrefixes) {
    const key = common.Prefix;
    if (!key || !key.startsWith(prefix)) continue;
    const name = key.slice(prefix.length).replace(/\/$/u, "");
    if (name) items.push({ path: childPath(dir, name), name, kind: "directory" });
  }
  return items;
}

/** Objects directly under `prefix` (nested keys and the folder marker are skipped). */
function fileItems(
  contents: readonly { Key?: string; Size?: number; LastModified?: Date; ETag?: string }[],
  prefix: string,
  dir: string,
): FileItem[] {
  const items: FileItem[] = [];
  for (const object of contents) {
    const key = object.Key;
    if (!key || !key.startsWith(prefix) || key === prefix) continue;
    const name = key.slice(prefix.length);
    if (!name || name.includes("/")) continue;
    items.push({
      path: childPath(dir, name),
      name,
      kind: "file",
      size: object.Size,
      modifiedAt: object.LastModified?.getTime(),
      meta: { key, etag: object.ETag },
    });
  }
  return items;
}

/**
 * Adapter over an S3-compatible bucket. Directories are key prefixes; a
 * zero-byte object ending in "/" marks an explicitly created folder.
 *
 * Import from `@marimo-team/react-finder/adapters/s3`; requires the optional
 * peer dependency `@aws-sdk/client-s3`.
 */
export class S3Adapter implements FileSystemAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly pageSize: number;

  constructor(options: S3AdapterOptions) {
    this.client = options.client;
    this.bucket = options.bucket;
    this.prefix = (options.prefix ?? "").replaceAll(/^\/+|\/+$/gu, "");
    this.pageSize = options.pageSize ?? 1000;
    if (options.readOnly ?? true) {
      stripMutations(this);
    }
  }

  async list(path: string, opts: ListOptions = {}): Promise<ListResult> {
    throwIfAborted(opts.signal, path);
    const dir = normalizePath(path);
    const prefix = this.dirKey(dir);
    try {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          Delimiter: "/",
          MaxKeys: this.pageSize,
          ContinuationToken: opts.cursor,
        }),
        { abortSignal: opts.signal },
      );
      const items: FileItem[] = [
        ...directoryItems(response.CommonPrefixes ?? [], prefix, dir),
        ...fileItems(response.Contents ?? [], prefix, dir),
      ];
      if (
        !opts.cursor &&
        items.length === 0 &&
        dir !== "/" &&
        !(await this.exists(prefix, opts.signal))
      ) {
        throw new FinderError("not_found", `Not found: ${dir}`, { path: dir });
      }
      return response.IsTruncated && response.NextContinuationToken
        ? { items, cursor: response.NextContinuationToken }
        : { items };
    } catch (error) {
      throw toFinderError(error, dir);
    }
  }

  async stat(path: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    const target = normalizePath(path);
    if (target === "/") return { path: "/", name: "", kind: "directory" };
    try {
      const head = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.fileKey(target),
        }),
        { abortSignal: opts.signal },
      );
      return {
        path: target,
        name: basename(target),
        kind: "file",
        size: head.ContentLength,
        modifiedAt: head.LastModified?.getTime(),
        mimeType: head.ContentType,
      };
    } catch (error) {
      const mapped = toFinderError(error, target);
      if (mapped.code !== "unknown" && mapped.code !== "not_found") throw mapped;
    }
    if (await this.exists(this.dirKey(target), opts.signal)) {
      return { path: target, name: basename(target), kind: "directory" };
    }
    throw new FinderError("not_found", `Not found: ${target}`, {
      path: target,
    });
  }

  async createDirectory(path: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    const target = normalizePath(path);
    await this.assertParent(target, opts.signal);
    await this.assertMissing(target, opts.signal);
    await this.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.dirKey(target),
        Body: "",
      }),
      opts,
      target,
    );
    return { path: target, name: basename(target), kind: "directory" };
  }

  async createFile(path: string, opts: CreateFileOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    const target = normalizePath(path);
    await this.assertParent(target, opts.signal);
    await this.assertMissing(target, opts.signal);
    return this.put(target, opts.content ?? "", opts);
  }

  async writeFile(path: string, data: Blob | string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, path);
    return this.put(normalizePath(path), data, opts);
  }

  async readFile(path: string, opts: RequestOptions = {}): Promise<Blob> {
    throwIfAborted(opts.signal, path);
    const target = normalizePath(path);
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.fileKey(target),
        }),
        { abortSignal: opts.signal },
      );
      // The SDK types `Body` as a union of platform stream types; only this method is used.
      const body = response.Body as StreamingBody | undefined;
      // Copy into a fresh `Uint8Array<ArrayBuffer>`: `BlobPart` rejects `ArrayBufferLike` views.
      const bytes = new Uint8Array((await body?.transformToByteArray()) ?? []);
      return new Blob([bytes], { type: response.ContentType ?? "" });
    } catch (error) {
      throw toFinderError(error, target);
    }
  }

  async delete(path: string, opts: RequestOptions = {}): Promise<void> {
    throwIfAborted(opts.signal, path);
    const target = normalizePath(path);
    const keys = await this.keysUnder(target, opts.signal);
    if (keys.length === 0) {
      throw new FinderError("not_found", `Not found: ${target}`, {
        path: target,
      });
    }
    for (let i = 0; i < keys.length; i += 1000) {
      await this.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        }),
        opts,
        target,
      );
    }
  }

  async copy(from: string, to: string, opts: RequestOptions = {}): Promise<FileItem> {
    throwIfAborted(opts.signal, from);
    const source = normalizePath(from);
    const target = normalizePath(to);
    if (isSameOrAncestor(source, target)) {
      throw new FinderError("unknown", `Cannot copy ${source} into itself`, {
        path: source,
      });
    }
    await this.assertMissing(target, opts.signal);
    const keys = await this.keysUnder(source, opts.signal);
    if (keys.length === 0) {
      throw new FinderError("not_found", `Not found: ${source}`, {
        path: source,
      });
    }
    const sourceFile = this.fileKey(source);
    const isFile = keys.length === 1 && keys[0] === sourceFile;
    for (const key of keys) {
      const suffix = isFile ? "" : key.slice(this.dirKey(source).length);
      const destKey = isFile ? this.fileKey(target) : this.dirKey(target) + suffix;
      await this.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${encodeURIComponent(key).replaceAll("%2F", "/")}`,
          Key: destKey,
        }),
        opts,
        source,
      );
    }
    return isFile
      ? this.stat(target, opts)
      : { path: target, name: basename(target), kind: "directory" };
  }

  async move(from: string, to: string, opts: RequestOptions = {}): Promise<FileItem> {
    const item = await this.copy(from, to, opts);
    await this.delete(from, opts);
    return item;
  }

  // ---- internals ---------------------------------------------------------

  private fileKey(path: string): string {
    const rel = normalizePath(path).slice(1);
    return this.prefix ? `${this.prefix}/${rel}` : rel;
  }

  private dirKey(path: string): string {
    const normalized = normalizePath(path);
    if (normalized === "/") return this.prefix ? `${this.prefix}/` : "";
    return `${this.fileKey(normalized)}/`;
  }

  private async exists(prefix: string, signal?: AbortSignal): Promise<boolean> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: 1,
      }),
      { abortSignal: signal },
    );
    return (response.KeyCount ?? 0) > 0;
  }

  private async objectExists(key: string, signal?: AbortSignal): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }), {
        abortSignal: signal,
      });
      return true;
    } catch (error) {
      const mapped = toFinderError(error, key);
      if (mapped.code === "not_found" || mapped.code === "unknown") return false;
      throw mapped;
    }
  }

  private async assertMissing(path: string, signal?: AbortSignal) {
    if (
      (await this.objectExists(this.fileKey(path), signal)) ||
      (await this.exists(this.dirKey(path), signal))
    ) {
      throw new FinderError("exists", `Already exists: ${path}`, { path });
    }
  }

  /** S3 has no directories; require the parent "directory" to have at least one object. */
  private async assertParent(path: string, signal?: AbortSignal) {
    const parent = path.slice(0, path.lastIndexOf("/")) || "/";
    if (parent === "/") return;
    if (!(await this.exists(this.dirKey(parent), signal))) {
      throw new FinderError("not_found", `Parent directory not found: ${parent}`, { path });
    }
  }

  private async keysUnder(path: string, signal?: AbortSignal): Promise<string[]> {
    const keys: string[] = [];
    const fileKey = this.fileKey(path);
    const dirKey = this.dirKey(path);
    let token: string | undefined;
    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: dirKey,
          ContinuationToken: token,
        }),
        { abortSignal: signal },
      );
      for (const object of response.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      token = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (token);
    if (keys.length === 0 && (await this.objectExists(fileKey, signal))) {
      keys.push(fileKey);
    }
    return keys;
  }

  private async put(path: string, data: Blob | string, opts: RequestOptions): Promise<FileItem> {
    const body = typeof data === "string" ? data : new Uint8Array(await blobToArrayBuffer(data));
    const type = typeof data === "string" ? undefined : data.type || undefined;
    await this.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fileKey(path),
        Body: body,
        ContentType: type,
      }),
      opts,
      path,
    );
    return {
      path,
      name: basename(path),
      kind: "file",
      size: typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.size,
      modifiedAt: Date.now(),
      mimeType: type,
    };
  }

  private async send(command: object, opts: RequestOptions, path: string): Promise<unknown> {
    try {
      // `S3Client.send` is overloaded per command; every command shares the same runtime path.
      return await this.client.send(command as ListObjectsV2Command, {
        abortSignal: opts.signal,
      });
    } catch (error) {
      throw toFinderError(error, path);
    }
  }
}
