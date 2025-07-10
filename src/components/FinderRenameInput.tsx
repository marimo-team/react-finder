import { useContext, useEffect, useRef, useState } from "react";
import type { JSX, KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import { Input, TextField } from "react-aria-components";
import type { TextFieldProps } from "react-aria-components";

import { splitExtension } from "../core/naming.js";
import type { FileItem } from "../core/types.js";
import { useFinderStore } from "../hooks/useFinderStore.js";
import { ItemContext } from "./contexts.js";

export interface FinderRenameInputProps extends Omit<
  TextFieldProps,
  "value" | "defaultValue" | "onChange" | "children" | "onKeyDown"
> {
  /** Item to rename; defaults to the enclosing `Finder.Item`. */
  item?: FileItem;
  /** Select the whole name on focus instead of just the stem. */
  selectExtension?: boolean;
  /** Commit when focus leaves the input. Default true. */
  commitOnBlur?: boolean;
  /** Defaults to a react-aria `<Input />`. */
  children?: ReactNode;
  onCommit?: (name: string) => void;
  onCancel?: () => void;
}

const stop = (event: SyntheticEvent) => {
  event.stopPropagation();
};

/**
 * Inline rename field. Enter commits (via `store.rename`), Escape cancels,
 * blur commits by default. Keyboard and pointer events are stopped so the
 * enclosing collection does not treat them as navigation or selection.
 */
export function FinderRenameInput({
  item: itemProp,
  selectExtension = false,
  commitOnBlur = true,
  children,
  onCommit,
  onCancel,
  onBlur,
  ...props
}: FinderRenameInputProps): JSX.Element {
  const contextItem = useContext(ItemContext);
  const item = itemProp ?? contextItem;
  if (!item) {
    throw new Error("Finder.RenameInput needs an `item` or an enclosing Finder.Item");
  }
  const store = useFinderStore();
  const [value, setValue] = useState(item.name);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const input = wrapperRef.current?.querySelector("input");
    if (!input) return;
    input.focus();
    const end =
      selectExtension || item.kind === "directory"
        ? item.name.length
        : splitExtension(item.name).stem.length;
    input.setSelectionRange(0, end);
  }, [item.name, item.kind, selectExtension]);

  const finish = () => {
    if (done.current) return false;
    done.current = true;
    // Hand focus back to the row so keyboard navigation and shortcuts keep working.
    const row = wrapperRef.current?.closest<HTMLElement>("[data-path]");
    if (row) {
      requestAnimationFrame(() => {
        if (row.isConnected) row.focus();
      });
    }
    return true;
  };

  const cancel = () => {
    if (!finish()) return;
    store.getState().stopEditing();
    onCancel?.();
  };

  const commit = async () => {
    const name = value.trim();
    if (!name || name === item.name) {
      cancel();
      return;
    }
    if (!finish()) return;
    try {
      await store.getState().rename(item.path, name);
      onCommit?.(name);
    } catch {
      // Reported through the store's onError; keep the item in place.
    }
    store.getState().stopEditing();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancel();
      return;
    }
    if (event.key !== "Tab") event.stopPropagation();
  };

  return (
    // The wrapper is not interactive itself: it only keeps the field's events
    // from reaching the enclosing collection, so it stays out of the a11y tree.
    <div
      ref={wrapperRef}
      role="presentation"
      data-rename=""
      onKeyDown={handleKeyDown}
      onKeyUp={stop}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      style={{ display: "contents" }}
    >
      <TextField
        aria-label="Rename"
        value={value}
        onChange={setValue}
        onBlur={(event) => {
          onBlur?.(event);
          if (commitOnBlur) void commit();
        }}
        {...props}
      >
        {children ?? <Input />}
      </TextField>
    </div>
  );
}
