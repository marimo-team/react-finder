import type { FinderActionName } from "../actions/actions.js";

/** Map of action -> key combos ("Mod+Shift+n", "Delete", "F2"). `null` disables an action's shortcut. */
export type ShortcutMap = Partial<Record<FinderActionName, string[] | null>>;

export const DEFAULT_SHORTCUTS: Record<FinderActionName, string[]> = {
  back: ["Alt+ArrowLeft"],
  forward: ["Alt+ArrowRight"],
  up: ["Mod+ArrowUp", "Backspace"],
  refresh: [],
  open: ["Mod+ArrowDown", "Mod+o"],
  newFile: [],
  newFolder: ["Mod+Shift+n"],
  rename: ["F2"],
  delete: ["Delete", "Mod+Backspace"],
  copy: ["Mod+c"],
  cut: ["Mod+x"],
  paste: ["Mod+v"],
  selectAll: [],
  clearSelection: [],
  loadMore: [],
};

export function mergeShortcuts(
  overrides: ShortcutMap | false | undefined,
): Record<FinderActionName, string[]> {
  if (overrides === false) {
    return Object.fromEntries(
      Object.keys(DEFAULT_SHORTCUTS).map((k) => [k, [] as string[]]),
    ) as unknown as Record<FinderActionName, string[]>;
  }
  const merged = { ...DEFAULT_SHORTCUTS };
  for (const [name, combos] of Object.entries(overrides ?? {})) {
    merged[name as FinderActionName] = combos ?? [];
  }
  return merged;
}

export interface KeyboardEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

interface ParsedCombo {
  key: string;
  mod: boolean;
  alt: boolean;
  shift: boolean;
}

const comboCache = new Map<string, ParsedCombo>();

function parseCombo(combo: string): ParsedCombo {
  let parsed = comboCache.get(combo);
  if (parsed) return parsed;
  const parts = combo.split("+");
  const key = parts.pop() ?? "";
  parsed = {
    key: key.length === 1 ? key.toLowerCase() : key,
    mod: parts.includes("Mod"),
    alt: parts.includes("Alt"),
    shift: parts.includes("Shift"),
  };
  comboCache.set(combo, parsed);
  return parsed;
}

function matchesCombo(event: KeyboardEventLike, combo: string): boolean {
  const parsed = parseCombo(combo);
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (key !== parsed.key) return false;
  const mod = event.metaKey || event.ctrlKey;
  return mod === parsed.mod && event.altKey === parsed.alt && event.shiftKey === parsed.shift;
}

/** Find the action bound to a keyboard event, or null. */
export function matchShortcut(
  event: KeyboardEventLike,
  shortcuts: Record<FinderActionName, string[]>,
): FinderActionName | null {
  for (const [name, combos] of Object.entries(shortcuts)) {
    for (const combo of combos) {
      if (matchesCombo(event, combo)) return name as FinderActionName;
    }
  }
  return null;
}

/** True for inputs, textareas, selects and contenteditable elements. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== "function") return false;
  const element = target as Element;
  return (
    element.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']") !==
    null
  );
}
