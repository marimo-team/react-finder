import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";

import type { SeedTree } from "../memory/virtualFs.js";

interface StoredObject {
  body: Uint8Array;
  contentType?: string;
  lastModified: Date;
}

/** An error shaped like an AWS SDK service error: a service `name` plus `$metadata`. */
function s3Error(name: string, status: number): Error {
  const error: Error & { $metadata?: { httpStatusCode: number } } = new Error(name);
  error.name = name;
  error.$metadata = { httpStatusCode: status };
  return error;
}

const encoder = new TextEncoder();

async function toBytes(body: PutObjectCommand["input"]["Body"]): Promise<Uint8Array> {
  if (typeof body === "string") return encoder.encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  return new Uint8Array();
}

/**
 * A minimal in-memory S3 that understands the commands `S3Adapter` sends.
 * Keys are flat strings; "directories" are just key prefixes, exactly like S3.
 */
export class FakeS3 {
  readonly objects: Map<string, StoredObject> = new Map<string, StoredObject>();
  readonly calls: string[] = [];

  constructor(public readonly bucket = "bucket") {}

  seed(tree: SeedTree, prefix = ""): void {
    for (const [name, value] of Object.entries(tree)) {
      const key = prefix ? `${prefix}/${name}` : name;
      if (typeof value === "string") {
        this.put(key, encoder.encode(value), "text/plain");
      } else {
        this.put(`${key}/`, new Uint8Array());
        this.seed(value, key);
      }
    }
  }

  put(key: string, body: Uint8Array, contentType?: string): void {
    this.objects.set(key, { body, contentType, lastModified: new Date() });
  }

  /** Cast to `S3Client` for the adapter; only `send` is implemented. */
  get client(): S3Client {
    return { send: this.send.bind(this) } as unknown as S3Client;
  }

  async send(command: unknown, options: { abortSignal?: AbortSignal } = {}): Promise<unknown> {
    if (options.abortSignal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    this.calls.push((command as { constructor: { name: string } }).constructor.name);
    if (command instanceof ListObjectsV2Command) return this.list(command.input);
    if (command instanceof HeadObjectCommand) return this.head(command.input);
    if (command instanceof GetObjectCommand) return this.get(command.input);
    if (command instanceof PutObjectCommand) return this.putObject(command.input);
    if (command instanceof DeleteObjectsCommand) return this.deleteObjects(command.input);
    if (command instanceof CopyObjectCommand) return this.copy(command.input);
    throw new Error(`FakeS3: unsupported command ${String(command)}`);
  }

  private list(input: ListObjectsV2Command["input"]) {
    const prefix = input.Prefix ?? "";
    const delimiter = input.Delimiter;
    const keys = [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
    const contents: {
      Key: string;
      Size: number;
      LastModified: Date;
      ETag: string;
    }[] = [];
    const commonPrefixes = new Set<string>();
    for (const key of keys) {
      const rest = key.slice(prefix.length);
      const slash = delimiter ? rest.indexOf(delimiter) : -1;
      if (delimiter && slash >= 0) {
        commonPrefixes.add(prefix + rest.slice(0, slash + 1));
      } else {
        const object = this.objects.get(key) as StoredObject;
        contents.push({
          Key: key,
          Size: object.body.byteLength,
          LastModified: object.lastModified,
          ETag: `"${key.length}"`,
        });
      }
    }
    const all: (
      | { kind: "prefix"; Prefix: string }
      | { kind: "object"; entry: (typeof contents)[number] }
    )[] = [
      ...[...commonPrefixes].map((p) => ({
        kind: "prefix" as const,
        Prefix: p,
      })),
      ...contents.map((entry) => ({ kind: "object" as const, entry })),
    ];
    const max = input.MaxKeys ?? 1000;
    const start = input.ContinuationToken ? Math.trunc(Number(input.ContinuationToken)) : 0;
    const page = all.slice(start, start + max);
    const truncated = start + max < all.length;
    return {
      CommonPrefixes: page.filter((p) => p.kind === "prefix").map((p) => ({ Prefix: p.Prefix })),
      Contents: page.filter((p) => p.kind === "object").map((p) => p.entry),
      KeyCount: page.length,
      IsTruncated: truncated,
      NextContinuationToken: truncated ? String(start + max) : undefined,
    };
  }

  private head(input: HeadObjectCommand["input"]) {
    const object = this.objects.get(input.Key ?? "");
    if (!object) throw s3Error("NotFound", 404);
    return {
      ContentLength: object.body.byteLength,
      ContentType: object.contentType,
      LastModified: object.lastModified,
    };
  }

  private get(input: GetObjectCommand["input"]) {
    const object = this.objects.get(input.Key ?? "");
    if (!object) throw s3Error("NoSuchKey", 404);
    return {
      ContentType: object.contentType,
      Body: { transformToByteArray: async () => object.body },
    };
  }

  private async putObject(input: PutObjectCommand["input"]) {
    const bytes = await toBytes(input.Body);
    this.put(input.Key ?? "", bytes, input.ContentType);
    return {};
  }

  private deleteObjects(input: DeleteObjectsCommand["input"]) {
    for (const { Key } of input.Delete?.Objects ?? []) {
      if (Key) this.objects.delete(Key);
    }
    return {};
  }

  private copy(input: CopyObjectCommand["input"]) {
    const source = decodeURIComponent((input.CopySource ?? "").replace(/^[^/]+\//u, ""));
    const object = this.objects.get(source);
    if (!object) throw s3Error("NoSuchKey", 404);
    this.put(input.Key ?? "", object.body, object.contentType);
    return {};
  }
}
