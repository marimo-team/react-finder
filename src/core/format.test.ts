import { describe, expect, it } from "vite-plus/test";

import { formatDate, formatFileSize } from "./format.js";

describe("formatFileSize", () => {
  it("formats units", () => {
    expect(formatFileSize()).toBe("-");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 * 1024, { decimals: 0 })).toBe("5 MB");
  });
});

describe("formatDate", () => {
  it("formats with Intl and falls back", () => {
    expect(formatDate()).toBe("-");
    expect(
      formatDate(Date.UTC(2024, 0, 15), {
        locale: "en-US",
        format: { dateStyle: "short", timeZone: "UTC" },
      }),
    ).toBe("1/15/24");
  });
});
