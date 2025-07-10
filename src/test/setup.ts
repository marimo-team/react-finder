import "@testing-library/jest-dom/vitest";

// jsdom lacks a few layout APIs that react-aria-components touches.
if (globalThis.ResizeObserver === undefined) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (typeof Element !== "undefined" && typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * The stub's shape, declared without referencing `MediaQueryList` so the legacy
 * `addListener`/`removeListener` aliases (which react-aria feature-detects) can
 * stay without resolving to the deprecated DOM declarations.
 */
interface MediaQueryListStub {
  matches: boolean;
  media: string;
  onchange: null;
  addListener: () => void;
  removeListener: () => void;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
}

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  const noop = () => {};
  window.matchMedia = (query: string): MediaQueryList => {
    const stub: MediaQueryListStub = {
      matches: false,
      media: query,
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    };
    // Widened through `unknown`: the stub covers only what the tests touch.
    const opaque: unknown = stub;
    return opaque as MediaQueryList;
  };
}
