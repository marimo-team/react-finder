import type { FileSystemAdapter } from "../core/types.js";

const MUTATING = ["createDirectory", "createFile", "delete", "move", "copy", "writeFile"] as const;

/**
 * A view of `adapter` without its mutating methods, so the store reports the
 * matching capabilities as unavailable. The underlying adapter is untouched.
 */
export function readOnlyAdapter(adapter: FileSystemAdapter): FileSystemAdapter {
  const view: FileSystemAdapter = {
    list: (path, opts) => adapter.list(path, opts),
  };
  if (adapter.stat) view.stat = (path, opts) => adapter.stat?.(path, opts) as never;
  if (adapter.readFile) view.readFile = (path, opts) => adapter.readFile?.(path, opts) as never;
  if (adapter.getDownloadUrl) {
    view.getDownloadUrl = (path, opts) => adapter.getDownloadUrl?.(path, opts) as never;
  }
  if (adapter.search) view.search = (query, opts) => adapter.search?.(query, opts) as never;
  if (adapter.watch) view.watch = (cb) => adapter.watch?.(cb) as never;
  if (adapter.dispose) view.dispose = () => adapter.dispose?.();
  return view;
}

/** Remove mutating methods from an adapter instance in place (for adapter constructors). */
export function stripMutations(adapter: object): void {
  const self = adapter as Record<string, unknown>;
  for (const method of MUTATING) self[method] = undefined;
}
