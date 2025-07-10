import { closestIn, dirname, isSameOrAncestor, rebasePath } from "../path.js";
import type { FileItem } from "../types.js";
import type { DirectoryState, LocationCache } from "./state.js";

/**
 * Mutable working copy of the parts of state an operation may patch. All
 * helpers are pure functions over this draft so they can be unit-tested
 * without a store.
 */
export interface Draft {
  entries: Record<string, FileItem>;
  directories: Record<string, DirectoryState>;
  selectedPaths: Set<string>;
  expandedPaths: Set<string>;
  editingPath: string | null;
}

export function createDraft(
  cache: LocationCache,
  selectedPaths: ReadonlySet<string>,
  expandedPaths: ReadonlySet<string>,
  editingPath: string | null,
): Draft {
  return {
    entries: { ...cache.entries },
    directories: { ...cache.directories },
    selectedPaths: new Set(selectedPaths),
    expandedPaths: new Set(expandedPaths),
    editingPath,
  };
}

/** Add or replace an entry and register it in its parent's listing if that is loaded. */
export function insertEntry(draft: Draft, item: FileItem): void {
  draft.entries[item.path] = item;
  const parent = dirname(item.path);
  const dir = draft.directories[parent];
  if (dir && dir.status !== "idle" && !dir.paths.includes(item.path)) {
    draft.directories[parent] = { ...dir, paths: [...dir.paths, item.path] };
  }
}

/**
 * Remove every entry, directory listing, selection and expansion under any of
 * `roots` (inclusive). One pass over the cache: O(entries * depth).
 */
export function removeSubtrees(draft: Draft, roots: Iterable<string>): void {
  const removed = new Set(roots);
  if (removed.size === 0) return;
  for (const key of Object.keys(draft.entries)) {
    if (closestIn(removed, key)) delete draft.entries[key];
  }
  for (const key of Object.keys(draft.directories)) {
    if (closestIn(removed, key)) delete draft.directories[key];
  }
  const byParent = new Map<string, Set<string>>();
  for (const root of removed) {
    const parent = dirname(root);
    let set = byParent.get(parent);
    if (!set) {
      set = new Set();
      byParent.set(parent, set);
    }
    set.add(root);
  }
  for (const [parent, gone] of byParent) {
    const dir = draft.directories[parent];
    if (dir?.paths.some((p) => gone.has(p))) {
      draft.directories[parent] = {
        ...dir,
        paths: dir.paths.filter((p) => !gone.has(p)),
      };
    }
  }
  for (const p of draft.selectedPaths) {
    if (closestIn(removed, p)) draft.selectedPaths.delete(p);
  }
  for (const p of draft.expandedPaths) {
    if (closestIn(removed, p)) draft.expandedPaths.delete(p);
  }
  if (draft.editingPath && closestIn(removed, draft.editingPath)) {
    draft.editingPath = null;
  }
}

/**
 * Rebase every cached path under each `from` to its new location. `moves`
 * maps old path -> the adapter's returned item at the new path. Selection and
 * expansion follow the moved items. One pass: O(entries * depth).
 */
export function moveSubtrees(draft: Draft, moves: ReadonlyMap<string, FileItem>): void {
  if (moves.size === 0) return;
  const rebase = (path: string): string | undefined => {
    const from = closestIn(moves, path);
    if (from === undefined) return undefined;
    return rebasePath(path, from, (moves.get(from) as FileItem).path);
  };

  const entries: Record<string, FileItem> = {};
  for (const [key, entry] of Object.entries(draft.entries)) {
    const to = rebase(key);
    if (to === undefined) {
      entries[key] = entry;
    } else if (!moves.has(key)) {
      entries[to] = {
        ...entry,
        path: to,
        name: to.slice(to.lastIndexOf("/") + 1),
      };
    }
  }
  for (const item of moves.values()) entries[item.path] = item;
  draft.entries = entries;

  const directories: Record<string, DirectoryState> = {};
  for (const [key, dir] of Object.entries(draft.directories)) {
    const to = rebase(key) ?? key;
    directories[to] = {
      ...dir,
      paths: dir.paths.filter((p) => !moves.has(p)).map((p) => rebase(p) ?? p),
    };
  }
  draft.directories = directories;

  for (const item of moves.values()) {
    const parent = dirname(item.path);
    const dir = draft.directories[parent];
    if (dir && dir.status !== "idle" && !dir.paths.includes(item.path)) {
      draft.directories[parent] = { ...dir, paths: [...dir.paths, item.path] };
    }
  }

  draft.selectedPaths = new Set([...draft.selectedPaths].map((p) => rebase(p) ?? p));
  draft.expandedPaths = new Set([...draft.expandedPaths].map((p) => rebase(p) ?? p));
  if (draft.editingPath) {
    const from = closestIn(moves, draft.editingPath);
    if (from !== undefined) draft.editingPath = null;
  }
}

/** True when moving/copying `source` into `targetDir` would nest it inside itself. */
export function isCircular(source: string, targetDir: string): boolean {
  return isSameOrAncestor(source, targetDir);
}
