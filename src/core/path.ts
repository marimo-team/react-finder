/**
 * POSIX-style virtual paths. Every path handled by the library goes through
 * `normalizePath` so that string equality is identity equality.
 */
export function normalizePath(input: string): string {
  const segments: string[] = [];
  for (const segment of input.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

export function joinPath(base: string, ...parts: string[]): string {
  return normalizePath([base, ...parts].join("/"));
}

export function dirname(path: string): string {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? "/" : normalized.slice(0, index);
}

export function basename(path: string): string {
  const normalized = normalizePath(path);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function isRoot(path: string): boolean {
  return normalizePath(path) === "/";
}

/** True when `ancestor` is a strict ancestor directory of `path`. */
export function isAncestor(ancestor: string, path: string): boolean {
  const a = normalizePath(ancestor);
  const p = normalizePath(path);
  if (a === p) return false;
  return a === "/" ? true : p.startsWith(`${a}/`);
}

export function isSameOrAncestor(ancestor: string, path: string): boolean {
  return normalizePath(ancestor) === normalizePath(path) || isAncestor(ancestor, path);
}

/**
 * Find the closest of `path` itself or its ancestors that is in `roots`.
 * Walks up the path (O(depth)) instead of scanning `roots`, which keeps bulk
 * cache updates linear in the number of entries.
 */
export function closestIn(
  roots: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  path: string,
): string | undefined {
  let current = path;
  for (;;) {
    if (roots.has(current)) return current;
    if (current === "/") return undefined;
    const index = current.lastIndexOf("/");
    current = index <= 0 ? "/" : current.slice(0, index);
  }
}

/** Replace the `from` prefix of `path` with `to` (used when moving subtrees). */
export function rebasePath(path: string, from: string, to: string): string {
  const p = normalizePath(path);
  const f = normalizePath(from);
  if (p === f) return normalizePath(to);
  if (!isAncestor(f, p)) return p;
  const rest = f === "/" ? p : p.slice(f.length);
  return joinPath(to, rest);
}

/** Number of segments; `/` is 0, `/a` is 1. */
export function pathDepth(path: string): number {
  const normalized = normalizePath(path);
  return normalized === "/" ? 0 : normalized.split("/").length - 1;
}

/** Ancestor directories of `path`, from root to its parent. Empty for root. */
export function ancestorsOf(path: string): string[] {
  const normalized = normalizePath(path);
  if (normalized === "/") return [];
  const result: string[] = ["/"];
  const segments = normalized.split("/").slice(1, -1);
  let current = "";
  for (const segment of segments) {
    current += `/${segment}`;
    result.push(current);
  }
  return result;
}
