import { mapWithConcurrency } from "../concurrency.js";
import { FinderError, toFinderError } from "../errors.js";
import { uniqueName, validateName } from "../naming.js";
import { basename, dirname, joinPath, normalizePath } from "../path.js";
import type { CapabilityName, FileItem, RequestOptions } from "../types.js";
import type { CacheActions } from "./cache.js";
import { adapterFor, cacheFor } from "./context.js";
import type { GetState, OperationResult, SetState, StoreContext } from "./context.js";
import { createDraft, insertEntry, isCircular, moveSubtrees, removeSubtrees } from "./draft.js";
import type { Draft } from "./draft.js";
import type { FinderState, OperationType } from "./state.js";

export interface OperationActions {
  createFile(opts?: { parent?: string; name?: string; content?: Blob | string }): Promise<FileItem>;
  createDirectory(opts?: { parent?: string; name?: string }): Promise<FileItem>;
  rename(path: string, newName: string): Promise<FileItem>;
  move(paths: string[], toDir: string): Promise<OperationResult>;
  copy(paths: string[], toDir: string): Promise<OperationResult>;
  deleteItems(paths: string[]): Promise<OperationResult>;
  writeFile(path: string, data: Blob | string): Promise<FileItem>;
  upload(files: File[], toDir?: string): Promise<OperationResult>;
  readFile(path: string, opts?: RequestOptions): Promise<Blob>;
  clearError(): void;
}

interface Fulfilled<T> {
  target: string;
  value: T;
}

interface OperationSpec<T> {
  type: OperationType;
  capability: CapabilityName;
  targets: string[];
  /** Resolve to `undefined` to skip the adapter call (success with no cache patch). */
  run: (target: string, signal: AbortSignal) => Promise<T | undefined> | undefined;
  /** Patch the cache with every successful result at once. */
  apply: (fulfilled: Fulfilled<T>[], draft: Draft) => void;
  /** Directories whose listings changed and should be revalidated. */
  affected: (fulfilled: Fulfilled<T>[]) => string[];
}

function namesIn(state: FinderState, dir: string): string[] {
  return (cacheFor(state).directories[dir]?.paths ?? []).map(basename);
}

const insertAll = (fulfilled: Fulfilled<FileItem>[], draft: Draft) => {
  for (const { value } of fulfilled) insertEntry(draft, value);
};

const parentsOf = (fulfilled: Fulfilled<FileItem>[]) =>
  fulfilled.map(({ value }) => dirname(value.path));

