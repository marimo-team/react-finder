import { describe, expect, it } from "vite-plus/test";

import { DEFAULT_SHORTCUTS, isEditableTarget, matchShortcut, mergeShortcuts } from "./shortcuts.js";

const key = (
  k: string,
  mods: Partial<{
    meta: boolean;
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
  }> = {},
) => ({
  key: k,
  metaKey: mods.meta ?? false,
  ctrlKey: mods.ctrl ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
});

describe("matchShortcut", () => {
  it("matches defaults with Mod meaning meta or ctrl", () => {
    expect(matchShortcut(key("Delete"), DEFAULT_SHORTCUTS)).toBe("delete");
    expect(matchShortcut(key("F2"), DEFAULT_SHORTCUTS)).toBe("rename");
    expect(matchShortcut(key("c", { meta: true }), DEFAULT_SHORTCUTS)).toBe("copy");
    expect(matchShortcut(key("C", { ctrl: true }), DEFAULT_SHORTCUTS)).toBe("copy");
    expect(matchShortcut(key("N", { meta: true, shift: true }), DEFAULT_SHORTCUTS)).toBe(
      "newFolder",
    );
    expect(matchShortcut(key("Backspace", { meta: true }), DEFAULT_SHORTCUTS)).toBe("delete");
    expect(matchShortcut(key("Backspace"), DEFAULT_SHORTCUTS)).toBe("up");
  });

  it("does not match when extra modifiers are held", () => {
    expect(matchShortcut(key("c"), DEFAULT_SHORTCUTS)).toBeNull();
    expect(matchShortcut(key("Delete", { shift: true }), DEFAULT_SHORTCUTS)).toBeNull();
  });
});

describe("mergeShortcuts", () => {
  it("overrides, disables and turns everything off", () => {
    const merged = mergeShortcuts({ delete: ["x"], rename: null });
    expect(merged.delete).toEqual(["x"]);
    expect(merged.rename).toEqual([]);
    expect(merged.copy).toEqual(DEFAULT_SHORTCUTS.copy);
    const off = mergeShortcuts(false);
    expect(Object.values(off).every((v) => v.length === 0)).toBe(true);
  });
});

describe("isEditableTarget", () => {
  it("detects inputs and contenteditable", () => {
    expect(isEditableTarget(null)).toBe(false);
    const input = {
      closest: (sel: string) => (sel.includes("input") ? {} : null),
    };
    expect(isEditableTarget(input as unknown as EventTarget)).toBe(true);
    const div = { closest: () => null };
    expect(isEditableTarget(div as unknown as EventTarget)).toBe(false);
  });
});
