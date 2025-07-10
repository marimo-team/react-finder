import { describe, expect, it } from "vite-plus/test";

import { MemoryAdapter } from "../adapters/memory/memoryAdapter.js";
import { DEFAULT_CONFIG } from "../components/contexts.js";
import type { FinderConfig } from "../components/contexts.js";
import { createFinderStore } from "../core/store/createFinderStore.js";
import { actionTargets, finderActions } from "./actions.js";

const flush = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

async function setup(config: Partial<FinderConfig> = {}) {
  const store = createFinderStore({
    adapter: new MemoryAdapter({
      seed: { docs: { "a.md": "a" }, "notes.txt": "n" },
    }),
  });
  await flush();
  return { store, config: { ...DEFAULT_CONFIG, ...config } };
}

describe("actionTargets", () => {
  it("prefers an unselected context target, otherwise the selection", async () => {
    const { store } = await setup();
    const state = store.getState();
    expect(actionTargets(state, {})).toEqual([]);
    expect(actionTargets(state, { targetPath: "/docs" })).toEqual(["/docs"]);
    state.setSelection(["/notes.txt", "/docs"]);
    expect(actionTargets(store.getState(), { targetPath: "/docs" }).sort()).toEqual([
      "/docs",
      "/notes.txt",
    ]);
    expect(actionTargets(store.getState(), { targetPath: "/other" })).toEqual(["/other"]);
  });
});

describe("finderActions.isEnabled", () => {
  it("reflects history, selection and capabilities", async () => {
    const { store, config } = await setup();
    const s = () => store.getState();
    expect(finderActions.back.isEnabled(s(), config, {})).toBe(false);
    expect(finderActions.up.isEnabled(s(), config, {})).toBe(false);
    expect(finderActions.rename.isEnabled(s(), config, {})).toBe(false);
    expect(finderActions.delete.isEnabled(s(), config, {})).toBe(false);
    expect(finderActions.paste.isEnabled(s(), config, {})).toBe(false);
    expect(finderActions.newFolder.isEnabled(s(), config, {})).toBe(true);
    expect(finderActions.selectAll.isEnabled(s(), config, {})).toBe(true);

    s().setSelection(["/notes.txt"]);
    expect(finderActions.rename.isEnabled(s(), config, {})).toBe(true);
    expect(finderActions.delete.isEnabled(s(), config, {})).toBe(true);
    expect(finderActions.open.isEnabled(s(), config, {})).toBe(false); // file, no onOpen
    expect(finderActions.open.isEnabled(s(), { ...config, onOpen: () => {} }, {})).toBe(true);

    s().setSelection(["/notes.txt", "/docs"]);
    expect(finderActions.rename.isEnabled(s(), config, {})).toBe(false);

    s().copyToClipboard(["/notes.txt"]);
    expect(finderActions.paste.isEnabled(s(), config, {})).toBe(true);
  });

  it("selectAll is disabled in single selection mode", async () => {
    const { store, config } = await setup({ selectionMode: "single" });
    expect(finderActions.selectAll.isEnabled(store.getState(), config, {})).toBe(false);
  });
});

describe("finderActions.run", () => {
  it("open navigates into directories and opens files", async () => {
    const opened: string[] = [];
    const { store, config } = await setup({
      onOpen: (item) => {
        opened.push(item.path);
      },
    });
    await finderActions.open.run(store, config, { targetPath: "/docs" });
    expect(store.getState().currentPath).toBe("/docs");
    await finderActions.up.run(store, config, {});
    expect(store.getState().currentPath).toBe("/");
    await finderActions.open.run(store, config, { targetPath: "/notes.txt" });
    expect(opened).toEqual(["/notes.txt"]);
  });

  it("newFolder creates, selects and starts editing", async () => {
    const { store, config } = await setup();
    await finderActions.newFolder.run(store, config, {});
    const state = store.getState();
    expect(state.editingPath).toBe("/untitled folder");
    expect([...state.selectedPaths]).toEqual(["/untitled folder"]);
  });

  it("loadMore follows the listing cursor", async () => {
    const store = createFinderStore({
      adapter: new MemoryAdapter({
        seed: { "a.txt": "", "b.txt": "", "c.txt": "" },
        pageSize: 2,
      }),
    });
    await flush();
    const config = DEFAULT_CONFIG;
    expect(finderActions.loadMore.isEnabled(store.getState(), config, {})).toBe(true);
    await finderActions.loadMore.run(store, config, {});
    await flush();
    expect(finderActions.loadMore.isEnabled(store.getState(), config, {})).toBe(false);
    expect(store.getState().cache.default?.directories["/"]?.paths).toHaveLength(3);
  });

  it("paste into a directory target", async () => {
    const { store, config } = await setup();
    store.getState().copyToClipboard(["/notes.txt"]);
    await finderActions.paste.run(store, config, { targetPath: "/docs" });
    await flush();
    const adapter = store.getState().locations[0]?.adapter;
    expect((await adapter?.list("/docs"))?.items.map((i) => i.name).sort()).toEqual([
      "a.md",
      "notes.txt",
    ]);
  });
});
