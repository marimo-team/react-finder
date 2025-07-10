/**
 * Every visual state below is driven by `data-*` attributes emitted by
 * react-finder / react-aria-components. No descendant selectors needed.
 */

export const panel =
  "border border-border rounded-lg flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white";

export const toolbar =
  "flex items-center gap-2 p-2 bg-muted/50 border border-border rounded-lg flex-wrap";

export const button =
  "px-3 py-1.5 text-sm border border-border rounded-md bg-white outline-none cursor-default " +
  "data-[hovered]:bg-accent data-[pressed]:bg-accent/80 " +
  "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-primary/40";

export const dangerButton = `${button} text-destructive`;

export const row =
  "flex items-center gap-3 px-4 py-2 border-b border-border/60 outline-none cursor-default select-none " +
  "data-[hovered]:bg-accent/60 data-[selected]:bg-primary/10 " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-primary/40 " +
  "data-[cut]:opacity-50 data-[dragging]:opacity-40 " +
  "data-[drop-target]:ring-2 data-[drop-target]:ring-inset data-[drop-target]:ring-primary";

export const gridCell =
  "flex flex-col items-center gap-2 p-3 rounded-lg border border-transparent text-center outline-none cursor-default select-none " +
  "data-[hovered]:bg-accent/60 data-[selected]:bg-primary/10 data-[selected]:border-primary/30 " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-primary/40 " +
  "data-[cut]:opacity-50 data-[dragging]:opacity-40 data-[drop-target]:ring-2 data-[drop-target]:ring-primary";

export const treeRow =
  "flex items-center gap-1 px-2 py-1 rounded outline-none cursor-default select-none " +
  "data-[hovered]:bg-accent/60 data-[selected]:bg-primary/10 " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-primary/40 " +
  "data-[drop-target]:ring-2 data-[drop-target]:ring-inset data-[drop-target]:ring-primary data-[dragging]:opacity-40";

export const chevron =
  "w-5 h-5 flex items-center justify-center rounded text-muted-foreground outline-none " +
  "data-[hovered]:bg-accent data-[focus-visible]:ring-2 data-[focus-visible]:ring-primary/40";

export const tableRow =
  "outline-none cursor-default select-none border-b border-border/60 " +
  "data-[hovered]:bg-accent/60 data-[selected]:bg-primary/10 " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-primary/40 " +
  "data-[cut]:opacity-50 data-[dragging]:opacity-40 data-[drop-target]:bg-primary/20";

export const column =
  "text-left px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30 outline-none cursor-default " +
  "data-[allows-sorting]:cursor-pointer data-[hovered]:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-primary/40 " +
  "data-[sort-direction=ascending]:after:content-['_↑'] data-[sort-direction=descending]:after:content-['_↓']";

export const cell =
  "px-4 py-2 text-sm outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-primary/40";

export const input =
  "w-full px-2 py-1 text-sm border border-border rounded-md bg-white outline-none " +
  "data-[focused]:ring-2 data-[focused]:ring-primary/40";

export const menu = "min-w-44 rounded-lg border border-border bg-white p-1 shadow-lg outline-none";

export const menuItem =
  "flex items-center justify-between gap-6 px-3 py-1.5 rounded text-sm outline-none cursor-default " +
  "data-[focused]:bg-accent data-[disabled]:opacity-40";

export const menuSeparator = "h-px bg-border my-1";

export const locationItem =
  "px-3 py-2 rounded-lg border border-transparent outline-none cursor-default select-none " +
  "data-[hovered]:bg-accent/50 data-[selected]:bg-primary/10 data-[selected]:border-primary/30 " +
  "data-[focus-visible]:ring-2 data-[focus-visible]:ring-primary/40";

export const dropZone =
  "rounded-lg border-2 border-dashed border-border transition-colors " +
  "data-[drop-target]:border-primary data-[drop-target]:bg-primary/5";

export const statusBar =
  "flex gap-4 px-3 py-2 text-xs text-muted-foreground bg-muted/30 border border-border rounded-md";

export const emptyState = "flex items-center justify-center h-32 text-sm text-muted-foreground";
