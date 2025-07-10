import { describe, expect, it } from "vite-plus/test";

import { FinderError, throwIfAborted, toFinderError } from "./errors.js";

describe("toFinderError", () => {
  it("passes FinderError through", () => {
    const err = new FinderError("exists", "x", { path: "/a" });
    expect(toFinderError(err)).toBe(err);
  });

  it("maps DOMException names", () => {
    expect(toFinderError(new DOMException("a", "AbortError")).code).toBe("aborted");
    expect(toFinderError(new DOMException("a", "NotFoundError")).code).toBe("not_found");
    expect(toFinderError(new DOMException("a", "NotAllowedError")).code).toBe("permission");
    expect(toFinderError(new DOMException("a", "SecurityError")).code).toBe("permission");
  });

  it("wraps unknown values", () => {
    const err = toFinderError("boom", "/p");
    expect(err.code).toBe("unknown");
    expect(err.path).toBe("/p");
    expect(FinderError.is(err)).toBe(true);
    expect(FinderError.is(err, "exists")).toBe(false);
  });
});

describe("throwIfAborted", () => {
  it("throws aborted for an aborted signal", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => {
      throwIfAborted(controller.signal);
    }).toThrow(FinderError);
    expect(() => {
      throwIfAborted();
    }).not.toThrow();
  });
});
