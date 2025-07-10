import { FinderError } from "../../core/errors.js";
import {
  basename,
  dirname,
  isSameOrAncestor,
  joinPath,
  normalizePath,
  rebasePath,
} from "../../core/path.js";
import type { FileItem, Unsubscribe } from "../../core/types.js";

/** Nested object literal used to seed a VirtualFS: strings are file contents, objects are directories. */
export interface SeedTree {
  [name: string]: string | SeedTree;
}

export interface VfsSnapshot {
  v: 1;
  nodes: { item: FileItem; content?: string }[];
}

interface VfsNode {
  item: FileItem;
  content?: string;
}

export interface VirtualFSOptions {
  seed?: SeedTree;
  snapshot?: VfsSnapshot;
  /** Clock used for timestamps (tests). */
  now?: () => number;
}

const encoder = new TextEncoder();

/**
 * Synchronous in-memory filesystem with a parent -> children index, so lookups
 * never rely on string-prefix matching. Throws `FinderError`s.
 */
export class VirtualFS {
  private readonly nodes = new Map<string, VfsNode>();
  private readonly children = new Map<string, Set<string>>();
  private readonly listeners = new Set<(dirPath: string) => void>();
  private readonly now: () => number;

  constructor(options: VirtualFSOptions = {}) {
    this.now = options.now ?? (() => Date.now());
    this.addNode({ item: { path: "/", name: "", kind: "directory" } });
    if (options.snapshot) {
      this.loadSnapshot(options.snapshot);
    } else if (options.seed) {
      this.seed("/", options.seed);
    }
  }

  static fromJSON(
    json: string,
    options: Omit<VirtualFSOptions, "snapshot" | "seed"> = {},
  ): VirtualFS {
    const snapshot = JSON.parse(json) as VfsSnapshot;
    if (snapshot?.v !== 1 || !Array.isArray(snapshot.nodes)) {
      throw new FinderError("unknown", "Invalid VirtualFS snapshot");
    }
    return new VirtualFS({ ...options, snapshot });
  }

  toJSON(): VfsSnapshot {
    const nodes: VfsSnapshot["nodes"] = [];
    for (const [path, node] of this.nodes) {
      if (path === "/") continue;
      nodes.push(
        node.content === undefined
          ? { item: node.item }
          : { item: node.item, content: node.content },
      );
    }
    return { v: 1, nodes };
  }

