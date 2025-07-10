import type { DropItem } from "react-aria-components";
import { describe, expect, it } from "vite-plus/test";

import {
  FINDER_DRAG_TYPE,
  parseDropItems,
  resolveDropOperation,
  serializeDragItems,
} from "./dragData.js";

const types = (...list: string[]) => ({
  has: (t: string | symbol) => list.includes(String(t)),
});

describe("serialize / parse", () => {
  it("round-trips the finder payload and ignores foreign text", async () => {
    const items = serializeDragItems({ finderId: "f1", locationId: "default" }, [
      { path: "/a.txt", name: "a.txt", kind: "file" },
    ]);
    expect(items[0]?.["text/plain"]).toBe("/a.txt");
    const dropItems: DropItem[] = [
      {
        kind: "text",
        types: new Set([FINDER_DRAG_TYPE, "text/plain"]),
        getText: async (type: string) => items[0]?.[type] ?? "",
      },
      {
        kind: "text",
        types: new Set(["text/plain"]),
        getText: async () => "hello",
      },
    ];
    const parsed = await parseDropItems(dropItems);
    expect(parsed.internal).toEqual([{ finderId: "f1", locationId: "default", path: "/a.txt" }]);
    expect(parsed.files).toEqual([]);
  });
});

describe("resolveDropOperation", () => {
  const base = {
    types: types(FINDER_DRAG_TYPE),
    allowedOperations: ["move", "copy", "link"] as const,
    preferred: "move" as const,
    acceptExternal: true,
  };

  it("moves by default, copies when only copy is allowed", () => {
    expect(
      resolveDropOperation({
        ...base,
        targetPath: "/dir",
        draggedPaths: ["/a"],
        allowedOperations: [...base.allowedOperations],
      }),
    ).toBe("move");
    expect(
      resolveDropOperation({
        ...base,
        targetPath: "/dir",
        draggedPaths: ["/a"],
        allowedOperations: ["copy"],
      }),
    ).toBe("copy");
  });

  it("cancels self, descendant and same-directory drops", () => {
    const allowed = [...base.allowedOperations];
    expect(
      resolveDropOperation({
        ...base,
        targetPath: "/a",
        draggedPaths: ["/a"],
        allowedOperations: allowed,
      }),
    ).toBe("cancel");
    expect(
      resolveDropOperation({
        ...base,
        targetPath: "/a/b",
        draggedPaths: ["/a"],
        allowedOperations: allowed,
      }),
    ).toBe("cancel");
    expect(
      resolveDropOperation({
        ...base,
        targetPath: "/",
        draggedPaths: ["/a"],
        allowedOperations: allowed,
      }),
    ).toBe("cancel");
    expect(
      resolveDropOperation({
        ...base,
        targetPath: null,
        draggedPaths: ["/a"],
        allowedOperations: allowed,
      }),
    ).toBe("cancel");
  });

  it("handles external files by acceptance", () => {
    const external = {
      ...base,
      types: types("image/png"),
      allowedOperations: ["move", "copy"] as ("move" | "copy")[],
    };
    expect(resolveDropOperation({ ...external, targetPath: "/dir" })).toBe("copy");
    expect(
      resolveDropOperation({
        ...external,
        targetPath: "/dir",
        acceptExternal: false,
      }),
    ).toBe("cancel");
  });
});
