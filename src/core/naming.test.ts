import { describe, expect, it } from "vite-plus/test";

import { splitExtension, uniqueName, validateName } from "./naming.js";

describe("splitExtension", () => {
  it("handles dotfiles and multi-dot names", () => {
    expect(splitExtension("a.txt")).toEqual({ stem: "a", ext: ".txt" });
    expect(splitExtension("a.tar.gz")).toEqual({ stem: "a.tar", ext: ".gz" });
    expect(splitExtension(".env")).toEqual({ stem: ".env", ext: "" });
    expect(splitExtension("README")).toEqual({ stem: "README", ext: "" });
  });
});

describe("uniqueName", () => {
  it("appends (n) before the extension", () => {
    expect(uniqueName("a.txt", [])).toBe("a.txt");
    expect(uniqueName("a.txt", ["/x/a.txt"])).toBe("a (1).txt");
    expect(uniqueName("a.txt", ["a.txt", "a (1).txt"])).toBe("a (2).txt");
    expect(uniqueName("a (1).txt", ["a (1).txt"])).toBe("a (2).txt");
    expect(uniqueName("dir", ["dir"])).toBe("dir (1)");
  });
});

describe("validateName", () => {
  it("rejects bad names", () => {
    expect(validateName("ok.txt")).toBeNull();
    expect(validateName("")).not.toBeNull();
    expect(validateName("a/b")).not.toBeNull();
    expect(validateName("..")).not.toBeNull();
    expect(validateName(" a")).not.toBeNull();
  });
});