  subscribe(listener: (dirPath: string) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get(path: string): FileItem | undefined {
    return this.nodes.get(normalizePath(path))?.item;
  }

  stat(path: string): FileItem {
    return this.require(path).item;
  }

  list(path: string): FileItem[] {
    const dir = this.require(path);
    if (dir.item.kind !== "directory") {
      throw new FinderError("not_found", `Not a directory: ${path}`, { path });
    }
    const names = this.children.get(dir.item.path) ?? new Set();
    const items: FileItem[] = [];
    for (const name of names) {
      const child = this.nodes.get(joinPath(dir.item.path, name));
      if (child) items.push(child.item);
    }
    return items;
  }

  createDirectory(path: string): FileItem {
    const target = normalizePath(path);
    this.assertCreatable(target);
    const item: FileItem = {
      path: target,
      name: basename(target),
      kind: "directory",
      modifiedAt: this.now(),
      createdAt: this.now(),
    };
    this.addNode({ item });
    this.emit(dirname(target));
    return item;
  }

  createFile(path: string, content = ""): FileItem {
    const target = normalizePath(path);
    this.assertCreatable(target);
    const item = this.makeFileItem(target, content);
    this.addNode({ item, content });
    this.emit(dirname(target));
    return item;
  }

  write(path: string, content: string): FileItem {
    const target = normalizePath(path);
    const existing = this.nodes.get(target);
    if (existing?.item.kind === "directory") {
      throw new FinderError("exists", `Is a directory: ${target}`, {
        path: target,
      });
    }
    if (!existing) {
      return this.createFile(target, content);
    }
    const item: FileItem = {
      ...existing.item,
      size: encoder.encode(content).byteLength,
      modifiedAt: this.now(),
    };
    this.nodes.set(target, { item, content });
    this.emit(dirname(target));
    return item;
  }

  read(path: string): string {
    const node = this.require(path);
    if (node.item.kind === "directory") {
      throw new FinderError("unknown", `Is a directory: ${path}`, { path });
    }
    return node.content ?? "";
  }

  delete(path: string): void {
    const target = normalizePath(path);
    if (target === "/") {
      throw new FinderError("permission", "Cannot delete the root directory", {
        path: target,
      });
    }
    this.require(target);
    for (const descendant of this.subtree(target)) {
      this.removeNode(descendant);
    }
    this.emit(dirname(target));
  }

  move(from: string, to: string): FileItem {
    const source = normalizePath(from);
    const target = normalizePath(to);
    const node = this.require(source);
    if (source === "/") {
      throw new FinderError("permission", "Cannot move the root directory", {
        path: source,
      });
    }
    if (isSameOrAncestor(source, target)) {
      throw new FinderError("unknown", `Cannot move ${source} into itself`, {
        path: source,
      });
    }
    this.assertCreatable(target);
    const moved: [string, VfsNode][] = [];
    for (const descendant of this.subtree(source)) {
      const existing = this.nodes.get(descendant) as VfsNode;
      moved.push([rebasePath(descendant, source, target), existing]);
      this.removeNode(descendant);
    }
    for (const [path, existing] of moved) {
      this.addNode({
        item: { ...existing.item, path, name: basename(path) },
        content: existing.content,
      });
    }
    const result = this.nodes.get(target) as VfsNode;
    result.item = { ...result.item, modifiedAt: this.now() };
    this.emit(dirname(source));
    if (dirname(target) !== dirname(source)) this.emit(dirname(target));
    return node.item.kind === "directory" ? result.item : result.item;
  }

  copy(from: string, to: string): FileItem {
    const source = normalizePath(from);
    const target = normalizePath(to);
    this.require(source);
    if (isSameOrAncestor(source, target)) {
      throw new FinderError("unknown", `Cannot copy ${source} into itself`, {
        path: source,
      });
    }
    this.assertCreatable(target);
    const copies: [string, VfsNode][] = [];
    for (const descendant of this.subtree(source)) {
      copies.push([rebasePath(descendant, source, target), this.nodes.get(descendant) as VfsNode]);
    }
    const timestamp = this.now();
    for (const [path, existing] of copies) {
      this.addNode({
        item: {
          ...existing.item,
          path,
          name: basename(path),
          createdAt: timestamp,
          modifiedAt: timestamp,
        },
        content: existing.content,
      });
    }
    this.emit(dirname(target));
    return (this.nodes.get(target) as VfsNode).item;
  }

  search(query: string, root = "/"): FileItem[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const base = normalizePath(root);
    const results: FileItem[] = [];
    for (const path of this.subtree(base)) {
      if (path === base) continue;
      const node = this.nodes.get(path) as VfsNode;
      if (node.item.name.toLowerCase().includes(needle)) {
        results.push(node.item);
      }
    }
    return results;
  }

  // ---- internals ---------------------------------------------------------

  private seed(base: string, tree: SeedTree) {
    for (const [name, value] of Object.entries(tree)) {
      const path = joinPath(base, name);
      if (typeof value === "string") {
        this.addNode({ item: this.makeFileItem(path, value), content: value });
      } else {
        this.addNode({
          item: {
            path,
            name,
            kind: "directory",
            modifiedAt: this.now(),
            createdAt: this.now(),
          },
        });
        this.seed(path, value);
      }
    }
  }

  private loadSnapshot(snapshot: VfsSnapshot) {
    const sorted = [...snapshot.nodes].sort((a, b) => a.item.path.length - b.item.path.length);
    for (const node of sorted) {
      const path = normalizePath(node.item.path);
      if (path === "/") continue;
      this.ensureParents(path);
      this.addNode({
        item: { ...node.item, path, name: basename(path) },
        content: node.content,
      });
    }
  }

  private ensureParents(path: string) {
    const parent = dirname(path);
    if (parent === "/" || this.nodes.has(parent)) return;
    this.ensureParents(parent);
    this.addNode({
      item: { path: parent, name: basename(parent), kind: "directory" },
    });
  }

  private makeFileItem(path: string, content: string): FileItem {
    return {
      path,
      name: basename(path),
      kind: "file",
      size: encoder.encode(content).byteLength,
      modifiedAt: this.now(),
      createdAt: this.now(),
    };
  }

  private require(path: string): VfsNode {
    const node = this.nodes.get(normalizePath(path));
    if (!node) {
      throw new FinderError("not_found", `Not found: ${path}`, { path });
    }
    return node;
  }

  private assertCreatable(target: string) {
    if (target === "/") {
      throw new FinderError("exists", "Root already exists", { path: target });
    }
    if (this.nodes.has(target)) {
      throw new FinderError("exists", `Already exists: ${target}`, {
        path: target,
      });
    }
    const parent = this.nodes.get(dirname(target));
    if (!parent) {
      throw new FinderError("not_found", `Parent directory not found: ${dirname(target)}`, {
        path: target,
      });
    }
    if (parent.item.kind !== "directory") {
      throw new FinderError("not_found", `Parent is not a directory: ${dirname(target)}`, {
        path: target,
      });
    }
  }

  private addNode(node: VfsNode) {
    const path = node.item.path;
    this.nodes.set(path, node);
    if (path !== "/") {
      const parent = dirname(path);
      let names = this.children.get(parent);
      if (!names) {
        names = new Set();
        this.children.set(parent, names);
      }
      names.add(node.item.name);
    }
    if (node.item.kind === "directory" && !this.children.has(path)) {
      this.children.set(path, new Set());
    }
  }

  private removeNode(path: string) {
    const node = this.nodes.get(path);
    if (!node) return;
    this.nodes.delete(path);
    this.children.delete(path);
    this.children.get(dirname(path))?.delete(node.item.name);
  }

  /** Depth-first list of `root` and all its descendants (children before parents for safe deletion). */
  private subtree(root: string): string[] {
    const result: string[] = [];
    const visit = (path: string) => {
      const names = this.children.get(path);
      if (names) {
        for (const name of names) visit(joinPath(path, name));
      }
      result.push(path);
    };
    visit(root);
    return result;
  }

  private emit(dirPath: string) {
    for (const listener of this.listeners) listener(dirPath);
  }
}
