import type React from "react";

import MinimalDemo from "./01-minimal.js";
import WithToolbarDemo from "./02-with-toolbar.js";
import GridViewDemo from "./03-grid-view.js";
import TableViewDemo from "./04-table-view.js";
import TreeViewDemo from "./05-tree-view.js";
import FilePickerDemo from "./06-file-picker.js";
import SearchDemo from "./07-search.js";
import MultiLocationDemo from "./08-multi-location.js";
import ContextMenuDemo from "./09-context-menu.js";
import DragAndDropDemo from "./10-drag-and-drop.js";
import KitchenSinkDemo from "./11-kitchen-sink.js";

export interface DemoEntry {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType;
}

export const demos: DemoEntry[] = [
  {
    id: "minimal",
    title: "Minimal",
    description: "Simplest possible usage",
    component: MinimalDemo,
  },
  {
    id: "with-toolbar",
    title: "Toolbar",
    description: "Actions, breadcrumbs, rename, confirm dialog",
    component: WithToolbarDemo,
  },
  {
    id: "grid-view",
    title: "Grid view",
    description: "Virtualized gallery layout",
    component: GridViewDemo,
  },
  {
    id: "table-view",
    title: "Table view",
    description: "Sortable columns",
    component: TableViewDemo,
  },
  {
    id: "tree-view",
    title: "Tree sidebar",
    description: "Lazy tree + list, drag between them",
    component: TreeViewDemo,
  },
  {
    id: "file-picker",
    title: "File picker",
    description: "Single-select dialog pattern",
    component: FilePickerDemo,
  },
  {
    id: "search",
    title: "Search",
    description: "Adapter search with debounce",
    component: SearchDemo,
  },
  {
    id: "multi-location",
    title: "Locations",
    description: "Memory, session storage, local folder",
    component: MultiLocationDemo,
  },
  {
    id: "context-menu",
    title: "Context menu",
    description: "Right-click actions + preview",
    component: ContextMenuDemo,
  },
  {
    id: "drag-and-drop",
    title: "Drag and drop",
    description: "Move, copy, upload, cross-finder",
    component: DragAndDropDemo,
  },
  {
    id: "kitchen-sink",
    title: "Kitchen sink",
    description: "Everything combined",
    component: KitchenSinkDemo,
  },
];
