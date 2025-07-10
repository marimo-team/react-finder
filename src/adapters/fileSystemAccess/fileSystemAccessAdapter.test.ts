import { describe, expect, it } from "vite-plus/test";

import { getCapabilities } from "../../core/capabilities.js";
import { FinderError } from "../../core/errors.js";
import { CONTRACT_SEED, describeAdapterContract } from "../testing/adapterContract.js";
import { fakeDirectoryFromSeed } from "../testing/fakeFileSystemAccess.js";
import { FileSystemAccessAdapter } from "./fileSystemAccessAdapter.js";

const make = (options = {}) =>
  new FileSystemAccessAdapter({
    root: fakeDirectoryFromSeed(CONTRACT_SEED, options) as unknown as FileSystemDirectoryHandle,
  });

describeAdapterContract("FileSystemAccessAdapter (copy+delete move)", {
  create: () => make(),
});

describeAdapterContract("FileSystemAccessAdapter (native move)", {
  create: () => make({ supportsMove: true }),
});

describe("FileSystemAccessAdapter", () => {
  it("reports capabilities and honours readOnly", () => {
    expect(getCapabilities(make())).toMatchObject({ move: true });
    const ro = new FileSystemAccessAdapter({
      root: fakeDirectoryFromSeed(CONTRACT_SEED) as unknown as FileSystemDirectoryHandle,
      readOnly: true,
    });
    expect(getCapabilities(ro)).toMatchObject({
      delete: false,
      writeFile: false,
      readFile: true,
    });
  });

  it("requests permission once and fails with `permission` when denied", async () => {
    const root = fakeDirectoryFromSeed(CONTRACT_SEED, { permission: "denied" });
    const adapter = new FileSystemAccessAdapter({
      root: root as unknown as FileSystemDirectoryHandle,
    });
    await expect(adapter.list("/")).rejects.toSatisfy((e) => FinderError.is(e, "permission"));
    expect(root.requested).toBe(1);
  });

  it("maps a missing parent to not_found", async () => {
    await expect(make().createDirectory("/nope/x")).rejects.toSatisfy((e) =>
      FinderError.is(e, "not_found"),
    );
  });

  it("isSupported is false outside a browser", () => {
    expect(FileSystemAccessAdapter.isSupported()).toBe(false);
  });
});
