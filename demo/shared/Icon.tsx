import type { FileItem } from "@marimo-team/react-finder";
import type { ReactElement } from "react";

const BY_EXTENSION: Record<string, string> = {
  pdf: "📕",
  doc: "📘",
  docx: "📘",
  xls: "📗",
  xlsx: "📗",
  md: "📝",
  txt: "📄",
  json: "🧾",
  ts: "🟦",
  tsx: "🟦",
  js: "🟨",
  py: "🐍",
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  heic: "🖼️",
  gif: "🖼️",
  mp3: "🎵",
  flac: "🎵",
  wav: "🎵",
  mp4: "🎬",
  zip: "🗜️",
};

/** Icons are the consumer's business; the library only exposes `kind`, `name` and `mimeType`. */
export function iconFor(item: FileItem): string {
  if (item.kind === "directory") return "📁";
  const ext = item.name.slice(item.name.lastIndexOf(".") + 1).toLowerCase();
  return BY_EXTENSION[ext] ?? "📄";
}

export function Icon({
  item,
  className = "text-base leading-none",
}: {
  item: FileItem;
  className?: string;
}): ReactElement {
  return (
    <span aria-hidden="true" className={className}>
      {iconFor(item)}
    </span>
  );
}

/** Glyph for a tree row's expand chevron. */
export function chevronGlyph(isLoading: boolean, isExpanded: boolean): string {
  if (isLoading) return "…";
  return isExpanded ? "▾" : "▸";
}
