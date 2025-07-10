import { FinderError } from "../../core/errors.js";
import type { FileItem, FileSystemAdapter, ListResult } from "../../core/types.js";

export interface ControlledCall {
  method: string;
  args: unknown[];
  signal: AbortSignal | undefined;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface ControlledAdapter {
  adapter: FileSystemAdapter;
  calls: ControlledCall[];
  /** Calls not yet settled. */
  pending(method?: string): ControlledCall[];
  /** Resolve the oldest pending call for `method`. */
  resolveNext(method: string, value?: unknown): ControlledCall;
  rejectNext(method: string, error: Error): ControlledCall;
  /** Emit a watch event to subscribers. */
  emitChange(path: string): void;
}

const METHODS = [
  "list",
  "stat",
  "createDirectory",
  "createFile",
  "delete",
  "move",
  "copy",
  "readFile",
  "writeFile",
  "search",
] as const;

/**
 * An adapter whose every call returns a promise you settle by hand, so tests
 * can resolve responses out of order and assert abort behavior.
 */
export function createControlledAdapter(
  options: { methods?: readonly string[]; watch?: boolean } = {},
): ControlledAdapter {
  const calls: ControlledCall[] = [];
  const settled = new WeakSet<ControlledCall>();
  const watchers = new Set<(e: { type: "changed"; path: string }) => void>();
  const enabled = new Set(options.methods ?? METHODS);

  const adapter: Record<string, unknown> = {};
  for (const method of METHODS) {
    if (!enabled.has(method)) continue;
    adapter[method] = (...args: unknown[]) =>
      new Promise((resolve, reject) => {
        const last = args.at(-1);
        const signal =
          typeof last === "object" && last !== null && "signal" in last
            ? (last as { signal?: AbortSignal }).signal
            : undefined;
        const call: ControlledCall = {
          method,
          args,
          signal,
          resolve: (value) => {
            settled.add(call);
            resolve(value);
          },
          reject: (error) => {
            settled.add(call);
            reject(error);
          },
        };
        if (signal?.aborted) {
          call.reject(new FinderError("aborted", "aborted"));
          return;
        }
        signal?.addEventListener("abort", () => {
          call.reject(new FinderError("aborted", "aborted"));
        });
        calls.push(call);
      });
  }
  if (options.watch !== false) {
    adapter.watch = (cb: (e: { type: "changed"; path: string }) => void) => {
      watchers.add(cb);
      return () => watchers.delete(cb);
    };
  }

  const pending = (method?: string) =>
    calls.filter((c) => !settled.has(c) && (!method || c.method === method));

  return {
    adapter: adapter as unknown as FileSystemAdapter,
    calls,
    pending,
    resolveNext: (method, value) => {
      const call = pending(method)[0];
      if (!call) throw new Error(`No pending ${method} call`);
      call.resolve(value);
      return call;
    },
    rejectNext: (method, error) => {
      const call = pending(method)[0];
      if (!call) throw new Error(`No pending ${method} call`);
      call.reject(error);
      return call;
    },
    emitChange: (path) => {
      for (const cb of watchers) cb({ type: "changed", path });
    },
  };
}

export const file = (path: string, extra: Partial<FileItem> = {}): FileItem => ({
  path,
  name: path.slice(path.lastIndexOf("/") + 1),
  kind: "file",
  ...extra,
});

export const dir = (path: string, extra: Partial<FileItem> = {}): FileItem => ({
  path,
  name: path.slice(path.lastIndexOf("/") + 1),
  kind: "directory",
  ...extra,
});

export const listing = (...items: FileItem[]): ListResult => ({ items });

/** Let pending microtasks run. */
export const flush = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
