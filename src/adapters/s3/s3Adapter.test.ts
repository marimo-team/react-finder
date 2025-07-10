import { describe, expect, it } from "vite-plus/test";

import { getCapabilities } from "../../core/capabilities.js";
import { FinderError } from "../../core/errors.js";
import { CONTRACT_SEED, describeAdapterContract } from "../testing/adapterContract.js";
import { FakeS3 } from "../testing/fakeS3.js";
import { S3Adapter } from "./index.js";

function make(options: { prefix?: string; pageSize?: number; readOnly?: boolean } = {}) {
  const s3 = new FakeS3();
  s3.seed(CONTRACT_SEED, options.prefix ?? "");
  return {
    s3,
    adapter: new S3Adapter({
      client: s3.client,
      bucket: s3.bucket,
      readOnly: false,
      ...options,
    }),
  };
}

describeAdapterContract("S3Adapter", { create: () => make().adapter });
describeAdapterContract("S3Adapter (prefix + tiny pages)", {
  create: () => make({ prefix: "team/data", pageSize: 2 }).adapter,
});

describe("S3Adapter", () => {
  it("is read-only by default", () => {
    const s3 = new FakeS3();
    expect(getCapabilities(new S3Adapter({ client: s3.client, bucket: "b" }))).toMatchObject({
      readFile: true,
      delete: false,
      createFile: false,
    });
  });

  it("paginates listings with a continuation cursor", async () => {
    const { adapter, s3 } = make({ pageSize: 1 });
    const items = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await adapter.list("/docs", { cursor });
      items.push(...page.items);
      cursor = page.cursor;
      pages++;
    } while (cursor);
    expect(items.map((i) => i.name).sort()).toEqual(["nested", "readme.md"]);
    expect(pages).toBeGreaterThan(1);
    expect(s3.calls.filter((c) => c === "ListObjectsV2Command").length).toBeGreaterThanOrEqual(
      pages,
    );
  });

  it("stat distinguishes files, directories and missing keys", async () => {
    const { adapter } = make();
    expect((await adapter.stat("/docs")).kind).toBe("directory");
    expect((await adapter.stat("/notes.txt")).kind).toBe("file");
    await expect(adapter.stat("/nope")).rejects.toSatisfy((e) => FinderError.is(e, "not_found"));
  });

  it("does not treat /doc as existing because /docs/ does", async () => {
    const { adapter } = make();
    const created = await adapter.createDirectory("/doc");
    expect(created.path).toBe("/doc");
  });

  it("passes the abort signal to the client", async () => {
    const { adapter } = make();
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.readFile("/notes.txt", { signal: controller.signal })).rejects.toSatisfy(
      (e) => FinderError.is(e, "aborted"),
    );
  });
});