export function createOperationActions(
  set: SetState,
  get: GetState,
  ctx: StoreContext,
  cache: CacheActions,
): OperationActions {
  async function runOperation<T>(spec: OperationSpec<T>): Promise<OperationResult> {
    const state = get();
    if (!state.capabilities[spec.capability]) {
      throw new FinderError("unsupported", `The current adapter does not support "${spec.type}"`);
    }
    const locationId = state.currentLocationId;
    const id = `op-${++ctx.opSeq}`;
    const controller = new AbortController();
    set((s) => ({
      pendingOperations: {
        ...s.pendingOperations,
        [id]: { type: spec.type, paths: spec.targets, startedAt: Date.now() },
      },
    }));

    const settled = await mapWithConcurrency(
      spec.targets,
      ctx.options.concurrency,
      async (target) => spec.run(target, controller.signal),
    );

    const result: OperationResult = { ok: [], failed: [] };
    const fulfilled: Fulfilled<T>[] = [];
    for (const [index, outcome] of settled.entries()) {
      const target = spec.targets[index] as string;
      if (outcome.status === "fulfilled") {
        result.ok.push(target);
        if (outcome.value !== undefined) {
          fulfilled.push({ target, value: outcome.value });
        }
      } else {
        result.failed.push({
          path: target,
          error: toFinderError(outcome.reason, target),
        });
      }
    }

    set((s) => {
      const draft = createDraft(
        cacheFor(s, locationId),
        s.selectedPaths,
        s.expandedPaths,
        s.editingPath,
      );
      spec.apply(fulfilled, draft);
      const { [id]: _done, ...pendingOperations } = s.pendingOperations;
      return {
        cache: {
          ...s.cache,
          [locationId]: {
            entries: draft.entries,
            directories: draft.directories,
          },
        },
        selectedPaths: draft.selectedPaths,
        expandedPaths: draft.expandedPaths,
        editingPath: draft.editingPath,
        pendingOperations,
        lastError: result.failed[0]?.error ?? s.lastError,
      };
    });

    const dirty = new Set([...spec.affected(fulfilled), ...ctx.deferredInvalidations]);
    ctx.deferredInvalidations.clear();
    if (get().currentLocationId === locationId) {
      if (Object.keys(get().pendingOperations).length === 0) {
        cache.invalidate([...dirty]);
      } else {
        for (const path of dirty) ctx.deferredInvalidations.add(path);
      }
    }

    const firstError = result.failed[0]?.error;
    if (firstError) ctx.options.onError?.(firstError);
    ctx.options.onOperation?.({
      type: spec.type,
      locationId,
      targets: spec.targets,
      result,
    });
    return result;
  }

  /** Run a single-target operation and return its item, throwing on failure. */
  async function single(spec: OperationSpec<FileItem>): Promise<FileItem> {
    let produced: FileItem | undefined;
    const result = await runOperation<FileItem>({
      ...spec,
      apply: (fulfilled, draft) => {
        produced = fulfilled[0]?.value;
        spec.apply(fulfilled, draft);
      },
    });
    const failure = result.failed[0];
    if (failure) throw failure.error;
    if (!produced) {
      throw new FinderError("unknown", "Operation produced no result");
    }
    return produced;
  }

  const create = (
    type: "createFile" | "createDirectory",
    parent: string | undefined,
    name: string | undefined,
    defaultName: string,
    run: (path: string, signal: AbortSignal) => Promise<FileItem> | undefined,
  ): Promise<FileItem> => {
    const dir = normalizePath(parent ?? get().currentPath);
    const finalName = name ?? uniqueName(defaultName, namesIn(get(), dir));
    const invalid = validateName(finalName);
    if (invalid) return Promise.reject(new FinderError("unknown", invalid));
    return single({
      type,
      capability: type,
      targets: [joinPath(dir, finalName)],
      run,
      apply: insertAll,
      affected: () => [dir],
    });
  };

  return {
    createFile: ({ parent, name, content } = {}) =>
      create("createFile", parent, name, "untitled.txt", (path, signal) =>
        adapterFor(get()).createFile?.(path, { content, signal }),
      ),

    createDirectory: ({ parent, name } = {}) =>
      create("createDirectory", parent, name, "untitled folder", (path, signal) =>
        adapterFor(get()).createDirectory?.(path, { signal }),
      ),

    rename: (path, newName) => {
      const source = normalizePath(path);
      const invalid = validateName(newName);
      if (invalid) return Promise.reject(new FinderError("unknown", invalid));
      const existing = cacheFor(get()).entries[source];
      if (basename(source) === newName && existing) {
        return Promise.resolve(existing);
      }
      const target = joinPath(dirname(source), newName);
      return single({
        type: "rename",
        capability: "move",
        targets: [source],
        run: (from, signal) => adapterFor(get()).move?.(from, target, { signal }),
        apply: (fulfilled, draft) => {
          moveSubtrees(draft, new Map(fulfilled.map((f) => [f.target, f.value])));
        },
        affected: () => [dirname(source)],
      });
    },

    move: (paths, toDir) => {
      const dest = normalizePath(toDir);
      return runOperation<FileItem>({
        type: "move",
        capability: "move",
        targets: paths.map(normalizePath),
        run: (from, signal): Promise<FileItem | undefined> | undefined => {
          // Already in the destination: nothing for the adapter to do.
          if (dirname(from) === dest) return undefined;
          if (isCircular(from, dest)) {
            return Promise.reject(
              new FinderError("unknown", `Cannot move ${from} into itself`, {
                path: from,
              }),
            );
          }
          return adapterFor(get()).move?.(from, joinPath(dest, basename(from)), {
            signal,
          });
        },
        apply: (fulfilled, draft) => {
          moveSubtrees(draft, new Map(fulfilled.map((f) => [f.target, f.value])));
        },
        affected: (fulfilled) => [
          ...fulfilled.map((f) => dirname(f.target)),
          ...(fulfilled.length > 0 ? [dest] : []),
        ],
      });
    },

    copy: (paths, toDir) => {
      const dest = normalizePath(toDir);
      const taken = new Set(namesIn(get(), dest));
      return runOperation<FileItem>({
        type: "copy",
        capability: "copy",
        targets: paths.map(normalizePath),
        run: (from, signal) => {
          if (isCircular(from, dest)) {
            return Promise.reject(
              new FinderError("unknown", `Cannot copy ${from} into itself`, {
                path: from,
              }),
            );
          }
          const name = uniqueName(basename(from), taken);
          taken.add(name);
          return adapterFor(get()).copy?.(from, joinPath(dest, name), {
            signal,
          });
        },
        apply: insertAll,
        affected: (fulfilled) => (fulfilled.length > 0 ? [dest] : []),
      });
    },

    deleteItems: (paths) =>
      runOperation<true>({
        type: "delete",
        capability: "delete",
        targets: paths.map(normalizePath),
        run: async (target, signal) => {
          await adapterFor(get()).delete?.(target, { signal });
          return true as const;
        },
        apply: (fulfilled, draft) => {
          removeSubtrees(
            draft,
            fulfilled.map((f) => f.target),
          );
        },
        affected: (fulfilled) => fulfilled.map((f) => dirname(f.target)),
      }),

    writeFile: (path, data) => {
      const target = normalizePath(path);
      return single({
        type: "writeFile",
        capability: "writeFile",
        targets: [target],
        run: (t, signal) => adapterFor(get()).writeFile?.(t, data, { signal }),
        apply: insertAll,
        affected: () => [dirname(target)],
      });
    },

    upload: (files, toDir) => {
      const dest = normalizePath(toDir ?? get().currentPath);
      const taken = new Set(namesIn(get(), dest));
      const byPath = new Map<string, File>();
      for (const file of files) {
        const name = uniqueName(file.name || "untitled", taken);
        taken.add(name);
        byPath.set(joinPath(dest, name), file);
      }
      return runOperation<FileItem>({
        type: "upload",
        capability: "writeFile",
        targets: [...byPath.keys()],
        run: (target, signal) =>
          adapterFor(get()).writeFile?.(target, byPath.get(target) as File, {
            signal,
          }),
        apply: insertAll,
        affected: parentsOf,
      });
    },

    readFile: (path, opts) => {
      const adapter = adapterFor(get());
      if (!adapter.readFile) {
        return Promise.reject(
          new FinderError("unsupported", "The current adapter cannot read files"),
        );
      }
      return adapter.readFile(normalizePath(path), opts);
    },

    clearError: () => {
      set({ lastError: null });
    },
  };
}
