import type {
  DirectoryDropItem,
  DropItem,
  DropOperation,
  FileDropItem,
} from "react-aria-components";

import { dirname, isSameOrAncestor } from "../core/path.js";
import type { FileItem } from "../core/types.js";

/** One dragged item: a map of MIME type to serialized data (matches react-aria's DragItem). */
export type DragItem = Record<string, string>;

/** MIME type carrying react-finder's own drag payload. */
export const FINDER_DRAG_TYPE = "application/x-react-finder+json";

export interface FinderDragPayload {
  finderId: string;
  locationId: string;
  path: string;
}

export function serializeDragItems(
  origin: { finderId: string; locationId: string },
  items: FileItem[],
): DragItem[] {
  return items.map((item) => ({
    [FINDER_DRAG_TYPE]: JSON.stringify({ ...origin, path: item.path }),
    "text/plain": item.path,
  }));
}

export interface ParsedDrop {
  internal: FinderDragPayload[];
  files: FileDropItem[];
  directories: DirectoryDropItem[];
}

export async function parseDropItems(items: DropItem[]): Promise<ParsedDrop> {
  const parsed: ParsedDrop = { internal: [], files: [], directories: [] };
  for (const item of items) {
    if (item.kind === "text") {
      if (item.types.has(FINDER_DRAG_TYPE)) {
        try {
          parsed.internal.push(
            JSON.parse(await item.getText(FINDER_DRAG_TYPE)) as FinderDragPayload,
          );
        } catch {
          // Malformed payload from another app: ignore.
        }
      }
    } else if (item.kind === "file") {
      parsed.files.push(item);
    } else if (item.kind === "directory") {
      parsed.directories.push(item);
    }
  }
  return parsed;
}

/** Flatten dropped files and directories into `File`s (directory contents are recursed). */
export async function collectDroppedFiles(parsed: ParsedDrop): Promise<File[]> {
  const files: File[] = [];
  for (const item of parsed.files) {
    files.push(await item.getFile());
  }
  const walk = async (directory: DirectoryDropItem) => {
    for await (const entry of directory.getEntries()) {
      if (entry.kind === "file") files.push(await entry.getFile());
      else await walk(entry);
    }
  };
  for (const directory of parsed.directories) {
    await walk(directory);
  }
  return files;
}

export interface DragTypesLike {
  has(type: string | symbol): boolean;
}

export interface ResolveDropArgs {
  /** Directory the drop would land in, or null when the target is not a directory. */
  targetPath: string | null;
  /** Paths being dragged when known (collections know; drop zones do not). */
  draggedPaths?: string[];
  types: DragTypesLike;
  allowedOperations: DropOperation[];
  /** Operation to use when the modifier keys do not force one. */
  preferred: "move" | "copy";
  acceptExternal: boolean;
}

function pick(allowed: DropOperation[], preferred: DropOperation): DropOperation {
  if (allowed.includes(preferred)) return preferred;
  return allowed.find((op) => op !== "cancel" && op !== "link") ?? "cancel";
}

/** Decide the drop operation for a target. Pure; unit-tested. */
export function resolveDropOperation(args: ResolveDropArgs): DropOperation {
  if (args.targetPath === null) return "cancel";
  if (args.types.has(FINDER_DRAG_TYPE)) {
    const target = args.targetPath;
    for (const path of args.draggedPaths ?? []) {
      if (isSameOrAncestor(path, target)) return "cancel";
      if (args.preferred === "move" && dirname(path) === target) return "cancel";
    }
    return pick(args.allowedOperations, args.preferred);
  }
  if (!args.acceptExternal) return "cancel";
  return pick(args.allowedOperations, "copy");
}
